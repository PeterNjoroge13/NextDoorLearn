const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');
const { isValidEmail, sanitizeText } = require('../utils/validation');
const { sendEmail } = require('../services/email');
const emailTemplates = require('../services/emailTemplates');
const { createSecurityToken, hashSecurityToken } = require('../utils/securityTokens');

const router = express.Router();

const publicUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

const insertExpiringToken = async (table, userId, hours = 2) => {
  const token = createSecurityToken();
  const expiresAt = new Date(Date.now() + Number(hours) * 60 * 60 * 1000).toISOString();
  await db.prepare(`UPDATE ${table} SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL`).run(userId);
  await db.prepare(`
    INSERT INTO ${table} (user_id, token, expires_at)
    VALUES (?, ?, ?)
  `).run(userId, hashSecurityToken(token), expiresAt);
  return token;
};

const sendVerificationEmail = async (user) => {
  const token = await insertExpiringToken('email_verification_tokens', user.id, 48);
  const link = `${publicUrl()}/verify-email?token=${token}`;
  const content = emailTemplates.verification(user.name, link);
  await sendEmail({
    to: user.email,
    template: 'email_verification',
    idempotencyKey: `verify_${user.id}_${hashSecurityToken(token).slice(0, 24)}`,
    subject: 'Verify your NextDoorLearn email',
    ...content
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

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const directTutorAllowed = process.env.NODE_ENV !== 'production' && process.env.ALLOW_DIRECT_TUTOR_REGISTRATION === 'true';
    if (role !== 'student' && !(role === 'tutor' && directTutorAllowed)) {
      return res.status(403).json({ error: 'Tutors must complete and activate an approved tutor application' });
    }

    // Check if user already exists
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert user
    const insertUser = await db.prepare(`
      INSERT INTO users (email, password_hash, role, name, bio)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const result = await insertUser.run(normalizedEmail, passwordHash, role, displayName, safeBio);
    const userId = result.lastInsertRowid;
    if (role === 'tutor' && directTutorAllowed) {
      await db.prepare('UPDATE users SET verified_at = CURRENT_TIMESTAMP WHERE id = ?').run(userId);
    }

    // Create profile based on role
    if (role === 'tutor') {
      const insertTutorProfile = await db.prepare(`
        INSERT INTO tutor_profiles (user_id, subjects, availability, hourly_rate)
        VALUES (?, ?, ?, ?)
      `);
      await insertTutorProfile.run(userId, '[]', '{}', 0);
    } else {
      const insertStudentProfile = await db.prepare(`
        INSERT INTO student_profiles (user_id, grade_level, subjects_needed)
        VALUES (?, ?, ?)
      `);
      await insertStudentProfile.run(userId, '', '[]');
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId, email: normalizedEmail, role, name: displayName },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    const verificationToken = await sendVerificationEmail({
      id: userId,
      email: normalizedEmail,
      name: displayName
    });

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: userId, email: normalizedEmail, role, name: displayName, bio: safeBio, emailVerified: false,
        isAdmin: (process.env.ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase()).includes(normalizedEmail)
      },
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
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ error: `Account is ${user.status || 'unavailable'}` });
    }

    // Update last_seen timestamp
    const updateLastSeen = await db.prepare('UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?');
    await updateLastSeen.run(user.id);

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase());
    const adminMembership = await db.prepare('SELECT id FROM admin_memberships WHERE user_id = ?').get(user.id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        bio: user.bio,
        emailVerified: Boolean(user.email_verified_at),
        isAdmin: Boolean(adminMembership) || adminEmails.includes(user.email)
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

    const user = await db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(normalizedEmail);
    let resetToken;

    if (user) {
      resetToken = await insertExpiringToken('password_reset_tokens', user.id, 2);
      const link = `${publicUrl()}/reset-password?token=${resetToken}`;
      const content = emailTemplates.passwordReset(user.name, link);
      await sendEmail({
        to: user.email,
        template: 'password_reset',
        idempotencyKey: `reset_${user.id}_${hashSecurityToken(resetToken).slice(0, 24)}`,
        subject: 'Reset your NextDoorLearn password',
        ...content
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

    if (!token || password.length < 8) {
      return res.status(400).json({ error: 'Valid token and password of at least 8 characters are required' });
    }

    const reset = await db.prepare(`
      SELECT * FROM password_reset_tokens
      WHERE token IN (?, ?) AND used_at IS NULL AND expires_at > datetime('now')
    `).get(token, hashSecurityToken(token));

    if (!reset) {
      return res.status(400).json({ error: 'Reset token is invalid or expired' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, reset.user_id);
    await db.prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL').run(reset.user_id);

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

    const verification = await db.prepare(`
      SELECT * FROM email_verification_tokens
      WHERE token IN (?, ?) AND used_at IS NULL AND expires_at > datetime('now')
    `).get(token, hashSecurityToken(token));

    if (!verification) {
      return res.status(400).json({ error: 'Verification token is invalid or expired' });
    }

    await db.prepare('UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE id = ?').run(verification.user_id);
    await db.prepare('UPDATE email_verification_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL').run(verification.user_id);

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

    const user = await db.prepare('SELECT id, email, name, email_verified_at FROM users WHERE email = ?').get(normalizedEmail);
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

router.get('/tutor-activation', async (req, res) => {
  try {
    const token = sanitizeText(req.query.token, 128);
    if (!token) return res.status(400).json({ error: 'Activation token is required' });
    const activation = await db.prepare(`
      SELECT ta.name, ta.email, ta.subjects, tat.expires_at
      FROM tutor_activation_tokens tat
      JOIN tutor_applications ta ON ta.id = tat.application_id
      WHERE tat.token_hash = ? AND tat.used_at IS NULL AND tat.revoked_at IS NULL
        AND tat.expires_at > CURRENT_TIMESTAMP AND ta.status = 'approved'
    `).get(hashSecurityToken(token));
    if (!activation) return res.status(400).json({ error: 'Activation link is invalid or expired' });
    res.json({ ...activation, subjects: JSON.parse(activation.subjects || '[]') });
  } catch (error) {
    console.error('Tutor activation lookup error:', error);
    res.status(500).json({ error: 'Unable to validate tutor invitation' });
  }
});

router.post('/tutor-activation', async (req, res) => {
  try {
    const rawToken = sanitizeText(req.body.token, 128);
    const password = String(req.body.password || '');
    if (!rawToken || password.length < 8) {
      return res.status(400).json({ error: 'A valid invitation and password of at least 8 characters are required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await db.withTransaction(async (transaction) => {
      const activation = await transaction.prepare(`
        SELECT tat.id AS token_id, tat.application_id, ta.*
        FROM tutor_activation_tokens tat
        JOIN tutor_applications ta ON ta.id = tat.application_id
        WHERE tat.token_hash = ? AND tat.used_at IS NULL AND tat.revoked_at IS NULL
          AND tat.expires_at > CURRENT_TIMESTAMP AND ta.status = 'approved'
      `).get(hashSecurityToken(rawToken));
      if (!activation) throw Object.assign(new Error('Activation link is invalid or expired'), { statusCode: 400 });

      const existing = await transaction.prepare('SELECT id FROM users WHERE email = ?').get(activation.email);
      if (existing) throw Object.assign(new Error('An account already exists for this email'), { statusCode: 409 });

      const result = await transaction.prepare(`
        INSERT INTO users (email, password_hash, role, name, bio, avatar_url, phone, location, email_verified_at, verified_at)
        VALUES (?, ?, 'tutor', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(activation.email, passwordHash, activation.name, activation.motivation, activation.profile_picture_url, activation.phone, activation.location);
      const userId = result.lastInsertRowid;
      await transaction.prepare(`
        INSERT INTO tutor_profiles
          (user_id, subjects, availability, hourly_rate, education, motivation, tutoring_mode, availability_notes)
        VALUES (?, ?, '{}', ?, ?, ?, ?, ?)
      `).run(userId, activation.subjects, activation.hourly_rate || 0, activation.education, activation.motivation, activation.tutoring_mode, activation.availability);
      await transaction.prepare('UPDATE tutor_activation_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?').run(activation.token_id);
      await transaction.prepare(`
        UPDATE tutor_applications SET activation_status = 'activated', activated_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(userId, activation.application_id);
      return { id: userId, email: activation.email, role: 'tutor', name: activation.name };
    });

    const token = jwt.sign({ userId: user.id, email: user.email, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
    res.status(201).json({ message: 'Tutor account activated', token, user: { ...user, emailVerified: true } });
  } catch (error) {
    console.error('Tutor activation error:', error);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Unable to activate tutor account' });
  }
});

module.exports = router;
