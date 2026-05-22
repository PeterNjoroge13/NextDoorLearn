const express = require('express');
const jwt = require('jsonwebtoken');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');
const {
  hasGoogleConfig,
  getGoogleIntegration,
  upsertGoogleIntegration,
  disconnectGoogleIntegration,
  createAuthUrl,
  exchangeCodeForTokens
} = require('../services/googleCalendar');

const router = express.Router();

const buildCallbackUrl = (status = 'success') => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  return `${frontendUrl}/profile?googleSync=${status}`;
};

router.get('/auth-url', authenticateToken, (req, res) => {
  try {
    if (!hasGoogleConfig()) {
      return res.status(400).json({ error: 'Google OAuth is not configured on the server' });
    }

    const state = jwt.sign(
      { userId: req.user.userId, type: 'google_oauth_state' },
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
  try {
    const { code, state } = req.query;
    if (!code || !state) {
      return res.redirect(buildCallbackUrl('missing_params'));
    }

    const decoded = jwt.verify(state, JWT_SECRET);
    if (!decoded?.userId || decoded.type !== 'google_oauth_state') {
      return res.redirect(buildCallbackUrl('invalid_state'));
    }

    const tokenPayload = await exchangeCodeForTokens(code);
    upsertGoogleIntegration(decoded.userId, {
      accessToken: tokenPayload.accessToken,
      refreshToken: tokenPayload.refreshToken,
      tokenExpiry: tokenPayload.tokenExpiry,
      syncEnabled: 1
    });

    return res.redirect(buildCallbackUrl('connected'));
  } catch (error) {
    console.error('Google callback error:', error);
    return res.redirect(buildCallbackUrl('failed'));
  }
});

router.post('/sync-toggle', authenticateToken, (req, res) => {
  try {
    const { enabled } = req.body;
    const existing = getGoogleIntegration(req.user.userId);

    if (!existing) {
      return res.status(404).json({ error: 'Google integration not connected' });
    }

    const updated = upsertGoogleIntegration(req.user.userId, {
      syncEnabled: enabled ? 1 : 0
    });

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

router.post('/disconnect', authenticateToken, (req, res) => {
  try {
    disconnectGoogleIntegration(req.user.userId);
    res.json({ message: 'Google Calendar disconnected' });
  } catch (error) {
    console.error('Disconnect Google error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/status', authenticateToken, (req, res) => {
  try {
    const integration = getGoogleIntegration(req.user.userId);
    res.json({
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
