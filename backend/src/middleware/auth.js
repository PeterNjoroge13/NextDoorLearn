const jwt = require('jsonwebtoken');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === 'your-secret-key-change-in-production') {
  throw new Error('JWT_SECRET must be set in production');
}

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  let user;
  try {
    user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  try {
    const currentUser = await db.prepare('SELECT id, email, role, name, status, email_verified_at, verified_at FROM users WHERE id = ?').get(user.userId);
    if (!currentUser) {
      return res.status(403).json({ error: 'Invalid user' });
    }
    if (currentUser.status !== 'active') {
      return res.status(403).json({ error: `Account is ${currentUser.status || 'unavailable'}` });
    }

    req.user = { ...user, ...currentUser, userId: currentUser.id };
    next();
  } catch (error) {
    next(error);
  }
};

const requireAdmin = async (req, res, next) => {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  try {
    const configured = adminEmails.includes(String(req.user.email || '').toLowerCase());
    if (configured) {
      await db.prepare(`
        INSERT INTO admin_memberships (user_id, permission_level) VALUES (?, 'owner')
        ON CONFLICT(user_id) DO NOTHING
      `).run(req.user.userId);
    }
    const membership = await db.prepare('SELECT permission_level FROM admin_memberships WHERE user_id = ?').get(req.user.userId);
    if (!membership) return res.status(403).json({ error: 'Admin access required' });
    req.user.adminPermission = membership.permission_level;
    next();
  } catch (error) {
    next(error);
  }
};

const requireVerifiedEmail = (req, res, next) => {
  if (process.env.REQUIRE_EMAIL_VERIFICATION === 'true' && !req.user.email_verified_at) {
    return res.status(403).json({ error: 'Verify your email before using this feature', code: 'EMAIL_VERIFICATION_REQUIRED' });
  }
  next();
};

module.exports = { authenticateToken, requireAdmin, requireVerifiedEmail, JWT_SECRET };
