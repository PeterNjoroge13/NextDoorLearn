import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const TutorBrowse = () => {
  const { user } = useAuth();
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const fetchTutors = async () => {
      try {
        const response = await api.getTutors();
        if (response.error) {
          setError(response.error);
        } else {
          setTutors(response);
        }
      } catch (err) {
        setError('Failed to load tutors');
      } finally {
        setLoading(false);
      }
    };

    fetchTutors();
  }, []);

  const handleRequestConnection = async (tutorId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.sendConnectionRequest(tutorId, token);
      
      if (response.error) {
        alert(response.error);
      } else {
        alert('Connection request sent successfully!');
      }
    } catch (err) {
      alert('Failed to send connection request');
    }
  };

  const filteredTutors = tutors.filter(tutor =>
    tutor.name.toLowerCase().includes(filter.toLowerCase()) ||
    tutor.subjects.some(subject => 
      subject.toLowerCase().includes(filter.toLowerCase())
    )
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tutors...</p>
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
            <div>
              <h1 className="text-3xl font-bold text-gradient">Find Tutors</h1>
              <p className="text-gray-600">Connect with experienced tutors in your area</p>
            </div>
            <a
              href="/dashboard"
              className="btn btn-ghost"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      {/* Search and Filter */}
      <div className="container py-6">
        <div className="card">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="🔍 Search by name or subject..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="focus-ring"
              />
            </div>
            <div className="text-sm text-gray-600 flex items-center">
              <span className="badge badge-primary">
                {filteredTutors.length} tutor{filteredTutors.length !== 1 ? 's' : ''} found
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tutors Grid */}
      <div className="container pb-8">
        {error && (
          <div className="alert alert-error mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTutors.map((tutor) => (
            <div key={tutor.id} className="card hover-lift hover-glow">
              <div className="card-header">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900">{tutor.name}</h3>
                  {tutor.hourly_rate > 0 && (
                    <span className="text-lg font-bold text-primary-600">
                      ${tutor.hourly_rate}/hr
                    </span>
                  )}
                </div>
              </div>
              
              <div className="card-body">
                {tutor.bio && (
                  <p className="text-gray-600 mb-4 italic">"{tutor.bio}"</p>
                )}

                <div className="mb-4">
                  <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                    📚 Subjects:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {tutor.subjects.map((subject, index) => (
                      <span
                        key={index}
                        className="badge badge-primary"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="card-footer">
                <button
                  onClick={() => handleRequestConnection(tutor.id)}
                  className="btn btn-primary w-full hover-glow"
                >
                  🤝 Request Connection
                </button>
              </div>
            </div>
          ))}
        </div>

        {filteredTutors.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-gray-500 text-lg">No tutors found matching your criteria.</p>
            <p className="text-gray-400 text-sm mt-2">Try adjusting your search terms</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TutorBrowse;
