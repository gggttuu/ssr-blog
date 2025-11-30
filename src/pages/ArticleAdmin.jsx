// src/pages/ArticleAdmin.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const thStyle = {
  borderBottom: '1px solid #ddd',
  padding: '4px 6px',
  textAlign: 'left'
};

const tdStyle = {
  borderBottom: '1px solid #f0f0f0',
  padding: '4px 6px',
  fontSize: 13
};

export default function ArticleAdmin() {
  // ===== 列表相关状态 =====
  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all'); // all | published | draft
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  // ===== 表单（新建 / 编辑）相关状态 =====
  const [editingId, setEditingId] = useState(null); // null=新建
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [status, setStatus] = useState('draft');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);

  // ===== 拉取列表 =====
  async function fetchList(pageArg = page, statusArg = statusFilter) {
    setListLoading(true);
    setListError('');
    try {
      const res = await axios.get('/api/articles', {
        params: {
          page: pageArg,
          pageSize,
          status: statusArg,
          sort: 'latest'
        }
      });
      setList(res.data.articles || []);
      setTotal(res.data.total || 0);
      setSelectedIds([]); // 刷新后清空勾选
    } catch (err) {
      console.error(err);
      setListError('加载文章列表失败');
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    fetchList(page, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter]);

  // ===== 加载某篇文章详情用于编辑 =====
  async function loadArticleDetail(id) {
    setMessage('');
    try {
      const res = await axios.get(`/api/articles/${id}`, {
        params: { includeDraft: true }
      });
      const a = res.data.article;
      setEditingId(a.id);
      setTitle(a.title);
      setSummary(a.summary || '');
      setContent(a.content || '');
      setTags((a.tags || []).join(','));
      setStatus(a.status || 'draft');
    } catch (err) {
      console.error(err);
      setMessage('加载文章详情失败');
    }
  }

  // ===== 提交（新建 / 修改） =====
  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    const payload = {
      title,
      summary,
      content,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      status
    };

    try {
      if (editingId) {
        await axios.put(`/api/articles/${editingId}`, payload);
        setMessage('更新成功');
      } else {
        await axios.post('/api/articles', payload);
        setMessage('创建成功');
      }
      // 刷新列表，回到第一页
      setPage(1);
      fetchList(1, statusFilter);
    } catch (err) {
      console.error(err);
      setMessage('保存失败，请检查服务器日志');
    } finally {
      setSaving(false);
    }
  }

  // ===== 单篇删除 =====
  async function handleDelete(id) {
    if (!window.confirm('确定删除这篇文章吗？（逻辑删除）')) return;
    try {
      await axios.delete(`/api/articles/${id}`);
      // 如果删的是正在编辑的那篇，切回新建
      if (editingId === id) {
        handleCreateNew();
      }
      fetchList(page, statusFilter);
    } catch (err) {
      console.error(err);
      alert('删除失败，请检查服务器日志');
    }
  }

  // ===== 批量删除（前端循环调用已有删除接口） =====
  async function handleBulkDelete() {
    if (selectedIds.length === 0) {
      alert('请先勾选要删除的文章');
      return;
    }
    if (!window.confirm(`确定批量删除这 ${selectedIds.length} 篇文章吗？（逻辑删除）`)) return;
    try {
      await Promise.all(selectedIds.map((id) => axios.delete(`/api/articles/${id}`)));
      if (editingId && selectedIds.includes(editingId)) {
        handleCreateNew();
      }
      fetchList(page, statusFilter);
    } catch (err) {
      console.error(err);
      alert('批量删除失败，请检查服务器日志');
    }
  }

  // ===== AI 写作 =====
  async function handleAIGenerate() {
    setAiLoading(true);
    setMessage('');
    try {
      const res = await axios.post('/api/ai/generate', {
        title,
        keywords: tags
      });
      if (res.data.content) {
        setContent(res.data.content);
      }
      if (!summary && res.data.summary) {
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error(err);
      setMessage('AI 生成失败，请确认已配置 OPENAI_API_KEY');
    } finally {
      setAiLoading(false);
    }
  }

  // ===== 新建按钮（清空表单） =====
  function handleCreateNew() {
    setEditingId(null);
    setTitle('');
    setSummary('');
    setContent('');
    setTags('');
    setStatus('draft');
    setMessage('');
  }

  // ===== 勾选单个 / 全选 =====
  function toggleSelect(id) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.concat(id)
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === list.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(list.map((a) => a.id));
    }
  }

  const isSelectedAll = list.length > 0 && selectedIds.length === list.length;

  function changePage(p) {
    const newPage = Math.max(1, Math.min(totalPages, p));
    setPage(newPage);
  }

  const isEditing = !!editingId;

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1>文章管理后台</h1>
        <button type="button" onClick={handleCreateNew}>
          新建文章
        </button>
      </header>

      {/* ===== 文章列表区域 ===== */}
      <section style={{ marginBottom: 24, padding: 16, border: '1px solid #eee' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ marginTop: 0 }}>文章列表</h2>
          <div>
            状态：
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">全部</option>
              <option value="published">已发布</option>
              <option value="draft">草稿</option>
            </select>
          </div>
        </div>

        {listLoading && <p>列表加载中...</p>}
        {listError && <p style={{ color: 'red' }}>{listError}</p>}

        {!listLoading && !listError && (
          <>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  <th style={thStyle}>
                    <input type="checkbox" checked={isSelectedAll} onChange={toggleSelectAll} />
                  </th>
                  <th style={thStyle}>ID</th>
                  <th style={thStyle}>标题</th>
                  <th style={thStyle}>状态</th>
                  <th style={thStyle}>阅读量</th>
                  <th style={thStyle}>创建时间</th>
                  <th style={thStyle}>操作</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.id}>
                    <td style={tdStyle}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(a.id)}
                        onChange={() => toggleSelect(a.id)}
                      />
                    </td>
                    <td style={tdStyle}>{a.id}</td>
                    <td style={tdStyle}>{a.title}</td>
                    <td style={tdStyle}>
                      {a.deleted ? '已删除' : a.status === 'published' ? '已发布' : '草稿'}
                    </td>
                    <td style={tdStyle}>{a.views}</td>
                    <td style={tdStyle}>
                      {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
                    </td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => loadArticleDetail(a.id)}
                        style={{ marginRight: 8 }}
                      >
                        编辑
                      </button>
                      {!a.deleted && (
                        <button type="button" onClick={() => handleDelete(a.id)}>
                          删除
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {list.length === 0 && (
                  <tr>
                    <td style={tdStyle} colSpan={7}>
                      暂无文章
                    </td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <button disabled={page <= 1} onClick={() => changePage(page - 1)}>
                上一页
              </button>
              <span>
                第 {page} / 共 {totalPages} 页
              </span>
              <button disabled={page >= totalPages} onClick={() => changePage(page + 1)}>
                下一页
              </button>
              <button
                type="button"
                disabled={selectedIds.length === 0}
                onClick={handleBulkDelete}
                style={{ marginLeft: 'auto' }}
              >
                批量删除所选
              </button>
            </div>
          </>
        )}
      </section>

      {/* ===== 新建 / 编辑区域 ===== */}
      <section style={{ padding: 16, border: '1px solid #eee' }}>
        <div style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{isEditing ? `编辑文章 #${editingId}` : '新建文章'}</h2>
          <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
            标题和正文为必填，状态为“草稿”时首页不会展示。
          </div>
        </div>

        <div style={{ margin: '8px 0' }}>
          <button type="button" onClick={handleAIGenerate} disabled={aiLoading}>
            {aiLoading ? 'AI 正在生成...' : 'AI 生成草稿'}
          </button>
          <span style={{ marginLeft: 8, fontSize: 12, color: '#555' }}>
            （根据标题和标签自动生成正文与摘要）
          </span>
        </div>

        <form onSubmit={handleSubmit} style={{ opacity: saving ? 0.6 : 1 }}>
          <div style={{ marginBottom: 12 }}>
            <label>
              标题：
              <input
                style={{ width: '100%', padding: 8 }}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>
              摘要：
              <textarea
                style={{ width: '100%', padding: 8 }}
                rows={3}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
              />
            </label>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>
              标签（用逗号分隔）：
              <input
                style={{ width: '100%', padding: 8 }}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </label>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>
              状态：
              <select
                style={{ padding: 4, marginLeft: 8 }}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="draft">草稿</option>
                <option value="published">发布</option>
              </select>
            </label>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label>
              正文（HTML 或 Markdown 转 HTML 后粘贴）：
              <textarea
                style={{ width: '100%', padding: 8, fontFamily: 'monospace' }}
                rows={16}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
              />
            </label>
          </div>

          <button type="submit" disabled={saving}>
            {saving ? '保存中...' : isEditing ? '保存修改' : '保存新文章'}
          </button>
        </form>

        {message && <p style={{ marginTop: 12 }}>{message}</p>}
      </section>
    </main>
  );
}
