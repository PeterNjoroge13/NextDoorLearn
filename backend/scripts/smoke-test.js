const API_BASE_URL = process.env.SMOKE_API_URL || 'http://localhost:3001/api';

const request = async (path, options = {}) => {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {})
    }
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${path} failed: ${response.status} ${JSON.stringify(body)}`);
  }
  return body;
};

const testImage = () => new Blob([
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
], { type: 'image/png' });

const main = async () => {
  const unique = Date.now();
  const studentEmail = `smoke.student.${unique}@example.com`;
  const tutorEmail = `smoke.tutor.${unique}@example.com`;
  const password = 'password123';

  const health = await request('/health');
  if (health.status !== 'ok') {
    throw new Error('Health check did not return ok');
  }

  const tutor = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: tutorEmail,
      password,
      role: 'tutor',
      name: 'Smoke Tutor',
      bio: 'Smoke test tutor'
    })
  });

  const student = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: studentEmail,
      password,
      role: 'student',
      name: 'Smoke Student',
      bio: 'Smoke test student'
    })
  });

  if (!tutor.verificationToken) {
    throw new Error('Expected development verification token from tutor registration');
  }

  await request('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token: tutor.verificationToken })
  });

  const reset = await request('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email: studentEmail })
  });

  if (!reset.resetToken) {
    throw new Error('Expected development reset token from forgot password');
  }

  await request('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token: reset.resetToken, password: 'password456' })
  });

  await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: studentEmail, password: 'password456' })
  });

  await request('/users/profile', {
    method: 'PUT',
    token: tutor.token,
    body: JSON.stringify({
      profile: {
        subjects: ['Math'],
        hourly_rate: 0,
        experience_years: 1,
        teaching_style: 'Patient and practical'
      }
    })
  });

  const tutors = await request('/users/tutors', { token: student.token });
  const createdTutor = tutors.find((item) => item.id === tutor.user.id);
  if (!createdTutor) {
    throw new Error('Created tutor was not returned by tutor browse endpoint');
  }

  const tutorProfile = await request(`/users/tutors/${tutor.user.id}`, {
    token: student.token
  });

  if (tutorProfile.id !== tutor.user.id || !Array.isArray(tutorProfile.subjects)) {
    throw new Error('Created tutor profile endpoint did not return expected tutor details');
  }

  await request('/users/profile', {
    method: 'PUT',
    token: tutor.token,
    body: JSON.stringify({ profile: {
      headline: 'Patient math tutor',
      motivation: 'I want academic help to be easier to reach.',
      tutoring_mode: 'online',
      age_groups: ['High school'],
      public_profile_enabled: true
    } })
  });

  const publicTutor = await request(`/users/public/tutors/${tutor.user.id}`);
  if (publicTutor.id !== tutor.user.id || publicTutor.email || publicTutor.phone) {
    throw new Error('Public tutor profile did not apply the expected privacy boundary');
  }

  const avatarForm = new FormData();
  avatarForm.append('avatar', testImage(), 'avatar.png');
  const avatarUpload = await request('/upload/avatar', { method: 'POST', token: student.token, body: avatarForm });
  if (!avatarUpload.avatarUrl) throw new Error('Profile picture was not uploaded');

  const profileWithAvatar = await request('/users/profile', { token: student.token });
  if (profileWithAvatar.avatar_url !== avatarUpload.avatarUrl) throw new Error('Uploaded profile picture was not saved');

  const applicationForm = new FormData();
  applicationForm.append('name', 'Applicant Tutor');
  applicationForm.append('email', `applicant.${unique}@example.com`);
  applicationForm.append('location', 'Baltimore, MD');
  applicationForm.append('subjects', 'Math');
  applicationForm.append('education', 'College student');
  applicationForm.append('motivation', 'I want to volunteer as a tutor.');
  applicationForm.append('availability', 'Saturday mornings');
  applicationForm.append('tutoringMode', 'online');
  applicationForm.append('hourlyRate', '0');
  applicationForm.append('profilePicture', testImage(), 'profile.png');
  const application = await request('/community/tutor-applications', {
    method: 'POST',
    body: applicationForm
  });
  if (!application.applicationId) throw new Error('Tutor application was not stored');

  const sponsor = await request('/community/sponsor-inquiries', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Community Sponsor',
      email: `sponsor.${unique}@example.com`,
      sponsorType: 'Sponsor tutoring',
      message: 'Interested in supporting student access.'
    })
  });
  if (!sponsor.inquiryId) throw new Error('Sponsor inquiry was not stored');

  await request('/users/profile', {
    method: 'PUT',
    token: student.token,
    body: JSON.stringify({ profile: {
      grade_level: 'College',
      subjects_needed: ['Math'],
      learning_style: 'Work through examples',
      budget_preference: 'free',
      tutoring_mode: 'online',
      intake_completed: true
    } })
  });

  const waitlist = await request('/community/waitlist/me', {
    method: 'PUT',
    token: student.token,
    body: JSON.stringify({ subjects: ['Math'], gradeLevel: 'College', budgetPreference: 'free', tutoringMode: 'online' })
  });
  if (waitlist.status !== 'open') throw new Error('Student waitlist entry was not created');

  const savedWaitlist = await request('/community/waitlist/me', { token: student.token });
  if (!Array.isArray(savedWaitlist.subjects) || !savedWaitlist.subjects.includes('Math')) {
    throw new Error('Student waitlist entry was not returned');
  }

  await request(`/favorites/${tutor.user.id}`, {
    method: 'POST',
    token: student.token
  });

  const favorites = await request('/favorites', {
    token: student.token
  });

  if (!Array.isArray(favorites) || !favorites.some((item) => item.id === tutor.user.id)) {
    throw new Error('Expected saved tutor to be returned by favorites endpoint');
  }

  await request(`/favorites/${tutor.user.id}`, {
    method: 'DELETE',
    token: student.token
  });

  const favoritesAfterDelete = await request('/favorites', {
    token: student.token
  });

  if (favoritesAfterDelete.some((item) => item.id === tutor.user.id)) {
    throw new Error('Expected saved tutor to be removed from favorites endpoint');
  }

  const report = await request('/reports', {
    method: 'POST',
    token: student.token,
    body: JSON.stringify({
      reportedUserId: tutor.user.id,
      reason: 'Smoke test report',
      details: 'Report submission should be accepted during smoke testing.'
    })
  });

  if (!report.reportId) {
    throw new Error('Expected report endpoint to return a report id');
  }

  const connection = await request('/connections/request', {
    method: 'POST',
    token: student.token,
    body: JSON.stringify({ tutorId: tutor.user.id })
  });

  await request(`/requests/${connection.connectionId}/respond`, {
    method: 'POST',
    token: tutor.token,
    body: JSON.stringify({ action: 'accept' })
  });

  await request('/messages/send', {
    method: 'POST',
    token: student.token,
    body: JSON.stringify({
      connectionId: connection.connectionId,
      content: 'Hello from the smoke test.'
    })
  });

  const messages = await request(`/messages/${connection.connectionId}`, {
    token: tutor.token
  });

  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('Expected at least one message after smoke test send');
  }

  const messageStats = await request('/messages/stats', {
    token: student.token
  });

  if (!messageStats.messagesSent || !messageStats.activeConnections) {
    throw new Error('Expected message stats endpoint to return sent message and connection counts');
  }

  const conversations = await request('/messages', {
    token: student.token
  });

  if (!conversations.some((item) => item.other_user_id === tutor.user.id)) {
    throw new Error('Expected conversations endpoint to include the other user id');
  }

  console.log('Smoke test passed');
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
