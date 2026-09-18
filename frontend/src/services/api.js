const configuredApiUrl = import.meta.env.VITE_API_URL;
export const API_BASE_URL = configuredApiUrl || 'http://localhost:3001/api';

let refreshRequest = null;

const clearStoredSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
  window.dispatchEvent(new CustomEvent('nextdoorlearn:session-expired'));
};

const refreshAccessToken = async () => {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return null;

  if (!refreshRequest) {
    refreshRequest = (async () => {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken, deviceName: 'Web browser' }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.token || !payload.refreshToken) throw new Error('Unable to refresh session');
      localStorage.setItem('token', payload.token);
      localStorage.setItem('refreshToken', payload.refreshToken);
      return payload.token;
    })()
      .catch(() => {
        clearStoredSession();
        return null;
      })
      .finally(() => { refreshRequest = null; });
  }

  return refreshRequest;
};

const apiFetch = async (input, init = {}) => {
  const response = await fetch(input, init);
  const headers = new Headers(init.headers || {});
  if (response.status !== 401 || !headers.has('Authorization')) return response;

  const payload = await response.clone().json().catch(() => ({}));
  if (payload.code !== 'SESSION_EXPIRED') return response;

  const token = await refreshAccessToken();
  if (!token) return response;
  headers.set('Authorization', `Bearer ${token}`);
  return fetch(input, { ...init, headers });
};

export const isApiConfiguredForProduction = () =>
  import.meta.env.DEV ||
  Boolean(configuredApiUrl && !configuredApiUrl.includes('localhost') && !configuredApiUrl.includes('127.0.0.1'));

const api = {
  // Auth endpoints
  register: async (userData) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    return response.json();
  },

  login: async (credentials) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    return response.json();
  },

  logout: async (refreshToken) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    return response.json();
  },

  forgotPassword: async (email) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    return response.json();
  },

  resetPassword: async (token, password) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, password }),
    });
    return response.json();
  },

  verifyEmail: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    return response.json();
  },

  resendVerification: async (email) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    return response.json();
  },

  getTutorActivation: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/tutor-activation?token=${encodeURIComponent(token || '')}`);
    return response.json();
  },

  activateTutor: async (token, password) => {
    const response = await apiFetch(`${API_BASE_URL}/auth/tutor-activation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    });
    return response.json();
  },

  // User endpoints
  getProfile: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/users/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  updateProfile: async (profileData, token) => {
    const response = await apiFetch(`${API_BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(profileData),
    });
    return response.json();
  },

  changePassword: async (currentPassword, newPassword, token) => {
    const response = await apiFetch(`${API_BASE_URL}/users/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return response.json();
  },

  deleteAccount: async (currentPassword, token) => {
    const response = await apiFetch(`${API_BASE_URL}/users/account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, confirmation: 'DELETE' }),
    });
    return response.json();
  },

  getProfileCompletion: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/users/profile-completion`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getTutors: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/users/tutors`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  },

  getRecommendations: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/recommendations`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  },

  getTutorProfile: async (tutorId, token) => {
    const response = await apiFetch(`${API_BASE_URL}/users/tutors/${tutorId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getPublicTutorProfile: async (tutorId) => {
    const response = await apiFetch(`${API_BASE_URL}/users/public/tutors/${tutorId}`);
    return response.json();
  },

  submitTutorApplication: async (application) => {
    const formData = new FormData();
    Object.entries(application).forEach(([key, value]) => {
      if (key === 'profilePicture' && value) formData.append(key, value);
      else if (Array.isArray(value)) formData.append(key, value.join(','));
      else formData.append(key, value ?? '');
    });
    const response = await apiFetch(`${API_BASE_URL}/community/tutor-applications`, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },

  uploadProfilePicture: async (file, token) => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await apiFetch(`${API_BASE_URL}/upload/avatar`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    return response.json();
  },

  deleteProfilePicture: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/upload/avatar`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  },

  submitSponsorInquiry: async (inquiry) => {
    const response = await apiFetch(`${API_BASE_URL}/community/sponsor-inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(inquiry),
    });
    return response.json();
  },

  getMyWaitlistEntry: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/community/waitlist/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  },

  joinWaitlist: async (details, token) => {
    const response = await apiFetch(`${API_BASE_URL}/community/waitlist/me`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(details),
    });
    return response.json();
  },

  leaveWaitlist: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/community/waitlist/me`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  },

  getFavorites: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/favorites`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  addFavorite: async (tutorId, token) => {
    const response = await apiFetch(`${API_BASE_URL}/favorites/${tutorId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  removeFavorite: async (tutorId, token) => {
    const response = await apiFetch(`${API_BASE_URL}/favorites/${tutorId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  submitReport: async (reportedUserId, reason, details, token) => {
    const response = await apiFetch(`${API_BASE_URL}/reports`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ reportedUserId, reason, details }),
    });
    return response.json();
  },

  // Connection endpoints
  sendConnectionRequest: async (tutorId, token) => {
    const response = await apiFetch(`${API_BASE_URL}/connections/request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ tutorId }),
    });
    return response.json();
  },

  getConnectionRequests: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/connections/requests`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  respondToConnection: async (connectionId, status, token) => {
    const response = await apiFetch(`${API_BASE_URL}/connections/${connectionId}/respond`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    return response.json();
  },

  getMyConnections: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/connections/my-connections`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Message endpoints
  sendMessage: async (connectionId, content, token) => {
    const response = await apiFetch(`${API_BASE_URL}/messages/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ connectionId, content }),
    });
    return response.json();
  },

  getMessages: async (connectionId, token) => {
    const response = await apiFetch(`${API_BASE_URL}/messages/${connectionId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getConversations: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/messages`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Status endpoints
  updateOnlineStatus: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/status/online`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getOnlineUsers: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/status/online`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Message statistics
  getMessageStats: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/messages/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Learning progress endpoints
  getLearningGoals: async (token, studentId) => {
    const params = new URLSearchParams();
    if (studentId) params.set('studentId', studentId);
    const response = await apiFetch(`${API_BASE_URL}/progress/goals${params.size ? `?${params}` : ''}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  },

  createLearningGoal: async (goal, token) => {
    const response = await apiFetch(`${API_BASE_URL}/progress/goals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(goal),
    });
    return response.json();
  },

  updateLearningGoal: async (goalId, updates, token) => {
    const response = await apiFetch(`${API_BASE_URL}/progress/goals/${goalId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(updates),
    });
    return response.json();
  },

  deleteLearningGoal: async (goalId, token) => {
    const response = await apiFetch(`${API_BASE_URL}/progress/goals/${goalId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  },

  addGoalMilestone: async (goalId, title, token) => {
    const response = await apiFetch(`${API_BASE_URL}/progress/goals/${goalId}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ title }),
    });
    return response.json();
  },

  updateGoalMilestone: async (milestoneId, updates, token) => {
    const response = await apiFetch(`${API_BASE_URL}/progress/milestones/${milestoneId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(updates),
    });
    return response.json();
  },

  deleteGoalMilestone: async (milestoneId, token) => {
    const response = await apiFetch(`${API_BASE_URL}/progress/milestones/${milestoneId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    return response.json();
  },

  getUserStatus: async (userId, token) => {
    const response = await apiFetch(`${API_BASE_URL}/status/user/${userId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Session endpoints
  getSessions: async (token, filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.month) params.append('month', filters.month);
    if (filters.year) params.append('year', filters.year);
    
    const response = await apiFetch(`${API_BASE_URL}/sessions?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getUpcomingSessions: async (token, limit = 5) => {
    const response = await apiFetch(`${API_BASE_URL}/sessions/upcoming?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  createSession: async (sessionData, token) => {
    const response = await apiFetch(`${API_BASE_URL}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(sessionData),
    });
    return response.json();
  },

  updateSessionStatus: async (sessionId, status, notes, token) => {
    const response = await apiFetch(`${API_BASE_URL}/sessions/${sessionId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ status, notes }),
    });
    return response.json();
  },

  updateSessionOutcome: async (sessionId, outcome, token) => {
    const response = await apiFetch(`${API_BASE_URL}/sessions/${sessionId}/outcome`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(outcome),
    });
    return response.json();
  },

  deleteSession: async (sessionId, token) => {
    const response = await apiFetch(`${API_BASE_URL}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getSessionStats: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/sessions/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Availability endpoints
  getMyAvailability: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/availability/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  updateMyAvailability: async (slots, timezone, token) => {
    const response = await apiFetch(`${API_BASE_URL}/availability/me`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ slots, timezone }),
    });
    return response.json();
  },

  getTutorAvailability: async (tutorId, date, token) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    const response = await apiFetch(`${API_BASE_URL}/availability/tutor/${tutorId}?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Google Calendar endpoints
  getGoogleAuthUrl: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/google/auth-url`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getGoogleStatus: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/google/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  toggleGoogleSync: async (enabled, token) => {
    const response = await apiFetch(`${API_BASE_URL}/google/sync-toggle`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ enabled }),
    });
    return response.json();
  },

  disconnectGoogle: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/google/disconnect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Request endpoints
  getRequests: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/requests`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  respondToRequest: async (requestId, action, token) => {
    const response = await apiFetch(`${API_BASE_URL}/requests/${requestId}/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ action }),
    });
    return response.json();
  },

  // Review endpoints
  createReview: async (tutorId, rating, comment, sessionId, token) => {
    const response = await apiFetch(`${API_BASE_URL}/reviews`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ tutorId, rating, comment, sessionId }),
    });
    return response.json();
  },

  getTutorReviews: async (tutorId) => {
    const response = await apiFetch(`${API_BASE_URL}/reviews/tutor/${tutorId}`);
    return response.json();
  },

  getTutorAverageRating: async (tutorId) => {
    const response = await apiFetch(`${API_BASE_URL}/reviews/tutor/${tutorId}/average`);
    return response.json();
  },

  getMyReview: async (tutorId, token) => {
    const response = await apiFetch(`${API_BASE_URL}/reviews/tutor/${tutorId}/my-review`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  deleteReview: async (reviewId, token) => {
    const response = await apiFetch(`${API_BASE_URL}/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Notification endpoints
  getNotifications: async (token, limit = 50, unreadOnly = false) => {
    const response = await apiFetch(`${API_BASE_URL}/notifications?limit=${limit}&unread_only=${unreadOnly}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getUnreadCount: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/notifications/unread-count`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  markNotificationRead: async (notificationId, token) => {
    const response = await apiFetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  markAllNotificationsRead: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  deleteNotification: async (notificationId, token) => {
    const response = await apiFetch(`${API_BASE_URL}/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  clearReadNotifications: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/notifications/clear/read`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Admin endpoints
  getAdminOverview: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/overview`, { headers: { 'Authorization': `Bearer ${token}` } });
    return response.json();
  },

  getAdminUsers: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/users`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  updateAdminUser: async (userId, updates, token) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/users/${userId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    return response.json();
  },

  getAdminReports: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/reports`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  updateAdminReport: async (reportId, status, token) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/reports/${reportId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ status }),
    });
    return response.json();
  },

  applyAdminModeration: async (reportId, action, reason, token) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/reports/${reportId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action, reason }),
    });
    return response.json();
  },

  getAdminTutorApplications: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/tutor-applications`, { headers: { 'Authorization': `Bearer ${token}` } });
    return response.json();
  },

  updateAdminTutorApplication: async (applicationId, updates, token) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/tutor-applications/${applicationId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify(typeof updates === 'string' ? { status: updates } : updates) });
    return response.json();
  },

  getAdminSponsorInquiries: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/sponsor-inquiries`, { headers: { 'Authorization': `Bearer ${token}` } });
    return response.json();
  },

  updateAdminSponsorInquiry: async (inquiryId, status, token) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/sponsor-inquiries/${inquiryId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ status }) });
    return response.json();
  },

  getAdminWaitlist: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/waitlist`, { headers: { 'Authorization': `Bearer ${token}` } });
    return response.json();
  },

  getAdminWaitlistRecommendations: async (entryId, token) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/waitlist/${entryId}/recommendations`, { headers: { 'Authorization': `Bearer ${token}` } });
    return response.json();
  },

  applyAdminWaitlistAction: async (entryId, action, details, token) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/waitlist/${entryId}/actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ action, ...details }),
    });
    return response.json();
  },

  getAdminAuditLog: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/audit-log`, { headers: { 'Authorization': `Bearer ${token}` } });
    return response.json();
  },

  getAdminEmailOutbox: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/email-outbox`, { headers: { 'Authorization': `Bearer ${token}` } });
    return response.json();
  },

  processAdminEmailOutbox: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/admin/email-outbox/process`, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    return response.json();
  },

  getBlockedUsers: async (token) => {
    const response = await apiFetch(`${API_BASE_URL}/blocks`, { headers: { 'Authorization': `Bearer ${token}` } });
    return response.json();
  },

  blockUser: async (userId, reason, token) => {
    const response = await apiFetch(`${API_BASE_URL}/blocks/${userId}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ reason }) });
    return response.json();
  },

  unblockUser: async (userId, token) => {
    const response = await apiFetch(`${API_BASE_URL}/blocks/${userId}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
    return response.json();
  },

  respondToSessionRequest: async (sessionId, decision, token) => {
    const response = await apiFetch(`${API_BASE_URL}/sessions/${sessionId}/confirmation`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ decision }) });
    return response.json();
  },
};

export default api;
