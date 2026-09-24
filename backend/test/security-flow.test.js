const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const path = require('node:path');

const port = 3219;
const base = `http://127.0.0.1:${port}/api`;
const databasePath = path.join('/tmp', `nextdoorlearn-test-${process.pid}.db`);
const zoomPort = 3229;
let zoomMeetingSequence = 0;
const zoomServer = http.createServer((req, res) => {
  const send = (status, payload) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(payload ? JSON.stringify(payload) : undefined);
  };
  if (req.method === 'POST' && req.url?.startsWith('/oauth/token')) {
    return send(200, { access_token: 'fake-zoom-token', expires_in: 3600 });
  }
  if (req.method === 'POST' && /^\/v2\/users\/[^/]+\/meetings$/.test(req.url || '')) {
    zoomMeetingSequence += 1;
    return send(201, {
      id: zoomMeetingSequence,
      join_url: `https://zoom.example/j/${zoomMeetingSequence}`,
      start_url: `https://zoom.example/s/${zoomMeetingSequence}?zak=initial`
    });
  }
  const meetingMatch = req.url?.match(/^\/v2\/meetings\/(\d+)$/);
  if (meetingMatch && req.method === 'GET') {
    return send(200, {
      id: Number(meetingMatch[1]),
      join_url: `https://zoom.example/j/${meetingMatch[1]}`,
      start_url: `https://zoom.example/s/${meetingMatch[1]}?zak=refreshed`
    });
  }
  if (meetingMatch && req.method === 'DELETE') {
    res.writeHead(204);
    return res.end();
  }
  return send(404, { message: 'Fake Zoom route not found' });
});
zoomServer.listen(zoomPort, '127.0.0.1');
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
    ALLOW_DIRECT_TUTOR_REGISTRATION: 'false',
    ZOOM_ACCOUNT_ID: 'test-account',
    ZOOM_CLIENT_ID: 'test-client',
    ZOOM_CLIENT_SECRET: 'test-secret',
    ZOOM_HOST_USER_ID: 'host@example.com',
    MESSAGE_RATE_LIMIT_MAX: '500',
    ZOOM_TOKEN_URL: `http://127.0.0.1:${zoomPort}/oauth/token`,
    ZOOM_API_BASE_URL: `http://127.0.0.1:${zoomPort}/v2`
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverOutput = '';
server.stdout.on('data', (chunk) => { serverOutput += chunk; });
server.stderr.on('data', (chunk) => { serverOutput += chunk; });
after(() => {
  server.kill('SIGTERM');
  zoomServer.close();
});

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
  const health = await fetch(`${base}/health`);
  assert.match(health.headers.get('x-request-id') || '', /^[0-9a-f-]{36}$/i);
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
  assert.equal(adminResponse.body.user.policyVersion, '2026-09-21');
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

  const defaultNotificationPreferences = await request('/notifications/preferences', {
    token: adminResponse.body.token
  });
  assert.equal(defaultNotificationPreferences.status, 200);
  assert.equal(defaultNotificationPreferences.body.messagesEnabled, true);
  assert.equal(defaultNotificationPreferences.body.emailEnabled, true);
  const invalidNotificationPreference = await request('/notifications/preferences', {
    method: 'PUT', token: adminResponse.body.token, body: { pushEnabled: 'yes' }
  });
  assert.equal(invalidNotificationPreference.status, 400);

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

  const excessiveRateApplication = new FormData();
  Object.entries({
    name: 'Expensive Tutor', email: 'expensive@example.com', subjects: 'Math',
    education: 'College student', motivation: 'I want to help students.', availability: 'Weekends',
    tutoringMode: 'online', hourlyRate: '26', isAdult: 'true', termsAccepted: 'true',
    privacyAccepted: 'true', safetyAccepted: 'true'
  }).forEach(([key, value]) => excessiveRateApplication.append(key, value));
  excessiveRateApplication.append('profilePicture', imageBlob(), 'profile.png');
  const rejectedExpensiveApplication = await request('/community/tutor-applications', {
    method: 'POST', body: excessiveRateApplication
  });
  assert.equal(rejectedExpensiveApplication.status, 400);

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
  assert.match(approved.body.activation.url, /\/activate-tutor\?token=/);
  assert.ok(new Date(approved.body.activation.expiresAt).getTime() > Date.now());
  assert.equal(approved.body.activation.emailProviderConfigured, false);

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

  const invalidLanguages = await request('/users/profile', {
    method: 'PUT', token: adminResponse.body.token, body: { languages: 'English' }
  });
  assert.equal(invalidLanguages.status, 400);
  const invalidStudentBudget = await request('/users/profile', {
    method: 'PUT', token: adminResponse.body.token, body: { profile: { budget_preference: 'under-100' } }
  });
  assert.equal(invalidStudentBudget.status, 400);
  const invalidTutorRate = await request('/users/profile', {
    method: 'PUT', token: activated.body.token, body: { profile: { hourly_rate: -1 } }
  });
  assert.equal(invalidTutorRate.status, 400);
  const excessiveTutorRate = await request('/users/profile', {
    method: 'PUT', token: activated.body.token, body: { profile: { hourly_rate: 26 } }
  });
  assert.equal(excessiveTutorRate.status, 400);
  const invalidTutorSubjects = await request('/users/profile', {
    method: 'PUT', token: activated.body.token, body: { profile: { subjects: 'Math' } }
  });
  assert.equal(invalidTutorSubjects.status, 400);
  const validTutorProfile = await request('/users/profile', {
    method: 'PUT', token: activated.body.token,
    body: {
      languages: ['English', 'English', 'Spanish'],
      profile: { hourly_rate: 25, experience_years: 3, max_students: 8, subjects: ['Math', 'Physics'] }
    }
  });
  assert.equal(validTutorProfile.status, 200);

  const reused = await request('/auth/tutor-activation', {
    method: 'POST', body: { token: approved.body.activationToken, password: 'newpassword123' }
  });
  assert.equal(reused.status, 400);

  const recommendations = await request('/recommendations', { token: adminResponse.body.token });
  assert.ok(recommendations.body.recommendations.some((tutor) => tutor.id === activated.body.user.id));

  const freeOnlyProfile = await request('/users/profile', {
    method: 'PUT', token: adminResponse.body.token, body: { profile: { budget_preference: 'free' } }
  });
  assert.equal(freeOnlyProfile.status, 200);
  const freeOnlyRecommendations = await request('/recommendations', { token: adminResponse.body.token });
  assert.ok(!freeOnlyRecommendations.body.recommendations.some((tutor) => tutor.id === activated.body.user.id));
  const flexibleProfile = await request('/users/profile', {
    method: 'PUT', token: adminResponse.body.token, body: { profile: { budget_preference: 'flexible' } }
  });
  assert.equal(flexibleProfile.status, 200);

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
      subjects: ['Math'], gradeLevel: 'College', budgetPreference: 'under-25',
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

  const mutedMessages = await request('/notifications/preferences', {
    method: 'PUT', token: activated.body.token, body: { messagesEnabled: false }
  });
  assert.equal(mutedMessages.status, 200);
  const mutedMessage = await request('/messages/send', {
    method: 'POST', token: adminResponse.body.token,
    body: { connectionId, content: 'This message should not create an alert.' }
  });
  assert.equal(mutedMessage.status, 201);
  const notificationsWhileMuted = await request('/notifications?limit=100', { token: activated.body.token });
  assert.ok(!notificationsWhileMuted.body.notifications.some((item) => item.message.includes('This message should not')));
  const unmutedMessages = await request('/notifications/preferences', {
    method: 'PUT', token: activated.body.token, body: { messagesEnabled: true }
  });
  assert.equal(unmutedMessages.status, 200);
  const visibleMessage = await request('/messages/send', {
    method: 'POST', token: adminResponse.body.token,
    body: { connectionId, content: 'This message should create an alert.' }
  });
  assert.equal(visibleMessage.status, 201);
  const latestVisibleMessage = await request('/messages/send', {
    method: 'POST', token: adminResponse.body.token,
    body: { connectionId, content: 'This newer message should replace the unread alert.' }
  });
  assert.equal(latestVisibleMessage.status, 201);
  const notificationsAfterUnmute = await request('/notifications?limit=100', { token: activated.body.token });
  const messageNotifications = notificationsAfterUnmute.body.notifications.filter((item) => item.type === 'message');
  assert.equal(messageNotifications.length, 1);
  assert.match(messageNotifications[0].message, /This newer message should replace/);
  const connectedPresence = await request(`/status/user/${activated.body.user.id}`, { token: adminResponse.body.token });
  assert.equal(connectedPresence.status, 200);
  const unrelatedPresence = await request(`/status/user/${activated.body.user.id}`, { token: changedPasswordLogin.body.token });
  assert.equal(unrelatedPresence.status, 404);

  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const scheduledDate = future.toISOString().slice(0, 10);
  const dayOfWeek = new Date(`${scheduledDate}T12:00:00`).getDay();
  const availability = await request('/availability/me', {
    method: 'PUT', token: activated.body.token,
    body: { timezone: 'UTC', slots: [{ dayOfWeek, startTime: '00:00', endTime: '12:00' }] }
  });
  assert.equal(availability.status, 200);
  assert.equal(availability.body.timezone, 'UTC');
  const invalidTimezone = await request('/availability/me', {
    method: 'PUT', token: activated.body.token,
    body: { timezone: 'Not/A_Timezone', slots: [{ dayOfWeek, startTime: '09:00', endTime: '10:00' }] }
  });
  assert.equal(invalidTimezone.status, 400);
  const oversizedAvailability = await request('/availability/me', {
    method: 'PUT', token: activated.body.token,
    body: { timezone: 'UTC', slots: Array.from({ length: 51 }, () => ({ dayOfWeek: 1, startTime: '09:00', endTime: '10:00' })) }
  });
  assert.equal(oversizedAvailability.status, 400);
  const invalidAvailabilityDate = await request(`/availability/tutor/${activated.body.user.id}?date=not-a-date`, {
    token: adminResponse.body.token
  });
  assert.equal(invalidAvailabilityDate.status, 400);
  const studentCustomMeeting = await request('/sessions', {
    method: 'POST', token: adminResponse.body.token,
    body: { connectionId, title: 'Unsafe link attempt', scheduledDate, startTime: '10:00', endTime: '11:00', meetingLink: 'https://student.example/room' }
  });
  assert.equal(studentCustomMeeting.status, 403);
  const insecureTutorMeeting = await request('/sessions', {
    method: 'POST', token: activated.body.token,
    body: { connectionId, title: 'Insecure room', scheduledDate, startTime: '10:00', endTime: '11:00', meetingLink: 'http://tutor.example/room' }
  });
  assert.equal(insecureTutorMeeting.status, 400);
  const mutedSessionEmail = await request('/notifications/preferences', {
    method: 'PUT', token: activated.body.token, body: { emailEnabled: false }
  });
  assert.equal(mutedSessionEmail.status, 200);
  const session = await request('/sessions', {
    method: 'POST', token: adminResponse.body.token,
    body: { connectionId, title: 'Algebra practice', subject: 'Math', scheduledDate, startTime: '10:00', endTime: '11:00' }
  });
  assert.equal(session.status, 201);
  assert.equal(session.body.confirmation_status, 'pending');
  assert.equal(session.body.session_timezone, 'UTC');
  assert.equal(session.body.agreed_hourly_rate_cents, 2500);
  assert.ok(session.body.starts_at);
  assert.ok(session.body.ends_at);
  const restoredSessionEmail = await request('/notifications/preferences', {
    method: 'PUT', token: activated.body.token, body: { emailEnabled: true }
  });
  assert.equal(restoredSessionEmail.status, 200);
  const beforeConfirmation = await request('/sessions/upcoming', { token: adminResponse.body.token });
  assert.ok(!beforeConfirmation.body.some((item) => item.id === session.body.id));
  const confirmed = await request(`/sessions/${session.body.id}/confirmation`, {
    method: 'PATCH', token: activated.body.token, body: { decision: 'confirmed' }
  });
  assert.equal(confirmed.status, 200);
  const paymentSummary = await request(`/payments/sessions/${session.body.id}`, { token: adminResponse.body.token });
  assert.equal(paymentSummary.status, 200);
  assert.equal(paymentSummary.body.amountCents, 2500);
  assert.equal(paymentSummary.body.status, 'unpaid');
  assert.equal(paymentSummary.body.canPay, true);
  assert.equal(paymentSummary.body.configured, false);
  const adminPayments = await request('/admin/payments', { token: adminResponse.body.token });
  assert.equal(adminPayments.status, 200);
  assert.equal(adminPayments.body.configured, false);
  assert.deepEqual(adminPayments.body.payments, []);
  assert.equal(adminPayments.body.summary.collected_cents, 0);
  const tutorCannotReviewPayments = await request('/admin/payments', { token: activated.body.token });
  assert.equal(tutorCannotReviewPayments.status, 403);
  const unsafeRefund = await request('/admin/payments/1/refund', {
    method: 'POST', token: adminResponse.body.token,
    body: { reason: 'Student requested a refund', confirmation: 'yes' }
  });
  assert.equal(unsafeRefund.status, 400);
  const unconfiguredRefund = await request('/admin/payments/1/refund', {
    method: 'POST', token: adminResponse.body.token,
    body: { reason: 'Student requested a refund', confirmation: 'REFUND' }
  });
  assert.equal(unconfiguredRefund.status, 503);
  const tutorPaymentSummary = await request(`/payments/sessions/${session.body.id}`, { token: activated.body.token });
  assert.equal(tutorPaymentSummary.status, 200);
  assert.equal(tutorPaymentSummary.body.canPay, false);
  const cannotPayWithoutTutorPayouts = await request(`/payments/sessions/${session.body.id}/intent`, {
    method: 'POST', token: adminResponse.body.token
  });
  assert.equal(cannotPayWithoutTutorPayouts.status, 409);
  const studentCannotStartTutorOnboarding = await request('/payments/account/onboarding-link', {
    method: 'POST', token: adminResponse.body.token
  });
  assert.equal(studentCannotStartTutorOnboarding.status, 403);
  const payoutStatus = await request('/payments/account', { token: activated.body.token });
  assert.equal(payoutStatus.status, 200);
  assert.equal(payoutStatus.body.onboardingStatus, 'not_started');
  const meetingAccess = await request(`/sessions/${session.body.id}/meeting`, { token: adminResponse.body.token });
  assert.equal(meetingAccess.status, 200);
  assert.equal(meetingAccess.body.status, 'ready');
  assert.equal(meetingAccess.body.joinUrl, 'https://zoom.example/j/1');
  assert.equal(meetingAccess.body.startUrl, undefined);
  const tutorMeetingAccess = await request(`/sessions/${session.body.id}/meeting`, { token: activated.body.token });
  assert.equal(tutorMeetingAccess.status, 200);
  assert.equal(tutorMeetingAccess.body.startUrl, 'https://zoom.example/s/1?zak=refreshed');
  const studentCannotCreateSeries = await request('/sessions', {
    method: 'POST', token: adminResponse.body.token,
    body: { connectionId, title: 'Weekly student request', subject: 'Math', scheduledDate, startTime: '13:00', endTime: '14:00', recurrenceCount: 3 }
  });
  assert.equal(studentCannotCreateSeries.status, 403);
  const recurringSessions = await request('/sessions', {
    method: 'POST', token: activated.body.token,
    body: { connectionId, title: 'Weekly algebra series', subject: 'Math', scheduledDate, startTime: '11:00', endTime: '12:00', recurrenceCount: 3 }
  });
  assert.equal(recurringSessions.status, 201);
  assert.equal(recurringSessions.body.series_count, 3);
  assert.equal(recurringSessions.body.series_index, 1);
  assert.equal(recurringSessions.body.series_sessions.length, 3);
  assert.ok(recurringSessions.body.series_sessions.every((item) => item.series_id === recurringSessions.body.series_id));
  assert.deepEqual(
    recurringSessions.body.series_sessions.map((item) => item.series_index),
    [1, 2, 3]
  );
  const invalidSeries = await request('/sessions', {
    method: 'POST', token: activated.body.token,
    body: { connectionId, title: 'Too many sessions', subject: 'Math', scheduledDate, startTime: '14:00', endTime: '15:00', recurrenceCount: 13 }
  });
  assert.equal(invalidSeries.status, 400);
  const studentCannotProvisionMeeting = await request(`/sessions/${session.body.id}/meeting`, {
    method: 'POST', token: adminResponse.body.token
  });
  assert.equal(studentCannotProvisionMeeting.status, 404);
  const afterConfirmation = await request('/sessions/upcoming', { token: adminResponse.body.token });
  const confirmedSession = afterConfirmation.body.find((item) => item.id === session.body.id);
  assert.ok(confirmedSession);
  assert.equal(confirmedSession.meeting_link, 'https://zoom.example/j/1');
  assert.equal(confirmedSession.host_url, undefined);

  const blockingSession = await request('/sessions', {
    method: 'POST', token: activated.body.token,
    body: { connectionId, title: 'Earlier practice', subject: 'Math', scheduledDate, startTime: '08:00', endTime: '09:00' }
  });
  assert.equal(blockingSession.status, 201);
  assert.equal(blockingSession.body.confirmation_status, 'confirmed');
  const conflictingReschedule = await request(`/sessions/${session.body.id}/reschedule`, {
    method: 'PATCH', token: adminResponse.body.token,
    body: { scheduledDate, startTime: '08:30', endTime: '09:30', reason: 'Trying a time that overlaps' }
  });
  assert.equal(conflictingReschedule.status, 409);
  const cancellationWithoutReason = await request(`/sessions/${blockingSession.body.id}/status`, {
    method: 'PATCH', token: activated.body.token, body: { status: 'cancelled', notes: '' }
  });
  assert.equal(cancellationWithoutReason.status, 400);
  const clearBlockingSession = await request(`/sessions/${blockingSession.body.id}/status`, {
    method: 'PATCH', token: activated.body.token,
    body: { status: 'cancelled', notes: 'Clearing the test schedule' }
  });
  assert.equal(clearBlockingSession.status, 200);

  const rescheduled = await request(`/sessions/${session.body.id}/reschedule`, {
    method: 'PATCH', token: adminResponse.body.token,
    body: { scheduledDate, startTime: '09:00', endTime: '10:00', reason: 'Student class schedule changed' }
  });
  assert.equal(rescheduled.status, 200);
  assert.equal(rescheduled.body.confirmation_status, 'pending');
  assert.equal(rescheduled.body.meeting_link, null);
  assert.equal(rescheduled.body.reschedule_count, 1);
  const pendingMeetingAccess = await request(`/sessions/${session.body.id}/meeting`, { token: adminResponse.body.token });
  assert.equal(pendingMeetingAccess.status, 409);
  const reconfirmed = await request(`/sessions/${session.body.id}/confirmation`, {
    method: 'PATCH', token: activated.body.token, body: { decision: 'confirmed' }
  });
  assert.equal(reconfirmed.status, 200);
  assert.equal(reconfirmed.body.meeting_link, 'https://zoom.example/j/6');
  const sessionHistory = await request(`/sessions/${session.body.id}/events`, { token: adminResponse.body.token });
  assert.equal(sessionHistory.status, 200);
  assert.deepEqual(
    sessionHistory.body.map((event) => event.event_type),
    ['created', 'confirmed', 'rescheduled', 'confirmed']
  );
  const outsiderHistory = await request(`/sessions/${session.body.id}/events`, { token: resetPasswordLogin.body.token });
  assert.equal(outsiderHistory.status, 404);
  const hardDeleteBlocked = await request(`/sessions/${session.body.id}`, {
    method: 'DELETE', token: adminResponse.body.token
  });
  assert.equal(hardDeleteBlocked.status, 405);

  for (let index = 0; index < 105; index += 1) {
    const sent = await request('/messages/send', {
      method: 'POST', token: adminResponse.body.token,
      body: { connectionId, content: `Bounded message ${index + 1}` }
    });
    assert.equal(sent.status, 201);
  }
  const boundedMessages = await request(`/messages/${connectionId}`, { token: adminResponse.body.token });
  assert.equal(boundedMessages.status, 200);
  assert.equal(boundedMessages.body.length, 100);
  assert.equal(boundedMessages.body[0].content, 'Bounded message 6');

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
  const tutorDetail = await request(`/users/tutors/${activated.body.user.id}`, { token: adminResponse.body.token });
  assert.equal(tutorDetail.status, 200);
  assert.equal(tutorDetail.body.reviews[0].student_name, 'NextDoorLearn student');
  assert.equal(tutorDetail.body.reviews[0].student_avatar, null);
  const sessionStats = await request('/sessions/stats', { token: activated.body.token });
  assert.equal(sessionStats.status, 200);
  assert.equal(sessionStats.body.completed_sessions, 1);
  assert.equal(sessionStats.body.outcomes_recorded, 1);
  assert.equal(sessionStats.body.reflections_completed, 1);
  assert.equal(sessionStats.body.average_confidence_gain, 2);

  const cancelledSession = await request(`/sessions/${session.body.id}/status`, {
    method: 'PATCH', token: adminResponse.body.token, body: { status: 'cancelled', notes: 'Schedule changed' }
  });
  assert.equal(cancelledSession.status, 200);
  assert.equal(cancelledSession.body.meeting_link, null);
  const cancelledMeetingAccess = await request(`/sessions/${session.body.id}/meeting`, { token: activated.body.token });
  assert.equal(cancelledMeetingAccess.status, 409);

  const outbox = await request('/admin/email-outbox', { token: adminResponse.body.token });
  assert.equal(outbox.status, 200);
  assert.ok(outbox.body.emails.some((email) => email.template === 'tutor_activation'));
  assert.ok(outbox.body.emails.some((email) => email.template === 'tutor_application_admin_alert' && email.recipient === 'admin@example.com'));
  assert.ok(!outbox.body.emails.some((email) => email.template === 'session_requested' && email.recipient === 'approved@example.com'));
  assert.ok(outbox.body.emails.some((email) => email.template === 'session_confirmed'));
  assert.ok(outbox.body.emails.some((email) => email.template === 'session_cancelled'));
  const readAllNotifications = await request('/notifications/read-all', {
    method: 'PATCH', token: adminResponse.body.token
  });
  assert.equal(readAllNotifications.status, 200);
  const clearReadNotifications = await request('/notifications/clear/read', {
    method: 'DELETE', token: adminResponse.body.token
  });
  assert.equal(clearReadNotifications.status, 200);
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
