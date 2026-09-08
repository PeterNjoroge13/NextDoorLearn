import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Building2, CheckCircle2, HeartHandshake, Laptop, Users } from 'lucide-react';
import api from '../services/api';

const options = [
  { icon: Users, title: 'Sponsor tutoring', copy: 'Help cover sessions for students whose families cannot afford private tutoring.' },
  { icon: Laptop, title: 'Support access', copy: 'Contribute toward learning tools, connectivity, and the basic technology tutoring requires.' },
  { icon: Building2, title: 'Community partner', copy: 'Bring a school, nonprofit, campus group, or employer into the NextDoorLearn network.' },
];

const Donate = () => {
  const [form, setForm] = useState({ name: '', email: '', organization: '', sponsorType: 'Sponsor tutoring', message: '' });
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));
  const submit = async (event) => {
    event.preventDefault(); setSending(true); setMessage('');
    try {
      const response = await api.submitSponsorInquiry(form);
      setMessage(response.error || response.message);
      if (!response.error) setForm((current) => ({ ...current, message: '' }));
    } catch { setMessage('We could not send your inquiry. Please try again.'); }
    finally { setSending(false); }
  };

  return (
    <main className="donate-page">
      <header className="public-flow-nav">
        <Link className="brand-link" to="/"><span className="brand-mark"><BookOpen size={22} /></span>NextDoorLearn</Link>
        <Link className="btn btn-ghost btn-sm" to="/"><ArrowLeft size={16} />Home</Link>
      </header>
      <section className="donate-hero">
        <span className="eyebrow"><HeartHandshake size={15} />Sponsor student access</span>
        <h1>Help make the right tutor reachable.</h1>
        <p>NextDoorLearn is building a community where cost does not decide whether a student gets help. Tell us how you would like to support that work.</p>
      </section>
      <section className="donate-options">{options.map(({ icon, title, copy }) => <article key={title}><span className="stat-icon">{React.createElement(icon, { size: 22 })}</span><h2>{title}</h2><p>{copy}</p></article>)}</section>
      <section className="donate-contact">
        <div><span className="eyebrow">Partner with us</span><h2>Start a sponsorship conversation.</h2><p>This page currently collects sponsorship interest; it does not process payments. That keeps the platform honest while secure donation processing and nonprofit partnerships are being established.</p><div className="impact-note"><CheckCircle2 size={20} /><span>We will follow up using the email you provide.</span></div></div>
        <form className="card card-pad form-grid" onSubmit={submit}>
          {message ? <div className="alert">{message}</div> : null}
          <div className="grid grid-2"><div className="field"><label>Name</label><input value={form.name} onChange={(e) => setField('name', e.target.value)} required /></div><div className="field"><label>Email</label><input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} required /></div></div>
          <div className="field"><label>Organization (optional)</label><input value={form.organization} onChange={(e) => setField('organization', e.target.value)} /></div>
          <div className="field"><label>I am interested in</label><select value={form.sponsorType} onChange={(e) => setField('sponsorType', e.target.value)}>{options.map((option) => <option key={option.title}>{option.title}</option>)}</select></div>
          <div className="field"><label>How would you like to help?</label><textarea value={form.message} onChange={(e) => setField('message', e.target.value)} /></div>
          <button className="btn btn-primary" type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send sponsorship interest'}</button>
        </form>
      </section>
    </main>
  );
};

export default Donate;
