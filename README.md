# SSR Blog - React + Express + MySQL + Redis 博客系统

> 一个基于 **React SSR + Express + MySQL + Redis** 的全栈博客系统，支持服务端渲染、文章 CRUD、评论、标签云、阅读统计、暗黑模式、AI 写作助手 等功能。

## 功能总览

### 1. SSR（服务端渲染）

- **文章列表页 SSR**
  - 服务端预取文章列表数据（标题 / 摘要 / 发布时间 / 作者 / 阅读量等）
  - 直接返回完整 HTML，首屏加载更快，更利于 SEO
- **文章详情页 SSR**
  - 根据文章 ID 服务端渲染完整内容（标题 / 正文 / 标签 / 阅读量 / 评论列表等）
  - 客户端接管后完成 hydration，支持交互（评论、切换主题等）
- **SSR 降级**
  - 当 MySQL / Redis 异常时，服务端返回基础 HTML 骨架
  - 客户端再通过 CSR（前端接口）请求数据，保证基础可用

### 2. 后端 API 能力（Express + MySQL）

- 文章列表查询（分页 / 排序 / 按标签筛选）
- 文章详情查询（按 ID）
- 文章新增（支持 Markdown 正文 / 标签 / 状态）
- 文章修改（标题 / 正文 / 标签 / 状态）
- 文章删除：逻辑删除 `is_deleted = 1`
- 评论接口：
  - 获取评论列表
  - 增加评论（游客评论，填写昵称 + 内容）
- 阅读量统计：
  - 文章详情接口自动 +1
  - 首页支持按阅读量排序

### 3. 数据库设计（MySQL）

> 默认数据库名：`ssr_blog`  
> 默认用户：`blog_user` / `blog_password`

主要表结构如下：

#### users

- `id`：主键
- `username`：用户名（唯一）
- `password_hash`：加密后的密码
- `role`：`admin` / `user`
- `created_at`：创建时间

#### articles

- `id`：主键
- `title`：标题
- `summary`：摘要
- `content`：正文（支持 Markdown）
- `tags`：标签字符串（如 `react, node, mysql`）
- `status`：`draft` / `published`
- `created_at` / `updated_at`：时间
- `author_id`：作者（外键关联 `users.id`）
- `views`：阅读量
- `is_deleted`：逻辑删除标记

#### comments

- `id`：主键
- `article_id`：所属文章（外键）
- `author_name`：评论昵称
- `content`：评论内容
- `created_at`：时间
- `is_deleted`：逻辑删除标记

### 4. 用户体系与权限

- 支持 **注册 / 登录**
- 使用 **JWT** 进行认证，token 保存在浏览器 `localStorage`
- 角色：
  - **admin**：可在后台创建 / 修改 / 删除文章
  - **user**：可以登录、评论（可根据需求扩展是否允许发文）

> 策略：**只有 admin 角色可以进行文章的增删改**。  
> 第一次注册的用户默认是 admin。

### 5. Redis 缓存优化

- 使用 Redis 缓存热点数据，减少 MySQL 压力：
  - 文章列表（首页）
  - 文章详情（高频访问文章）
- 缓存策略：
  - 读：优先查 Redis，未命中再查 MySQL 并写回缓存
  - 写（新建 / 修改 / 删除文章）：主动删除或刷新相关缓存 key，避免数据不一致
- 常用 key 设计：
  - `article:list:page=${page}&pageSize=${pageSize}&sort=${sort}&tag=${tag}`
  - `article:detail:${id}`

### 6. HTTP 缓存策略

- **静态资源**（`client.bundle.js`、`styles.css`、图片等）：
  - 设置 `Cache-Control` 强缓存
- **HTML 页面**（SSR 输出）：
  - 使用 `ETag` / `Last-Modified` 支持协商缓存
  - 减少重复传输

### 7. 前端功能（React）

- 首页文章列表：
  - 分页切换
  - 排序（最新 / 最早 / 最热）
  - 按标签筛选
- 文章详情：
  - Markdown 渲染正文
  - 显示标签、发布时间、作者、阅读量
  - 评论列表 + 评论表单
- 后台管理（`/admin`）：
  - 登录 / 注册（第一个用户为 admin）
  - 文章列表管理
  - 创建 / 编辑文章（支持 Markdown）
  - 修改状态（草稿 / 发布）
  - 删除文章（逻辑删除）
  - AI 写作助手按钮
- UI 小功能：
  - 暗黑模式切换（localStorage 记住用户偏好）
  - 标签云可视化
  - 响应式布局

### 8. AI 写作助手

- 后台编辑文章时，输入标题 / 关键词，点击 **「AI 写作助手 ✨」**
- 调用 OpenAI API（或本地示例），生成：
  - 一段摘要
  - Markdown 格式正文草稿
- 生成内容会直接填入编辑器，可继续手动编辑后发布

---
## 环境准备
- Node.js 
  - node -v
- MySQL 初始化
```bash
  - CREATE DATABASE ssr_blog DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  - CREATE USER 'blog_user'@'localhost' IDENTIFIED BY 'blog_password';
  - GRANT ALL PRIVILEGES ON ssr_blog.* TO 'blog_user'@'localhost';
  - FLUSH PRIVILEGES;
 
- 建表 SQL
  USE ssr_blog;

CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','user') NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE articles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  summary VARCHAR(500),
  content MEDIUMTEXT NOT NULL,
  tags VARCHAR(255),
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  author_id INT,
  views INT NOT NULL DEFAULT 0,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (author_id) REFERENCES users(id),
  INDEX idx_status_created (status, created_at),
  INDEX idx_status_views (status, views)
);

CREATE TABLE comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  article_id INT NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  INDEX idx_article_created (article_id, created_at)
);


- Redis
  - 默认使用本地 Redis：
  - host: 127.0.0.1
  - port: 6379
 
## 本地运行步骤

### 安装依赖
- npm install

### 构建前端
- npm run build

### 启动服务（开发模式）
- npm run dev

## 项目结构

```bash
ssr-blog/
├─ server/
│  ├─ index.js          # Express 入口 + SSR
│  ├─ db.js             # MySQL 连接池
│  ├─ redis.js          # Redis 客户端
│  ├─ auth.js           # JWT 认证 & 权限
│  ├─ ai.js             # AI 写作助手路由
│  ├─ routes/
│  │  ├─ articles.js    # 文章相关 REST API
│  │  └─ comments.js    # 评论相关 REST API
│  └─ services/
│     └─ articlesService.js  # 文章增删改查、缓存逻辑
│
├─ src/
│  ├─ client/
│  │  └─ index.jsx      # 客户端入口（hydration）
│  ├─ App.jsx           # 前端路由 / 布局
│  └─ pages/
│     ├─ Home.jsx       # 首页文章列表 + 标签云
│     ├─ ArticleDetail.jsx  # 文章详情页
│     └─ Admin.jsx      # 后台管理页面
│
├─ webpack.client.js    # 前端打包配置
├─ package.json
├─ styles.css           # 全局样式
└─ README.md
