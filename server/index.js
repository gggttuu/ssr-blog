const path = require('path');
const express = require('express');
const compression = require('compression');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const childProcess = require('child_process');

dotenv.config();

const { renderApp } = require('./ssr');
const pool = require('./db');
const redis = require('./redis');
const articlesService = require('./services/articlesService');
const articlesRouter = require('./routes/articles');
const aiRouter = require('./ai');
const { authenticate, requireAdmin } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('etag', 'strong');

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(morgan('dev'));

app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    maxAge: '7d',
    etag: true
  })
);

// API 限流
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api', apiLimiter);

/* ---------- Auth ---------- */

// 注册（也可以直接用登录接口，登录会自动注册）
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码必填' });
  }
  try {
    const [rows] = await pool.query('SELECT COUNT(*) AS count FROM users');
    const isFirst = rows[0].count === 0;
    const hash = await bcrypt.hash(password, 10);
    const role = isFirst ? 'admin' : 'user';
    await pool.query(
      'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
      [username, hash, role]
    );
    res.status(201).json({ message: '注册成功', role });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '注册失败，用户名可能已存在' });
  }
});

// 登录：如果用户不存在则自动注册（第一个用户是 admin）
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ message: '用户名和密码必填' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    let user = rows[0];

    if (!user) {
      const [countRows] = await pool.query('SELECT COUNT(*) AS count FROM users');
      const isFirst = countRows[0].count === 0;
      const hash = await bcrypt.hash(password, 10);
      const role = isFirst ? 'admin' : 'user';
      const [result] = await pool.query(
        'INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)',
        [username, hash, role]
      );
      user = { id: result.insertId, username, password_hash: hash, role };
    } else {
      const ok = await bcrypt.compare(password, user.password_hash);
      if (!ok) {
        return res.status(401).json({ message: '密码错误' });
      }
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: '7d' }
    );
    res.json({
      token,
      user: { id: user.id, username: user.username, role: user.role }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: '登录失败' });
  }
});

app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

/* ---------- API: Articles & AI ---------- */

app.use('/api/articles', articlesRouter);
app.use('/api/ai', aiRouter);

/* ---------- 管理员数据库备份 ---------- */

app.post('/api/admin/backup', authenticate, requireAdmin, (req, res) => {
  const dbName = process.env.MYSQL_DATABASE || 'ssr_blog';
  const user = process.env.MYSQL_USER || 'blog_user';
  const password = process.env.MYSQL_PASSWORD || 'blog_password';
  const backupDir = path.join(__dirname, '..', 'backups');
  const filename = `${dbName}_${Date.now()}.sql`;
  const filepath = path.join(backupDir, filename);

  require('fs').mkdirSync(backupDir, { recursive: true });

  const cmd = `mysqldump -u${user} -p${password} ${dbName} > "${filepath}"`;
  childProcess.exec(cmd, (err) => {
    if (err) {
      console.error('backup error', err);
      return res
        .status(500)
        .json({ message: '备份失败，请确认服务器已安装 mysqldump 命令' });
    }
    res.json({ message: '备份成功', file: filename });
  });
});

/* ---------- SSR 路由（带降级） ---------- */

// 首页：文章列表 SSR
app.get('/', async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const tag = req.query.tag || '';
    const sort = req.query.sort || 'newest';

    const data = await articlesService.listArticles({ page, pageSize: 10, tag, sort });
    const tags = await articlesService.getTagCloud();

    const initialData = {
      page: 'home',
      articles: data.articles,
      pagination: { page: data.page, pageSize: data.pageSize, total: data.total },
      tagCloud: tags,
      filterTag: tag,
      sort,
      degraded: false
    };

    res.set('Cache-Control', 'no-cache');
    const html = renderApp(initialData);
    res.send(html);
  } catch (err) {
    console.error('SSR home error, degrade to CSR', err);
    const initialData = {
      page: 'home',
      articles: [],
      pagination: { page: 1, pageSize: 10, total: 0 },
      tagCloud: [],
      degraded: true
    };
    res.set('X-Degraded', '1');
    res.set('Cache-Control', 'no-cache');
    const html = renderApp(initialData);
    res.send(html);
  }
});

// 详情页 SSR
app.get('/article/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).send('Bad id');
  try {
    const article = await articlesService.getArticleById(id, { includeDraft: false });
    if (!article) {
      return res.status(404).send('文章不存在');
    }
    // 阅读量 +1（忽略错误）
    articlesService.incrementViews(id).catch((err) =>
      console.error('Increment views error', err)
    );
    const comments = await articlesService.getComments(id);
    const initialData = {
      page: 'detail',
      article,
      comments,
      articleId: id,
      degraded: false
    };
    res.set('Cache-Control', 'no-cache');
    const html = renderApp(initialData);
    res.send(html);
  } catch (err) {
    console.error('SSR detail error, degrade to CSR', err);
    const initialData = {
      page: 'detail',
      article: null,
      articleId: id,
      comments: [],
      degraded: true
    };
    res.set('X-Degraded', '1');
    res.set('Cache-Control', 'no-cache');
    const html = renderApp(initialData);
    res.send(html);
  }
});

// 后台 SSR
app.get('/admin', (req, res) => {
  const initialData = { page: 'admin', degraded: false };
  res.set('Cache-Control', 'no-cache');
  const html = renderApp(initialData);
  res.send(html);
});

// 其它路径重定向到首页
app.get('*', (req, res) => {
  res.redirect('/');
});

/* ---------- 全局错误处理 ---------- */

app.use((err, req, res, next) => {
  console.error('Unhandled error', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ message: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`SSR blog server listening on http://localhost:${PORT}`);
});
