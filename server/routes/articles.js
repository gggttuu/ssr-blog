const express = require('express');
const router = express.Router();
const articleService = require('../services/articlesService');
const redis = require('../redis');
const { authenticate, requireAdmin } = require('../auth');

const LIST_TTL = 60;
const DETAIL_TTL = 300;

async function invalidateArticleCache() {
  if (!redis.isOpen) return;
  try {
    const keys = await redis.keys('articles:*');
    if (keys.length) {
      await redis.del(keys);
    }
  } catch (err) {
    console.error('invalidate cache error', err);
  }
}

// 列表（带 Redis / 协商缓存）
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, pageSize = 10, tag = '', sort = 'newest' } = req.query;
    const cacheKey = `articles:list:${page}:${pageSize}:${tag}:${sort}`;
    if (redis.isOpen) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.set('X-Cache', 'HIT');
        res.set('Cache-Control', 'no-cache');
        return res.json(JSON.parse(cached));
      }
    }
    const data = await articleService.listArticles({ page, pageSize, tag, sort });
    if (redis.isOpen) {
      await redis.set(cacheKey, JSON.stringify(data), { EX: LIST_TTL });
    }
    res.set('X-Cache', redis.isOpen ? 'MISS' : 'SKIP');
    res.set('Cache-Control', 'no-cache');
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 后台列表
router.get('/admin', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const data = await articleService.listArticlesAdmin({
      page: req.query.page || 1,
      pageSize: req.query.pageSize || 50,
      status: req.query.status
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// 标签云
router.get('/tags', async (req, res, next) => {
  try {
    const cacheKey = 'articles:tags';
    if (redis.isOpen) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.set('X-Cache', 'HIT');
        return res.json({ tags: JSON.parse(cached) });
      }
    }
    const tags = await articleService.getTagCloud();
    if (redis.isOpen) {
      await redis.set(cacheKey, JSON.stringify(tags), { EX: DETAIL_TTL });
    }
    res.json({ tags });
  } catch (err) {
    next(err);
  }
});

// 详情
router.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid id' });
    const cacheKey = `articles:detail:${id}`;
    if (redis.isOpen) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        res.set('X-Cache', 'HIT');
        res.set('Cache-Control', 'no-cache');
        return res.json({ article: JSON.parse(cached) });
      }
    }
    const article = await articleService.getArticleById(id, { includeDraft: true });
    if (!article) return res.status(404).json({ message: '文章不存在' });
    if (redis.isOpen) {
      await redis.set(cacheKey, JSON.stringify(article), { EX: DETAIL_TTL });
    }
    res.set('X-Cache', redis.isOpen ? 'MISS' : 'SKIP');
    res.set('Cache-Control', 'no-cache');
    res.json({ article });
  } catch (err) {
    next(err);
  }
});

// 评论列表
router.get('/:id/comments', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid id' });
    const comments = await articleService.getComments(id);
    res.json({ comments });
  } catch (err) {
    next(err);
  }
});

// 发表评论
router.post('/:id/comments', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { authorName, content } = req.body || {};
    if (!id || !authorName || !content) {
      return res.status(400).json({ message: '参数不完整' });
    }
    await articleService.addComment(id, { authorName, content });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// 新增文章
router.post('/', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const { title, summary, content, tags, status } = req.body || {};
    if (!title || !content) {
      return res.status(400).json({ message: '标题和内容必填' });
    }
    const id = await articleService.createArticle({
      title,
      summary,
      content,
      tags,
      status,
      authorId: req.user.id
    });
    await invalidateArticleCache();
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
});

// 修改文章
router.put('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await articleService.updateArticle(id, req.body || {});
    await invalidateArticleCache();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// 删除文章（逻辑删除）
router.delete('/:id', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await articleService.deleteArticle(id);
    await invalidateArticleCache();
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
