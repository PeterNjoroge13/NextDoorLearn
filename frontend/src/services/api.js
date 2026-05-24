const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const api = {
  // Auth endpoints
  register: async (userData) => {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    return response.json();
  },

  login: async (credentials) => {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });
    return response.json();
  },

  forgotPassword: async (email) => {
    const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    return response.json();
  },

  resetPassword: async (token, password) => {
    const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token, password }),
    });
    return response.json();
  },

  verifyEmail: async (token) => {
    const response = await fetch(`${API_BASE_URL}/auth/verify-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });
    return response.json();
  },

  resendVerification: async (email) => {
    const response = await fetch(`${API_BASE_URL}/auth/resend-verification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    });
    return response.json();
  },

  // User endpoints
  getProfile: async (token) => {
    const response = await fetch(`${API_BASE_URL}/users/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  updateProfile: async (profileData, token) => {
    const response = await fetch(`${API_BASE_URL}/users/profile`, {
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
    const response = await fetch(`${API_BASE_URL}/users/change-password`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    return response.json();
  },

  getProfileCompletion: async (token) => {
    const response = await fetch(`${API_BASE_URL}/users/profile-completion`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getTutors: async () => {
    const response = await fetch(`${API_BASE_URL}/users/tutors`);
    return response.json();
  },

  getFavorites: async (token) => {
    const response = await fetch(`${API_BASE_URL}/favorites`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  addFavorite: async (tutorId, token) => {
    const response = await fetch(`${API_BASE_URL}/favorites/${tutorId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  removeFavorite: async (tutorId, token) => {
    const response = await fetch(`${API_BASE_URL}/favorites/${tutorId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  submitReport: async (reportedUserId, reason, details, token) => {
    const response = await fetch(`${API_BASE_URL}/reports`, {
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
    const response = await fetch(`${API_BASE_URL}/connections/request`, {
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
    const response = await fetch(`${API_BASE_URL}/connections/requests`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  respondToConnection: async (connectionId, status, token) => {
    const response = await fetch(`${API_BASE_URL}/connections/${connectionId}/respond`, {
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
    const response = await fetch(`${API_BASE_URL}/connections/my-connections`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Message endpoints
  sendMessage: async (connectionId, content, token) => {
    const response = await fetch(`${API_BASE_URL}/messages/send`, {
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
    const response = await fetch(`${API_BASE_URL}/messages/${connectionId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getConversations: async (token) => {
    const response = await fetch(`${API_BASE_URL}/messages`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Status endpoints
  updateOnlineStatus: async (token) => {
    const response = await fetch(`${API_BASE_URL}/status/online`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getOnlineUsers: async (token) => {
    const response = await fetch(`${API_BASE_URL}/status/online`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Message statistics
  getMessageStats: async (token) => {
    const response = await fetch(`${API_BASE_URL}/messages/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getUserStatus: async (userId, token) => {
    const response = await fetch(`${API_BASE_URL}/status/user/${userId}`, {
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
    
    const response = await fetch(`${API_BASE_URL}/sessions?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getUpcomingSessions: async (token, limit = 5) => {
    const response = await fetch(`${API_BASE_URL}/sessions/upcoming?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  createSession: async (sessionData, token) => {
    const response = await fetch(`${API_BASE_URL}/sessions`, {
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
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ status, notes }),
    });
    return response.json();
  },

  deleteSession: async (sessionId, token) => {
    const response = await fetch(`${API_BASE_URL}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getSessionStats: async (token) => {
    const response = await fetch(`${API_BASE_URL}/sessions/stats`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Availability endpoints
  getMyAvailability: async (token) => {
    const response = await fetch(`${API_BASE_URL}/availability/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  updateMyAvailability: async (slots, timezone, token) => {
    const response = await fetch(`${API_BASE_URL}/availability/me`, {
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
    const response = await fetch(`${API_BASE_URL}/availability/tutor/${tutorId}?${params}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Google Calendar endpoints
  getGoogleAuthUrl: async (token) => {
    const response = await fetch(`${API_BASE_URL}/google/auth-url`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getGoogleStatus: async (token) => {
    const response = await fetch(`${API_BASE_URL}/google/status`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  toggleGoogleSync: async (enabled, token) => {
    const response = await fetch(`${API_BASE_URL}/google/sync-toggle`, {
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
    const response = await fetch(`${API_BASE_URL}/google/disconnect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Request endpoints
  getRequests: async (token) => {
    const response = await fetch(`${API_BASE_URL}/requests`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  respondToRequest: async (requestId, action, token) => {
    const response = await fetch(`${API_BASE_URL}/requests/${requestId}/respond`, {
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
    const response = await fetch(`${API_BASE_URL}/reviews`, {
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
    const response = await fetch(`${API_BASE_URL}/reviews/tutor/${tutorId}`);
    return response.json();
  },

  getTutorAverageRating: async (tutorId) => {
    const response = await fetch(`${API_BASE_URL}/reviews/tutor/${tutorId}/average`);
    return response.json();
  },

  getMyReview: async (tutorId, token) => {
    const response = await fetch(`${API_BASE_URL}/reviews/tutor/${tutorId}/my-review`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  deleteReview: async (reviewId, token) => {
    const response = await fetch(`${API_BASE_URL}/reviews/${reviewId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  // Notification endpoints
  getNotifications: async (token, limit = 50, unreadOnly = false) => {
    const response = await fetch(`${API_BASE_URL}/notifications?limit=${limit}&unread_only=${unreadOnly}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  getUnreadCount: async (token) => {
    const response = await fetch(`${API_BASE_URL}/notifications/unread-count`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  markNotificationRead: async (notificationId, token) => {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  markAllNotificationsRead: async (token) => {
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  deleteNotification: async (notificationId, token) => {
    const response = await fetch(`${API_BASE_URL}/notifications/${notificationId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },

  clearReadNotifications: async (token) => {
    const response = await fetch(`${API_BASE_URL}/notifications/clear/read`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    return response.json();
  },
};

export default api;
