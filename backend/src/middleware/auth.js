const jwt = require('jsonwebtoken');
const db = require('../db/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const ACCESS_TOKEN_TYPE = 'access';

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
    return res.status(401).json({ error: 'Invalid or expired token', code: 'SESSION_EXPIRED' });
  }
  // Other tokens signed with JWT_SECRET (such as the Google OAuth state) carry their own type
  // and must never authenticate API requests. Access tokens issued before this check have no
  // type and expire within ACCESS_TOKEN_TTL.
  if (!user?.userId || (user.type !== undefined && user.type !== ACCESS_TOKEN_TYPE)) {
    return res.status(401).json({ error: 'Invalid or expired token', code: 'SESSION_EXPIRED' });
  }

  try {
    const currentUser = await db.prepare('SELECT id, email, role, name, status, email_verified_at, verified_at, session_version FROM users WHERE id = ?').get(user.userId);
    if (!currentUser) {
      return res.status(401).json({ error: 'Invalid user', code: 'SESSION_EXPIRED' });
    }
    if (currentUser.status !== 'active') {
      return res.status(403).json({ error: `Account is ${currentUser.status || 'unavailable'}` });
    }
    if (Number(user.sessionVersion || 0) !== Number(currentUser.session_version || 0)) {
      return res.status(401).json({ error: 'Session has expired. Please sign in again.', code: 'SESSION_EXPIRED' });
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
    // ADMIN_EMAILS only grants access once the account has proven it owns that address;
    // otherwise anyone could register an unverified account under an admin email first.
    const configured = adminEmails.includes(String(req.user.email || '').toLowerCase())
      && Boolean(req.user.email_verified_at);
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

module.exports = { authenticateToken, requireAdmin, requireVerifiedEmail, ACCESS_TOKEN_TTL, ACCESS_TOKEN_TYPE, JWT_SECRET };
