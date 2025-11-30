import React, { useEffect, useState } from 'react';

function getToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('token');
}

export default function Admin() {
  const [user, setUser] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [articles, setArticles] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    summary: '',
    tags: '',
    status: 'published',
    content: ''
  });
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = getToken();
    if (token) {
      fetchMe(token);
      fetchAdminArticles(token);
    }
  }, []);

  const fetchMe = async (token) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setUser(data.user);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchAdminArticles = async (token) => {
    try {
      const res = await fetch('/api/articles/admin', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      setArticles(data.articles || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm)
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || '登录失败');
        return;
      }
      const token = data.token;
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('token', token);
      }
      setUser(data.user);
      setMessage('登录成功');
      fetchAdminArticles(token);
    } catch (err) {
      console.error(err);
      alert('登录失败');
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('token');
    }
    setUser(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return alert('请先登录');
    if (!form.title.trim() || !form.content.trim()) {
      return alert('标题和正文不能为空');
    }
    setLoading(true);
    try {
      const payload = {
        title: form.title.trim(),
        summary: form.summary.trim(),
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        status: form.status,
        content: form.content
      };
      let url = '/api/articles';
      let method = 'POST';
      if (editingId) {
        url = `/api/articles/${editingId}`;
        method = 'PUT';
      }
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '保存失败');
      setMessage(editingId ? '更新成功' : '创建成功');
      setEditingId(null);
      setForm({
        title: '',
        summary: '',
        tags: '',
        status: 'published',
        content: ''
      });
      fetchAdminArticles(token);
    } catch (err) {
      console.error(err);
      alert(err.message || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (article) => {
    // 详情内容从 API 拉取
    try {
      const res = await fetch(`/api/articles/${article.id}`);
      const data = await res.json();
      const full = data.article || article;
      setEditingId(article.id);
      setForm({
        title: full.title,
        summary: full.summary || '',
        tags: (full.tags || []).join(','),
        status: full.status || 'published',
        content: full.content || ''
      });
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err) {
      console.error(err);
      alert('获取文章详情失败');
    }
  };

  const handleDelete = async (id) => {
    if (typeof window !== 'undefined') {
      if (!window.confirm('确认要删除这篇文章吗？')) return;
    }
    const token = getToken();
    if (!token) return alert('请先登录');
    try {
      const res = await fetch(`/api/articles/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || '删除失败');
      setMessage('删除成功');
      fetchAdminArticles(token);
    } catch (err) {
      console.error(err);
      alert(err.message || '删除失败');
    }
  };

  const handleAiGenerate = async () => {
    const token = getToken();
    if (!token) return alert('请先登录');
    if (!form.title.trim() && !form.tags.trim()) {
      return alert('请至少输入标题或标签作为提示');
    }
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: form.title,
          keywords: form.tags
        })
      });
      const data = await res.json();
      if (data.content) {
        setForm((prev) => ({
          ...prev,
          content: prev.content
            ? `${prev.content}\n\n${data.content}`
            : data.content,
          summary: prev.summary || data.summary || prev.summary
        }));
        setMessage('AI 已生成草稿，可继续修改后发布');
      } else {
        alert('AI 生成失败，请检查 OpenAI API 配置');
      }
    } catch (err) {
      console.error(err);
      alert('AI 生成失败');
    } finally {
      setAiLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="page page-admin">
        <div className="panel">
          <h1>后台登录</h1>
          <form className="form" onSubmit={handleLogin}>
            <div className="form-row">
              <label>用户名</label>
              <input
                value={loginForm.username}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, username: e.target.value })
                }
              />
            </div>
            <div className="form-row">
              <label>密码</label>
              <input
                type="password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm({ ...loginForm, password: e.target.value })
                }
              />
            </div>
            <button type="submit">登录 / 注册</button>
            <p className="form-tip">
              如果账号不存在，将自动注册；第一个注册的用户会成为管理员。
            </p>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="page page-admin">
      <div className="panel">
        <div className="panel-header">
          <h1>文章管理</h1>
          <div>
            <span className="me">
              你好，{user.username}（{user.role}）
            </span>
            <button type="button" onClick={handleLogout}>
              退出登录
            </button>
          </div>
        </div>
        {message && <div className="alert alert-success">{message}</div>}

        <form className="form" onSubmit={handleSave}>
          <div className="form-row">
            <label>标题</label>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label>摘要</label>
            <textarea
              rows="2"
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label>标签（用逗号分隔）</label>
            <input
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
            />
          </div>
          <div className="form-row">
            <label>状态</label>
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
            >
              <option value="published">发布</option>
              <option value="draft">草稿</option>
            </select>
          </div>
          <div className="form-row">
            <label>正文（支持 Markdown）</label>
            <textarea
              rows="10"
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
          </div>
          <div className="form-actions">
            <button type="button" onClick={handleAiGenerate} disabled={aiLoading}>
              {aiLoading ? 'AI 生成中…' : 'AI 写作助手 ✨'}
            </button>
            <button type="submit" disabled={loading}>
              {editingId ? '保存修改' : '发布文章'}
            </button>
          </div>
        </form>
      </div>

      <div className="panel panel-list">
        <h2>文章列表</h2>
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>标题</th>
              <th>状态</th>
              <th>阅读</th>
              <th>创建时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((a) => (
              <tr key={a.id}>
                <td>{a.id}</td>
                <td>{a.title}</td>
                <td>{a.status}</td>
                <td>{a.views}</td>
                <td>{new Date(a.created_at).toLocaleString()}</td>
                <td>
                  <button type="button" onClick={() => handleEdit(a)}>
                    编辑
                  </button>
                  <button type="button" onClick={() => handleDelete(a.id)}>
                    删除
                  </button>
                  <a href={`/article/${a.id}`} target="_blank" rel="noreferrer">
                    预览
                  </a>
                </td>
              </tr>
            ))}
            {!articles.length && (
              <tr>
                <td colSpan="6">暂无文章</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
