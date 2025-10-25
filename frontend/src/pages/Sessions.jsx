import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Sessions = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [filters, setFilters] = useState({
    status: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  });

  // Form state for creating sessions
  const [formData, setFormData] = useState({
    connectionId: '',
    title: '',
    description: '',
    subject: '',
    scheduledDate: '',
    startTime: '',
    endTime: '',
    meetingLink: ''
  });

  // Get connections for the dropdown
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('No authentication token found. Please log in again.');
          setLoading(false);
          return;
        }

        // Fetch sessions
        const sessionsResponse = await api.getSessions(token, filters);
        if (sessionsResponse.error) {
          if (sessionsResponse.error.includes('User not found') || sessionsResponse.error.includes('Unauthorized') || sessionsResponse.error.includes('Invalid or expired token')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return;
          }
          setError('Failed to load sessions: ' + sessionsResponse.error);
        } else {
          setSessions(sessionsResponse);
        }

        // Fetch upcoming sessions
        const upcomingResponse = await api.getUpcomingSessions(token, 5);
        if (!upcomingResponse.error) {
          setUpcomingSessions(upcomingResponse);
        }

        // Fetch connections for creating sessions
        const connectionsResponse = await api.getConnections(token);
        if (!connectionsResponse.error) {
          setConnections(connectionsResponse);
        }

        setError('');
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load sessions. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [filters]);

  const handleCreateSession = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await api.createSession(formData, token);
      
      if (response.error) {
        alert('Error creating session: ' + response.error);
      } else {
        setSessions(prev => [response, ...prev]);
        setUpcomingSessions(prev => [response, ...prev].slice(0, 5));
        setShowCreateModal(false);
        setFormData({
          connectionId: '',
          title: '',
          description: '',
          subject: '',
          scheduledDate: '',
          startTime: '',
          endTime: '',
          meetingLink: ''
        });
        alert('Session created successfully!');
      }
    } catch (error) {
      console.error('Error creating session:', error);
      alert('Error creating session. Please try again.');
    }
  };

  const handleUpdateStatus = async (sessionId, status, notes = '') => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.updateSessionStatus(sessionId, status, notes, token);
      
      if (response.error) {
        alert('Error updating session: ' + response.error);
      } else {
        setSessions(prev => prev.map(s => s.id === sessionId ? response : s));
        setUpcomingSessions(prev => prev.map(s => s.id === sessionId ? response : s));
        setSelectedSession(null);
        alert('Session updated successfully!');
      }
    } catch (error) {
      console.error('Error updating session:', error);
      alert('Error updating session. Please try again.');
    }
  };

  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm('Are you sure you want to delete this session?')) return;
    
    try {
      const token = localStorage.getItem('token');
      const response = await api.deleteSession(sessionId, token);
      
      if (response.error) {
        alert('Error deleting session: ' + response.error);
      } else {
        setSessions(prev => prev.filter(s => s.id !== sessionId));
        setUpcomingSessions(prev => prev.filter(s => s.id !== sessionId));
        alert('Session deleted successfully!');
      }
    } catch (error) {
      console.error('Error deleting session:', error);
      alert('Error deleting session. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (timeString) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'badge-primary';
      case 'completed': return 'badge-success';
      case 'cancelled': return 'badge-error';
      case 'no_show': return 'badge-warning';
      default: return 'badge-secondary';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner"></div>
          <p className="mt-4 text-gray-600">Loading sessions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Sessions</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary w-full"
            >
              Try Again
            </button>
            <a
              href="/dashboard"
              className="btn btn-ghost w-full"
            >
              Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
          <p className="text-gray-600 mb-6">Please log in to view sessions.</p>
          <a
            href="/login"
            className="btn btn-primary w-full"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="container">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-gradient">Sessions</h1>
              <p className="text-gray-600">Schedule and manage your tutoring sessions</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn btn-primary"
              >
                📅 Schedule Session
              </button>
              <a
                href="/dashboard"
                className="text-primary-600 hover:text-primary-500"
              >
                ← Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="container py-6">
        {/* Filters */}
        <div className="card mb-6">
          <div className="p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700">Status</label>
                <select
                  id="status"
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="mt-1 block w-full focus-ring"
                >
                  <option value="">All Statuses</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="no_show">No Show</option>
                </select>
              </div>
              <div>
                <label htmlFor="month" className="block text-sm font-medium text-gray-700">Month</label>
                <select
                  id="month"
                  value={filters.month}
                  onChange={(e) => setFilters(prev => ({ ...prev, month: parseInt(e.target.value) }))}
                  className="mt-1 block w-full focus-ring"
                >
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                      {new Date(0, i).toLocaleString('default', { month: 'long' })}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="year" className="block text-sm font-medium text-gray-700">Year</label>
                <select
                  id="year"
                  value={filters.year}
                  onChange={(e) => setFilters(prev => ({ ...prev, year: parseInt(e.target.value) }))}
                  className="mt-1 block w-full focus-ring"
                >
                  {Array.from({ length: 5 }, (_, i) => {
                    const year = new Date().getFullYear() - 2 + i;
                    return (
                      <option key={year} value={year}>{year}</option>
                    );
                  })}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Upcoming Sessions */}
        {upcomingSessions.length > 0 && (
          <div className="card mb-6">
            <div className="card-header">
              <h3 className="text-xl font-semibold text-gray-900">⏰ Upcoming Sessions</h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {upcomingSessions.map((session) => (
                  <div key={session.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900">{session.title}</h4>
                      <span className={`badge ${getStatusColor(session.status)}`}>
                        {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {user.role === 'tutor' ? session.student_name : session.tutor_name}
                    </p>
                    <p className="text-sm text-gray-500 mb-3">
                      {formatDate(session.scheduled_date)} at {formatTime(session.start_time)}
                    </p>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setSelectedSession(session)}
                        className="btn btn-sm btn-primary"
                      >
                        View Details
                      </button>
                      {session.status === 'scheduled' && (
                        <button
                          onClick={() => handleUpdateStatus(session.id, 'completed')}
                          className="btn btn-sm btn-success"
                        >
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* All Sessions */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-xl font-semibold text-gray-900">📚 All Sessions</h3>
          </div>
          <div className="card-body">
            {sessions.length === 0 ? (
              <div className="text-center text-gray-500 p-8">
                No sessions found. Schedule your first session!
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.map((session) => (
                  <div key={session.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{session.title}</h4>
                        <p className="text-sm text-gray-600">
                          {user.role === 'tutor' ? session.student_name : session.tutor_name}
                          {session.subject && ` • ${session.subject}`}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`badge ${getStatusColor(session.status)}`}>
                          {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
                        </span>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => setSelectedSession(session)}
                            className="btn btn-sm btn-ghost"
                          >
                            👁️
                          </button>
                          {session.status === 'scheduled' && (
                            <button
                              onClick={() => handleDeleteSession(session.id)}
                              className="btn btn-sm btn-ghost text-error-600"
                            >
                              🗑️
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500">
                      {formatDate(session.scheduled_date)} • {formatTime(session.start_time)} - {formatTime(session.end_time)}
                      {session.duration_minutes && ` (${session.duration_minutes} min)`}
                    </p>
                    {session.description && (
                      <p className="text-sm text-gray-600 mt-2">{session.description}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Schedule New Session</h3>
            <form onSubmit={handleCreateSession} className="space-y-4">
              <div>
                <label htmlFor="connectionId" className="block text-sm font-medium text-gray-700">Connection</label>
                <select
                  id="connectionId"
                  value={formData.connectionId}
                  onChange={(e) => setFormData(prev => ({ ...prev, connectionId: e.target.value }))}
                  className="mt-1 block w-full focus-ring"
                  required
                >
                  <option value="">Select a connection</option>
                  {connections.map((conn) => (
                    <option key={conn.id} value={conn.id}>
                      {user.role === 'tutor' ? conn.student_name : conn.tutor_name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className="mt-1 block w-full focus-ring"
                  placeholder="e.g., Math Tutoring Session"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="subject" className="block text-sm font-medium text-gray-700">Subject</label>
                <input
                  type="text"
                  id="subject"
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  className="mt-1 block w-full focus-ring"
                  placeholder="e.g., Algebra, Calculus"
                />
              </div>
              
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="mt-1 block w-full focus-ring"
                  rows="3"
                  placeholder="What will you cover in this session?"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="scheduledDate" className="block text-sm font-medium text-gray-700">Date</label>
                  <input
                    type="date"
                    id="scheduledDate"
                    value={formData.scheduledDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, scheduledDate: e.target.value }))}
                    className="mt-1 block w-full focus-ring"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="startTime" className="block text-sm font-medium text-gray-700">Start Time</label>
                  <input
                    type="time"
                    id="startTime"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    className="mt-1 block w-full focus-ring"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="endTime" className="block text-sm font-medium text-gray-700">End Time</label>
                  <input
                    type="time"
                    id="endTime"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="mt-1 block w-full focus-ring"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="meetingLink" className="block text-sm font-medium text-gray-700">Meeting Link</label>
                  <input
                    type="url"
                    id="meetingLink"
                    value={formData.meetingLink}
                    onChange={(e) => setFormData(prev => ({ ...prev, meetingLink: e.target.value }))}
                    className="mt-1 block w-full focus-ring"
                    placeholder="https://zoom.us/j/..."
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                >
                  Schedule Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Session Details</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-900">{selectedSession.title}</h4>
                <p className="text-sm text-gray-600">
                  {user.role === 'tutor' ? selectedSession.student_name : selectedSession.tutor_name}
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">Date</p>
                  <p className="text-sm text-gray-900">{formatDate(selectedSession.scheduled_date)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Time</p>
                  <p className="text-sm text-gray-900">
                    {formatTime(selectedSession.start_time)} - {formatTime(selectedSession.end_time)}
                  </p>
                </div>
              </div>
              
              {selectedSession.subject && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Subject</p>
                  <p className="text-sm text-gray-900">{selectedSession.subject}</p>
                </div>
              )}
              
              {selectedSession.description && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Description</p>
                  <p className="text-sm text-gray-900">{selectedSession.description}</p>
                </div>
              )}
              
              {selectedSession.meeting_link && (
                <div>
                  <p className="text-sm font-medium text-gray-700">Meeting Link</p>
                  <a
                    href={selectedSession.meeting_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-600 hover:text-primary-500"
                  >
                    {selectedSession.meeting_link}
                  </a>
                </div>
              )}
              
              <div>
                <p className="text-sm font-medium text-gray-700">Status</p>
                <span className={`badge ${getStatusColor(selectedSession.status)}`}>
                  {selectedSession.status.charAt(0).toUpperCase() + selectedSession.status.slice(1)}
                </span>
              </div>
            </div>
            
            <div className="flex justify-end space-x-3 pt-6">
              {selectedSession.status === 'scheduled' && (
                <>
                  <button
                    onClick={() => handleUpdateStatus(selectedSession.id, 'completed')}
                    className="btn btn-success"
                  >
                    Mark Complete
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedSession.id, 'cancelled')}
                    className="btn btn-error"
                  >
                    Cancel Session
                  </button>
                </>
              )}
              <button
                onClick={() => setSelectedSession(null)}
                className="btn btn-ghost"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sessions;

