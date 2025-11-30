require('@babel/register')({
  presets: [
    ['@babel/preset-env', { targets: { node: '18' } }],
    ['@babel/preset-react', { runtime: 'automatic' }]
  ],
  extensions: ['.js', '.jsx'],
  ignore: [/node_modules/]
});

const React = require('react');
const { renderToString } = require('react-dom/server');
const App = require('../src/App.jsx').default;

function renderApp(initialData) {
  const appHtml = renderToString(React.createElement(App, { initialData }));
  const html = `
<!DOCTYPE html>
<html lang="zh-CN" data-theme="${initialData.theme || 'light'}">
  <head>
    <meta charset="utf-8" />
    <title>${
      initialData.page === 'detail' && initialData.article
        ? `${initialData.article.title} - SSR 博客`
        : 'SSR 博客系统'
    }</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="React + Express + MySQL + Redis 实现的 SSR 博客系统" />
    <link rel="stylesheet" href="/styles.css" />
  </head>
  <body>
    <div id="root">${appHtml}</div>
    <script>
      window.__INITIAL_DATA__ = ${JSON.stringify(initialData).replace(/</g, '\\u003c')};
    </script>
    <script src="/client.bundle.js"></script>
  </body>
</html>
`;
  return html;
}

module.exports = { renderApp };
