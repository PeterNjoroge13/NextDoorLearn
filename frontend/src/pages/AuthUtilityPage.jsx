import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BookOpen, KeyRound, MailCheck } from 'lucide-react';
import api from '../services/api';

const AuthUtilityPage = ({ mode }) => {
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(mode === 'verify');
  const token = params.get('token') || '';

  useEffect(() => {
    const verify = async () => {
      if (mode !== 'verify') return;
      if (!token) {
        setError('Verification token is missing.');
        setLoading(false);
        return;
      }
      const response = await api.verifyEmail(token);
      if (response.error) setError(response.error);
      else setMessage(response.message || 'Email verified.');
      setLoading(false);
    };
    verify();
  }, [mode, token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    const response = mode === 'forgot'
      ? await api.forgotPassword(email)
      : await api.resetPassword(token, password);

    if (response.error) setError(response.error);
    else setMessage(response.message || 'Done.');
    setLoading(false);
  };

  const isForgot = mode === 'forgot';
  const title = mode === 'verify' ? 'Verify your email' : isForgot ? 'Reset your password' : 'Choose a new password';
  const Icon = mode === 'verify' ? MailCheck : KeyRound;

  return (
    <main className="auth-panel-wrap" style={{ minHeight: '100vh' }}>
      <section className="auth-panel">
        <Link to="/login" className="brand-link" style={{ marginBottom: 28 }}>
          <span className="brand-mark">
            <BookOpen size={22} />
          </span>
          <span>NextDoorLearn</span>
        </Link>

        <span className="eyebrow">
          <Icon size={15} />
          Account help
        </span>
        <h1 className="page-title">{title}</h1>

        {message ? <div className="alert" style={{ marginTop: 20 }}>{message}</div> : null}
        {error ? <div className="alert alert-error" style={{ marginTop: 20 }}>{error}</div> : null}

        {mode === 'verify' ? (
          <div className="button-row" style={{ marginTop: 24 }}>
            <Link className="btn btn-primary" to="/login">Back to sign in</Link>
          </div>
        ) : (
          <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: 24 }}>
            {isForgot ? (
              <div className="field">
                <label>Email address</label>
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              </div>
            ) : (
              <div className="field">
                <label>New password</label>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
              </div>
            )}
            <button className="btn btn-primary" type="submit" disabled={loading || (!isForgot && !token)}>
              {loading ? 'Working...' : isForgot ? 'Send reset link' : 'Reset password'}
            </button>
            <Link className="btn btn-ghost" to="/login">Back to sign in</Link>
          </form>
        )}
      </section>
    </main>
  );
};

export default AuthUtilityPage;
