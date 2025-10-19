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

  getTutors: async () => {
    const response = await fetch(`${API_BASE_URL}/users/tutors`);
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
};

export default api;
