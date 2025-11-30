const pool = require('../db');

const PAGE_SIZE_DEFAULT = 10;

function normalizeTags(str) {
  if (!str) return [];
  return str
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

async function listArticles({ page = 1, pageSize = PAGE_SIZE_DEFAULT, sort = 'newest', tag }) {
  page = Number(page) || 1;
  pageSize = Math.min(Number(pageSize) || PAGE_SIZE_DEFAULT, 50);
  const offset = (page - 1) * pageSize;

  const params = [];
  let where = 'is_deleted = 0 AND status = "published"';
  if (tag) {
    where += ' AND FIND_IN_SET(?, tags)';
    params.push(tag);
  }

  let orderBy = 'created_at DESC';
  if (sort === 'oldest') orderBy = 'created_at ASC';
  else if (sort === 'popular') orderBy = 'views DESC';

  const [rows] = await pool.query(
    `SELECT id, title, summary, tags, created_at, updated_at, views
     FROM articles
     WHERE ${where}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total
     FROM articles
     WHERE ${where}`,
    params
  );

  return {
    articles: rows.map((a) => ({
      ...a,
      tags: normalizeTags(a.tags)
    })),
    total: countRows[0].total,
    page,
    pageSize
  };
}

async function listArticlesAdmin({ page = 1, pageSize = PAGE_SIZE_DEFAULT, status }) {
  page = Number(page) || 1;
  pageSize = Math.min(Number(pageSize) || PAGE_SIZE_DEFAULT, 100);
  const offset = (page - 1) * pageSize;

  const params = [];
  let where = 'is_deleted = 0';
  if (status) {
    where += ' AND status = ?';
    params.push(status);
  }

  const [rows] = await pool.query(
    `SELECT id, title, summary, tags, status, created_at, updated_at, views
     FROM articles
     WHERE ${where}
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, pageSize, offset]
  );
  const [countRows] = await pool.query(
    `SELECT COUNT(*) AS total FROM articles WHERE ${where}`,
    params
  );

  return {
    articles: rows.map((a) => ({
      ...a,
      tags: normalizeTags(a.tags)
    })),
    total: countRows[0].total,
    page,
    pageSize
  };
}

async function getArticleById(id, { includeDraft = false } = {}) {
  const [rows] = await pool.query(
    `SELECT id, title, summary, content, tags, status,
            created_at, updated_at, views
     FROM articles
     WHERE id = ? AND is_deleted = 0 ${
       includeDraft ? '' : 'AND status = "published"'
     }`,
    [id]
  );
  const article = rows[0];
  if (!article) return null;
  return {
    ...article,
    tags: normalizeTags(article.tags)
  };
}

async function incrementViews(id) {
  await pool.query('UPDATE articles SET views = views + 1 WHERE id = ?', [id]);
}

async function createArticle({ title, summary, content, tags, status = 'draft', authorId }) {
  const tagStr = Array.isArray(tags) ? tags.join(',') : tags || '';
  const [result] = await pool.query(
    `INSERT INTO articles (title, summary, content, tags, status, author_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [title, summary, content, tagStr, status, authorId || null]
  );
  return result.insertId;
}

async function updateArticle(id, { title, summary, content, tags, status }) {
  const tagStr = Array.isArray(tags) ? tags.join(',') : tags;
  const fields = [];
  const params = [];
  if (title != null) {
    fields.push('title = ?');
    params.push(title);
  }
  if (summary != null) {
    fields.push('summary = ?');
    params.push(summary);
  }
  if (content != null) {
    fields.push('content = ?');
    params.push(content);
  }
  if (tagStr != null) {
    fields.push('tags = ?');
    params.push(tagStr);
  }
  if (status != null) {
    fields.push('status = ?');
    params.push(status);
  }
  if (!fields.length) return;
  params.push(id);
  await pool.query(`UPDATE articles SET ${fields.join(', ')} WHERE id = ? AND is_deleted = 0`, params);
}

async function deleteArticle(id) {
  await pool.query('UPDATE articles SET is_deleted = 1 WHERE id = ?', [id]);
}

async function getTagCloud() {
  const [rows] = await pool.query(
    `SELECT tags FROM articles WHERE is_deleted = 0 AND status = "published"`
  );
  const map = new Map();
  for (const row of rows) {
    if (!row.tags) continue;
    normalizeTags(row.tags).forEach((tag) => {
      map.set(tag, (map.get(tag) || 0) + 1);
    });
  }
  const tags = [];
  for (const [name, count] of map.entries()) {
    tags.push({ name, count });
  }
  tags.sort((a, b) => b.count - a.count);
  return tags;
}

async function getComments(articleId) {
  const [rows] = await pool.query(
    `SELECT id,
            author_name AS authorName,
            content,
            created_at AS createdAt
     FROM comments
     WHERE article_id = ? AND is_deleted = 0
     ORDER BY created_at ASC`,
    [articleId]
  );
  return rows;
}

async function addComment(articleId, { authorName, content }) {
  await pool.query(
    `INSERT INTO comments (article_id, author_name, content)
     VALUES (?, ?, ?)`,
    [articleId, authorName, content]
  );
}

module.exports = {
  listArticles,
  listArticlesAdmin,
  getArticleById,
  incrementViews,
  createArticle,
  updateArticle,
  deleteArticle,
  getTagCloud,
  getComments,
  addComment
};
