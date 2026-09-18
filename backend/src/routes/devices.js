const express = require('express');
const db = require('../db/database');
const { authenticateToken } = require('../middleware/auth');
const { sanitizeText } = require('../utils/validation');

const router = express.Router();
const isExpoPushToken = (value) => /^Expo(nent)?PushToken\[[A-Za-z0-9_-]+\]$/.test(String(value || ''));

router.post('/push-token', authenticateToken, async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const platform = ['ios', 'android'].includes(req.body.platform) ? req.body.platform : null;
    if (!isExpoPushToken(token) || !platform) {
      return res.status(400).json({ error: 'A valid Expo push token and platform are required' });
    }

    const existingDevice = await db.prepare(
      'SELECT user_id FROM push_devices WHERE expo_push_token = ?'
    ).get(token);
    if (existingDevice && Number(existingDevice.user_id) !== Number(req.user.userId)) {
      return res.status(409).json({ error: 'This push token is already registered to another account' });
    }

    await db.prepare(`
      INSERT INTO push_devices (user_id, expo_push_token, platform, device_name, enabled, updated_at, last_seen_at)
      VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT(expo_push_token) DO UPDATE SET
        platform = excluded.platform,
        device_name = excluded.device_name,
        enabled = 1,
        updated_at = CURRENT_TIMESTAMP,
        last_seen_at = CURRENT_TIMESTAMP
    `).run(req.user.userId, token, platform, sanitizeText(req.body.deviceName, 120) || null);

    res.json({ message: 'This device will receive NextDoorLearn updates' });
  } catch (error) {
    console.error('Register push device error:', error);
    res.status(500).json({ error: 'Unable to register this device' });
  }
});

router.delete('/push-token', authenticateToken, async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    await db.prepare(`
      DELETE FROM push_devices WHERE user_id = ? AND expo_push_token = ?
    `).run(req.user.userId, token);
    res.json({ message: 'Push notifications disabled for this device' });
  } catch (error) {
    console.error('Remove push device error:', error);
    res.status(500).json({ error: 'Unable to remove this device' });
  }
});

module.exports = router;
