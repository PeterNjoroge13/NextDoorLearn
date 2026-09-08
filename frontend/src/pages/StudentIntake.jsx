import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, GraduationCap, HeartHandshake, Search } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AppShell, { Avatar, ErrorState, LoadingState } from '../components/AppShell';
import { parseList } from '../utils/format';

const subjectOptions = ['Math', 'English', 'Science', 'History', 'Computer Science', 'Physics', 'Chemistry', 'Test prep'];
const learningStyles = ['Work through examples', 'Visual explanations', 'Practice and feedback', 'Talk concepts through', 'Not sure yet'];

const StudentIntake = () => {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [outcome, setOutcome] = useState(null);
  const [waitlist, setWaitlist] = useState(null);
  const [tutors, setTutors] = useState([]);
  const [form, setForm] = useState({ gradeLevel: '', school: '', subjects: [], learningStyle: '', supportNeeds: '', learningGoals: '', preferredSchedule: '', budgetPreference: 'free', tutoringMode: 'online', accessibilityNeeds: '', guardianName: '', guardianContact: '' });

  useEffect(() => {
    const load = async () => {
      const token = localStorage.getItem('token');
      try {
        const [profile, tutorList, existingWaitlist] = await Promise.all([api.getProfile(token), api.getTutors(token), api.getMyWaitlistEntry(token)]);
        if (profile.error) return setError(profile.error);
        const details = profile.profile || {};
        setForm({
          gradeLevel: details.grade_level || '', school: details.school || '', subjects: parseList(details.subjects_needed),
          learningStyle: details.learning_style || '', supportNeeds: details.support_needs || '', learningGoals: details.learning_goals || '',
          preferredSchedule: details.preferred_schedule || '', budgetPreference: details.budget_preference || 'free', tutoringMode: details.tutoring_mode || 'online',
          accessibilityNeeds: details.accessibility_needs || '', guardianName: details.guardian_name || '', guardianContact: details.guardian_contact || '',
        });
        setTutors(Array.isArray(tutorList) ? tutorList : []);
        setWaitlist(existingWaitlist?.error ? null : existingWaitlist);
      } catch { setError('Your learning intake could not be loaded.'); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const matches = useMemo(() => tutors.filter((tutor) => {
    const tutorSubjects = parseList(tutor.subjects).map((value) => value.toLowerCase());
    const subjectMatch = form.subjects.some((subject) => tutorSubjects.some((offered) => offered.includes(subject.toLowerCase()) || subject.toLowerCase().includes(offered)));
    const maxRate = form.budgetPreference === 'free' ? 0 : form.budgetPreference === 'under-25' ? 25 : 100000;
    const rateMatch = Number(tutor.hourly_rate || 0) <= maxRate;
    const modeMatch = !tutor.tutoring_mode || tutor.tutoring_mode === 'hybrid' || tutor.tutoring_mode === form.tutoringMode;
    return subjectMatch && rateMatch && modeMatch;
  }), [form.budgetPreference, form.subjects, form.tutoringMode, tutors]);

  const toggleSubject = (subject) => setForm((current) => ({ ...current, subjects: current.subjects.includes(subject) ? current.subjects.filter((item) => item !== subject) : [...current.subjects, subject] }));
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const next = () => {
    if (step === 0 && (!form.gradeLevel || form.subjects.length === 0)) return setError('Choose your grade level and at least one subject.');
    if (step === 1 && (!form.learningStyle || !form.preferredSchedule)) return setError('Choose a learning style and tell us when you are usually available.');
    setError(''); setStep((current) => current + 1);
  };
  const save = async () => {
    setSaving(true); setError('');
    const token = localStorage.getItem('token');
    const response = await api.updateProfile({ profile: {
      grade_level: form.gradeLevel, school: form.school, subjects_needed: form.subjects, learning_style: form.learningStyle,
      support_needs: form.supportNeeds, learning_goals: form.learningGoals, preferred_schedule: form.preferredSchedule,
      budget_preference: form.budgetPreference, tutoring_mode: form.tutoringMode, accessibility_needs: form.accessibilityNeeds,
      guardian_name: form.guardianName, guardian_contact: form.guardianContact, intake_completed: true,
    } }, token);
    if (response.error) setError(response.error); else setOutcome(matches.length ? 'matches' : 'none');
    setSaving(false);
  };
  const joinWaitlist = async () => {
    setSaving(true); const token = localStorage.getItem('token');
    const response = await api.joinWaitlist({ subjects: form.subjects, gradeLevel: form.gradeLevel, budgetPreference: form.budgetPreference, preferredSchedule: form.preferredSchedule, tutoringMode: form.tutoringMode, learningGoals: form.learningGoals }, token);
    if (response.error) setError(response.error); else setWaitlist(response);
    setSaving(false);
  };
  const leaveWaitlist = async () => { const token = localStorage.getItem('token'); const response = await api.leaveWaitlist(token); if (!response.error) setWaitlist(null); };

  if (loading) return <LoadingState label="Preparing your intake..." />;
  if (user?.role !== 'student') return <ErrorState title="Student intake" message="This learning intake is available to student accounts." action={<Link className="btn btn-primary" to="/dashboard">Return to dashboard</Link>} />;

  return (
    <AppShell><main className="page intake-page">
      <section className="intake-head"><div><span className="eyebrow"><ClipboardCheck size={15} />Student intake</span><h1>Help us understand how you learn.</h1><p>Your answers improve tutor matching and give a future tutor useful context before you ever meet.</p></div><div className="intake-progress"><strong>Step {Math.min(step + 1, 3)} of 3</strong><div className="progress"><span style={{ width: `${((Math.min(step, 2) + 1) / 3) * 100}%` }} /></div></div></section>
      {waitlist?.status === 'open' ? <div className="waitlist-banner"><HeartHandshake size={22} /><div><strong>You are on the tutor match waitlist</strong><p>We saved your current subjects and preferences.</p></div><button className="btn btn-ghost btn-sm" onClick={leaveWaitlist}>Leave waitlist</button></div> : null}
      {error ? <div className="alert alert-error">{error}</div> : null}
      {outcome ? <section className="card intake-outcome">{outcome === 'matches' ? <><span className="success-mark"><CheckCircle2 size={30} /></span><h2>We found {matches.length} possible match{matches.length === 1 ? '' : 'es'}.</h2><p>Your learning profile is saved. These tutors fit your subject, format, and budget preferences.</p><div className="intake-matches">{matches.slice(0, 3).map((tutor) => <Link to={`/tutors/${tutor.id}`} key={tutor.id}><Avatar name={tutor.name} src={tutor.avatar_url} /><span><strong>{tutor.name}</strong><small>{parseList(tutor.subjects).slice(0, 2).join(' · ')}</small></span><ArrowRight size={17} /></Link>)}</div><Link className="btn btn-primary" to={`/tutors?search=${encodeURIComponent(form.subjects[0] || '')}`}><Search size={17} />See tutor matches</Link></> : <><span className="intake-empty-mark"><GraduationCap size={30} /></span><h2>No exact match yet.</h2><p>That is useful information, not a dead end. Join the waitlist and your needs will be saved for future tutor matching.</p>{waitlist?.status === 'open' ? <span className="badge badge-success"><CheckCircle2 size={15} />You are on the waitlist</span> : <button className="btn btn-primary" onClick={joinWaitlist} disabled={saving}><HeartHandshake size={17} />{saving ? 'Saving...' : 'Join the tutor waitlist'}</button>}<button className="btn btn-ghost" onClick={() => { setOutcome(null); setStep(0); }}>Adjust answers</button></>}</section> : <section className="card intake-form">
        {step === 0 ? <div className="form-grid"><div><h2>What are you working on?</h2><p className="muted">Choose every subject where support would make a difference.</p></div><div className="grid grid-2"><div className="field"><label>Grade level</label><select value={form.gradeLevel} onChange={(e) => setField('gradeLevel', e.target.value)}><option value="">Choose grade level</option><option>Middle school</option><option>9th grade</option><option>10th grade</option><option>11th grade</option><option>12th grade</option><option>College</option><option>Adult learner</option></select></div><div className="field"><label>School (optional)</label><input value={form.school} onChange={(e) => setField('school', e.target.value)} /></div></div><div className="field"><label>Subjects</label><div className="choice-grid">{subjectOptions.map((subject) => <button type="button" className={form.subjects.includes(subject) ? 'active' : ''} onClick={() => toggleSubject(subject)} key={subject}>{form.subjects.includes(subject) ? <CheckCircle2 size={17} /> : <span />}{subject}</button>)}</div></div></div> : null}
        {step === 1 ? <div className="form-grid"><div><h2>What kind of support works for you?</h2><p className="muted">There is no wrong answer. This helps tutors arrive prepared.</p></div><div className="field"><label>How do you learn best?</label><div className="choice-grid">{learningStyles.map((style) => <button type="button" className={form.learningStyle === style ? 'active' : ''} onClick={() => setField('learningStyle', style)} key={style}>{form.learningStyle === style ? <CheckCircle2 size={17} /> : <span />}{style}</button>)}</div></div><div className="grid grid-2"><div className="field"><label>Format</label><select value={form.tutoringMode} onChange={(e) => setField('tutoringMode', e.target.value)}><option value="online">Online</option><option value="in-person">In person</option><option value="hybrid">Either works</option></select></div><div className="field"><label>Budget</label><select value={form.budgetPreference} onChange={(e) => setField('budgetPreference', e.target.value)}><option value="free">Free only</option><option value="under-25">Up to $25/hour</option><option value="flexible">Flexible</option></select></div></div><div className="field"><label>When are you usually available?</label><textarea value={form.preferredSchedule} onChange={(e) => setField('preferredSchedule', e.target.value)} placeholder="Weekdays after 5 PM, Saturday mornings..." /></div></div> : null}
        {step === 2 ? <div className="form-grid"><div><h2>What would progress look like?</h2><p className="muted">Only tutors you connect with should use this context to support you.</p></div><div className="field"><label>Learning goals</label><textarea value={form.learningGoals} onChange={(e) => setField('learningGoals', e.target.value)} placeholder="Pass Algebra II, feel confident writing essays, prepare for an exam..." /></div><div className="field"><label>What tends to get in the way?</label><textarea value={form.supportNeeds} onChange={(e) => setField('supportNeeds', e.target.value)} placeholder="Keeping up with assignments, understanding lectures, test anxiety..." /></div><div className="field"><label>Accessibility or accommodation needs (optional)</label><textarea value={form.accessibilityNeeds} onChange={(e) => setField('accessibilityNeeds', e.target.value)} /></div><div className="grid grid-2"><div className="field"><label>Guardian name (optional)</label><input value={form.guardianName} onChange={(e) => setField('guardianName', e.target.value)} /></div><div className="field"><label>Guardian contact (optional)</label><input value={form.guardianContact} onChange={(e) => setField('guardianContact', e.target.value)} /></div></div></div> : null}
        <div className="button-row intake-actions">{step > 0 ? <button className="btn btn-ghost" onClick={() => setStep((current) => current - 1)}><ArrowLeft size={17} />Back</button> : <span />}{step < 2 ? <button className="btn btn-primary" onClick={next}>Continue<ArrowRight size={17} /></button> : <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Finding matches...' : 'Save and find matches'}<Search size={17} /></button>}</div>
      </section>}
    </main></AppShell>
  );
};

export default StudentIntake;
