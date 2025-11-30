const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  let token = null;
  if (header.startsWith('Bearer ')) token = header.slice(7);
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  if (!token) {
    return res.status(401).json({ message: '未登录或登录已过期' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: '无效的登录状态' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: '需要管理员权限' });
  }
  next();
}

module.exports = { authenticate, requireAdmin };
