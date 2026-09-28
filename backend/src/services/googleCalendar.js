const db = require('../db/database');
const { decryptField, encryptField, isEncryptedField } = require('../utils/fieldEncryption');
const { isFeatureDisabled } = require('./featureFlags');

const GOOGLE_PROVIDER = 'google';
const GOOGLE_SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'openid', 'email', 'profile'];
const getGoogleApi = () => require('googleapis').google;
const GOOGLE_REQUEST_OPTIONS = { timeout: 15000 };

const getOAuthClient = () => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  const google = getGoogleApi();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
};

const hasGoogleConfig = () => Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI
);
const googleCalendarAvailable = () => hasGoogleConfig() && !isFeatureDisabled('googleCalendar');

const isGoogleAuthError = (error) => {
  const status = Number(error?.code || error?.response?.status);
  const message = String(error?.message || '').toLowerCase();
  return status === 401 || message.includes('invalid_grant') || message.includes('invalid credentials');
};

const runParticipantOperations = async (participants, operation) => Promise.all(participants.map(async (participant) => {
  try {
    const result = await operation(participant);
    return { userId: participant.userId, status: 'synced', ...result };
  } catch (error) {
    return { userId: participant.userId, status: 'failed', error };
  }
}));

const getGoogleIntegration = async (userId) => {
  const integration = await db.prepare(`
    SELECT *
    FROM user_google_integrations
    WHERE user_id = ? AND provider = ?
  `).get(userId, GOOGLE_PROVIDER);
  if (!integration) return null;

  const accessToken = decryptField(integration.access_token);
  const refreshToken = decryptField(integration.refresh_token);
  if ((integration.access_token && !isEncryptedField(integration.access_token)) ||
      (integration.refresh_token && !isEncryptedField(integration.refresh_token))) {
    await db.prepare(`
      UPDATE user_google_integrations SET access_token = ?, refresh_token = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND provider = ?
    `).run(encryptField(accessToken), encryptField(refreshToken), userId, GOOGLE_PROVIDER);
  }
  return { ...integration, access_token: accessToken, refresh_token: refreshToken };
};

const upsertGoogleIntegration = async (userId, payload = {}) => {
  const existing = await getGoogleIntegration(userId);

  const updateData = {
    accessToken: payload.accessToken ?? existing?.access_token ?? null,
    refreshToken: payload.refreshToken ?? existing?.refresh_token ?? null,
    tokenExpiry: payload.tokenExpiry ?? existing?.token_expiry ?? null,
    calendarId: payload.calendarId ?? existing?.calendar_id ?? 'primary',
    syncEnabled: payload.syncEnabled ?? existing?.sync_enabled ?? 0
  };

  if (existing) {
    await db.prepare(`
      UPDATE user_google_integrations
      SET access_token = ?, refresh_token = ?, token_expiry = ?, calendar_id = ?, sync_enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND provider = ?
    `).run(
      encryptField(updateData.accessToken),
      encryptField(updateData.refreshToken),
      updateData.tokenExpiry,
      updateData.calendarId,
      updateData.syncEnabled ? 1 : 0,
      userId,
      GOOGLE_PROVIDER
    );
    return getGoogleIntegration(userId);
  }

  await db.prepare(`
    INSERT INTO user_google_integrations (
      user_id, provider, access_token, refresh_token, token_expiry, calendar_id, sync_enabled
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    GOOGLE_PROVIDER,
    encryptField(updateData.accessToken),
    encryptField(updateData.refreshToken),
    updateData.tokenExpiry,
    updateData.calendarId,
    updateData.syncEnabled ? 1 : 0
  );

  return getGoogleIntegration(userId);
};

const disconnectGoogleIntegration = async (userId) => {
  const integration = await getGoogleIntegration(userId);
  if (integration?.access_token && hasGoogleConfig()) {
    try {
      await getOAuthClient().revokeToken(integration.access_token);
    } catch (error) {
      console.error('Google token revocation warning:', error.message || error);
    }
  }
  await db.prepare(`
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
  const integration = await getGoogleIntegration(userId);
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

  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token || tokens.refresh_token) {
      await upsertGoogleIntegration(userId, {
        accessToken: tokens.access_token || integration.access_token,
        refreshToken: tokens.refresh_token || integration.refresh_token,
        tokenExpiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : integration.token_expiry,
        syncEnabled: integration.sync_enabled,
        calendarId: integration.calendar_id
      });
    }
  });

  const google = getGoogleApi();
  return {
    integration,
    calendar: google.calendar({ version: 'v3', auth: oauth2Client })
  };
};

const toDateTime = (date, time) => {
  const datePart = date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);
  const timePart = String(time).slice(0, 5);
  return `${datePart}T${timePart}:00`;
};

const buildEventPayload = (session, timezone = null, includeMeeting = true) => ({
  summary: session.title,
  description: [session.description, session.subject ? `Subject: ${session.subject}` : null, includeMeeting && session.meeting_link ? `Meeting link: ${session.meeting_link}` : null]
    .filter(Boolean)
    .join('\n'),
  location: includeMeeting ? session.meeting_link || undefined : undefined,
  start: { dateTime: toDateTime(session.scheduled_date, session.start_time), timeZone: session.session_timezone || timezone || 'UTC' },
  end: { dateTime: toDateTime(session.scheduled_date, session.end_time), timeZone: session.session_timezone || timezone || 'UTC' }
});

const getSessionGoogleEvent = async (sessionId, userId) => await db.prepare(`
  SELECT event_id
  FROM session_google_events
  WHERE session_id = ? AND user_id = ? AND provider = ?
`).get(sessionId, userId, GOOGLE_PROVIDER);

const upsertSessionGoogleEvent = async (sessionId, userId, eventId) => {
  await db.prepare(`
    INSERT INTO session_google_events (session_id, user_id, provider, event_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(session_id, user_id, provider)
    DO UPDATE SET event_id = excluded.event_id, updated_at = CURRENT_TIMESTAMP
  `).run(sessionId, userId, GOOGLE_PROVIDER, eventId);
};

const syncSessionToGoogle = async (session, action = 'upsert') => {
  if (isFeatureDisabled('googleCalendar')) {
    return [session.tutor_id, session.student_id].map((userId) => ({ userId, status: 'maintenance' }));
  }
  const payment = session.payment_status
    ? { status: session.payment_status }
    : await db.prepare('SELECT status FROM session_payments WHERE session_id = ?').get(session.id);
  const studentMeetingAccess = Number(session.agreed_hourly_rate_cents || 0) === 0 || payment?.status === 'succeeded';
  const participants = [{ userId: session.tutor_id }, { userId: session.student_id }];
  const results = await runParticipantOperations(participants, async (participant) => {
    const client = await getAuthorizedCalendarClient(participant.userId);
    if (!client) return { status: 'skipped' };
    const includeMeeting = Number(participant.userId) === Number(session.tutor_id) || studentMeetingAccess;
    const eventPayload = buildEventPayload(session, null, includeMeeting);
    const calendarId = client.integration.calendar_id || 'primary';
    const existingEvent = await getSessionGoogleEvent(session.id, participant.userId);
    try {
      if (action === 'delete') {
        if (existingEvent?.event_id) {
          await client.calendar.events.delete({ calendarId, eventId: existingEvent.event_id }, GOOGLE_REQUEST_OPTIONS);
        }
        await db.prepare(`
          DELETE FROM session_google_events WHERE session_id = ? AND user_id = ? AND provider = ?
        `).run(session.id, participant.userId, GOOGLE_PROVIDER);
        if (Number(participant.userId) === Number(session.tutor_id)) {
          await db.prepare('UPDATE sessions SET google_event_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(session.id);
        }
        return {};
      }
      if (existingEvent?.event_id) {
        await client.calendar.events.update({
          calendarId,
          eventId: existingEvent.event_id,
          requestBody: eventPayload
        }, GOOGLE_REQUEST_OPTIONS);
      } else {
        const created = await client.calendar.events.insert({ calendarId, requestBody: eventPayload }, GOOGLE_REQUEST_OPTIONS);
        if (created?.data?.id) {
          await upsertSessionGoogleEvent(session.id, participant.userId, created.data.id);
          if (Number(participant.userId) === Number(session.tutor_id)) {
            await db.prepare('UPDATE sessions SET google_event_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
              .run(created.data.id, session.id);
          }
        }
      }
      return {};
    } catch (error) {
      if (isGoogleAuthError(error)) {
        await db.prepare(`
          UPDATE user_google_integrations SET sync_enabled = 0, updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ? AND provider = ?
        `).run(participant.userId, GOOGLE_PROVIDER);
      }
      throw error;
    }
  });
  for (const result of results) {
    if (result.status === 'failed') console.error('Google Calendar participant sync warning:', result.error?.message || result.error);
  }
  return results.map(({ error, ...result }) => ({
    ...result,
    error: error ? (isGoogleAuthError(error) ? 'authorization_required' : 'provider_error') : undefined
  }));
};

module.exports = {
  hasGoogleConfig,
  googleCalendarAvailable,
  isGoogleAuthError,
  getGoogleIntegration,
  upsertGoogleIntegration,
  disconnectGoogleIntegration,
  createAuthUrl,
  exchangeCodeForTokens,
  runParticipantOperations,
  syncSessionToGoogle
};
