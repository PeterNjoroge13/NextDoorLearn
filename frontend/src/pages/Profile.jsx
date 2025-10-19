import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Profile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    subjects: [],
    availability: {},
    hourly_rate: 0,
    grade_level: '',
    subjects_needed: []
  });
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await api.getProfile(token);
        if (response.error) {
          console.error('Error fetching profile:', response.error);
        } else {
          setProfile(response);
          setFormData({
            name: response.name || '',
            bio: response.bio || '',
            subjects: response.profile?.subjects || [],
            availability: response.profile?.availability || {},
            hourly_rate: response.profile?.hourly_rate || 0,
            grade_level: response.profile?.grade_level || '',
            subjects_needed: response.profile?.subjects_needed || []
          });
          setAvatarUrl(response.avatar_url || '');
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleArrayChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value.split(',').map(item => item.trim()).filter(item => item)
    }));
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/upload/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const result = await response.json();
      if (response.ok) {
        setAvatarUrl(result.avatarUrl);
        setMessage('Avatar updated successfully!');
      } else {
        setMessage('Error uploading avatar: ' + result.message);
      }
    } catch (error) {
      setMessage('Error uploading avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const profileData = {
        name: formData.name,
        bio: formData.bio,
        profile: user.role === 'tutor' ? {
          subjects: formData.subjects,
          availability: formData.availability,
          hourly_rate: parseFloat(formData.hourly_rate)
        } : {
          grade_level: formData.grade_level,
          subjects_needed: formData.subjects_needed
        }
      };

      const response = await api.updateProfile(profileData, token);
      
      if (response.error) {
        setMessage('Error: ' + response.error);
      } else {
        setMessage('Profile updated successfully!');
        setProfile({ ...profile, ...profileData });
      }
    } catch (error) {
      setMessage('Error updating profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Edit Profile</h1>
              <p className="text-gray-600">Update your profile information</p>
            </div>
            <a
              href="/dashboard"
              className="text-indigo-600 hover:text-indigo-500"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </header>

      {/* Profile Form */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white shadow rounded-lg">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Avatar Section */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Picture</h3>
              <div className="flex items-center space-x-4">
                <div className="relative">
                  {avatarUrl ? (
                    <img
                      src={`http://localhost:3001${avatarUrl}`}
                      alt="Profile"
                      className="w-20 h-20 rounded-full object-cover border-2 border-gray-300"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-gray-300 flex items-center justify-center">
                      <span className="text-2xl text-gray-600">👤</span>
                    </div>
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploadingAvatar}
                    className="hidden"
                    id="avatar-upload"
                  />
                  <label
                    htmlFor="avatar-upload"
                    className="btn btn-secondary cursor-pointer"
                  >
                    {uploadingAvatar ? 'Uploading...' : 'Change Avatar'}
                  </label>
                  <p className="text-sm text-gray-500 mt-1">
                    JPG, PNG, GIF up to 5MB
                  </p>
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={formData.name}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                    Bio
                  </label>
                  <textarea
                    name="bio"
                    id="bio"
                    rows={3}
                    value={formData.bio}
                    onChange={handleChange}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Tell us about yourself..."
                  />
                </div>
              </div>
            </div>

            {/* Role-specific fields */}
            {user.role === 'tutor' ? (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Tutor Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="subjects" className="block text-sm font-medium text-gray-700">
                      Subjects (comma-separated)
                    </label>
                    <input
                      type="text"
                      id="subjects"
                      value={formData.subjects.join(', ')}
                      onChange={(e) => handleArrayChange('subjects', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Math, Science, English..."
                    />
                  </div>
                  <div>
                    <label htmlFor="hourly_rate" className="block text-sm font-medium text-gray-700">
                      Hourly Rate ($)
                    </label>
                    <input
                      type="number"
                      name="hourly_rate"
                      id="hourly_rate"
                      value={formData.hourly_rate}
                      onChange={handleChange}
                      min="0"
                      step="0.01"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Student Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="grade_level" className="block text-sm font-medium text-gray-700">
                      Grade Level
                    </label>
                    <input
                      type="text"
                      name="grade_level"
                      id="grade_level"
                      value={formData.grade_level}
                      onChange={handleChange}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="9th Grade, High School, etc."
                    />
                  </div>
                  <div>
                    <label htmlFor="subjects_needed" className="block text-sm font-medium text-gray-700">
                      Subjects Needed (comma-separated)
                    </label>
                    <input
                      type="text"
                      id="subjects_needed"
                      value={formData.subjects_needed.join(', ')}
                      onChange={(e) => handleArrayChange('subjects_needed', e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder="Math, Science, English..."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Message */}
            {message && (
              <div className={`p-4 rounded-md ${
                message.includes('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
              }`}>
                {message}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Profile;
