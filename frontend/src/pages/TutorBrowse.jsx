import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatusIndicator from '../components/StatusIndicator';
import ThemeToggle from '../components/ThemeToggle';

const TutorBrowse = () => {
  const { user } = useAuth();
  const [tutors, setTutors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');
  const [tutorStatuses, setTutorStatuses] = useState({});
  const [filters, setFilters] = useState({
    subject: '',
    priceRange: [0, 100],
    onlineOnly: false,
    sortBy: 'name' // name, price, rating
  });

  useEffect(() => {
    const fetchTutors = async () => {
      try {
        const response = await api.getTutors();
        if (response.error) {
          setError(response.error);
        } else {
          setTutors(response);
          // Fetch status for each tutor
          const token = localStorage.getItem('token');
          const statusPromises = response.map(async (tutor) => {
            try {
              const statusResponse = await api.getUserStatus(tutor.id, token);
              return { tutorId: tutor.id, status: statusResponse };
            } catch (error) {
              return { tutorId: tutor.id, status: { isOnline: false, lastSeenFormatted: 'Unknown' } };
            }
          });
          
          const statuses = await Promise.all(statusPromises);
          const statusMap = {};
          statuses.forEach(({ tutorId, status }) => {
            statusMap[tutorId] = status;
          });
          setTutorStatuses(statusMap);
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

  const filteredTutors = tutors.filter(tutor => {
    const searchTerm = filter.toLowerCase();
    const matchesSearch = tutor.name.toLowerCase().includes(searchTerm) ||
           (tutor.subjects && tutor.subjects.some(subject => 
             subject.toLowerCase().includes(searchTerm)
           ));
    
    const matchesSubject = !filters.subject || 
           (tutor.subjects && tutor.subjects.some(subject => 
             subject.toLowerCase().includes(filters.subject.toLowerCase())
           ));
    
    const matchesPrice = tutor.hourly_rate >= filters.priceRange[0] && 
           tutor.hourly_rate <= filters.priceRange[1];
    
    const matchesOnline = !filters.onlineOnly || 
           (tutorStatuses[tutor.id]?.isOnline === true);
    
    return matchesSearch && matchesSubject && matchesPrice && matchesOnline;
  }).sort((a, b) => {
    switch (filters.sortBy) {
      case 'price':
        return a.hourly_rate - b.hourly_rate;
      case 'name':
        return a.name.localeCompare(b.name);
      case 'online':
        const aOnline = tutorStatuses[a.id]?.isOnline || false;
        const bOnline = tutorStatuses[b.id]?.isOnline || false;
        return bOnline - aOnline;
      default:
        return 0;
    }
  });

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
            <div className="flex items-center space-x-4">
              <ThemeToggle />
              <a
                href="/dashboard"
                className="btn btn-ghost"
              >
                ← Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Search and Filter */}
      <div className="container py-6">
        <div className="card">
          <div className="space-y-4">
            {/* Search Bar */}
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
              <div className="text-sm text-gray-600 flex items-center space-x-2">
                <span className="badge badge-primary">
                  {filteredTutors.length} tutor{filteredTutors.length !== 1 ? 's' : ''} found
                </span>
                <button
                  onClick={() => {
                    setFilter('');
                    setFilters({
                      subject: '',
                      priceRange: [0, 100],
                      onlineOnly: false,
                      sortBy: 'name'
                    });
                  }}
                  className="btn btn-ghost btn-sm"
                >
                  Clear Filters
                </button>
              </div>
            </div>

            {/* Advanced Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Subject Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject
                </label>
                <select
                  value={filters.subject}
                  onChange={(e) => setFilters(prev => ({ ...prev, subject: e.target.value }))}
                  className="focus-ring"
                >
                  <option value="">All Subjects</option>
                  <option value="math">Math</option>
                  <option value="science">Science</option>
                  <option value="english">English</option>
                  <option value="history">History</option>
                  <option value="computer">Computer Science</option>
                  <option value="physics">Physics</option>
                  <option value="chemistry">Chemistry</option>
                </select>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Price: ${filters.priceRange[1]}
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={filters.priceRange[1]}
                  onChange={(e) => setFilters(prev => ({ 
                    ...prev, 
                    priceRange: [prev.priceRange[0], parseInt(e.target.value)]
                  }))}
                  className="w-full"
                />
              </div>

              {/* Online Only */}
              <div className="flex items-center">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.onlineOnly}
                    onChange={(e) => setFilters(prev => ({ ...prev, onlineOnly: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">Online Only</span>
                </label>
              </div>

              {/* Sort By */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                  className="focus-ring"
                >
                  <option value="name">Name</option>
                  <option value="price">Price (Low to High)</option>
                  <option value="online">Online First</option>
                </select>
              </div>
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
                  <div className="flex items-center space-x-3">
                    {tutor.avatar_url ? (
                      <img
                        src={`http://localhost:3001${tutor.avatar_url}`}
                        alt={tutor.name}
                        className="w-12 h-12 rounded-full object-cover border-2 border-primary-200"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-lg text-primary-600">👤</span>
                      </div>
                    )}
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{tutor.name}</h3>
                      <StatusIndicator 
                        isOnline={tutorStatuses[tutor.id]?.isOnline || false}
                        lastSeenFormatted={tutorStatuses[tutor.id]?.lastSeenFormatted}
                        showText={true}
                      />
                    </div>
                  </div>
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
