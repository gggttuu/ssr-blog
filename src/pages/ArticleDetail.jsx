import React, { useEffect, useState } from 'react';
import { marked } from 'marked';

if (typeof marked === 'function') {
  marked.setOptions({ breaks: true });
}

export default function ArticleDetail({ initialData }) {
  const [article, setArticle] = useState(initialData.article || null);
  const [comments, setComments] = useState(initialData.comments || []);
  const [loading, setLoading] = useState(initialData.degraded || false);
  const [error, setError] = useState(
    initialData.degraded ? '服务端数据获取失败，正在从客户端加载…' : ''
  );
  const [commentAuthor, setCommentAuthor] = useState('');
  const [commentContent, setCommentContent] = useState('');

  const articleId = article?.id || initialData.articleId;

  const fetchArticle = async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/articles/${articleId}`);
      const data = await res.json();
      setArticle(data.article);
      setError('');
      fetchComments();
    } catch (err) {
      console.error(err);
      setError('加载文章失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/articles/${articleId}/comments`);
      const data = await res.json();
      setComments(data.comments || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (initialData.degraded && articleId) {
      fetchArticle();
    } else if (articleId && !comments.length) {
      fetchComments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmitComment = async (e) => {
    e.preventDefault();
    if (!commentAuthor.trim() || !commentContent.trim()) return;
    try {
      const res = await fetch(`/api/articles/${articleId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          authorName: commentAuthor.trim(),
          content: commentContent.trim()
        })
      });
      if (!res.ok) throw new Error('comment failed');
      setCommentAuthor('');
      setCommentContent('');
      fetchComments();
    } catch (err) {
      console.error(err);
      alert('发表评论失败，请稍后重试');
    }
  };

  if (!article && !loading) {
    return (
      <div className="page page-detail">
        <div className="alert alert-error">文章不存在或已被删除。</div>
        <button
          type="button"
          className="back-button"
          onClick={() => {
            if (typeof window !== 'undefined') window.location.href = '/';
          }}
        >
          ← 返回列表
        </button>
      </div>
    );
  }

  return (
    <div className="page page-detail">
      {error && <div className="alert alert-warning">{error}</div>}
      {loading && <div className="loading">加载中…</div>}
      {article && (
        <>
          <article className="article-detail-card">
            <h1>{article.title}</h1>
            <div className="article-meta">
              <span>{new Date(article.created_at).toLocaleString()}</span>
              <span> · 阅读 {article.views}</span>
            </div>
            <div className="article-tags">
              {article.tags &&
                article.tags.map((tag) => (
                  <span key={tag} className="tag-chip">
                    #{tag}
                  </span>
                ))}
            </div>
            <div
              className="article-content"
              dangerouslySetInnerHTML={{
                __html: marked(article.content || '')
              }}
            />
          </article>

          <section className="comments-section">
            <h2>评论 ({comments.length})</h2>
            <form className="comment-form" onSubmit={handleSubmitComment}>
              <div className="form-row">
                <input
                  type="text"
                  placeholder="你的昵称"
                  value={commentAuthor}
                  onChange={(e) => setCommentAuthor(e.target.value)}
                />
              </div>
              <div className="form-row">
                <textarea
                  placeholder="写点什么吧～"
                  value={commentContent}
                  onChange={(e) => setCommentContent(e.target.value)}
                />
              </div>
              <button type="submit">发表评论</button>
            </form>

            <ul className="comment-list">
              {comments.map((c) => (
                <li key={c.id} className="comment-item">
                  <div className="comment-header">
                    <strong>{c.authorName}</strong>
                    <span>{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                  <p>{c.content}</p>
                </li>
              ))}
              {!comments.length && (
                <li className="comment-empty">还没有评论，来抢沙发吧～</li>
              )}
            </ul>
          </section>

          <button
            type="button"
            className="back-button"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.href = '/';
            }}
          >
            ← 返回列表
          </button>
        </>
      )}
    </div>
  );
}
