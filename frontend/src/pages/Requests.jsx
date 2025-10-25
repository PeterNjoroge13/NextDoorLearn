import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Requests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) {
          setError('No authentication token found. Please log in again.');
          setLoading(false);
          return;
        }

        // Fetch real requests from API
        const response = await fetch('http://localhost:3001/api/requests', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setRequests(data);
        } else {
          // If no real data, show some mock data for demo
          const mockRequests = [
            {
              id: 1,
              student_name: 'Alice Johnson',
              student_email: 'alice@example.com',
              subjects_needed: '["Mathematics", "Calculus"]',
              message: 'I need help with calculus. Can you help me understand derivatives?',
              status: 'pending',
              created_at: '2024-01-15T10:30:00Z'
            },
            {
              id: 2,
              student_name: 'Bob Smith',
              student_email: 'bob@example.com',
              subjects_needed: '["Physics", "Quantum Mechanics"]',
              message: 'Struggling with quantum mechanics concepts. Available for tutoring?',
              status: 'pending',
              created_at: '2024-01-14T15:45:00Z'
            }
          ];
          setRequests(mockRequests);
        }
        setError('');
      } catch (error) {
        console.error('Error fetching requests:', error);
        setError('Failed to load requests. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  const handleRespondToRequest = async (requestId, action) => {
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`http://localhost:3001/api/requests/${requestId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update local state
        setRequests(prev => prev.map(req => 
          req.id === requestId 
            ? { ...req, status: result.status }
            : req
        ));
        
        // Show success message
        alert(`Request ${action}ed successfully!`);
      } else {
        const error = await response.json();
        alert(`Error: ${error.error}`);
      }
    } catch (error) {
      console.error('Error responding to request:', error);
      alert('Error responding to request. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="spinner"></div>
          <p className="mt-4 text-gray-600">Loading requests...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Requests</h2>
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
          <p className="text-gray-600 mb-6">Please log in to view requests.</p>
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

  if (user.role !== 'tutor') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-6xl mb-4">👨‍🎓</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Tutor Access Required</h2>
          <p className="text-gray-600 mb-6">Only tutors can view connection requests.</p>
          <a
            href="/dashboard"
            className="btn btn-primary w-full"
          >
            Back to Dashboard
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
              <h1 className="text-gradient">Connection Requests</h1>
              <p className="text-gray-600">Manage your tutoring requests from students</p>
            </div>
            <a
              href="/dashboard"
              className="text-primary-600 hover:text-primary-500"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-8">
        {requests.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📝</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Requests Yet</h3>
            <p className="text-gray-600 mb-6">You haven't received any connection requests from students.</p>
            <a
              href="/tutors"
              className="btn btn-primary"
            >
              Browse Students
            </a>
          </div>
        ) : (
          <div className="space-y-6">
            {requests.map((request) => (
              <div key={request.id} className="card hover-lift">
                <div className="card-header">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{request.student_name}</h3>
                      <p className="text-gray-600">{request.student_email}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(request.created_at).toLocaleDateString()} at{' '}
                        {new Date(request.created_at).toLocaleTimeString()}
                      </p>
                    </div>
                    <span className={`badge ${
                      request.status === 'pending' ? 'badge-warning' :
                      request.status === 'accepted' ? 'badge-success' :
                      'badge-error'
                    }`}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </span>
                  </div>
                </div>
                <div className="card-body">
                  <div className="mb-4">
                    {request.subjects_needed && (
                      <div className="flex flex-wrap gap-2">
                        {JSON.parse(request.subjects_needed || '[]').map((subject, index) => (
                          <span key={index} className="inline-block bg-primary-100 text-primary-800 text-sm font-medium px-2.5 py-0.5 rounded">
                            {subject}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <p className="text-gray-700 mb-4">{request.message}</p>
                  
                  {request.status === 'pending' && (
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleRespondToRequest(request.id, 'accept')}
                        className="btn btn-success"
                      >
                        ✓ Accept Request
                      </button>
                      <button
                        onClick={() => handleRespondToRequest(request.id, 'reject')}
                        className="btn btn-error"
                      >
                        ✗ Decline Request
                      </button>
                      <button
                        onClick={() => {
                          // Navigate to messages with this student
                          window.location.href = '/messages';
                        }}
                        className="btn btn-secondary"
                      >
                        💬 Message Student
                      </button>
                    </div>
                  )}
                  
                  {request.status === 'accepted' && (
                    <div className="flex space-x-3">
                      <span className="text-success-600 font-medium">✓ Request Accepted</span>
                      <button
                        onClick={() => {
                          window.location.href = '/messages';
                        }}
                        className="btn btn-primary"
                      >
                        💬 Start Conversation
                      </button>
                    </div>
                  )}
                  
                  {request.status === 'rejected' && (
                    <div className="flex space-x-3">
                      <span className="text-error-600 font-medium">✗ Request Declined</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Requests;
