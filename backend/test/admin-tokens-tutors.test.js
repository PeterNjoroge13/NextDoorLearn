// Admin bootstrap requires a verified email, non-access JWTs cannot authenticate, and the
// tutor list loads availability in bulk with optional paging. Runs in-process on SQLite by
// default; set TEST_DATABASE_URL to run the same assertions against PostgreSQL.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');

const scratchDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextdoorlearn-admin-tokens-'));
process.env.NODE_ENV = 'test';
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  process.env.JWT_SECRET = 'admin-tokens-tutors-test-secret';
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || '';
process.env.DATABASE_PATH = path.join(scratchDir, 'test.db');
process.env.REQUIRE_EMAIL_VERIFICATION = 'false';
const adminEmail = `owner-${process.pid}@example.com`;
process.env.ADMIN_EMAILS = adminEmail;
process.env.GOOGLE_CLIENT_ID = 'test-google-client';
process.env.GOOGLE_CLIENT_SECRET = 'test-google-secret';
process.env.GOOGLE_REDIRECT_URI = 'http://127.0.0.1/api/google/callback';
delete process.env.RESEND_API_KEY;

let db;
let apiServer;
let base;
let bcrypt;

before(async () => {
  db = require('../src/db/database');
  await db.initialize();
  bcrypt = require('bcryptjs');
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../src/routes/auth'));
  app.use('/api/users', require('../src/routes/users'));
  app.use('/api/admin', require('../src/routes/admin'));
  app.use('/api/google', require('../src/routes/google'));
  await new Promise((resolve) => { apiServer = app.listen(0, '127.0.0.1', resolve); });
  base = `http://127.0.0.1:${apiServer.address().port}/api`;
});

after(async () => {
  await new Promise((resolve) => apiServer?.close(resolve));
  await db?.close?.();
  fs.rmSync(scratchDir, { recursive: true, force: true });
});

const api = async (route, { method = 'GET', token, body } = {}) => {
  const response = await fetch(`${base}${route}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, body: await response.json() };
};

let sequence = 0;
const createUser = async ({ role = 'student', email, verifiedEmail = false, password = 'correct-horse-123' } = {}) => {
  sequence += 1;
  const address = email || `${role}-${process.pid}-${sequence}@example.com`;
  const result = await db.prepare(`
    INSERT INTO users (email, password_hash, role, name, timezone, status, email_verified_at, verified_at)
    VALUES (?, ?, ?, ?, 'UTC', 'active', ${verifiedEmail ? 'CURRENT_TIMESTAMP' : 'NULL'}, CURRENT_TIMESTAMP)
  `).run(address, await bcrypt.hash(password, 4), role, `${role} ${sequence}`);
  return { id: Number(result.lastInsertRowid), email: address, password };
};

const login = async (user) => {
  const response = await api('/auth/login', { method: 'POST', body: { email: user.email, password: user.password } });
  assert.equal(response.status, 200, JSON.stringify(response.body));
  return response.body;
};

test('ADMIN_EMAILS only grants admin access after the email is verified', async () => {
  const owner = await createUser({ email: adminEmail });
  const unverified = await login(owner);
  assert.equal(unverified.user.isAdmin, false);
  const blocked = await api('/admin/waitlist', { token: unverified.token });
  assert.equal(blocked.status, 403);
  assert.equal(await db.prepare('SELECT id FROM admin_memberships WHERE user_id = ?').get(owner.id), undefined);

  await db.prepare('UPDATE users SET email_verified_at = CURRENT_TIMESTAMP WHERE id = ?').run(owner.id);
  const verified = await login(owner);
  assert.equal(verified.user.isAdmin, true);
  const allowed = await api('/admin/waitlist', { token: verified.token });
  assert.equal(allowed.status, 200, JSON.stringify(allowed.body));

  // Existing memberships keep working; an ordinary verified user is still refused.
  const stranger = await login(await createUser({ verifiedEmail: true }));
  assert.equal((await api('/admin/waitlist', { token: stranger.token })).status, 403);
});

test('the Google OAuth state token cannot be used as a login token', async () => {
  const user = await login(await createUser({ verifiedEmail: true }));
  const profile = await api('/users/profile', { token: user.token });
  assert.equal(profile.status, 200, 'a real access token still works');

  const authUrl = await api('/google/auth-url', { token: user.token });
  assert.equal(authUrl.status, 200, JSON.stringify(authUrl.body));
  const state = new URL(authUrl.body.authUrl).searchParams.get('state');
  assert.ok(state);
  const withState = await api('/users/profile', { token: state });
  assert.equal(withState.status, 401);
});

test('the tutor list loads availability in bulk and can be paged', async () => {
  const student = await login(await createUser({ verifiedEmail: true }));
  const tutorIds = [];
  for (let index = 0; index < 3; index += 1) {
    const tutor = await createUser({ role: 'tutor', verifiedEmail: true });
    const legacy = index === 1 ? JSON.stringify({ monday: [{ start: '09:00', end: '11:00' }] }) : null;
    await db.prepare(`
      INSERT INTO tutor_profiles (user_id, subjects, availability, hourly_rate) VALUES (?, ?, ?, 0)
    `).run(tutor.id, JSON.stringify(['Math']), legacy);
    if (index === 0) {
      await db.prepare(`
        INSERT INTO tutor_availability_slots (tutor_id, day_of_week, start_time, end_time, timezone, is_active)
        VALUES (?, 2, '16:00', '18:00', 'America/New_York', 1)
      `).run(tutor.id);
    }
    tutorIds.push(tutor.id);
  }

  // Default response stays a plain array for shipped clients.
  const all = await api('/users/tutors', { token: student.token });
  assert.equal(all.status, 200, JSON.stringify(all.body));
  assert.ok(Array.isArray(all.body));
  const byId = new Map(all.body.map((tutor) => [Number(tutor.id), tutor]));
  assert.deepEqual(byId.get(tutorIds[0]).availability, [
    { dayOfWeek: 2, startTime: '16:00', endTime: '18:00', timezone: 'America/New_York' }
  ]);
  assert.deepEqual(byId.get(tutorIds[1]).availability, [
    { dayOfWeek: 1, startTime: '09:00', endTime: '11:00', timezone: null }
  ]);
  assert.equal(byId.get(tutorIds[2]).availability, null); // unchanged from before: no availability saved

  const total = all.body.length;
  const firstPage = await api('/users/tutors?limit=2', { token: student.token });
  assert.equal(firstPage.status, 200);
  assert.equal(firstPage.body.tutors.length, 2);
  assert.equal(firstPage.body.total, total);
  assert.equal(firstPage.body.offset, 0);
  assert.equal(firstPage.body.nextOffset, 2);
  const secondPage = await api(`/users/tutors?limit=2&offset=${firstPage.body.nextOffset}`, { token: student.token });
  assert.equal(secondPage.body.tutors.length, total - 2);
  assert.equal(secondPage.body.nextOffset, null);
  const pagedIds = [...firstPage.body.tutors, ...secondPage.body.tutors].map((tutor) => Number(tutor.id));
  assert.deepEqual(pagedIds, all.body.map((tutor) => Number(tutor.id)));
});
