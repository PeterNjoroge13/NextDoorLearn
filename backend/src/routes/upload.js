const express = require('express');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const db = require('../db/database');
const { createImageUpload, handleSingleImage, isSupportedImage, removeUploadedFile, uploadRoot } = require('../utils/imageUpload');

const router = express.Router();
const upload = createImageUpload({ directory: 'avatars', prefix: (req) => `avatar-${req.user.userId}`, maxSizeMb: 10 });

// Upload avatar endpoint
router.post('/avatar', authenticateToken, handleSingleImage(upload, 'avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Choose a profile picture to upload' });
    }

    if (!isSupportedImage(req.file.path)) {
      removeUploadedFile(req.file.path);
      return res.status(400).json({ error: 'The selected file is not a valid JPG, PNG, or WebP image' });
    }

    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const previous = await db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(req.user.userId);
    const updateUser = await db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?');
    await updateUser.run(avatarUrl, req.user.userId);

    if (previous?.avatar_url?.startsWith('/uploads/avatars/')) {
      removeUploadedFile(path.join(uploadRoot, previous.avatar_url.replace(/^\/uploads\//, '')));
    }

    res.json({ 
      message: 'Avatar uploaded successfully',
      avatarUrl: avatarUrl
    });
  } catch (error) {
    removeUploadedFile(req.file?.path);
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: 'Error uploading profile picture' });
  }
});

// Delete avatar endpoint
router.delete('/avatar', authenticateToken, async (req, res) => {
  try {
    // Get current avatar URL from database
    const user = await db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(req.user.userId);
    
    if (user && user.avatar_url) {
      // Remove the file from filesystem
      const filePath = path.join(uploadRoot, user.avatar_url.replace(/^\/uploads\//, ''));
      removeUploadedFile(filePath);
      
      // Update database to remove avatar URL
      const updateUser = await db.prepare('UPDATE users SET avatar_url = NULL WHERE id = ?');
      await updateUser.run(req.user.userId);
    }

    res.json({ message: 'Avatar removed successfully' });
  } catch (error) {
    console.error('Avatar removal error:', error);
    res.status(500).json({ error: 'Error removing profile picture' });
  }
});

// Serve uploaded files
router.use('/uploads', express.static(uploadRoot));

module.exports = router;
