const crypto = require('crypto');
const db = require('../db/database');
const { decryptField, encryptField } = require('../utils/fieldEncryption');
const { zonedTimeToUtc } = require('./reminders');

const ZOOM_TOKEN_URL = process.env.ZOOM_TOKEN_URL || 'https://zoom.us/oauth/token';
const ZOOM_API_BASE_URL = process.env.ZOOM_API_BASE_URL || 'https://api.zoom.us/v2';
const REQUEST_TIMEOUT_MS = 15000;

let cachedToken = null;
let cachedTokenExpiresAt = 0;

const zoomConfigured = () => Boolean(
  process.env.ZOOM_ACCOUNT_ID &&
  process.env.ZOOM_CLIENT_ID &&
  process.env.ZOOM_CLIENT_SECRET &&
  process.env.ZOOM_HOST_USER_ID
);

const zoomRequest = async (url, options = {}) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
};

const getZoomAccessToken = async ({ forceRefresh = false } = {}) => {
  if (!zoomConfigured()) throw Object.assign(new Error('Zoom is not configured'), { code: 'ZOOM_NOT_CONFIGURED' });
  if (!forceRefresh && cachedToken && cachedTokenExpiresAt > Date.now() + 60000) return cachedToken;

  const credentials = Buffer.from(`${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`).toString('base64');
  const tokenUrl = new URL(ZOOM_TOKEN_URL);
  tokenUrl.searchParams.set('grant_type', 'account_credentials');
  tokenUrl.searchParams.set('account_id', process.env.ZOOM_ACCOUNT_ID);
  const response = await zoomRequest(tokenUrl, {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}` }
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.reason || payload.error || `Zoom authentication returned ${response.status}`);
  }
  cachedToken = payload.access_token;
  cachedTokenExpiresAt = Date.now() + Math.max(60, Number(payload.expires_in) || 3600) * 1000;
  return cachedToken;
};

const callZoomApi = async (path, options = {}, retry = true) => {
  const accessToken = await getZoomAccessToken();
  const response = await zoomRequest(`${ZOOM_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  });
  if (response.status === 401 && retry) {
    cachedToken = null;
    cachedTokenExpiresAt = 0;
    await getZoomAccessToken({ forceRefresh: true });
    return callZoomApi(path, options, false);
  }
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || payload.reason || `Zoom API returned ${response.status}`);
  }
  return payload;
};

const buildZoomMeetingPayload = (session, timezone = 'UTC') => {
  const startsAt = zonedTimeToUtc(session.scheduled_date, session.start_time, timezone);
  return {
    topic: String(session.title || 'NextDoorLearn tutoring session').slice(0, 200),
    type: 2,
    start_time: startsAt.toISOString(),
    duration: Math.max(15, Math.min(480, Number(session.duration_minutes) || 60)),
    timezone,
    agenda: String(session.subject ? `NextDoorLearn tutoring: ${session.subject}` : 'NextDoorLearn tutoring session').slice(0, 2000),
    password: crypto.randomBytes(6).toString('base64url').slice(0, 10),
    settings: {
      waiting_room: true,
      join_before_host: false,
      mute_upon_entry: true,
      participant_video: false,
      host_video: true,
      auto_recording: 'none'
    }
  };
};

const saveMeetingError = async (sessionId, error) => {
  await db.prepare(`
    INSERT INTO session_meetings (session_id, provider, status, last_error)
    VALUES (?, 'zoom', 'error', ?)
    ON CONFLICT(session_id) DO UPDATE SET
      status = 'error', last_error = excluded.last_error, updated_at = CURRENT_TIMESTAMP
  `).run(sessionId, String(error.message || error).slice(0, 500));
};

const getMeetingRecord = (sessionId) => db.prepare(`
  SELECT * FROM session_meetings WHERE session_id = ?
`).get(sessionId);

const provisionZoomMeeting = async (session, { force = false } = {}) => {
  if (!zoomConfigured() || session.meeting_link) return session;
  const existing = await getMeetingRecord(session.id);
  if (existing?.provider_meeting_id && existing.status === 'ready' && !force) return session;

  try {
    if (existing?.provider_meeting_id && force) {
      await deleteZoomMeeting(session).catch(() => null);
    }
    const timezone = session.session_timezone || (await db.prepare('SELECT timezone FROM users WHERE id = ?').get(session.tutor_id))?.timezone || 'UTC';
    const payload = buildZoomMeetingPayload(session, timezone);
    const hostUser = encodeURIComponent(process.env.ZOOM_HOST_USER_ID);
    const meeting = await callZoomApi(`/users/${hostUser}/meetings`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!meeting?.id || !meeting?.join_url || !meeting?.start_url) throw new Error('Zoom returned incomplete meeting details');

    await db.withTransaction(async (transaction) => {
      await transaction.prepare(`
        INSERT INTO session_meetings
          (session_id, provider, provider_meeting_id, host_url, status, last_error)
        VALUES (?, 'zoom', ?, ?, 'ready', NULL)
        ON CONFLICT(session_id) DO UPDATE SET
          provider = 'zoom', provider_meeting_id = excluded.provider_meeting_id,
          host_url = excluded.host_url, status = 'ready', last_error = NULL,
          updated_at = CURRENT_TIMESTAMP
      `).run(session.id, String(meeting.id), encryptField(meeting.start_url));
      await transaction.prepare(`
        UPDATE sessions SET meeting_link = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).run(meeting.join_url, session.id);
    });
    return { ...session, meeting_link: meeting.join_url, meeting_provider: 'zoom', meeting_status: 'ready' };
  } catch (error) {
    await saveMeetingError(session.id, error);
    throw error;
  }
};

const refreshZoomMeeting = async (session, meetingRecord) => {
  const meeting = await callZoomApi(`/meetings/${encodeURIComponent(meetingRecord.provider_meeting_id)}`);
  if (!meeting?.join_url || !meeting?.start_url) throw new Error('Zoom returned incomplete meeting details');
  await db.withTransaction(async (transaction) => {
    await transaction.prepare(`
      UPDATE session_meetings SET host_url = ?, status = 'ready', last_error = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?
    `).run(encryptField(meeting.start_url), session.id);
    await transaction.prepare('UPDATE sessions SET meeting_link = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(meeting.join_url, session.id);
  });
  return { ...meetingRecord, host_url: encryptField(meeting.start_url), status: 'ready', join_url: meeting.join_url };
};

const getMeetingAccess = async (session, user) => {
  let record = await getMeetingRecord(session.id);
  if (!record) {
    return { provider: session.meeting_link ? 'external' : null, status: session.meeting_link ? 'ready' : 'unavailable', joinUrl: session.meeting_link || null };
  }
  if (record.provider === 'zoom' && record.provider_meeting_id && Number(user.userId) === Number(session.tutor_id)) {
    try {
      record = await refreshZoomMeeting(session, record);
    } catch (error) {
      await saveMeetingError(session.id, error);
      throw error;
    }
  }
  return {
    provider: record.provider,
    status: record.status,
    joinUrl: record.join_url || session.meeting_link || null,
    startUrl: Number(user.userId) === Number(session.tutor_id) ? decryptField(record.host_url) : undefined,
    error: record.status === 'error' ? 'The meeting room could not be prepared. The tutor can retry.' : undefined
  };
};

const deleteZoomMeeting = async (session) => {
  const record = await getMeetingRecord(session.id);
  if (!record) return;
  let remoteError = null;
  try {
    if (record.provider === 'zoom' && record.provider_meeting_id && zoomConfigured()) {
      await callZoomApi(`/meetings/${encodeURIComponent(record.provider_meeting_id)}`, { method: 'DELETE' });
    }
  } catch (error) {
    remoteError = error;
  } finally {
    await db.prepare('DELETE FROM session_meetings WHERE session_id = ?').run(session.id);
    await db.prepare('UPDATE sessions SET meeting_link = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(session.id);
  }
  if (remoteError) throw remoteError;
};

module.exports = {
  buildZoomMeetingPayload,
  deleteZoomMeeting,
  getMeetingAccess,
  getMeetingRecord,
  provisionZoomMeeting,
  zoomConfigured
};
