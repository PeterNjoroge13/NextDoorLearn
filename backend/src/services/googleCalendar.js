const { google } = require('googleapis');
const db = require('../db/database');

const GOOGLE_PROVIDER = 'google';
const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'openid', 'email', 'profile'];

const getOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

const hasGoogleConfig = () => !!getOAuthClient();

const getGoogleIntegration = (userId) => db.prepare(`
  SELECT *
  FROM user_google_integrations
  WHERE user_id = ? AND provider = ?
`).get(userId, GOOGLE_PROVIDER);

const upsertGoogleIntegration = (userId, payload = {}) => {
  const existing = getGoogleIntegration(userId);

  const updateData = {
    accessToken: payload.accessToken ?? existing?.access_token ?? null,
    refreshToken: payload.refreshToken ?? existing?.refresh_token ?? null,
    tokenExpiry: payload.tokenExpiry ?? existing?.token_expiry ?? null,
    calendarId: payload.calendarId ?? existing?.calendar_id ?? 'primary',
    syncEnabled: payload.syncEnabled ?? existing?.sync_enabled ?? 0
  };

  if (existing) {
    db.prepare(`
      UPDATE user_google_integrations
      SET access_token = ?, refresh_token = ?, token_expiry = ?, calendar_id = ?, sync_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND provider = ?
    `).run(
      updateData.accessToken,
      updateData.refreshToken,
      updateData.tokenExpiry,
      updateData.calendarId,
      updateData.syncEnabled ? 1 : 0,
      userId,
      GOOGLE_PROVIDER
    );
    return getGoogleIntegration(userId);
  }

  db.prepare(`
    INSERT INTO user_google_integrations (
      user_id, provider, access_token, refresh_token, token_expiry, calendar_id, sync_enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    GOOGLE_PROVIDER,
    updateData.accessToken,
    updateData.refreshToken,
    updateData.tokenExpiry,
    updateData.calendarId,
    updateData.syncEnabled ? 1 : 0
  );

  return getGoogleIntegration(userId);
};

const disconnectGoogleIntegration = (userId) => {
  db.prepare(`
    DELETE FROM user_google_integrations
    WHERE user_id = ? AND provider = ?
  `).run(userId, GOOGLE_PROVIDER);
};

const createAuthUrl = (state) => {
  const oauth2Client = getOAuthClient();
  if (!oauth2Client) {
    throw new Error('Google OAuth is not configured on the server');
  }

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: GOOGLE_SCOPES,
    state
  });
};

const exchangeCodeForTokens = async (code) => {
  const oauth2Client = getOAuthClient();
  if (!oauth2Client) {
    throw new Error('Google OAuth is not configured on the server');
  }

  const { tokens } = await oauth2Client.getToken(code);
  return {
    accessToken: tokens.access_token || null,
    refreshToken: tokens.refresh_token || null,
    tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null
  };
};

const getAuthorizedCalendarClient = async (userId) => {
  const integration = getGoogleIntegration(userId);
  if (!integration || !integration.sync_enabled || !integration.access_token) {
    return null;
  }

  const oauth2Client = getOAuthClient();
  if (!oauth2Client) {
    return null;
  }

  oauth2Client.setCredentials({
    access_token: integration.access_token,
    refresh_token: integration.refresh_token || undefined,
    expiry_date: integration.token_expiry ? new Date(integration.token_expiry).getTime() : undefined
  });

  oauth2Client.on('tokens', (tokens) => {
    if (tokens.access_token || tokens.refresh_token) {
      upsertGoogleIntegration(userId, {
        accessToken: tokens.access_token || integration.access_token,
        refreshToken: tokens.refresh_token || integration.refresh_token,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : integration.token_expiry,
        syncEnabled: integration.sync_enabled,
        calendarId: integration.calendar_id
      });
    }
  });

  return {
    integration,
    calendar: google.calendar({ version: 'v3', auth: oauth2Client })
  };
};

const toDateTime = (date, time) => `${date}T${time}:00`;

const buildEventPayload = (session, timezone = null) => ({
  summary: session.title,
  description: [session.description, session.subject ? `Subject: ${session.subject}` : null, session.meeting_link ? `Meeting link: ${session.meeting_link}` : null]
    .filter(Boolean)
    .join('\n'),
  start: { dateTime: toDateTime(session.scheduled_date, session.start_time), timeZone: timezone || 'UTC' },
  end: { dateTime: toDateTime(session.scheduled_date, session.end_time), timeZone: timezone || 'UTC' }
});

const getSessionGoogleEvent = (sessionId, userId) => db.prepare(`
  SELECT event_id
  FROM session_google_events
  WHERE session_id = ? AND user_id = ? AND provider = ?
`).get(sessionId, userId, GOOGLE_PROVIDER);

const upsertSessionGoogleEvent = (sessionId, userId, eventId) => {
  db.prepare(`
    INSERT INTO session_google_events (session_id, user_id, provider, event_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(session_id, user_id, provider)
    DO UPDATE SET event_id = excluded.event_id, updated_at = CURRENT_TIMESTAMP
  `).run(sessionId, userId, GOOGLE_PROVIDER, eventId);
};

const deleteSessionGoogleEvents = (sessionId) => {
  db.prepare('DELETE FROM session_google_events WHERE session_id = ?').run(sessionId);
};

const syncSessionToGoogle = async (session, action = 'upsert') => {
  try {
    const clients = await Promise.all([
      getAuthorizedCalendarClient(session.tutor_id),
      getAuthorizedCalendarClient(session.student_id)
    ]);

    const participants = [
      { userId: session.tutor_id, client: clients[0] },
      { userId: session.student_id, client: clients[1] }
    ];

    for (const participant of participants) {
      if (!participant.client) {
        continue;
      }

      const timezoneRecord = db.prepare('SELECT timezone FROM users WHERE id = ?').get(participant.userId);
      const eventPayload = buildEventPayload(session, timezoneRecord?.timezone || null);
      const calendarId = participant.client.integration.calendar_id || 'primary';
      const existingEvent = getSessionGoogleEvent(session.id, participant.userId);

      if (action === 'delete') {
        if (existingEvent?.event_id) {
          await participant.client.calendar.events.delete({
            calendarId,
            eventId: existingEvent.event_id
          });
        }
        continue;
      }

      if (existingEvent?.event_id) {
        await participant.client.calendar.events.update({
          calendarId,
          eventId: existingEvent.event_id,
          requestBody: eventPayload
        });
      } else {
        const created = await participant.client.calendar.events.insert({
          calendarId,
          requestBody: eventPayload
        });
        if (created?.data?.id) {
          upsertSessionGoogleEvent(session.id, participant.userId, created.data.id);
          if (participant.userId === session.tutor_id) {
            db.prepare('UPDATE sessions SET google_event_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(created.data.id, session.id);
          }
        }
      }
    }
    if (action === 'delete') {
      deleteSessionGoogleEvents(session.id);
    }
  } catch (error) {
    console.error('Google Calendar sync warning:', error.message || error);
  }
};

module.exports = {
  hasGoogleConfig,
  getGoogleIntegration,
  upsertGoogleIntegration,
  disconnectGoogleIntegration,
  createAuthUrl,
  exchangeCodeForTokens,
  syncSessionToGoogle
};
