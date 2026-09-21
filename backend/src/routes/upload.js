const express = require('express');
const { randomUUID } = require('crypto');
const path = require('path');
const { authenticateToken } = require('../middleware/auth');
const db = require('../db/database');
const { createImageUpload, detectImageMime, handleSingleImage, removeUploadedFile, uploadRoot } = require('../utils/imageUpload');

const router = express.Router();
const upload = createImageUpload({ maxSizeMb: 5 });

// Upload avatar endpoint
router.post('/avatar', authenticateToken, handleSingleImage(upload, 'avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Choose a profile picture to upload' });
    }

    const mimeType = detectImageMime(req.file.buffer);
    if (!mimeType) {
      return res.status(400).json({ error: 'The selected file is not a valid JPG, PNG, or WebP image' });
    }

    const assetId = randomUUID();
    const avatarUrl = `/api/media/${assetId}`;
    const previous = await db.prepare('SELECT avatar_url FROM users WHERE id = ?').get(req.user.userId);
    await db.withTransaction(async (transaction) => {
      await transaction.prepare(`
        INSERT INTO media_assets (id, owner_user_id, kind, mime_type, data, byte_size)
        VALUES (?, ?, 'avatar', ?, ?, ?)
      `).run(assetId, req.user.userId, mimeType, req.file.buffer, req.file.buffer.length);
      await transaction.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(avatarUrl, req.user.userId);
      const previousMediaId = previous?.avatar_url?.match(/^\/api\/media\/([0-9a-f-]+)$/i)?.[1];
      if (previousMediaId) {
        await transaction.prepare('DELETE FROM media_assets WHERE id = ? AND owner_user_id = ?').run(previousMediaId, req.user.userId);
      }
    });

    if (previous?.avatar_url?.startsWith('/uploads/avatars/')) {
      removeUploadedFile(path.join(uploadRoot, previous.avatar_url.replace(/^\/uploads\//, '')));
    }

    res.json({ 
      message: 'Avatar uploaded successfully',
      avatarUrl: avatarUrl
    });
  } catch (error) {
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
      const mediaId = user.avatar_url.match(/^\/api\/media\/([0-9a-f-]+)$/i)?.[1];
      await db.withTransaction(async (transaction) => {
        await transaction.prepare('UPDATE users SET avatar_url = NULL WHERE id = ?').run(req.user.userId);
        if (mediaId) {
          await transaction.prepare('DELETE FROM media_assets WHERE id = ? AND owner_user_id = ?').run(mediaId, req.user.userId);
        }
      });
      if (user.avatar_url.startsWith('/uploads/avatars/')) {
        const filePath = path.join(uploadRoot, user.avatar_url.replace(/^\/uploads\//, ''));
        removeUploadedFile(filePath);
      }
    }

    res.json({ message: 'Avatar removed successfully' });
  } catch (error) {
    console.error('Avatar removal error:', error);
    res.status(500).json({ error: 'Error removing profile picture' });
  }
});

module.exports = router;
