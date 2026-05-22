const jwt = require('jsonwebtoken');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'your-secret-key-change-in-production') {
  throw new Error('JWT_SECRET must be set in production');
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    const currentUser = db.prepare('SELECT status FROM users WHERE id = ?').get(user.userId);
    if (!currentUser) {
      return res.status(403).json({ error: 'Invalid user' });
    }
    if (currentUser.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended' });
    }

    req.user = user;
    next();
  });
};

const requireAdmin = (req, res, next) => {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes(String(req.user.email || '').toLowerCase())) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  next();
};

module.exports = { authenticateToken, requireAdmin, JWT_SECRET };
