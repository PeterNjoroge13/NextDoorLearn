const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticateToken } = require('../middleware/auth');
const db = require('../db/database');

const router = express.Router();

// Configure multer for avatar uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../../uploads/avatars');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `avatar-${req.user.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit - will be compressed on frontend
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Upload avatar endpoint
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    
    // Update user's avatar in database
    const updateUser = db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?');
    updateUser.run(avatarUrl, req.user.id);

    res.json({ 
      message: 'Avatar uploaded successfully',
      avatarUrl: avatarUrl
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ message: 'Error uploading avatar' });
  }
});

// Delete avatar endpoint
router.delete('/avatar', authenticateToken, async (req, res) => {
  try {
    // Get current avatar URL from database
    const user = db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(req.user.id);
    
    if (user && user.avatar_url) {
      // Remove the file from filesystem
      const filePath = path.join(__dirname, '../../', user.avatar_url);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      
      // Update database to remove avatar URL
      const updateUser = db.prepare('UPDATE users SET avatar_url = NULL WHERE id = ?');
      updateUser.run(req.user.id);
    }

    res.json({ message: 'Avatar removed successfully' });
  } catch (error) {
    console.error('Avatar removal error:', error);
    res.status(500).json({ message: 'Error removing avatar' });
  }
});

// Serve uploaded files
router.use('/uploads', express.static(path.join(__dirname, '../../uploads')));

module.exports = router;
