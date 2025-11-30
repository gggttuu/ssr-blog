import React, { useEffect, useState } from 'react';

export default function Home({ initialData }) {
  const [articles, setArticles] = useState(initialData.articles || []);
  const [page, setPage] = useState(initialData.pagination?.page || 1);
  const [pageSize] = useState(initialData.pagination?.pageSize || 10);
  const [total, setTotal] = useState(initialData.pagination?.total || 0);
  const [tag, setTag] = useState(initialData.filterTag || '');
  const [sort, setSort] = useState(initialData.sort || 'newest');
  const [loading, setLoading] = useState(initialData.degraded || false);
  const [tagsCloud, setTagsCloud] = useState(initialData.tagCloud || []);
  const [error, setError] = useState(
    initialData.degraded ? '服务端数据获取失败，已降级为客户端渲染' : ''
  );

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const fetchArticles = async (pageIndex, tagValue, sortValue) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageIndex,
        pageSize,
        sort: sortValue || ''
      });
      if (tagValue) params.append('tag', tagValue);
      const res = await fetch(`/api/articles?${params.toString()}`);
      const data = await res.json();
      setArticles(data.articles || []);
      setTotal(data.total || 0);
      setPage(data.page || pageIndex);
      setError('');
    } catch (err) {
      console.error(err);
      setError('加载文章列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const fetchTagCloud = async () => {
    try {
      const res = await fetch('/api/articles/tags');
      const data = await res.json();
      setTagsCloud(data.tags || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (initialData.degraded) {
      fetchArticles(page, tag, sort);
      fetchTagCloud();
    } else {
      if (!tagsCloud || !tagsCloud.length) {
        fetchTagCloud();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    fetchArticles(newPage, tag, sort);
  };

  const handleTagClick = (t) => {
    const nextTag = t === tag ? '' : t;
    setTag(nextTag);
    fetchArticles(1, nextTag, sort);
  };

  const handleSortChange = (e) => {
    const value = e.target.value;
    setSort(value);
    fetchArticles(1, tag, value);
  };

  return (
    <div className="page page-home">
      {error && <div className="alert alert-warning">{error}</div>}
      <div className="home-layout">
        <section className="article-list">
          <div className="panel-header">
            <h1>最新文章</h1>
            <div className="panel-actions">
              <select value={sort} onChange={handleSortChange}>
                <option value="newest">最新优先</option>
                <option value="popular">阅读最多</option>
                <option value="oldest">最早优先</option>
              </select>
            </div>
          </div>

          {loading && <div className="loading">加载中...</div>}

          {!loading && !articles.length && (
            <div className="empty">暂无文章，快去后台写一篇吧～</div>
          )}

          {!loading &&
            articles.map((article) => (
              <article key={article.id} className="article-card">
                <a className="article-title" href={`/article/${article.id}`}>
                  {article.title}
                </a>
                <p className="article-summary">{article.summary}</p>
                <div className="article-meta">
                  <span>
                    {new Date(article.created_at).toLocaleString()} · 阅读{' '}
                    {article.views}
                  </span>
                </div>
                <div className="article-tags">
                  {article.tags &&
                    article.tags.map((tagName) => (
                      <button
                        key={tagName}
                        type="button"
                        className={`tag-chip ${
                          tagName === tag ? 'active' : ''
                        }`}
                        onClick={(e) => {
                          e.preventDefault();
                          handleTagClick(tagName);
                        }}
                      >
                        #{tagName}
                      </button>
                    ))}
                </div>
              </article>
            ))}

          {totalPages > 1 && (
            <div className="pagination">
              <button
                type="button"
                onClick={() => handlePageChange(page - 1)}
                disabled={page <= 1}
              >
                上一页
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => handlePageChange(page + 1)}
                disabled={page >= totalPages}
              >
                下一页
              </button>
            </div>
          )}
        </section>

        <aside className="sidebar">
          <section className="sidebar-card">
            <h2>标签云</h2>
            <div className="tag-cloud">
              {tagsCloud.map((tagItem) => {
                const size = 12 + tagItem.count * 2;
                return (
                  <button
                    key={tagItem.name}
                    type="button"
                    style={{ fontSize: `${Math.min(size, 26)}px` }}
                    className={`tag-cloud-item ${
                      tag === tagItem.name ? 'active' : ''
                    }`}
                    onClick={() => handleTagClick(tagItem.name)}
                  >
                    {tagItem.name} ({tagItem.count})
                  </button>
                );
              })}
            </div>
          </section>
          <section className="sidebar-card">
            <h2>关于本站</h2>
            <p>
              这是一个使用 React + Express + MySQL + Redis 实现的服务端渲染博客示例，
              支持文章列表 / 详情 SSR、评论、暗黑模式、AI 写作助手等功能。
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
