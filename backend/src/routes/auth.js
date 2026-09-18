const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');
const { isValidEmail, passwordValidationError, sanitizeText } = require('../utils/validation');
const { sendEmail } = require('../services/email');
const emailTemplates = require('../services/emailTemplates');
const { createSecurityToken, hashSecurityToken } = require('../utils/securityTokens');

const router = express.Router();

const publicUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';

const accessTokenFor = (user) => jwt.sign(
  {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    sessionVersion: Number(user.session_version || 0)
  },
  JWT_SECRET,
  { expiresIn: '24h' }
);

const createRefreshToken = async (userId, deviceName = null) => {
  const token = createSecurityToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await db.prepare(`
    INSERT INTO refresh_tokens (user_id, token_hash, device_name, expires_at)
    VALUES (?, ?, ?, ?)
  `).run(userId, hashSecurityToken(token), sanitizeText(deviceName, 120) || null, expiresAt);
  return token;
};

const authPayload = async (user, deviceName = null) => ({
  token: accessTokenFor(user),
  refreshToken: await createRefreshToken(user.id, deviceName)
});

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

    const passwordError = passwordValidationError(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

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

    const session = await authPayload(
      { id: userId, email: normalizedEmail, role, name: displayName },
      req.body.deviceName
    );
    const verificationToken = await sendVerificationEmail({
      id: userId,
      email: normalizedEmail,
      name: displayName
    });

    res.status(201).json({
      message: 'User created successfully',
      ...session,
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

    if (!normalizedEmail || typeof password !== 'string' || !password || Buffer.byteLength(password, 'utf8') > 72) {
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

    const session = await authPayload(user, req.body.deviceName);
    const adminEmails = (process.env.ADMIN_EMAILS || '').split(',').map((item) => item.trim().toLowerCase());
    const adminMembership = await db.prepare('SELECT id FROM admin_memberships WHERE user_id = ?').get(user.id);

    res.json({
      message: 'Login successful',
      ...session,
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

    const passwordError = passwordValidationError(password);
    if (!token || passwordError) return res.status(400).json({ error: passwordError || 'Valid reset token is required' });

    const reset = await db.prepare(`
      SELECT * FROM password_reset_tokens
      WHERE token IN (?, ?) AND used_at IS NULL AND expires_at > datetime('now')
    `).get(token, hashSecurityToken(token));

    if (!reset) {
      return res.status(400).json({ error: 'Reset token is invalid or expired' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    await db.withTransaction(async (transaction) => {
      await transaction.prepare('UPDATE users SET password_hash = ?, session_version = session_version + 1 WHERE id = ?').run(passwordHash, reset.user_id);
      await transaction.prepare('UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL').run(reset.user_id);
      await transaction.prepare('UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = ? AND revoked_at IS NULL').run(reset.user_id);
    });

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

router.post('/refresh', async (req, res) => {
  try {
    const rawToken = String(req.body.refreshToken || '');
    if (!rawToken) return res.status(400).json({ error: 'Refresh token is required' });

    const session = await db.prepare(`
      SELECT rt.id, rt.user_id, u.email, u.role, u.name, u.status, u.session_version
      FROM refresh_tokens rt
      JOIN users u ON u.id = rt.user_id
      WHERE rt.token_hash = ? AND rt.revoked_at IS NULL AND rt.expires_at > CURRENT_TIMESTAMP
    `).get(hashSecurityToken(rawToken));

    if (!session || session.status !== 'active') {
      return res.status(401).json({ error: 'Session has expired. Please sign in again.', code: 'SESSION_EXPIRED' });
    }

    const refreshToken = await db.withTransaction(async (transaction) => {
      const revoked = await transaction.prepare(`
        UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP, last_used_at = CURRENT_TIMESTAMP
        WHERE id = ? AND revoked_at IS NULL
      `).run(session.id);
      if (!revoked.changes) {
        throw Object.assign(new Error('Session has expired. Please sign in again.'), { statusCode: 401 });
      }
      const nextToken = createSecurityToken();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await transaction.prepare(`
        INSERT INTO refresh_tokens (user_id, token_hash, device_name, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(session.user_id, hashSecurityToken(nextToken), sanitizeText(req.body.deviceName, 120) || null, expiresAt);
      return nextToken;
    });

    res.json({
      token: accessTokenFor({ id: session.user_id, email: session.email, role: session.role, name: session.name, session_version: session.session_version }),
      refreshToken
    });
  } catch (error) {
    console.error('Refresh session error:', error);
    res.status(error.statusCode || 500).json({
      error: error.statusCode ? error.message : 'Unable to refresh session',
      ...(error.statusCode ? { code: 'SESSION_EXPIRED' } : {})
    });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const rawToken = String(req.body.refreshToken || '');
    if (rawToken) {
      await db.prepare(`
        UPDATE refresh_tokens SET revoked_at = CURRENT_TIMESTAMP
        WHERE token_hash = ? AND revoked_at IS NULL
      `).run(hashSecurityToken(rawToken));
    }
    res.json({ message: 'Signed out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Unable to sign out' });
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
    const passwordError = passwordValidationError(password);
    if (!rawToken || passwordError) return res.status(400).json({ error: passwordError || 'A valid invitation is required' });

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
      const mediaId = activation.profile_picture_url?.match(/^\/api\/media\/([0-9a-f-]+)$/i)?.[1];
      if (mediaId) {
        await transaction.prepare('UPDATE media_assets SET owner_user_id = ? WHERE id = ? AND application_id = ?')
          .run(userId, mediaId, activation.application_id);
      }
      return { id: userId, email: activation.email, role: 'tutor', name: activation.name };
    });

    const session = await authPayload(user, req.body.deviceName);
    res.status(201).json({ message: 'Tutor account activated', ...session, user: { ...user, emailVerified: true } });
  } catch (error) {
    console.error('Tutor activation error:', error);
    res.status(error.statusCode || 500).json({ error: error.statusCode ? error.message : 'Unable to activate tutor account' });
  }
});

module.exports = router;
