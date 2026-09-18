const express = require('express');
const db = require('../db/database');

const router = express.Router();
const mediaIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const supportedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

router.get('/:id', async (req, res) => {
  try {
    if (!mediaIdPattern.test(req.params.id)) return res.status(404).json({ error: 'Image not found' });
    const media = await db.prepare(
      'SELECT mime_type, data, byte_size FROM media_assets WHERE id = ?'
    ).get(req.params.id);
    if (!media || !supportedMimeTypes.has(media.mime_type)) return res.status(404).json({ error: 'Image not found' });

    const data = Buffer.isBuffer(media.data) ? media.data : Buffer.from(media.data);
    res.set({
      'Content-Type': media.mime_type,
      'Content-Length': String(media.byte_size || data.length),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Disposition': 'inline',
      'X-Content-Type-Options': 'nosniff'
    });
    res.send(data);
  } catch (error) {
    console.error('Serve media error:', error);
    res.status(500).json({ error: 'Unable to load image' });
  }
});

module.exports = router;
