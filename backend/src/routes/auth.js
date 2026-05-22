const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');
const { isValidEmail, sanitizeText } = require('../utils/validation');
const { sendEmail } = require('../services/email');

const router = express.Router();

const publicUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

const createToken = () => crypto.randomBytes(32).toString('hex');

const insertExpiringToken = (table, userId, hours = 2) => {
  const token = createToken();
  db.prepare(`
    INSERT INTO ${table} (user_id, token, expires_at)
    VALUES (?, ?, datetime('now', ?))
  `).run(userId, token, `+${hours} hours`);
  return token;
};

const sendVerificationEmail = async (user) => {
  const token = insertExpiringToken('email_verification_tokens', user.id, 48);
  const link = `${publicUrl()}/verify-email?token=${token}`;
  await sendEmail({
    to: user.email,
    subject: 'Verify your NextDoorLearn email',
    text: `Verify your email: ${link}`,
    html: `<p>Verify your NextDoorLearn email:</p><p><a href="${link}">${link}</a></p>`
  });
  return token;
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, role, name, bio } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const displayName = sanitizeText(name, 120);
    const safeBio = sanitizeText(bio, 1000);

    // Validate required fields
    if (!normalizedEmail || !password || !role || !displayName) {
      return res.status(400).json({ error: 'Email, password, role, and name are required' });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (!['student', 'tutor'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either student or tutor' });
    }

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user
    const insertUser = db.prepare(`
      INSERT INTO users (email, password_hash, role, name, bio)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = insertUser.run(normalizedEmail, passwordHash, role, displayName, safeBio);
    const userId = result.lastInsertRowid;

    // Create profile based on role
    if (role === 'tutor') {
      const insertTutorProfile = db.prepare(`
        INSERT INTO tutor_profiles (user_id, subjects, availability, hourly_rate)
        VALUES (?, ?, ?, ?)
      `);
      insertTutorProfile.run(userId, '[]', '{}', 0);
    } else {
      const insertStudentProfile = db.prepare(`
        INSERT INTO student_profiles (user_id, grade_level, subjects_needed)
        VALUES (?, ?, ?)
      `);
      insertStudentProfile.run(userId, '', '[]');
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId, email: normalizedEmail, role, name: displayName },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    const verificationToken = await sendVerificationEmail({
      id: userId,
      email: normalizedEmail
    });

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: userId, email: normalizedEmail, role, name: displayName, bio: safeBio },
      ...(process.env.NODE_ENV === 'production' ? {} : { verificationToken })
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }

    // Find user
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended' });
    }

    // Update last_seen timestamp
    const updateLastSeen = db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?');
    updateLastSeen.run(user.id);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        bio: user.bio,
        emailVerified: Boolean(user.email_verified_at)
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const normalizedEmail = String(req.body.email || '').trim().toLowerCase();

    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }

    const user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(normalizedEmail);
    let resetToken;

    if (user) {
      resetToken = insertExpiringToken('password_reset_tokens', user.id, 2);
      const link = `${publicUrl()}/reset-password?token=${resetToken}`;
      await sendEmail({
        to: user.email,
        subject: 'Reset your NextDoorLearn password',
        text: `Reset your password: ${link}`,
        html: `<p>Reset your NextDoorLearn password:</p><p><a href="${link}">${link}</a></p>`
      });
    }

    res.json({
      message: 'If an account exists for that email, a password reset link has been sent.',
      ...(process.env.NODE_ENV === 'production' || !resetToken ? {} : { resetToken })
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Unable to start password reset' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const token = sanitizeText(req.body.token, 128);
    const password = String(req.body.password || '');

    if (!token || password.length < 6) {
      return res.status(400).json({ error: 'Valid token and password of at least 6 characters are required' });
    }

    const reset = db.prepare(`
      SELECT * FROM password_reset_tokens
      WHERE token = ? AND used_at IS NULL AND expires_at > datetime('now')
    `).get(token);

    if (!reset) {
      return res.status(400).json({ error: 'Reset token is invalid or expired' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, reset.user_id);
    db.prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(reset.id);

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Unable to reset password' });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const token = sanitizeText(req.body.token, 128);
    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    const verification = db.prepare(`
      SELECT * FROM email_verification_tokens
      WHERE token = ? AND used_at IS NULL AND expires_at > datetime('now')
    `).get(token);

    if (!verification) {
      return res.status(400).json({ error: 'Verification token is invalid or expired' });
    }

    db.prepare('UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE id = ?').run(verification.user_id);
    db.prepare('UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(verification.id);

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ error: 'Unable to verify email' });
  }
});

router.post('/resend-verification', async (req, res) => {
  try {
    const normalizedEmail = String(req.body.email || '').trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }

    const user = db.prepare('SELECT id, email, email_verified_at FROM users WHERE email = ?').get(normalizedEmail);
    let verificationToken;
    if (user && !user.email_verified_at) {
      verificationToken = await sendVerificationEmail(user);
    }

    res.json({
      message: 'If the account exists and is unverified, a verification email has been sent.',
      ...(process.env.NODE_ENV === 'production' || !verificationToken ? {} : { verificationToken })
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ error: 'Unable to resend verification email' });
  }
});

module.exports = router;
