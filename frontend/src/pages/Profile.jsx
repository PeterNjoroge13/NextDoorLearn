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
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarError, setAvatarError] = useState('');
  const [error, setError] = useState('');
  const [compressing, setCompressing] = useState(false);
  const [compressionInfo, setCompressionInfo] = useState('');

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
          
          // Safely parse JSON fields
          let subjects = [];
          let availability = {};
          let subjects_needed = [];
          
          try {
            subjects = response.profile?.subjects ? 
              (typeof response.profile.subjects === 'string' ? 
                JSON.parse(response.profile.subjects) : response.profile.subjects) : [];
          } catch (e) {
            console.warn('Error parsing subjects:', e);
          }
          
          try {
            availability = response.profile?.availability ? 
              (typeof response.profile.availability === 'string' ? 
                JSON.parse(response.profile.availability) : response.profile.availability) : {};
          } catch (e) {
            console.warn('Error parsing availability:', e);
          }
          
          try {
            subjects_needed = response.profile?.subjects_needed ? 
              (typeof response.profile.subjects_needed === 'string' ? 
                JSON.parse(response.profile.subjects_needed) : response.profile.subjects_needed) : [];
          } catch (e) {
            console.warn('Error parsing subjects_needed:', e);
          }
          
          setFormData({
            name: response.name || '',
            bio: response.bio || '',
            subjects: subjects,
            availability: availability,
            hourly_rate: response.profile?.hourly_rate || 0,
            grade_level: response.profile?.grade_level || '',
            subjects_needed: subjects_needed
          });
          setAvatarUrl(response.avatar_url || '');
          setError(''); // Clear any previous errors
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        setError('Failed to load profile. Please try again.');
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

  // Function to compress and resize image
  const compressImage = (file, maxWidth = 600, maxHeight = 600, quality = 0.85) => {
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        const aspectRatio = width / height;
        
        // Determine if we need to resize
        if (width > maxWidth || height > maxHeight) {
          if (aspectRatio > 1) {
            // Landscape
            width = Math.min(width, maxWidth);
            height = width / aspectRatio;
          } else {
            // Portrait or square
            height = Math.min(height, maxHeight);
            width = height * aspectRatio;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);
        
        // Use different quality based on file size
        let finalQuality = quality;
        if (file.size > 5 * 1024 * 1024) { // If original > 5MB
          finalQuality = 0.7;
        } else if (file.size > 2 * 1024 * 1024) { // If original > 2MB
          finalQuality = 0.8;
        }
        
        canvas.toBlob(resolve, file.type, finalQuality);
      };

      img.src = URL.createObjectURL(file);
    });
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Reset error state
    setAvatarError('');
    setMessage('');

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setAvatarError('File size must be less than 10MB');
      return;
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      setAvatarError('Please select a valid image file (JPG, PNG, GIF, or WebP)');
      return;
    }

    setCompressing(true);
    setUploadingAvatar(true);
    try {
      // Compress the image
      const compressedFile = await compressImage(file);
      setCompressing(false);
      
      // Show compression info
      const originalSize = (file.size / 1024 / 1024).toFixed(2);
      const compressedSize = (compressedFile.size / 1024 / 1024).toFixed(2);
      const savings = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
      setCompressionInfo(`Compressed from ${originalSize}MB to ${compressedSize}MB (${savings}% smaller)`);
      
      // Create preview with compressed image
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target.result);
      };
      reader.readAsDataURL(compressedFile);

      const formData = new FormData();
      formData.append('avatar', compressedFile, file.name);

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
        setCompressionInfo(''); // Clear compression info
        // Clear the file input
        e.target.value = '';
        
        // Show success message for 3 seconds
        setTimeout(() => {
          setMessage('');
        }, 3000);
      } else {
        setAvatarError('Error uploading avatar: ' + result.message);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setAvatarError('Error uploading avatar. Please try again.');
    } finally {
      setCompressing(false);
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('http://localhost:3001/api/upload/avatar', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setAvatarUrl('');
        setAvatarPreview(null);
        setMessage('Avatar removed successfully!');
      } else {
        setMessage('Error removing avatar');
      }
    } catch (error) {
      setMessage('Error removing avatar');
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
          <div className="spinner"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Profile</h2>
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
          <p className="text-gray-600 mb-6">Please log in to access your profile.</p>
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
            <div className="flex items-center space-x-4">
              {/* Profile Picture in Header */}
              {avatarUrl ? (
                <img
                  src={`http://localhost:3001${avatarUrl}`}
                  alt="Profile"
                  className="w-12 h-12 rounded-full object-cover border-2 border-primary-200 shadow-md"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center border-2 border-primary-200 shadow-md">
                  <span className="text-xl text-primary-600">👤</span>
                </div>
              )}
              <div>
                <h1 className="text-gradient">Edit Profile</h1>
                <p className="text-gray-600">Update your profile information</p>
              </div>
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

      {/* Profile Form */}
      <div className="container py-6">
        <div className="card">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Avatar Section */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Profile Picture</h3>
              <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6">
                <div className="relative group">
                  {/* Avatar Display */}
                  <div className="relative">
                    {avatarPreview ? (
                      <img
                        src={avatarPreview}
                        alt="Preview"
                        className="w-24 h-24 rounded-full object-cover border-4 border-primary-200 shadow-lg"
                        onError={(e) => {
                          console.error('Preview image error:', e);
                          setAvatarPreview(null);
                        }}
                      />
                    ) : avatarUrl ? (
                      <img
                        src={`http://localhost:3001${avatarUrl}`}
                        alt="Profile"
                        className="w-24 h-24 rounded-full object-cover border-4 border-primary-200 shadow-lg"
                        onError={(e) => {
                          console.error('Avatar image error:', e);
                          setAvatarUrl('');
                        }}
                      />
                    ) : (
                      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-primary-100 to-secondary-100 flex items-center justify-center border-4 border-primary-200 shadow-lg">
                        <span className="text-3xl text-primary-600">👤</span>
                      </div>
                    )}
                    
                    {/* Upload Overlay */}
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <span className="text-white text-sm font-medium">📷</span>
                    </div>
                  </div>
                  
                  {/* Remove Avatar Button */}
                  {avatarUrl && (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-error-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-error-600 transition-colors"
                      title="Remove avatar"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <div>
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleAvatarUpload}
                      disabled={uploadingAvatar}
                      className="hidden"
                      id="avatar-upload"
                    />
            <label
              htmlFor="avatar-upload"
              className={`btn btn-primary cursor-pointer inline-flex items-center space-x-2 ${
                uploadingAvatar ? 'opacity-50 cursor-not-allowed' : 'hover-glow'
              }`}
            >
              {compressing ? (
                <>
                  <div className="spinner w-4 h-4"></div>
                  <span>Compressing...</span>
                </>
              ) : uploadingAvatar ? (
                <>
                  <div className="spinner w-4 h-4"></div>
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <span>📷</span>
                  <span>{avatarUrl ? 'Change Avatar' : 'Upload Avatar'}</span>
                </>
              )}
            </label>
                  </div>
                  
                  <div className="text-sm text-gray-500">
                    <p>JPG, PNG, GIF, or WebP up to 10MB</p>
                    <p>Auto-compressed to 600x600px max for optimal performance</p>
                    <p>Larger files will be compressed more aggressively</p>
                  </div>

                  {/* Compression Info */}
                  {compressionInfo && (
                    <div className="text-sm text-blue-600 bg-blue-50 p-2 rounded-md border border-blue-200">
                      {compressionInfo}
                    </div>
                  )}

                  {/* Success Message */}
                  {message && !message.includes('Error') && (
                    <div className="text-sm text-success-600 bg-success-50 p-2 rounded-md border border-success-200">
                      {message}
                    </div>
                  )}

                  {/* Error Message */}
                  {avatarError && (
                    <div className="text-sm text-error-600 bg-error-50 p-2 rounded-md border border-error-200">
                      {avatarError}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className="mt-1 block w-full focus-ring"
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
                    className="mt-1 block w-full focus-ring"
                    placeholder="Tell us about yourself..."
                  />
                </div>
              </div>
            </div>

            {/* Role-specific fields */}
            {user.role === 'tutor' ? (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Tutor Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="subjects" className="block text-sm font-medium text-gray-700">
                      Subjects (comma-separated)
                    </label>
                    <input
                      type="text"
                      id="subjects"
                      value={formData.subjects.join(', ')}
                      onChange={(e) => handleArrayChange('subjects', e.target.value)}
                      className="mt-1 block w-full focus-ring"
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
                      className="mt-1 block w-full focus-ring"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Student Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                      className="mt-1 block w-full focus-ring"
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
                      className="mt-1 block w-full focus-ring"
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
                className="btn btn-primary"
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
