import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BookOpen, CheckCircle2, ShieldCheck } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const TutorActivation = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [invitation, setInvitation] = useState(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    api.getTutorActivation(token).then((response) => {
      if (!active) return;
      if (response.error) setError(response.error);
      else setInvitation(response);
      setLoading(false);
    }).catch(() => {
      if (active) {
        setError('This invitation could not be checked. Please try again.');
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (password !== confirmPassword) return setError('Passwords do not match.');
    setSubmitting(true);
    setError('');
    const response = await api.activateTutor(token, password);
    setSubmitting(false);
    if (response.error) return setError(response.error);
    login(response.user, response.token);
    navigate('/profile', { replace: true });
  };

  return (
    <main className="auth-layout">
      <section className="auth-panel">
        <Link to="/" className="brand-link" style={{ marginBottom: 28 }}>
          <span className="brand-mark"><BookOpen size={22} /></span>
          <span>NextDoorLearn</span>
        </Link>
        <span className="eyebrow"><ShieldCheck size={15} />Tutor activation</span>
        <h1 className="page-title">Join the learning community.</h1>

        {loading ? <p className="page-copy">Checking your secure invitation...</p> : null}
        {error ? <div className="alert alert-error" style={{ marginTop: 20 }}>{error}</div> : null}

        {invitation ? (
          <>
            <div className="alert" style={{ marginTop: 20 }}>
              <CheckCircle2 size={18} />
              Approved for {invitation.subjects.join(', ') || 'tutoring'} as {invitation.name}
            </div>
            <p className="page-copy">Create a password for <strong>{invitation.email}</strong>. You can complete your availability and public profile after activation.</p>
            <form className="form-grid" onSubmit={handleSubmit}>
              <div className="field">
                <label htmlFor="activation-password">Password</label>
                <input id="activation-password" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required />
              </div>
              <div className="field">
                <label htmlFor="activation-confirm">Confirm password</label>
                <input id="activation-confirm" type="password" minLength={8} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
              </div>
              <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Activating...' : 'Activate tutor account'}</button>
            </form>
          </>
        ) : !loading ? <p className="page-copy"><Link to="/apply/tutor">Submit a new tutor application</Link> if your invitation has expired.</p> : null}
      </section>
    </main>
  );
};

export default TutorActivation;
