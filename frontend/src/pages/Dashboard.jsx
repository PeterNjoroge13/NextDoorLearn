import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatusIndicator from '../components/StatusIndicator';
import ThemeToggle from '../components/ThemeToggle';

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('No authentication token found. Please log in again.');
          setLoading(false);
          return;
        }

        const response = await api.getProfile(token);
        if (response.error) {
          console.error('Error fetching profile:', response.error);
          // If user not found, unauthorized, or invalid token, clear localStorage and redirect to login
          if (response.error.includes('User not found') || response.error.includes('Unauthorized') || response.error.includes('Invalid or expired token')) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
            return;
          }
          setError('Failed to load profile: ' + response.error);
        } else {
          setProfile(response);
          setError(''); // Clear any previous errors
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        setError('Failed to load profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    const updateOnlineStatus = async () => {
      try {
        const token = localStorage.getItem('token');
        await api.updateOnlineStatus(token);
      } catch (error) {
        console.error('Error updating online status:', error);
      }
    };

    fetchProfile();
    updateOnlineStatus();

    // Update online status every 2 minutes
    const statusInterval = setInterval(updateOnlineStatus, 2 * 60 * 1000);

    return () => clearInterval(statusInterval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Dashboard</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="btn btn-primary w-full"
            >
              Try Again
            </button>
            <a
              href="/login"
              className="btn btn-ghost w-full"
            >
              Go to Login
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
          <p className="text-gray-600 mb-6">Please log in to access the dashboard.</p>
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
    <div className="min-h-screen">
      {/* Header */}
      <header className="navbar">
        <div className="container">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              {profile?.avatar_url ? (
                <img
                  src={`http://localhost:3001${profile.avatar_url}`}
                  alt="Profile"
                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center border-2 border-white shadow-md">
                  <span className="text-xl text-primary-600">👤</span>
                </div>
              )}
              <div>
                <h1 className="navbar-brand">NextDoorLearn</h1>
                <div className="flex items-center space-x-2">
                  <p className="text-gray-600">Welcome back, {user?.name}! 👋</p>
                  <StatusIndicator isOnline={isOnline} showText={true} />
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <span className={`badge ${user?.role === 'tutor' ? 'badge-primary' : 'badge-secondary'}`}>
                {user?.role === 'tutor' ? '👨‍🏫 Tutor' : '🎓 Student'}
              </span>
              <button
                onClick={() => {
                  localStorage.removeItem('token');
                  localStorage.removeItem('user');
                  window.location.reload();
                }}
                className="btn btn-ghost"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Quick Actions */}
          <div className="card hover-lift">
            <div className="card-header">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                ⚡ Quick Actions
              </h3>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                {user?.role === 'student' ? (
                  <>
                    <a
                      href="/tutors"
                      className="btn btn-primary w-full hover-glow"
                    >
                      🔍 Find Tutors
                    </a>
                    <a
                      href="/messages"
                      className="btn btn-secondary w-full hover-glow"
                    >
                      💬 My Messages
                    </a>
                  </>
                ) : (
                  <>
                    <a
                      href="/requests"
                      className="btn btn-primary w-full hover-glow"
                    >
                      📋 View Requests
                    </a>
                    <a
                      href="/messages"
                      className="btn btn-secondary w-full hover-glow"
                    >
                      💬 My Messages
                    </a>
                  </>
                )}
                <a
                  href="/profile"
                  className="btn btn-success w-full hover-glow"
                >
                  ✏️ Edit Profile
                </a>
              </div>
            </div>
          </div>

          {/* Profile Summary */}
          <div className="card hover-lift">
            <div className="card-header">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                👤 Profile Summary
              </h3>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                {/* Profile Picture */}
                <div className="flex justify-center mb-4">
                  {profile?.avatar_url ? (
                    <img
                      src={`http://localhost:3001${profile.avatar_url}`}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover border-4 border-primary-200 shadow-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center border-4 border-primary-200 shadow-lg">
                      <span className="text-3xl text-primary-600">👤</span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Name:</span>
                    <span className="text-gray-900">{profile?.name || user?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Email:</span>
                    <span className="text-gray-900 text-sm">{user?.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 font-medium">Role:</span>
                    <span className={`badge ${user?.role === 'tutor' ? 'badge-primary' : 'badge-secondary'}`}>
                      {user?.role === 'tutor' ? 'Tutor' : 'Student'}
                    </span>
                  </div>
                  {profile?.bio && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700 italic">"{profile.bio}"</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="card hover-lift">
            <div className="card-header">
              <h3 className="text-xl font-semibold text-gray-900 flex items-center">
                📊 Quick Stats
              </h3>
            </div>
            <div className="card-body">
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-number">0</div>
                  <div className="stat-label">
                    {user?.role === 'tutor' ? 'Students Helped' : 'Tutors Connected'}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">0</div>
                  <div className="stat-label">Messages Sent</div>
                </div>
                <div className="stat-card">
                  <div className="stat-number">0</div>
                  <div className="stat-label">Active Connections</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
