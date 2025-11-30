const express = require('express');
const dotenv = require('dotenv');
const { authenticate, requireAdmin } = require('./auth');

dotenv.config();

const router = express.Router();

// node-fetch 动态导入，兼容 CommonJS
const fetchFn = (...args) =>
  import('node-fetch').then(({ default: fetch }) => fetch(...args));

// AI 写作助手：根据标题 / 关键词生成 Markdown 草稿 + 摘要
router.post('/generate', authenticate, requireAdmin, async (req, res) => {
  const { title = '', keywords = '' } = req.body || {};
  const apiKey = process.env.OPENAI_API_KEY;

  const prompt = `你是一个中文技术博客写作助手。根据下面的标题和关键词，生成一篇适合发布在博客上的文章正文（使用 Markdown 格式），并在开头给出一句不超过 60 字的中文摘要。
标题: ${title || '未命名文章'}
关键词: ${keywords || '技术, 博客'}`;

  // 如果没配置 KEY，返回示例内容，不让功能彻底报错
  if (!apiKey) {
    return res.json({
      content: `> 提示：当前未配置 OpenAI API KEY，下面是示例正文。\n\n# ${
        title || '示例文章标题'
      }\n\n这是 AI 写作助手的示例内容。你可以：\n\n- 在后台直接编辑此内容\n- 在服务器 .env 中配置 OPENAI_API_KEY 获得真实 AI 生成\n\n支持 **Markdown**、代码块等格式。`,
      summary: '这是 AI 写作助手的示例摘要，配置 OPENAI_API_KEY 后即可获得真实生成结果。'
    });
  }

  try {
    const resp = await fetchFn('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: '你是一个专业的中文技术博客写作助手。' },
          { role: 'user', content: prompt }
        ]
      })
    });

    const json = await resp.json();
    const fullText = json.choices?.[0]?.message?.content || '';
    const [firstLine, ...rest] = fullText.split('\n');
    const summary = firstLine.replace(/^#+\s*/, '').slice(0, 80);
    const content = rest.join('\n').trim() || fullText;

    res.json({ content, summary });
  } catch (err) {
    console.error('AI generate error', err);
    res.status(500).json({ message: 'AI 生成失败' });
  }
});

module.exports = router;
