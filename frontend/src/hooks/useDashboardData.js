import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';

const emptySessionStats = {
  totalSessions: 0,
  scheduledSessions: 0,
  completedSessions: 0,
  cancelledSessions: 0,
  totalMinutesTaught: 0,
};

const valueOr = (result, fallback) => {
  if (result.status !== 'fulfilled' || result.value?.error) return fallback;
  return result.value;
};

const useDashboardData = (role) => {
  const [data, setData] = useState({
    profile: null,
    profileCompletion: null,
    connections: [],
    conversations: [],
    upcomingSessions: [],
    messageStats: { messagesSent: 0, activeConnections: 0, peopleHelped: 0 },
    sessionStats: emptySessionStats,
    favorites: [],
    tutors: [],
    requests: [],
    availability: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('Please sign in again to load your dashboard.');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const sharedResults = await Promise.allSettled([
        api.getProfile(token),
        api.getProfileCompletion(token),
        api.getMyConnections(token),
        api.getConversations(token),
        api.getUpcomingSessions(token, 6),
        api.getMessageStats(token),
        api.getSessionStats(token),
      ]);

      const profile = valueOr(sharedResults[0], null);
      if (!profile) {
        setError('Your dashboard data could not be loaded.');
        return;
      }

      const roleResults = await Promise.allSettled(
        role === 'tutor'
          ? [api.getRequests(token), api.getMyAvailability(token)]
          : [api.getFavorites(token), api.getRecommendations(token)]
      );
      const rawSessionStats = valueOr(sharedResults[6], {});

      setData({
        profile,
        profileCompletion: valueOr(sharedResults[1], null),
        connections: valueOr(sharedResults[2], []),
        conversations: valueOr(sharedResults[3], []),
        upcomingSessions: valueOr(sharedResults[4], []),
        messageStats: valueOr(sharedResults[5], { messagesSent: 0, activeConnections: 0, peopleHelped: 0 }),
        sessionStats: {
          totalSessions: rawSessionStats.total_sessions || 0,
          scheduledSessions: rawSessionStats.scheduled_sessions || 0,
          completedSessions: rawSessionStats.completed_sessions || 0,
          cancelledSessions: rawSessionStats.cancelled_sessions || 0,
          totalMinutesTaught: rawSessionStats.total_minutes_taught || 0,
        },
        favorites: role === 'student' ? valueOr(roleResults[0], []) : [],
        tutors: role === 'student' ? valueOr(roleResults[1], {}).recommendations || [] : [],
        requests: role === 'tutor' ? valueOr(roleResults[0], []) : [],
        availability: role === 'tutor' ? valueOr(roleResults[1], {}).slots || [] : [],
      });
      setError('');
    } catch {
      setError('Your dashboard data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    fetchDashboard();
    window.refreshDashboardStats = fetchDashboard;
    return () => {
      delete window.refreshDashboardStats;
    };
  }, [fetchDashboard]);

  const updateRequest = useCallback((requestId, status) => {
    setData((current) => {
      const request = current.requests.find((item) => item.id === requestId);
      const alreadyConnected = current.connections.some((connection) => connection.id === requestId);
      return {
        ...current,
        requests: current.requests.map((item) => item.id === requestId ? { ...item, status } : item),
        connections: status === 'accepted' && request && !alreadyConnected
          ? [{
              id: request.id,
              status,
              student_id: request.student_id,
              student_name: request.student_name,
              student_bio: request.student_bio,
              student_avatar: request.avatar_url,
            }, ...current.connections]
          : current.connections,
      };
    });
  }, []);

  return { data, loading, error, refetch: fetchDashboard, updateRequest };
};

export default useDashboardData;
