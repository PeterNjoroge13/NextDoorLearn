import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Lock, Save, Settings, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AppShell, { Avatar, ErrorState, LoadingState } from '../components/AppShell';
import { parseList } from '../utils/format';

const commonLanguages = ['English', 'Spanish', 'French', 'Mandarin', 'Arabic', 'Portuguese', 'Korean'];
const timezones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'];
const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const Profile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [completion, setCompletion] = useState(0);
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [formData, setFormData] = useState({
    name: '',
    bio: '',
    phone: '',
    location: '',
    timezone: '',
    languages: [],
    website: '',
    linkedin: '',
    subjects: [],
    hourly_rate: 0,
    experience_years: 0,
    education: '',
    certifications: '',
    teaching_style: '',
    grade_level: '',
    subjects_needed: [],
    school: '',
    learning_goals: '',
    preferred_schedule: '',
    avatar_url: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await api.getProfile(token);
        if (response.error) {
          setError(response.error);
          return;
        }

        setFormData({
          name: response.name || '',
          bio: response.bio || '',
          phone: response.phone || '',
          location: response.location || '',
          timezone: response.timezone || '',
          languages: parseList(response.languages),
          website: response.website || '',
          linkedin: response.linkedin || '',
          subjects: parseList(response.profile?.subjects),
          hourly_rate: response.profile?.hourly_rate || 0,
          experience_years: response.profile?.experience_years || 0,
          education: response.profile?.education || '',
          certifications: response.profile?.certifications || '',
          teaching_style: response.profile?.teaching_style || '',
          grade_level: response.profile?.grade_level || '',
          subjects_needed: parseList(response.profile?.subjects_needed),
          school: response.profile?.school || '',
          learning_goals: response.profile?.learning_goals || '',
          preferred_schedule: response.profile?.preferred_schedule || '',
          avatar_url: response.avatar_url || '',
        });

        const completionResponse = await api.getProfileCompletion(token);
        if (!completionResponse.error) setCompletion(completionResponse.percentage || 0);

        if (user?.role === 'tutor') {
          const availabilityResponse = await api.getMyAvailability(token);
          if (!availabilityResponse.error) setAvailabilitySlots(availabilityResponse.slots || []);
        }
      } catch {
        setError('Profile could not be loaded.');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user?.role]);

  const profilePayload = useMemo(() => {
    const base = {
      name: formData.name,
      bio: formData.bio,
      phone: formData.phone,
      location: formData.location,
      timezone: formData.timezone,
      languages: formData.languages,
      website: formData.website,
      linkedin: formData.linkedin,
    };

    if (user?.role === 'tutor') {
      base.profile = {
        subjects: formData.subjects,
        hourly_rate: Number(formData.hourly_rate || 0),
        experience_years: Number(formData.experience_years || 0),
        education: formData.education,
        certifications: formData.certifications,
        teaching_style: formData.teaching_style,
      };
    } else {
      base.profile = {
        grade_level: formData.grade_level,
        subjects_needed: formData.subjects_needed,
        school: formData.school,
        learning_goals: formData.learning_goals,
        preferred_schedule: formData.preferred_schedule,
      };
    }

    return base;
  }, [formData, user?.role]);

  const setField = (field, value) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const setListField = (field, value) => {
    setField(field, value.split(',').map((item) => item.trim()).filter(Boolean));
  };

  const toggleLanguage = (language) => {
    setFormData((current) => ({
      ...current,
      languages: current.languages.includes(language)
        ? current.languages.filter((item) => item !== language)
        : [...current.languages, language],
    }));
  };

  const handleSave = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      const token = localStorage.getItem('token');
      const response = await api.updateProfile(profilePayload, token);
      setMessage(response.error ? response.error : 'Profile saved.');
    } catch {
      setMessage('Profile could not be saved.');
    } finally {
      setSaving(false);
      setTimeout(() => setMessage(''), 3600);
    }
  };

  const handlePassword = async (event) => {
    event.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage('New passwords do not match.');
      return;
    }
    const token = localStorage.getItem('token');
    const response = await api.changePassword(passwordData.currentPassword, passwordData.newPassword, token);
    setMessage(response.error || 'Password updated.');
    if (!response.error) setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  const addAvailabilitySlot = () => {
    setAvailabilitySlots((current) => [...current, { dayOfWeek: 1, startTime: '09:00', endTime: '10:00', timezone: formData.timezone }]);
  };

  const saveAvailability = async () => {
    const token = localStorage.getItem('token');
    const response = await api.updateMyAvailability(availabilitySlots, formData.timezone, token);
    if (!response.error) setAvailabilitySlots(response.slots || []);
    setMessage(response.error || 'Availability saved.');
  };

  if (loading) return <LoadingState label="Loading profile..." />;
  if (error) return <ErrorState message={error} />;

  return (
    <AppShell>
      <main className="page">
        <section className="section-head">
          <div>
            <span className="eyebrow">
              <Settings size={15} />
              Profile settings
            </span>
            <h1 className="page-title">Make your profile feel trustworthy.</h1>
            <p className="page-copy">Keep your account, subjects, and availability current so connections feel easy.</p>
          </div>
        </section>

        {message ? <div className="alert" style={{ marginBottom: 16 }}>{message}</div> : null}

        <section className="profile-layout">
          <aside className="card card-pad profile-sidebar">
            <div className="item-main">
              <Avatar name={formData.name || user?.name} src={formData.avatar_url} size={64} />
              <div>
                <h2 style={{ fontSize: '1.15rem' }}>{formData.name || user?.name}</h2>
                <p className="muted" style={{ textTransform: 'capitalize' }}>{user?.role}</p>
              </div>
            </div>
            <div style={{ marginTop: 20 }}>
              <div className="list-item" style={{ padding: 0, border: 0, marginBottom: 8 }}>
                <strong>Profile strength</strong>
                <span className="badge badge-primary">{completion}%</span>
              </div>
              <div className="progress"><span style={{ width: `${completion}%` }} /></div>
            </div>
            <div className="tabs" style={{ marginTop: 20 }}>
              <button className={`tab${activeTab === 'profile' ? ' active' : ''}`} onClick={() => setActiveTab('profile')} type="button">
                <UserRound size={15} /> Profile
              </button>
              {user?.role === 'tutor' ? (
                <button className={`tab${activeTab === 'availability' ? ' active' : ''}`} onClick={() => setActiveTab('availability')} type="button">
                  <CalendarClock size={15} /> Availability
                </button>
              ) : null}
              <button className={`tab${activeTab === 'security' ? ' active' : ''}`} onClick={() => setActiveTab('security')} type="button">
                <Lock size={15} /> Security
              </button>
            </div>
          </aside>

          <div className="card card-pad">
            {activeTab === 'profile' ? (
              <form className="form-grid" onSubmit={handleSave}>
                <div className="grid grid-2">
                  <div className="field">
                    <label>Name</label>
                    <input value={formData.name} onChange={(event) => setField('name', event.target.value)} required />
                  </div>
                  <div className="field">
                    <label>Location</label>
                    <input value={formData.location} onChange={(event) => setField('location', event.target.value)} placeholder="City, state, or remote" />
                  </div>
                </div>
                <div className="field">
                  <label>Bio</label>
                  <textarea value={formData.bio} onChange={(event) => setField('bio', event.target.value)} />
                </div>
                <div className="grid grid-2">
                  <div className="field">
                    <label>Phone</label>
                    <input value={formData.phone} onChange={(event) => setField('phone', event.target.value)} />
                  </div>
                  <div className="field">
                    <label>Timezone</label>
                    <select value={formData.timezone} onChange={(event) => setField('timezone', event.target.value)}>
                      <option value="">Select timezone</option>
                      {timezones.map((timezone) => <option key={timezone} value={timezone}>{timezone}</option>)}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Languages</label>
                  <div className="chip-row">
                    {commonLanguages.map((language) => (
                      <button
                        key={language}
                        type="button"
                        className={`badge ${formData.languages.includes(language) ? 'badge-primary' : ''}`}
                        onClick={() => toggleLanguage(language)}
                      >
                        {language}
                      </button>
                    ))}
                  </div>
                </div>

                {user?.role === 'tutor' ? (
                  <>
                    <div className="field">
                      <label>Subjects</label>
                      <input value={formData.subjects.join(', ')} onChange={(event) => setListField('subjects', event.target.value)} placeholder="Math, Biology, SAT prep" />
                    </div>
                    <div className="grid grid-2">
                      <div className="field">
                        <label>Hourly rate</label>
                        <input type="number" min="0" value={formData.hourly_rate} onChange={(event) => setField('hourly_rate', event.target.value)} />
                      </div>
                      <div className="field">
                        <label>Experience years</label>
                        <input type="number" min="0" value={formData.experience_years} onChange={(event) => setField('experience_years', event.target.value)} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Teaching style</label>
                      <textarea value={formData.teaching_style} onChange={(event) => setField('teaching_style', event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Education and certifications</label>
                      <textarea value={formData.education} onChange={(event) => setField('education', event.target.value)} />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-2">
                      <div className="field">
                        <label>Grade level</label>
                        <input value={formData.grade_level} onChange={(event) => setField('grade_level', event.target.value)} />
                      </div>
                      <div className="field">
                        <label>School</label>
                        <input value={formData.school} onChange={(event) => setField('school', event.target.value)} />
                      </div>
                    </div>
                    <div className="field">
                      <label>Subjects needed</label>
                      <input value={formData.subjects_needed.join(', ')} onChange={(event) => setListField('subjects_needed', event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Learning goals</label>
                      <textarea value={formData.learning_goals} onChange={(event) => setField('learning_goals', event.target.value)} />
                    </div>
                  </>
                )}

                <button className="btn btn-primary" type="submit" disabled={saving}>
                  <Save size={18} />
                  {saving ? 'Saving...' : 'Save profile'}
                </button>
              </form>
            ) : null}

            {activeTab === 'availability' ? (
              <div className="form-grid">
                <div className="section-head">
                  <div>
                    <h2>Availability</h2>
                    <p>Add recurring windows when students can request sessions.</p>
                  </div>
                  <button className="btn btn-ghost" type="button" onClick={addAvailabilitySlot}>Add slot</button>
                </div>
                {availabilitySlots.map((slot, index) => (
                  <div className="grid grid-4" key={`${slot.dayOfWeek}-${index}`}>
                    <select
                      value={slot.dayOfWeek}
                      onChange={(event) => setAvailabilitySlots((current) => current.map((item, i) => (i === index ? { ...item, dayOfWeek: Number(event.target.value) } : item)))}
                    >
                      {weekDays.map((day, dayIndex) => <option key={day} value={dayIndex}>{day}</option>)}
                    </select>
                    <input
                      type="time"
                      value={slot.startTime}
                      onChange={(event) => setAvailabilitySlots((current) => current.map((item, i) => (i === index ? { ...item, startTime: event.target.value } : item)))}
                    />
                    <input
                      type="time"
                      value={slot.endTime}
                      onChange={(event) => setAvailabilitySlots((current) => current.map((item, i) => (i === index ? { ...item, endTime: event.target.value } : item)))}
                    />
                    <button className="btn btn-ghost" type="button" onClick={() => setAvailabilitySlots((current) => current.filter((_, i) => i !== index))}>Remove</button>
                  </div>
                ))}
                <button className="btn btn-primary" type="button" onClick={saveAvailability}>Save availability</button>
              </div>
            ) : null}

            {activeTab === 'security' ? (
              <form className="form-grid" onSubmit={handlePassword}>
                <div className="field">
                  <label>Current password</label>
                  <input type="password" value={passwordData.currentPassword} onChange={(event) => setPasswordData((current) => ({ ...current, currentPassword: event.target.value }))} required />
                </div>
                <div className="grid grid-2">
                  <div className="field">
                    <label>New password</label>
                    <input type="password" value={passwordData.newPassword} onChange={(event) => setPasswordData((current) => ({ ...current, newPassword: event.target.value }))} required />
                  </div>
                  <div className="field">
                    <label>Confirm new password</label>
                    <input type="password" value={passwordData.confirmPassword} onChange={(event) => setPasswordData((current) => ({ ...current, confirmPassword: event.target.value }))} required />
                  </div>
                </div>
                <button className="btn btn-primary" type="submit">Update password</button>
              </form>
            ) : null}
          </div>
        </section>
      </main>
    </AppShell>
  );
};

export default Profile;
