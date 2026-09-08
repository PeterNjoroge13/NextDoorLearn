import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarClock, Camera, ClipboardCheck, ExternalLink, Globe2, Lock, Save, Settings, Trash2, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AppShell, { Avatar, ErrorState, LoadingState } from '../components/AppShell';
import { parseList } from '../utils/format';

const commonLanguages = ['English', 'Spanish', 'French', 'Mandarin', 'Arabic', 'Portuguese', 'Korean'];
const timezones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo'];
const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(requestedTab === 'availability' && user?.role === 'tutor' ? 'availability' : 'profile');
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
    headline: '',
    motivation: '',
    tutoring_mode: 'online',
    service_area: '',
    max_students: 5,
    availability_notes: '',
    age_groups: [],
    public_profile_enabled: false,
    grade_level: '',
    subjects_needed: [],
    school: '',
    learning_goals: '',
    preferred_schedule: '',
    learning_style: '',
    support_needs: '',
    budget_preference: 'free',
    accessibility_needs: '',
    guardian_name: '',
    guardian_contact: '',
    avatar_url: '',
  });

  useEffect(() => {
    const nextTab = requestedTab === 'availability' && user?.role === 'tutor'
      ? 'availability'
      : requestedTab === 'security'
        ? 'security'
        : 'profile';
    setActiveTab(nextTab);
  }, [requestedTab, user?.role]);

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
          certifications: parseList(response.profile?.certifications),
          teaching_style: response.profile?.teaching_style || '',
          headline: response.profile?.headline || '',
          motivation: response.profile?.motivation || '',
          tutoring_mode: response.profile?.tutoring_mode || 'online',
          service_area: response.profile?.service_area || '',
          max_students: response.profile?.max_students || 5,
          availability_notes: response.profile?.availability_notes || '',
          age_groups: parseList(response.profile?.age_groups),
          public_profile_enabled: Boolean(response.profile?.public_profile_enabled),
          grade_level: response.profile?.grade_level || '',
          subjects_needed: parseList(response.profile?.subjects_needed),
          school: response.profile?.school || '',
          learning_goals: response.profile?.learning_goals || '',
          preferred_schedule: response.profile?.preferred_schedule || '',
          learning_style: response.profile?.learning_style || '',
          support_needs: response.profile?.support_needs || '',
          budget_preference: response.profile?.budget_preference || 'free',
          accessibility_needs: response.profile?.accessibility_needs || '',
          guardian_name: response.profile?.guardian_name || '',
          guardian_contact: response.profile?.guardian_contact || '',
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
        headline: formData.headline,
        motivation: formData.motivation,
        tutoring_mode: formData.tutoring_mode,
        service_area: formData.service_area,
        max_students: Number(formData.max_students || 1),
        availability_notes: formData.availability_notes,
        age_groups: formData.age_groups,
        public_profile_enabled: formData.public_profile_enabled,
      };
    } else {
      base.profile = {
        grade_level: formData.grade_level,
        subjects_needed: formData.subjects_needed,
        school: formData.school,
        learning_goals: formData.learning_goals,
        preferred_schedule: formData.preferred_schedule,
        learning_style: formData.learning_style,
        support_needs: formData.support_needs,
        budget_preference: formData.budget_preference,
        tutoring_mode: formData.tutoring_mode,
        accessibility_needs: formData.accessibility_needs,
        guardian_name: formData.guardian_name,
        guardian_contact: formData.guardian_contact,
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

  const selectTab = (tab) => {
    setActiveTab(tab);
    if (tab === 'profile') setSearchParams({});
    else setSearchParams({ tab });
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

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setMessage('Choose a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMessage('Profile pictures must be 10 MB or smaller.');
      return;
    }

    setUploadingAvatar(true);
    const previewUrl = URL.createObjectURL(file);
    setField('avatar_url', previewUrl);
    try {
      const response = await api.uploadProfilePicture(file, localStorage.getItem('token'));
      if (response.error) {
        setMessage(response.error);
        setField('avatar_url', user?.avatar_url || '');
      } else {
        setField('avatar_url', response.avatarUrl);
        updateUser({ avatar_url: response.avatarUrl });
        setMessage('Profile picture updated.');
      }
    } catch {
      setField('avatar_url', user?.avatar_url || '');
      setMessage('Profile picture could not be uploaded.');
    } finally {
      URL.revokeObjectURL(previewUrl);
      setUploadingAvatar(false);
    }
  };

  const handleAvatarRemove = async () => {
    setUploadingAvatar(true);
    try {
      const response = await api.deleteProfilePicture(localStorage.getItem('token'));
      if (response.error) setMessage(response.error);
      else {
        setField('avatar_url', '');
        updateUser({ avatar_url: '' });
        setMessage('Profile picture removed.');
      }
    } catch {
      setMessage('Profile picture could not be removed.');
    } finally {
      setUploadingAvatar(false);
    }
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
            <div className="profile-photo-actions">
              <label className="btn btn-ghost btn-sm" htmlFor="profile-picture"><Camera size={16} />{uploadingAvatar ? 'Uploading...' : 'Change photo'}</label>
              <input className="sr-only" id="profile-picture" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
              {formData.avatar_url ? <button className="icon-button" type="button" onClick={handleAvatarRemove} disabled={uploadingAvatar} aria-label="Remove profile picture" title="Remove profile picture"><Trash2 size={16} /></button> : null}
            </div>
            <div style={{ marginTop: 20 }}>
              <div className="list-item" style={{ padding: 0, border: 0, marginBottom: 8 }}>
                <strong>Profile strength</strong>
                <span className="badge badge-primary">{completion}%</span>
              </div>
              <div className="progress"><span style={{ width: `${completion}%` }} /></div>
            </div>
            <div className="tabs" style={{ marginTop: 20 }}>
              <button className={`tab${activeTab === 'profile' ? ' active' : ''}`} onClick={() => selectTab('profile')} type="button">
                <UserRound size={15} /> Profile
              </button>
              {user?.role === 'tutor' ? (
                <button className={`tab${activeTab === 'availability' ? ' active' : ''}`} onClick={() => selectTab('availability')} type="button">
                  <CalendarClock size={15} /> Availability
                </button>
              ) : null}
              <button className={`tab${activeTab === 'security' ? ' active' : ''}`} onClick={() => selectTab('security')} type="button">
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
                      <label>Profile headline</label>
                      <input value={formData.headline} onChange={(event) => setField('headline', event.target.value)} placeholder="Patient math tutor helping students rebuild confidence" />
                    </div>
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
                      <div className="field">
                        <label>Maximum active students</label>
                        <input type="number" min="1" max="50" value={formData.max_students} onChange={(event) => setField('max_students', event.target.value)} />
                      </div>
                    </div>
                    <div className="grid grid-2">
                      <div className="field"><label>Tutoring format</label><select value={formData.tutoring_mode} onChange={(event) => setField('tutoring_mode', event.target.value)}><option value="online">Online</option><option value="in-person">In person</option><option value="hybrid">Online and in person</option></select></div>
                      <div className="field"><label>Public service area</label><input value={formData.service_area} onChange={(event) => setField('service_area', event.target.value)} placeholder="Baltimore area or remote" /></div>
                    </div>
                    <div className="field"><label>Student age groups</label><input value={formData.age_groups.join(', ')} onChange={(event) => setListField('age_groups', event.target.value)} placeholder="Middle school, High school, College" /></div>
                    <div className="field">
                      <label>Teaching style</label>
                      <textarea value={formData.teaching_style} onChange={(event) => setField('teaching_style', event.target.value)} />
                    </div>
                    <div className="field">
                      <label>Education</label>
                      <textarea value={formData.education} onChange={(event) => setField('education', event.target.value)} />
                    </div>
                    <div className="field"><label>Certifications</label><input value={formData.certifications.join(', ')} onChange={(event) => setListField('certifications', event.target.value)} placeholder="Teaching license, CPR, subject certifications" /></div>
                    <div className="field"><label>Why you tutor</label><textarea value={formData.motivation} onChange={(event) => setField('motivation', event.target.value)} /></div>
                    <div className="field"><label>Availability notes</label><textarea value={formData.availability_notes} onChange={(event) => setField('availability_notes', event.target.value)} placeholder="Lead time, schedule limits, or anything students should know after connecting" /></div>
                    <div className="profile-visibility-panel">
                      <div><span className="stat-icon"><Globe2 size={20} /></span><div><strong>Public tutor page</strong><p>Opt in to a shareable page. Email, phone, exact location, private notes, and student identities are never shown.</p></div></div>
                      <label className="switch"><input type="checkbox" checked={formData.public_profile_enabled} onChange={(event) => setField('public_profile_enabled', event.target.checked)} /><span /></label>
                    </div>
                    {formData.public_profile_enabled && user?.id ? <a className="btn btn-ghost" href={`/community/tutors/${user.id}`} target="_blank" rel="noreferrer"><ExternalLink size={17} />Preview public profile</a> : null}
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
                    <div className="grid grid-2">
                      <div className="field"><label>Preferred format</label><select value={formData.tutoring_mode} onChange={(event) => setField('tutoring_mode', event.target.value)}><option value="online">Online</option><option value="in-person">In person</option><option value="hybrid">Either works</option></select></div>
                      <div className="field"><label>Budget preference</label><select value={formData.budget_preference} onChange={(event) => setField('budget_preference', event.target.value)}><option value="free">Free only</option><option value="under-25">Up to $25/hour</option><option value="flexible">Flexible</option></select></div>
                    </div>
                    <div className="field"><label>How you learn best</label><input value={formData.learning_style} onChange={(event) => setField('learning_style', event.target.value)} placeholder="Visual examples, practice with feedback..." /></div>
                    <div className="field"><label>Preferred schedule</label><textarea value={formData.preferred_schedule} onChange={(event) => setField('preferred_schedule', event.target.value)} /></div>
                    <div className="field">
                      <label>Learning goals</label>
                      <textarea value={formData.learning_goals} onChange={(event) => setField('learning_goals', event.target.value)} />
                    </div>
                    <div className="field"><label>Support needs</label><textarea value={formData.support_needs} onChange={(event) => setField('support_needs', event.target.value)} placeholder="Organization, homework support, test confidence..." /></div>
                    <div className="field"><label>Accessibility or accommodation needs</label><textarea value={formData.accessibility_needs} onChange={(event) => setField('accessibility_needs', event.target.value)} /></div>
                    <div className="grid grid-2"><div className="field"><label>Guardian name (optional)</label><input value={formData.guardian_name} onChange={(event) => setField('guardian_name', event.target.value)} /></div><div className="field"><label>Guardian contact (optional)</label><input value={formData.guardian_contact} onChange={(event) => setField('guardian_contact', event.target.value)} /></div></div>
                    <Link className="btn btn-ghost" to="/intake"><ClipboardCheck size={17} />Open guided learning intake</Link>
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
