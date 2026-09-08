import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Camera, CheckCircle2, GraduationCap, HeartHandshake, ShieldCheck } from 'lucide-react';
import api from '../services/api';

const steps = ['About you', 'Experience', 'Commitment'];

const TutorApplication = () => {
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', phone: '', location: '', profilePicture: null, subjects: '', education: '',
    experience: '', motivation: '', availability: '', tutoringMode: 'online', hourlyRate: 0,
  });

  const field = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);
  const next = () => {
    setError('');
    if (step === 0 && (!form.name || !form.email || !form.location || !form.profilePicture)) return setError('Please complete your name, email, location, and profile picture.');
    if (step === 1 && (!form.subjects || !form.education)) return setError('Please share your subjects and education or relevant training.');
    setStep((current) => Math.min(2, current + 1));
  };

  const selectPhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setError('Choose a JPG, PNG, or WebP image no larger than 5 MB.');
      event.target.value = '';
      return;
    }
    setPhotoPreview(URL.createObjectURL(file));
    field('profilePicture', file);
    setError('');
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    if (!form.motivation || !form.availability) return setError('Please share why you want to tutor and when you can help.');
    setStatus('submitting');
    try {
      const response = await api.submitTutorApplication({ ...form, subjects: form.subjects.split(',').map((item) => item.trim()).filter(Boolean) });
      if (response.error) {
        setError(response.error);
        setStatus('');
      } else {
        setStatus('complete');
      }
    } catch {
      setError('We could not submit your application. Please try again.');
      setStatus('');
    }
  };

  if (status === 'complete') {
    return (
      <main className="public-flow-page">
        <section className="public-flow-success card">
          <span className="success-mark"><CheckCircle2 size={34} /></span>
          <span className="eyebrow">Application received</span>
          <h1>Thank you for offering your time.</h1>
          <p>We will review your experience, subject fit, and availability before inviting you to create a tutor account.</p>
          <div className="button-row"><Link className="btn btn-primary" to="/">Return home</Link><Link className="btn btn-ghost" to="/login">Already have an account?</Link></div>
        </section>
      </main>
    );
  }

  return (
    <main className="public-flow-page">
      <header className="public-flow-nav">
        <Link className="brand-link" to="/"><span className="brand-mark"><BookOpen size={22} /></span>NextDoorLearn</Link>
        <Link className="btn btn-ghost btn-sm" to="/"><ArrowLeft size={16} />Home</Link>
      </header>
      <div className="public-flow-layout">
        <aside className="public-flow-story tutor-application-story">
          <span className="eyebrow"><HeartHandshake size={15} />Tutor application</span>
          <h1>Teach one student. Strengthen a whole community.</h1>
          <p>We are looking for patient people who can make learning feel possible, whether you volunteer, charge a low rate, teach online, or meet locally.</p>
          <div className="trust-list">
            <div><ShieldCheck size={20} /><span><strong>Thoughtful review</strong><small>Applications are reviewed before tutor access is granted.</small></span></div>
            <div><GraduationCap size={20} /><span><strong>Experience can look different</strong><small>Teachers, college students, professionals, and community mentors are welcome.</small></span></div>
          </div>
        </aside>
        <section className="card public-flow-form">
          <div className="step-track" aria-label="Application progress">
            {steps.map((label, index) => <span key={label} className={index <= step ? 'active' : ''}><b>{index + 1}</b>{label}</span>)}
          </div>
          {error ? <div className="alert alert-error">{error}</div> : null}
          <form className="form-grid" onSubmit={submit}>
            {step === 0 ? <>
              <div><span className="eyebrow">Step 1</span><h2>Tell us about yourself</h2><p className="muted">Use contact details you check regularly.</p></div>
              <div className="grid grid-2"><div className="field"><label>Full name</label><input value={form.name} onChange={(e) => field('name', e.target.value)} required /></div><div className="field"><label>Email</label><input type="email" value={form.email} onChange={(e) => field('email', e.target.value)} required /></div></div>
              <div className="grid grid-2"><div className="field"><label>Phone</label><input type="tel" value={form.phone} onChange={(e) => field('phone', e.target.value)} /></div><div className="field"><label>City and state</label><input value={form.location} onChange={(e) => field('location', e.target.value)} required /></div></div>
              <div className="application-photo-field">
                <div className="application-photo-preview">{photoPreview ? <img src={photoPreview} alt="Profile preview" /> : <Camera size={28} />}</div>
                <div>
                  <label htmlFor="application-photo">Profile picture <span aria-hidden="true">*</span></label>
                  <p>Use a clear, current photo of yourself. JPG, PNG, or WebP up to 5 MB.</p>
                  <label className="btn btn-ghost btn-sm" htmlFor="application-photo"><Camera size={16} />{photoPreview ? 'Choose a different photo' : 'Choose photo'}</label>
                  <input className="sr-only" id="application-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={selectPhoto} required />
                </div>
              </div>
            </> : null}
            {step === 1 ? <>
              <div><span className="eyebrow">Step 2</span><h2>What can you teach?</h2><p className="muted">Specific subjects make student matching more useful.</p></div>
              <div className="field"><label>Subjects</label><input value={form.subjects} onChange={(e) => field('subjects', e.target.value)} placeholder="Algebra, Biology, Computer Science" required /></div>
              <div className="field"><label>Education or relevant training</label><textarea value={form.education} onChange={(e) => field('education', e.target.value)} required /></div>
              <div className="field"><label>Tutoring, mentoring, or teaching experience</label><textarea value={form.experience} onChange={(e) => field('experience', e.target.value)} /></div>
            </> : null}
            {step === 2 ? <>
              <div><span className="eyebrow">Step 3</span><h2>How would you like to help?</h2><p className="muted">Set honest expectations. You can update these later.</p></div>
              <div className="grid grid-2"><div className="field"><label>Tutoring format</label><select value={form.tutoringMode} onChange={(e) => field('tutoringMode', e.target.value)}><option value="online">Online</option><option value="in-person">In person</option><option value="hybrid">Both</option></select></div><div className="field"><label>Hourly rate (0 for volunteer)</label><input type="number" min="0" value={form.hourlyRate} onChange={(e) => field('hourlyRate', e.target.value)} /></div></div>
              <div className="field"><label>Typical availability</label><textarea value={form.availability} onChange={(e) => field('availability', e.target.value)} placeholder="Weekday evenings and Saturday mornings" required /></div>
              <div className="field"><label>Why do you want to tutor through NextDoorLearn?</label><textarea value={form.motivation} onChange={(e) => field('motivation', e.target.value)} required /></div>
            </> : null}
            <div className="button-row application-actions">
              {step > 0 ? <button className="btn btn-ghost" type="button" onClick={() => setStep((current) => current - 1)}><ArrowLeft size={17} />Back</button> : <span />}
              {step < 2 ? <button className="btn btn-primary" type="button" onClick={next}>Continue<ArrowRight size={17} /></button> : <button className="btn btn-primary" type="submit" disabled={status === 'submitting'}>{status === 'submitting' ? 'Submitting...' : 'Submit application'}<CheckCircle2 size={17} /></button>}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
};

export default TutorApplication;
