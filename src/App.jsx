import React, { useEffect, useState } from 'react';
import Home from './pages/Home';
import ArticleDetail from './pages/ArticleDetail';
import Admin from './pages/Admin';

export default function App({ initialData }) {
  const [page, setPage] = useState(initialData.page || 'home');
  const [data, setData] = useState(initialData);
  const [theme, setTheme] = useState(initialData.theme || 'light');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('theme');
      if (stored) setTheme(stored);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.theme = theme;
    }
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('theme', theme);
    }
  }, [theme]);

  const toggleTheme = () =>
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  const sharedProps = {
    initialData: data,
    setInitialData: setData,
    goto: (nextPage, nextData) => {
      setPage(nextPage);
      setData((prev) => ({ ...prev, ...nextData, page: nextPage }));
    }
  };

  let content = null;
  if (page === 'detail') {
    content = <ArticleDetail {...sharedProps} />;
  } else if (page === 'admin') {
    content = <Admin {...sharedProps} />;
  } else {
    content = <Home {...sharedProps} />;
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div
          className="app-logo"
          onClick={() => {
            if (typeof window !== 'undefined') window.location.href = '/';
          }}
        >
          <span className="logo-dot" />
          <span>SSR 博客</span>
        </div>
        <nav className="app-nav">
          <a href="/" className={page === 'home' ? 'active' : ''}>
            首页
          </a>
          <a href="/admin" className={page === 'admin' ? 'active' : ''}>
            后台管理
          </a>
        </nav>
        <button className="theme-toggle" type="button" onClick={toggleTheme}>
          {theme === 'light' ? '🌙 暗黑' : '☀️ 明亮'}
        </button>
      </header>
      <main className="app-main">{content}</main>
      <footer className="app-footer">
        SSR Blog · React + Express + MySQL + Redis
      </footer>
    </div>
  );
}
