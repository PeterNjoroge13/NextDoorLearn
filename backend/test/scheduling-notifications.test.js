// Regression tests for time-zone-safe scheduling, reschedule declines, connection responses
// and push-token ownership. Runs in-process against SQLite by default; set TEST_DATABASE_URL
// to run the same assertions against PostgreSQL.
const { test, before, after, mock } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextdoorlearn-scheduling-'));
process.env.NODE_ENV = 'test';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  process.env.JWT_SECRET = 'scheduling-notifications-test-secret';
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
process.env.DATABASE_PATH = path.join(scratchDir, 'test.db');
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
delete process.env.RESEND_API_KEY;
delete process.env.STRIPE_SECRET_KEY;

// Zoom stub: the real zoom service talks to this server, so we can count the rooms it creates.
const zoomMeetings = { created: 0, deleted: 0 };
const zoomServer = http.createServer((req, res) => {
  const send = (status, payload) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(payload ? JSON.stringify(payload) : undefined);
  };
  if (req.method === 'POST' && req.url?.startsWith('/oauth/token')) {
    return send(200, { access_token: 'fake-zoom-token', expires_in: 3600 });
  }
  if (req.method === 'POST' && /^\/v2\/users\/[^/]+\/meetings$/.test(req.url || '')) {
    zoomMeetings.created += 1;
    const id = 9000 + zoomMeetings.created;
    return send(201, { id, join_url: `https://zoom.example/j/${id}`, start_url: `https://zoom.example/s/${id}` });
  }
  const meetingMatch = req.url?.match(/^\/v2\/meetings\/(\d+)$/);
  if (meetingMatch && req.method === 'DELETE') {
    zoomMeetings.deleted += 1;
    res.writeHead(204);
    return res.end();
  }
  if (meetingMatch && req.method === 'GET') {
    const id = Number(meetingMatch[1]);
    return send(200, { id, join_url: `https://zoom.example/j/${id}`, start_url: `https://zoom.example/s/${id}` });
  }
  return send(404, { message: 'Fake Zoom route not found' });
});

let db;
let app;
let apiServer;
let base;
let jwt;
let listSessionsToSync;
const googleCalls = [];

before(async () => {
  await new Promise((resolve) => zoomServer.listen(0, '127.0.0.1', resolve));
  const zoomPort = zoomServer.address().port;
  Object.assign(process.env, {
    ZOOM_ACCOUNT_ID: 'test-account',
    ZOOM_CLIENT_ID: 'test-client',
    ZOOM_CLIENT_SECRET: 'test-secret',
    ZOOM_HOST_USER_ID: 'host@example.com',
    ZOOM_TOKEN_URL: `http://127.0.0.1:${zoomPort}/oauth/token`,
    ZOOM_API_BASE_URL: `http://127.0.0.1:${zoomPort}/v2`,
  });

  db = require('../src/db/database');
  await db.initialize();

  // Google stub: routes destructure syncSessionToGoogle when they load, so replace it first.
  const googleCalendar = require('../src/services/googleCalendar');
  googleCalendar.syncSessionToGoogle = async (session, action = 'upsert') => {
    googleCalls.push({ sessionId: Number(session.id), action, scheduledDate: String(session.scheduled_date) });
    return [];
  };

  jwt = require('jsonwebtoken');
  const express = require('express');
  ({ listSessionsToSync } = require('../src/routes/google'));
  app = express();
  app.use(express.json());
  app.use('/api/sessions', require('../src/routes/sessions'));
  app.use('/api/requests', require('../src/routes/requests'));
  app.use('/api/connections', require('../src/routes/connections'));
  app.use('/api/devices', require('../src/routes/devices'));
  await new Promise((resolve) => { apiServer = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${apiServer.address().port}/api`;
});

after(async () => {
  mock.timers.reset();
  await new Promise((resolve) => apiServer?.close(resolve));
  await new Promise((resolve) => zoomServer.close(resolve));
  await db?.close?.();
  fs.rmSync(scratchDir, { recursive: true, force: true });
});

let userSequence = 0;
const createUser = async ({ role, timezone = 'UTC', name }) => {
  userSequence += 1;
  const email = `${role}-${process.pid}-${userSequence}@example.com`;
  const result = await db.prepare(`
    INSERT INTO users (email, password_hash, role, name, timezone, status, email_verified_at, verified_at)
    VALUES (?, 'not-a-real-hash', ?, ?, ?, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `).run(email, role, name || `${role} ${userSequence}`, timezone);
  const id = Number(result.lastInsertRowid);
  if (role === 'tutor') {
    for (let day = 0; day < 7; day += 1) {
      await db.prepare(`
        INSERT INTO tutor_availability_slots (tutor_id, day_of_week, start_time, end_time, timezone, is_active)
        VALUES (?, ?, '00:00', '23:59', ?, 1)
      `).run(id, day, timezone);
    }
  }
  const token = jwt.sign({ userId: id, role, email, sessionVersion: 0 }, process.env.JWT_SECRET);
  return { id, token };
};

const connect = async (student, tutor, status = 'accepted') => Number((await db.prepare(`
  INSERT INTO connections (student_id, tutor_id, status) VALUES (?, ?, ?)
`).run(student.id, tutor.id, status)).lastInsertRowid);

const api = async (route, { method = 'GET', token, body } = {}) => {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
};

const iso = (value) => new Date(value).toISOString();
const dateOnly = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);

test('a 9pm America/New_York session still shows as upcoming after UTC midnight', async () => {
  const tutor = await createUser({ role: 'tutor', timezone: 'America/New_York' });
  const student = await createUser({ role: 'student', timezone: 'America/New_York' });
  const connectionId = await connect(student, tutor);

  // 2030-01-15 is a Tuesday. 9pm EST is 02:00Z on the 16th; the 6pm session ended at 00:00Z.
  const evening = await api('/sessions', {
    method: 'POST', token: tutor.token,
    body: { connectionId, title: 'Evening algebra', scheduledDate: '2030-01-15', startTime: '21:00', endTime: '22:00' },
  });
  assert.equal(evening.status, 201, JSON.stringify(evening.body));
  assert.equal(iso(evening.body.starts_at), '2030-01-16T02:00:00.000Z');
  const finished = await api('/sessions', {
    method: 'POST', token: tutor.token,
    body: { connectionId, title: 'Already finished', scheduledDate: '2030-01-15', startTime: '18:00', endTime: '19:00' },
  });
  assert.equal(finished.status, 201, JSON.stringify(finished.body));

  // 8:30pm in New York, but already January 16th in UTC.
  mock.timers.enable({ apis: ['Date'], now: new Date('2030-01-16T01:30:00Z') });
  try {
    for (const user of [student, tutor]) {
      const upcoming = await api('/sessions/upcoming?limit=50', { token: user.token });
      assert.equal(upcoming.status, 200);
      const ids = upcoming.body.map((session) => Number(session.id));
      assert.ok(ids.includes(Number(evening.body.id)), 'tonight\'s 9pm session must still be upcoming');
      assert.ok(!ids.includes(Number(finished.body.id)), 'a session that already ended must not be upcoming');
    }

    const toSync = (await listSessionsToSync(student.id)).map((session) => Number(session.id));
    assert.ok(toSync.includes(Number(evening.body.id)), 'Google sync must include tonight\'s session');
    assert.ok(!toSync.includes(Number(finished.body.id)), 'Google sync must skip sessions that already ended');
  } finally {
    mock.timers.reset();
  }
});

test('double-booking checks compare real instants across tutor time zones', async () => {
  const student = await createUser({ role: 'student', timezone: 'America/Chicago' });
  const easternTutor = await createUser({ role: 'tutor', timezone: 'America/New_York' });
  const pacificTutor = await createUser({ role: 'tutor', timezone: 'America/Los_Angeles' });
  const easternConnection = await connect(student, easternTutor);
  const pacificConnection = await connect(student, pacificTutor);

  // Noon Eastern on 2030-02-05 is 17:00Z.
  const eastern = await api('/sessions', {
    method: 'POST', token: easternTutor.token,
    body: { connectionId: easternConnection, title: 'Eastern chemistry', scheduledDate: '2030-02-05', startTime: '12:00', endTime: '13:00' },
  });
  assert.equal(eastern.status, 201, JSON.stringify(eastern.body));

  // 9am Pacific is the same instant (17:00Z): conflict, even though the local times differ.
  const sameInstant = await api('/sessions', {
    method: 'POST', token: pacificTutor.token,
    body: { connectionId: pacificConnection, title: 'Pacific overlap', scheduledDate: '2030-02-05', startTime: '09:00', endTime: '10:00' },
  });
  assert.equal(sameInstant.status, 409, JSON.stringify(sameInstant.body));

  // Noon Pacific has the same wall-clock time but is 20:00Z: no conflict.
  const sameClock = await api('/sessions', {
    method: 'POST', token: pacificTutor.token,
    body: { connectionId: pacificConnection, title: 'Pacific noon', scheduledDate: '2030-02-05', startTime: '12:00', endTime: '13:00' },
  });
  assert.equal(sameClock.status, 201, JSON.stringify(sameClock.body));

  // Back-to-back sessions touch but do not overlap: 13:00 ET and 10:00 PT are both 18:00Z.
  const backToBack = await api('/sessions', {
    method: 'POST', token: pacificTutor.token,
    body: { connectionId: pacificConnection, title: 'Right after', scheduledDate: '2030-02-05', startTime: '10:00', endTime: '11:00' },
  });
  assert.equal(backToBack.status, 201, JSON.stringify(backToBack.body));

  // Rescheduling excludes the session being moved, so it may overlap its own old slot.
  const shifted = await api(`/sessions/${eastern.body.id}/reschedule`, {
    method: 'PATCH', token: easternTutor.token,
    body: { scheduledDate: '2030-02-05', startTime: '11:30', endTime: '12:30', reason: 'Starting a little earlier' },
  });
  assert.equal(shifted.status, 200, JSON.stringify(shifted.body));

  // ...but not onto another tutor's session at the same instant (12:00 PT = 20:00Z = 15:00 ET).
  const onto = await api(`/sessions/${eastern.body.id}/reschedule`, {
    method: 'PATCH', token: easternTutor.token,
    body: { scheduledDate: '2030-02-05', startTime: '15:00', endTime: '16:00', reason: 'Trying the afternoon' },
  });
  assert.equal(onto.status, 409, JSON.stringify(onto.body));
});

test('accepting through /requests/:id/respond notifies the student and blocked pairs are rejected', async () => {
  const tutor = await createUser({ role: 'tutor', name: 'Tutor Tess' });
  const student = await createUser({ role: 'student' });
  const connectionId = await connect(student, tutor, 'pending');

  const accepted = await api(`/requests/${connectionId}/respond`, {
    method: 'POST', token: tutor.token, body: { action: 'accept' },
  });
  assert.equal(accepted.status, 200, JSON.stringify(accepted.body));
  assert.equal(accepted.body.status, 'accepted');
  const acceptedNotice = await db.prepare(`
    SELECT * FROM notifications WHERE user_id = ? AND type = 'connection_response' AND related_id = ?
  `).get(student.id, connectionId);
  assert.ok(acceptedNotice, 'student must be notified on accept');
  assert.equal(acceptedNotice.title, 'Connection accepted!');

  const decliningStudent = await createUser({ role: 'student' });
  const declinedConnection = await connect(decliningStudent, tutor, 'pending');
  const declined = await api(`/requests/${declinedConnection}/respond`, {
    method: 'POST', token: tutor.token, body: { action: 'reject' },
  });
  assert.equal(declined.status, 200);
  assert.equal(declined.body.status, 'rejected');
  const declinedNotice = await db.prepare(`
    SELECT title FROM notifications WHERE user_id = ? AND type = 'connection_response' AND related_id = ?
  `).get(decliningStudent.id, declinedConnection);
  assert.equal(declinedNotice?.title, 'Connection declined');

  // The legacy /connections URL shares the same logic.
  const legacyStudent = await createUser({ role: 'student' });
  const legacyConnection = await connect(legacyStudent, tutor, 'pending');
  const legacy = await api(`/connections/${legacyConnection}/respond`, {
    method: 'PUT', token: tutor.token, body: { status: 'accepted' },
  });
  assert.equal(legacy.status, 200);
  assert.ok(await db.prepare(`
    SELECT id FROM notifications WHERE user_id = ? AND type = 'connection_response' AND related_id = ?
  `).get(legacyStudent.id, legacyConnection));

  // Blocked pairs are rejected on both URLs and the request stays untouched.
  const blockedStudent = await createUser({ role: 'student' });
  const blockedConnection = await connect(blockedStudent, tutor, 'pending');
  await db.prepare('INSERT INTO user_blocks (blocker_id, blocked_user_id) VALUES (?, ?)').run(blockedStudent.id, tutor.id);
  const blockedViaRequests = await api(`/requests/${blockedConnection}/respond`, {
    method: 'POST', token: tutor.token, body: { action: 'accept' },
  });
  assert.equal(blockedViaRequests.status, 403);
  const blockedViaConnections = await api(`/connections/${blockedConnection}/respond`, {
    method: 'PUT', token: tutor.token, body: { status: 'accepted' },
  });
  assert.equal(blockedViaConnections.status, 403);
  const stillPending = await db.prepare('SELECT status FROM connections WHERE id = ?').get(blockedConnection);
  assert.equal(stillPending.status, 'pending');
  assert.equal(
    (await db.prepare('SELECT COUNT(*) AS count FROM notifications WHERE user_id = ?').get(blockedStudent.id)).count,
    0
  );
});

test('declining a student reschedule restores the confirmed session at its original time', async () => {
  const tutor = await createUser({ role: 'tutor', timezone: 'America/New_York', name: 'Tutor Ray' });
  const student = await createUser({ role: 'student', timezone: 'America/New_York' });
  const connectionId = await connect(student, tutor);

  const created = await api('/sessions', {
    method: 'POST', token: tutor.token,
    body: { connectionId, title: 'Geometry review', scheduledDate: '2030-03-05', startTime: '15:00', endTime: '16:00' },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const sessionId = Number(created.body.id);
  const original = await db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  assert.equal(original.confirmation_status, 'confirmed');
  assert.ok(original.meeting_link, 'confirmed session gets a Zoom room');

  const moved = await api(`/sessions/${sessionId}/reschedule`, {
    method: 'PATCH', token: student.token,
    body: { scheduledDate: '2030-03-06', startTime: '17:00', endTime: '18:00', reason: 'Exam moved' },
  });
  assert.equal(moved.status, 200, JSON.stringify(moved.body));
  assert.equal(moved.body.confirmation_status, 'pending');
  assert.equal(moved.body.meeting_link, null);
  // The previous schedule is not exposed to clients, but it is kept on the row.
  const pending = await db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  assert.equal(iso(pending.previous_starts_at), iso(original.starts_at));

  // Moving the pending time again must keep the original confirmed slot.
  const movedAgain = await api(`/sessions/${sessionId}/reschedule`, {
    method: 'PATCH', token: student.token,
    body: { scheduledDate: '2030-03-07', startTime: '17:00', endTime: '18:00', reason: 'Actually Thursday' },
  });
  assert.equal(movedAgain.status, 200, JSON.stringify(movedAgain.body));

  const zoomBefore = zoomMeetings.created;
  googleCalls.length = 0;
  const declined = await api(`/sessions/${sessionId}/confirmation`, {
    method: 'PATCH', token: tutor.token, body: { decision: 'declined' },
  });
  assert.equal(declined.status, 200, JSON.stringify(declined.body));

  const restored = await db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  assert.equal(restored.status, 'scheduled');
  assert.equal(restored.confirmation_status, 'confirmed');
  assert.equal(dateOnly(restored.scheduled_date), '2030-03-05');
  assert.equal(String(restored.start_time).slice(0, 5), '15:00');
  assert.equal(String(restored.end_time).slice(0, 5), '16:00');
  assert.equal(iso(restored.starts_at), iso(original.starts_at));
  assert.equal(iso(restored.ends_at), iso(original.ends_at));
  assert.equal(restored.session_timezone, 'America/New_York');
  assert.equal(restored.cancelled_by, null);
  assert.equal(restored.previous_starts_at, null);
  assert.equal(restored.previous_scheduled_date, null);

  // Zoom room, calendar events and reminders are recreated like the confirm path.
  assert.equal(zoomMeetings.created, zoomBefore + 1);
  assert.ok(restored.meeting_link);
  assert.ok(googleCalls.some((call) => call.sessionId === sessionId && call.action === 'upsert'));
  const reminders = await db.prepare(`
    SELECT reminder_type, scheduled_for FROM session_reminders WHERE session_id = ? AND status = 'pending'
  `).all(sessionId);
  assert.equal(reminders.length, 4);
  for (const reminder of reminders) {
    const hours = reminder.reminder_type === '1_hour' ? 1 : 24;
    assert.equal(iso(reminder.scheduled_for), iso(new Date(original.starts_at).getTime() - hours * 3600000));
  }

  const events = await db.prepare('SELECT event_type FROM session_events WHERE session_id = ? ORDER BY id').all(sessionId);
  assert.deepEqual(events.map((event) => event.event_type), ['created', 'rescheduled', 'rescheduled', 'reschedule_declined']);
  const notice = await db.prepare(`
    SELECT title, message FROM notifications WHERE user_id = ? AND type = 'session_confirmation' AND related_id = ?
  `).get(student.id, sessionId);
  assert.equal(notice?.title, 'New time declined');
  assert.match(notice.message, /2030-03-05 at 15:00/);

  // The restored session is upcoming again (it is confirmed and in the future).
  const upcoming = await api('/sessions/upcoming?limit=50', { token: student.token });
  assert.ok(upcoming.body.some((session) => Number(session.id) === sessionId));
});

test('declining a brand-new request cancels it and settles its payment', async () => {
  const tutor = await createUser({ role: 'tutor', timezone: 'America/New_York' });
  const student = await createUser({ role: 'student', timezone: 'America/New_York' });
  const connectionId = await connect(student, tutor);

  const requested = await api('/sessions', {
    method: 'POST', token: student.token,
    body: { connectionId, title: 'New request', scheduledDate: '2030-04-02', startTime: '10:00', endTime: '11:00' },
  });
  assert.equal(requested.status, 201, JSON.stringify(requested.body));
  assert.equal(requested.body.confirmation_status, 'pending');
  const sessionId = Number(requested.body.id);
  // A ledger row with no Stripe intent yet: settlement cancels it without calling Stripe.
  await db.prepare(`
    INSERT INTO session_payments (session_id, student_id, tutor_id, amount_cents, status)
    VALUES (?, ?, ?, 2500, 'pending')
  `).run(sessionId, student.id, tutor.id);

  const declined = await api(`/sessions/${sessionId}/confirmation`, {
    method: 'PATCH', token: tutor.token, body: { decision: 'declined' },
  });
  assert.equal(declined.status, 200, JSON.stringify(declined.body));
  assert.equal(declined.body.status, 'cancelled');
  assert.equal(declined.body.confirmation_status, 'declined');
  assert.equal(declined.body.payment_status, 'cancelled');
  const payment = await db.prepare('SELECT status FROM session_payments WHERE session_id = ?').get(sessionId);
  assert.equal(payment.status, 'cancelled');
});

test('a push token registered by a second user moves to that user', async () => {
  const first = await createUser({ role: 'student' });
  const second = await createUser({ role: 'tutor' });
  const pushToken = `ExponentPushToken[shared_device_${process.pid}]`;

  const registeredFirst = await api('/devices/push-token', {
    method: 'POST', token: first.token, body: { token: pushToken, platform: 'ios', deviceName: 'Shared phone' },
  });
  assert.equal(registeredFirst.status, 200);
  const registeredSecond = await api('/devices/push-token', {
    method: 'POST', token: second.token, body: { token: pushToken, platform: 'ios', deviceName: 'Shared phone' },
  });
  assert.equal(registeredSecond.status, 200, JSON.stringify(registeredSecond.body));

  const owners = await db.prepare('SELECT user_id FROM push_devices WHERE expo_push_token = ?').all(pushToken);
  assert.deepEqual(owners.map((row) => Number(row.user_id)), [second.id]);

  // The previous owner can no longer remove the device from the new owner.
  const staleRemoval = await api('/devices/push-token', {
    method: 'DELETE', token: first.token, body: { token: pushToken },
  });
  assert.equal(staleRemoval.status, 200);
  assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM push_devices WHERE expo_push_token = ?').get(pushToken)).count, 1);
});
