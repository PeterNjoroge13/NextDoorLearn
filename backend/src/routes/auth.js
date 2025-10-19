const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password, role, name, bio } = req.body;

    // Validate required fields
    if (!email || !password || !role || !name) {
      return res.status(400).json({ error: 'Email, password, role, and name are required' });
    }

    if (!['student', 'tutor'].includes(role)) {
      return res.status(400).json({ error: 'Role must be either student or tutor' });
    }

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
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
    
    const result = insertUser.run(email, passwordHash, role, name, bio || '');
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
      { userId, email, role, name },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: userId, email, role, name, bio }
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

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
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
      user: { id: user.id, email: user.email, role: user.role, name: user.name, bio: user.bio }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
