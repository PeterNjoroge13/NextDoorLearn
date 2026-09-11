const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const port = 3219;
const base = `http://127.0.0.1:${port}/api`;
const databasePath = path.join('/tmp', `nextdoorlearn-test-${process.pid}.db`);
const server = spawn(process.execPath, ['src/server.js'], {
  cwd: path.resolve(__dirname, '..'),
  env: {
    ...process.env,
    NODE_ENV: 'test',
    PORT: String(port),
    DATABASE_URL: '',
    DATABASE_PATH: databasePath,
    JWT_SECRET: 'integration-test-secret',
    ADMIN_EMAILS: 'admin@example.com',
    ALLOW_DIRECT_TUTOR_REGISTRATION: 'false'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });
after(() => server.kill('SIGTERM'));

const waitForServer = async () => {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Test server did not start:\n${serverOutput}`);
};

const request = async (route, { method = 'GET', token, body } = {}) => {
  const form = body instanceof FormData;
  const response = await fetch(`${base}${route}`, {
    method,
    headers: {
      ...(form ? {} : { 'Content-Type': 'application/json' }),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: form ? body : body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: await response.json() };
};

const imageBlob = () => new Blob([
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
], { type: 'image/png' });

test('secure tutor activation, matching, session outcomes, reviews, and blocking work end to end', async () => {
  await waitForServer();
  const adminResponse = await request('/auth/register', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'password123', role: 'student', name: 'Admin' }
  });
  assert.equal(adminResponse.status, 201);
  assert.equal(adminResponse.body.user.isAdmin, true);

  const bypass = await request('/auth/register', {
    method: 'POST',
    body: { email: 'bypass@example.com', password: 'password123', role: 'tutor', name: 'Bypass' }
  });
  assert.equal(bypass.status, 403);

  const application = new FormData();
  Object.entries({
    name: 'Approved Tutor', email: 'approved@example.com', subjects: 'Math,Physics',
    education: 'College student', motivation: 'I want to help students.', availability: 'Weekends',
    tutoringMode: 'online', hourlyRate: '0'
  }).forEach(([key, value]) => application.append(key, value));
  application.append('profilePicture', imageBlob(), 'profile.png');
  const submitted = await request('/community/tutor-applications', { method: 'POST', body: application });
  assert.equal(submitted.status, 201);

  const approved = await request(`/admin/tutor-applications/${submitted.body.applicationId}`, {
    method: 'PATCH', token: adminResponse.body.token,
    body: { status: 'approved', reason: 'Strong community fit', internalNotes: 'Test review complete' }
  });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.activation_status, 'invited');
  assert.ok(approved.body.activationToken);

  const activated = await request('/auth/tutor-activation', {
    method: 'POST', body: { token: approved.body.activationToken, password: 'newpassword123' }
  });
  assert.equal(activated.status, 201);
  assert.equal(activated.body.user.role, 'tutor');

  const reused = await request('/auth/tutor-activation', {
    method: 'POST', body: { token: approved.body.activationToken, password: 'newpassword123' }
  });
  assert.equal(reused.status, 400);

  const recommendations = await request('/recommendations', { token: adminResponse.body.token });
  assert.ok(recommendations.body.recommendations.some((tutor) => tutor.id === activated.body.user.id));

  const blocked = await request(`/blocks/${activated.body.user.id}`, {
    method: 'POST', token: adminResponse.body.token, body: { reason: 'Test block' }
  });
  assert.equal(blocked.status, 201);
  const recommendationsAfterBlock = await request('/recommendations', { token: adminResponse.body.token });
  assert.ok(!recommendationsAfterBlock.body.recommendations.some((tutor) => tutor.id === activated.body.user.id));

  const unblocked = await request(`/blocks/${activated.body.user.id}`, { method: 'DELETE', token: adminResponse.body.token });
  assert.equal(unblocked.status, 200);
  const connection = await request('/connections/request', {
    method: 'POST', token: adminResponse.body.token, body: { tutorId: activated.body.user.id }
  });
  assert.equal(connection.status, 201);
  const accepted = await request(`/requests/${connection.body.connectionId}/respond`, {
    method: 'POST', token: activated.body.token, body: { action: 'accept' }
  });
  assert.equal(accepted.status, 200);

  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const scheduledDate = future.toISOString().slice(0, 10);
  const dayOfWeek = new Date(`${scheduledDate}T12:00:00`).getDay();
  const availability = await request('/availability/me', {
    method: 'PUT', token: activated.body.token,
    body: { timezone: 'UTC', slots: [{ dayOfWeek, startTime: '00:00', endTime: '12:00' }] }
  });
  assert.equal(availability.status, 200);
  const session = await request('/sessions', {
    method: 'POST', token: adminResponse.body.token,
    body: { connectionId: connection.body.connectionId, title: 'Algebra practice', subject: 'Math', scheduledDate, startTime: '10:00', endTime: '11:00' }
  });
  assert.equal(session.status, 201);
  assert.equal(session.body.confirmation_status, 'pending');
  const beforeConfirmation = await request('/sessions/upcoming', { token: adminResponse.body.token });
  assert.ok(!beforeConfirmation.body.some((item) => item.id === session.body.id));
  const confirmed = await request(`/sessions/${session.body.id}/confirmation`, {
    method: 'PATCH', token: activated.body.token, body: { decision: 'confirmed' }
  });
  assert.equal(confirmed.status, 200);
  const afterConfirmation = await request('/sessions/upcoming', { token: adminResponse.body.token });
  assert.ok(afterConfirmation.body.some((item) => item.id === session.body.id));

  const earlyOutcome = await request(`/sessions/${session.body.id}/outcome`, {
    method: 'PATCH', token: activated.body.token,
    body: { attendance: 'completed', tutorSummary: 'Too early' }
  });
  assert.equal(earlyOutcome.status, 409);

  const today = new Date().toISOString().slice(0, 10);
  const completedSession = await request('/sessions', {
    method: 'POST', token: activated.body.token,
    body: { connectionId: connection.body.connectionId, title: 'Completed algebra review', subject: 'Math', scheduledDate: today, startTime: '00:00', endTime: '00:30' }
  });
  assert.equal(completedSession.status, 201);
  assert.equal(completedSession.body.confirmation_status, 'confirmed');

  const studentCannotComplete = await request(`/sessions/${completedSession.body.id}/outcome`, {
    method: 'PATCH', token: adminResponse.body.token,
    body: { attendance: 'completed', tutorSummary: 'Student should not write this' }
  });
  assert.equal(studentCannotComplete.status, 409);

  const tutorOutcome = await request(`/sessions/${completedSession.body.id}/outcome`, {
    method: 'PATCH', token: activated.body.token,
    body: {
      attendance: 'completed',
      tutorSummary: 'Practiced solving two-step equations.',
      skillsPracticed: 'Isolating variables',
      nextSteps: 'Complete five practice problems before the next session.'
    }
  });
  assert.equal(tutorOutcome.status, 200);
  assert.equal(tutorOutcome.body.status, 'completed');
  assert.equal(tutorOutcome.body.student_reflection, undefined);

  const reflection = await request(`/sessions/${completedSession.body.id}/outcome`, {
    method: 'PATCH', token: adminResponse.body.token,
    body: { studentReflection: 'I can see why each inverse operation works now.', confidenceBefore: 2, confidenceAfter: 4 }
  });
  assert.equal(reflection.status, 200);
  assert.equal(reflection.body.student_reflection, 'I can see why each inverse operation works now.');

  const tutorView = await request(`/sessions/${completedSession.body.id}/outcome`, { token: activated.body.token });
  assert.equal(tutorView.status, 200);
  assert.equal(tutorView.body.student_reflection, undefined);

  const incompleteReview = await request('/reviews', {
    method: 'POST', token: adminResponse.body.token,
    body: { tutorId: activated.body.user.id, sessionId: session.body.id, rating: 5, comment: 'Not eligible yet' }
  });
  assert.equal(incompleteReview.status, 403);

  const review = await request('/reviews', {
    method: 'POST', token: adminResponse.body.token,
    body: { tutorId: activated.body.user.id, sessionId: completedSession.body.id, rating: 5, comment: 'Patient, clear, and encouraging.' }
  });
  assert.equal(review.status, 201);
  const publicReviews = await request(`/reviews/tutor/${activated.body.user.id}`);
  assert.equal(publicReviews.status, 200);
  assert.equal(publicReviews.body[0].student_name, 'NextDoorLearn student');
  assert.equal(publicReviews.body[0].student_id, undefined);
  const sessionStats = await request('/sessions/stats', { token: activated.body.token });
  assert.equal(sessionStats.status, 200);
  assert.equal(sessionStats.body.completed_sessions, 1);
  assert.equal(sessionStats.body.outcomes_recorded, 1);
  assert.equal(sessionStats.body.reflections_completed, 1);
  assert.equal(sessionStats.body.average_confidence_gain, 2);

  const outbox = await request('/admin/email-outbox', { token: adminResponse.body.token });
  assert.equal(outbox.status, 200);
  assert.ok(outbox.body.emails.some((email) => email.template === 'tutor_activation'));
  const audit = await request('/admin/audit-log', { token: adminResponse.body.token });
  assert.ok(audit.body.some((entry) => entry.action === 'tutor_application.approved'));
});
