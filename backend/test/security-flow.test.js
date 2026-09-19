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
  for (let attempt = 0; attempt < 1200; attempt += 1) {
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

const registrationConsent = {
  ageGroup: '18+',
  termsAccepted: true,
  privacyAccepted: true,
  safetyAccepted: true,
  consentSource: 'integration_test'
};

test('secure tutor activation, matching, session outcomes, reviews, and blocking work end to end', async () => {
  await waitForServer();
  const expoPreflight = await fetch(`${base}/auth/login`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://localhost:8081',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type'
    }
  });
  assert.equal(expoPreflight.status, 204);
  assert.equal(expoPreflight.headers.get('access-control-allow-origin'), 'http://localhost:8081');

  const missingConsent = await request('/auth/register', {
    method: 'POST',
    body: { email: 'no-consent@example.com', password: 'password123', role: 'student', name: 'No Consent' }
  });
  assert.equal(missingConsent.status, 400);

  const teenWithoutPermission = await request('/auth/register', {
    method: 'POST',
    body: {
      email: 'teen-no-permission@example.com', password: 'password123', role: 'student', name: 'Teen Student',
      ...registrationConsent, ageGroup: '13-17', guardianConsent: false
    }
  });
  assert.equal(teenWithoutPermission.status, 400);

  const adminResponse = await request('/auth/register', {
    method: 'POST',
    body: { email: 'admin@example.com', password: 'password123', role: 'student', name: 'Admin', ...registrationConsent }
  });
  assert.equal(adminResponse.status, 201);
  assert.equal(adminResponse.body.user.isAdmin, true);
  assert.ok(adminResponse.body.refreshToken);
  assert.equal(adminResponse.body.user.policyVersion, '2026-09-19');
  const adminProfile = await request('/users/profile', { token: adminResponse.body.token });
  assert.equal(adminProfile.body.age_group, '18+');
  assert.deepEqual(
    adminProfile.body.policyAcceptances.map((item) => item.policy_type).sort(),
    ['community_safety', 'privacy', 'terms']
  );

  const refreshed = await request('/auth/refresh', {
    method: 'POST', body: { refreshToken: adminResponse.body.refreshToken, deviceName: 'Integration test phone' }
  });
  assert.equal(refreshed.status, 200);
  assert.ok(refreshed.body.token);
  assert.ok(refreshed.body.refreshToken);
  const reusedRefreshToken = await request('/auth/refresh', {
    method: 'POST', body: { refreshToken: adminResponse.body.refreshToken }
  });
  assert.equal(reusedRefreshToken.status, 401);

  const oversizedPassword = await request('/auth/register', {
    method: 'POST',
    body: { email: 'oversized@example.com', password: 'a'.repeat(73), role: 'student', name: 'Oversized Password', ...registrationConsent }
  });
  assert.equal(oversizedPassword.status, 400);

  const concurrentSession = await request('/auth/login', {
    method: 'POST', body: { email: 'admin@example.com', password: 'password123' }
  });
  const concurrentRefreshes = await Promise.all([
    request('/auth/refresh', { method: 'POST', body: { refreshToken: concurrentSession.body.refreshToken } }),
    request('/auth/refresh', { method: 'POST', body: { refreshToken: concurrentSession.body.refreshToken } })
  ]);
  assert.deepEqual(concurrentRefreshes.map(({ status }) => status).sort(), [200, 401]);

  const passwordChangeUser = await request('/auth/register', {
    method: 'POST',
    body: { email: 'password-change@example.com', password: 'password123', role: 'student', name: 'Password Change', ...registrationConsent }
  });
  const changedPassword = await request('/users/change-password', {
    method: 'PUT', token: passwordChangeUser.body.token,
    body: { currentPassword: 'password123', newPassword: 'updated-password123' }
  });
  assert.equal(changedPassword.status, 200);
  assert.equal(changedPassword.body.reauthenticate, true);
  const accessAfterPasswordChange = await request('/users/profile', { token: passwordChangeUser.body.token });
  assert.equal(accessAfterPasswordChange.status, 401);
  const refreshAfterPasswordChange = await request('/auth/refresh', {
    method: 'POST', body: { refreshToken: passwordChangeUser.body.refreshToken }
  });
  assert.equal(refreshAfterPasswordChange.status, 401);
  const oldPasswordLogin = await request('/auth/login', {
    method: 'POST', body: { email: 'password-change@example.com', password: 'password123' }
  });
  assert.equal(oldPasswordLogin.status, 401);
  const changedPasswordLogin = await request('/auth/login', {
    method: 'POST', body: { email: 'password-change@example.com', password: 'updated-password123' }
  });
  assert.equal(changedPasswordLogin.status, 200);

  const passwordResetUser = await request('/auth/register', {
    method: 'POST',
    body: { email: 'password-reset@example.com', password: 'password123', role: 'student', name: 'Password Reset', ...registrationConsent }
  });
  const forgotPassword = await request('/auth/forgot-password', {
    method: 'POST', body: { email: 'password-reset@example.com' }
  });
  assert.equal(forgotPassword.status, 200);
  assert.ok(forgotPassword.body.resetToken);
  const resetPassword = await request('/auth/reset-password', {
    method: 'POST', body: { token: forgotPassword.body.resetToken, password: 'reset-password123' }
  });
  assert.equal(resetPassword.status, 200);
  const accessAfterPasswordReset = await request('/users/profile', { token: passwordResetUser.body.token });
  assert.equal(accessAfterPasswordReset.status, 401);
  const refreshAfterPasswordReset = await request('/auth/refresh', {
    method: 'POST', body: { refreshToken: passwordResetUser.body.refreshToken }
  });
  assert.equal(refreshAfterPasswordReset.status, 401);
  const resetPasswordLogin = await request('/auth/login', {
    method: 'POST', body: { email: 'password-reset@example.com', password: 'reset-password123' }
  });
  assert.equal(resetPasswordLogin.status, 200);

  const pushDevice = await request('/devices/push-token', {
    method: 'POST', token: adminResponse.body.token,
    body: { token: 'ExpoPushToken[integration_test]', platform: 'ios', deviceName: 'Test phone' }
  });
  assert.equal(pushDevice.status, 200);
  const removedPushDevice = await request('/devices/push-token', {
    method: 'DELETE', token: adminResponse.body.token,
    body: { token: 'ExpoPushToken[integration_test]' }
  });
  assert.equal(removedPushDevice.status, 200);

  const avatar = new FormData();
  avatar.append('avatar', imageBlob(), 'avatar.png');
  const uploadedAvatar = await request('/upload/avatar', {
    method: 'POST', token: adminResponse.body.token, body: avatar
  });
  assert.equal(uploadedAvatar.status, 200);
  assert.match(uploadedAvatar.body.avatarUrl, /^\/api\/media\//);
  const avatarResponse = await fetch(`http://127.0.0.1:${port}${uploadedAvatar.body.avatarUrl}`);
  assert.equal(avatarResponse.status, 200);
  assert.equal(avatarResponse.headers.get('content-type'), 'image/png');
  assert.ok((await avatarResponse.arrayBuffer()).byteLength > 0);

  const bypass = await request('/auth/register', {
    method: 'POST',
    body: { email: 'bypass@example.com', password: 'password123', role: 'tutor', name: 'Bypass', ...registrationConsent }
  });
  assert.equal(bypass.status, 403);

  const application = new FormData();
  Object.entries({
    name: 'Approved Tutor', email: 'approved@example.com', subjects: 'Math,Physics',
    education: 'College student', motivation: 'I want to help students.', availability: 'Weekends',
    tutoringMode: 'online', hourlyRate: '0', isAdult: 'true', termsAccepted: 'true',
    privacyAccepted: 'true', safetyAccepted: 'true'
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
  const activatedProfile = await request('/users/profile', { token: activated.body.token });
  assert.match(activatedProfile.body.avatar_url, /^\/api\/media\//);
  const tutorPhoto = await fetch(`http://127.0.0.1:${port}${activatedProfile.body.avatar_url}`);
  assert.equal(tutorPhoto.status, 200);
  assert.equal(tutorPhoto.headers.get('content-type'), 'image/png');

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

  const joinedWaitlist = await request('/community/waitlist/me', {
    method: 'PUT', token: adminResponse.body.token,
    body: {
      subjects: ['Math'], gradeLevel: 'College', budgetPreference: 'Free or volunteer',
      tutoringMode: 'online', preferredSchedule: 'Weekends', learningGoals: 'Build confidence in algebra.'
    }
  });
  assert.equal(joinedWaitlist.status, 200);
  const waitlist = await request('/admin/waitlist', { token: adminResponse.body.token });
  assert.equal(waitlist.status, 200);
  const waitlistEntry = waitlist.body.find((entry) => entry.email === 'admin@example.com');
  assert.ok(waitlistEntry);
  const waitlistRecommendations = await request(`/admin/waitlist/${waitlistEntry.id}/recommendations`, { token: adminResponse.body.token });
  assert.equal(waitlistRecommendations.status, 200);
  assert.ok(waitlistRecommendations.body.recommendations.some((tutor) => tutor.id === activated.body.user.id));
  const contacted = await request(`/admin/waitlist/${waitlistEntry.id}/actions`, {
    method: 'POST', token: adminResponse.body.token,
    body: { action: 'contacted', adminNotes: 'Student confirmed weekend availability.' }
  });
  assert.equal(contacted.status, 200);
  assert.ok(contacted.body.contacted_at);
  const matched = await request(`/admin/waitlist/${waitlistEntry.id}/actions`, {
    method: 'POST', token: adminResponse.body.token,
    body: { action: 'match', tutorId: activated.body.user.id, adminNotes: 'Strong subject and affordability fit.' }
  });
  assert.equal(matched.status, 200);
  assert.equal(matched.body.status, 'matched');
  assert.equal(matched.body.matched_tutor_name, 'Approved Tutor');
  const savedNotes = await request(`/admin/waitlist/${waitlistEntry.id}/actions`, {
    method: 'POST', token: adminResponse.body.token,
    body: { action: 'notes', adminNotes: 'Tutor invitation sent; monitor acceptance.' }
  });
  assert.equal(savedNotes.status, 200);
  assert.equal(savedNotes.body.admin_notes, 'Tutor invitation sent; monitor acceptance.');
  const reopened = await request(`/admin/waitlist/${waitlistEntry.id}/actions`, {
    method: 'POST', token: adminResponse.body.token,
    body: { action: 'reopen', adminNotes: 'Retry the match after confirming availability.' }
  });
  assert.equal(reopened.status, 200);
  assert.equal(reopened.body.status, 'open');
  const recommendationsAfterReopen = await request(`/admin/waitlist/${waitlistEntry.id}/recommendations`, { token: adminResponse.body.token });
  assert.ok(recommendationsAfterReopen.body.recommendations.some((tutor) => tutor.id === activated.body.user.id));
  const rematched = await request(`/admin/waitlist/${waitlistEntry.id}/actions`, {
    method: 'POST', token: adminResponse.body.token,
    body: { action: 'match', tutorId: activated.body.user.id, adminNotes: 'Availability reconfirmed.' }
  });
  assert.equal(rematched.status, 200);
  const studentWaitlist = await request('/community/waitlist/me', { token: adminResponse.body.token });
  assert.equal(studentWaitlist.body.matched_tutor_name, 'Approved Tutor');
  const tutorRequests = await request('/requests', { token: activated.body.token });
  const matchedRequest = tutorRequests.body.find((item) => item.student_name === 'Admin');
  assert.ok(matchedRequest);
  const connectionId = matchedRequest.id;
  const accepted = await request(`/requests/${connectionId}/respond`, {
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
    body: { connectionId, title: 'Algebra practice', subject: 'Math', scheduledDate, startTime: '10:00', endTime: '11:00' }
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
    body: { connectionId, title: 'Completed algebra review', subject: 'Math', scheduledDate: today, startTime: '00:00', endTime: '00:30' }
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
  assert.ok(audit.body.some((entry) => entry.action === 'waitlist.matched'));

  const disposable = await request('/auth/register', {
    method: 'POST', body: { email: 'delete-me@example.com', password: 'password123', role: 'student', name: 'Delete Me', ...registrationConsent }
  });
  assert.equal(disposable.status, 201);
  const wrongPasswordDeletion = await request('/users/account', {
    method: 'DELETE', token: disposable.body.token,
    body: { currentPassword: 'wrong-password', confirmation: 'DELETE' }
  });
  assert.equal(wrongPasswordDeletion.status, 401);
  const deleted = await request('/users/account', {
    method: 'DELETE', token: disposable.body.token,
    body: { currentPassword: 'password123', confirmation: 'DELETE' }
  });
  assert.equal(deleted.status, 200);
  const deletedLogin = await request('/auth/login', {
    method: 'POST', body: { email: 'delete-me@example.com', password: 'password123' }
  });
  assert.equal(deletedLogin.status, 401);
});
