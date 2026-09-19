const express = require('express');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const {
  hasGoogleConfig,
  getGoogleIntegration,
  upsertGoogleIntegration,
  disconnectGoogleIntegration,
  createAuthUrl,
  exchangeCodeForTokens,
  syncSessionToGoogle
} = require('../services/googleCalendar');

const router = express.Router();

const buildCallbackUrl = (status = 'success', client = 'web') => {
  if (client === 'mobile') return `nextdoorlearn://schedule?googleSync=${status}`;
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${frontendUrl}/sessions?googleSync=${status}`;
};

const syncUpcomingSessions = async (userId) => {
  const sessions = await db.prepare(`
    SELECT * FROM sessions
    WHERE (student_id = ? OR tutor_id = ?)
      AND status = 'scheduled' AND confirmation_status = 'confirmed'
      AND (scheduled_date > date('now') OR scheduled_date = date('now'))
    ORDER BY scheduled_date ASC, start_time ASC
    LIMIT 100
  `).all(userId, userId);
  for (const session of sessions) await syncSessionToGoogle(session, 'upsert');
};

router.get('/auth-url', authenticateToken, async (req, res) => {
  try {
    if (!hasGoogleConfig()) {
      return res.status(400).json({ error: 'Google OAuth is not configured on the server' });
    }

    const client = req.query.client === 'mobile' ? 'mobile' : 'web';
    const state = jwt.sign(
      { userId: req.user.userId, type: 'google_oauth_state', client },
      JWT_SECRET,
      { expiresIn: '10m' }
    );

    const authUrl = createAuthUrl(state);
    res.json({ authUrl });
  } catch (error) {
    console.error('Create Google auth URL error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/callback', async (req, res) => {
  let callbackClient = 'web';
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(buildCallbackUrl('missing_params'));
    }

    const decoded = jwt.verify(state, JWT_SECRET);
    if (!decoded?.userId || decoded.type !== 'google_oauth_state') {
      return res.redirect(buildCallbackUrl('invalid_state'));
    }
    callbackClient = decoded.client === 'mobile' ? 'mobile' : 'web';

    const tokenPayload = await exchangeCodeForTokens(code);
    await upsertGoogleIntegration(decoded.userId, {
      accessToken: tokenPayload.accessToken,
      refreshToken: tokenPayload.refreshToken,
      tokenExpiry: tokenPayload.tokenExpiry,
      syncEnabled: 1
    });
    await syncUpcomingSessions(decoded.userId);

    return res.redirect(buildCallbackUrl('connected', callbackClient));
  } catch (error) {
    console.error('Google callback error:', error);
    return res.redirect(buildCallbackUrl('failed', callbackClient));
  }
});

router.post('/sync-toggle', authenticateToken, async (req, res) => {
  try {
    const { enabled } = req.body;
    const existing = await getGoogleIntegration(req.user.userId);

    if (!existing) {
      return res.status(404).json({ error: 'Google integration not connected' });
    }

    const updated = await upsertGoogleIntegration(req.user.userId, {
      syncEnabled: enabled ? 1 : 0
    });
    if (enabled) await syncUpcomingSessions(req.user.userId);

    res.json({
      message: `Google sync ${enabled ? 'enabled' : 'disabled'}`,
      integration: {
        provider: updated.provider,
        syncEnabled: Boolean(updated.sync_enabled),
        calendarId: updated.calendar_id
      }
    });
  } catch (error) {
    console.error('Toggle Google sync error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/disconnect', authenticateToken, async (req, res) => {
  try {
    await disconnectGoogleIntegration(req.user.userId);
    res.json({ message: 'Google Calendar disconnected' });
  } catch (error) {
    console.error('Disconnect Google error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status', authenticateToken, async (req, res) => {
  try {
    const integration = await getGoogleIntegration(req.user.userId);
    res.json({
      configured: hasGoogleConfig(),
      connected: Boolean(integration),
      integration: integration
        ? {
            provider: integration.provider,
            syncEnabled: Boolean(integration.sync_enabled),
            calendarId: integration.calendar_id,
            updatedAt: integration.updated_at
          }
        : null
    });
  } catch (error) {
    console.error('Get Google status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
