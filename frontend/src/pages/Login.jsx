import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, GraduationCap, HeartHandshake, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api, { isApiConfiguredForProduction } from '../services/api';

const Login = ({ initialMode = 'login' }) => {
  const [isLogin, setIsLogin] = useState(initialMode !== 'signup');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'student',
    bio: '',
    ageGroup: '',
  });
  const [consent, setConsent] = useState({ legal: false, safety: false, guardian: false });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (event) => {
    setFormData((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (!isApiConfiguredForProduction()) {
        setError('NextDoorLearn is missing its deployed API URL. Set VITE_API_URL in Vercel to your backend URL ending in /api, then redeploy.');
        return;
      }

      const response = isLogin
        ? await api.login({ email: formData.email, password: formData.password })
        : await api.register({
            ...formData,
            termsAccepted: consent.legal,
            privacyAccepted: consent.legal,
            safetyAccepted: consent.safety,
            guardianConsent: formData.ageGroup === '13-17' ? consent.guardian : false,
            consentSource: 'web',
          });

      if (response.error) {
        setError(response.error);
      } else {
        login(response.user, response.token, response.refreshToken);
        navigate('/dashboard', { replace: true });
      }
    } catch {
      setError('We could not reach NextDoorLearn. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-page">
      <section className="auth-story">
        <Link to="/" className="auth-brand" aria-label="NextDoorLearn welcome page">
          <span className="brand-mark">
            <BookOpen size={22} />
          </span>
          NextDoorLearn
        </Link>

        <div>
          <span className="eyebrow">
            <HeartHandshake size={15} />
            Mission-first tutoring
          </span>
          <h1>Connect with help that should have always been within reach.</h1>
          <p>
            Students can request affordable support. Tutors can volunteer or offer low-cost help.
            Together, NextDoorLearn keeps learning personal, local, and accessible.
          </p>
        </div>

        <div className="auth-metrics">
          <div className="auth-metric">
            <strong>1:1</strong>
            <span>student and tutor support</span>
          </div>
          <div className="auth-metric">
            <strong>Fast</strong>
            <span>matching, messaging, and sessions</span>
          </div>
          <div className="auth-metric">
            <strong>Local</strong>
            <span>built for underserved students</span>
          </div>
        </div>
      </section>

      <section className="auth-panel-wrap">
        <div className="auth-panel">
          <span className="eyebrow">
            <Sparkles size={15} />
            {isLogin ? 'Welcome back' : 'Start learning'}
          </span>
          <h2 className="page-title">{isLogin ? 'Sign in to continue.' : 'Create your account.'}</h2>
          <p className="page-copy">
            {isLogin
              ? 'Pick up conversations, sessions, and tutor requests where you left off.'
              : 'Students can create an account now. Tutors begin with a short application so the community stays trustworthy.'}
          </p>

          <div className="segmented" role="tablist" aria-label="Authentication mode">
            <button type="button" className={isLogin ? 'active' : ''} onClick={() => setIsLogin(true)}>
              Sign in
            </button>
            <button type="button" className={!isLogin ? 'active' : ''} onClick={() => setIsLogin(false)}>
              Sign up
            </button>
          </div>

          {error ? <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div> : null}

          <form className="form-grid" onSubmit={handleSubmit}>
            {!isLogin ? (
              <>
                <div className="field">
                  <label htmlFor="name">Full name</label>
                  <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} required />
                </div>

                <div className="field">
                  <label>I am joining as</label>
                  <div className="role-grid">
                    <button
                      type="button"
                      className={`role-choice${formData.role === 'student' ? ' active' : ''}`}
                      onClick={() => setFormData((current) => ({ ...current, role: 'student' }))}
                    >
                      <GraduationCap size={24} />
                      <span>
                        <strong>Student</strong>
                        <span className="muted" style={{ display: 'block', fontSize: '0.82rem' }}>Find support</span>
                      </span>
                    </button>
                    <Link
                      className="role-choice"
                      to="/apply/tutor"
                    >
                      <Users size={24} />
                      <span>
                        <strong>Tutor application</strong>
                        <span className="muted" style={{ display: 'block', fontSize: '0.82rem' }}>Apply to offer help</span>
                      </span>
                    </Link>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="age-group">Age group</label>
                  <select id="age-group" name="ageGroup" value={formData.ageGroup} onChange={handleChange} required>
                    <option value="">Choose your age group</option>
                    <option value="13-17">13–17</option>
                    <option value="18+">18 or older</option>
                  </select>
                  <small className="muted">Accounts are currently available only to people age 13 or older.</small>
                </div>
              </>
            ) : null}

            <div className="field">
              <label htmlFor="email">Email address</label>
              <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} required />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={isLogin ? undefined : 8}
              />
            </div>

            {!isLogin ? (
              <div className="field">
                <label htmlFor="bio">Short bio</label>
                <textarea
                  id="bio"
                  name="bio"
                  value={formData.bio}
                  onChange={handleChange}
                  placeholder="A sentence or two about what you need or how you help."
                />
              </div>
            ) : null}

            {!isLogin ? (
              <div className="consent-stack">
                {formData.ageGroup === '13-17' ? (
                  <label className="consent-row">
                    <input type="checkbox" checked={consent.guardian} onChange={(event) => setConsent((current) => ({ ...current, guardian: event.target.checked }))} />
                    <span>I confirm that my parent or guardian has given me permission to use NextDoorLearn.</span>
                  </label>
                ) : null}
                <label className="consent-row">
                  <input type="checkbox" checked={consent.legal} onChange={(event) => setConsent((current) => ({ ...current, legal: event.target.checked }))} />
                  <span>I agree to the <Link to="/terms" target="_blank">Terms of Service</Link> and acknowledge the <Link to="/privacy" target="_blank">Privacy Policy</Link>.</span>
                </label>
                <label className="consent-row">
                  <input type="checkbox" checked={consent.safety} onChange={(event) => setConsent((current) => ({ ...current, safety: event.target.checked }))} />
                  <span>I will follow the <Link to="/guidelines" target="_blank">Community and Safety Guidelines</Link>.</span>
                </label>
              </div>
            ) : null}

            <button
              className="btn btn-primary w-full"
              type="submit"
              disabled={loading || (!isLogin && (!formData.ageGroup || !consent.legal || !consent.safety || (formData.ageGroup === '13-17' && !consent.guardian)))}
            >
              <ShieldCheck size={18} />
              {loading ? 'Working...' : isLogin ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="chip-row" style={{ justifyContent: 'center', marginTop: 22 }}>
            <Link className="badge" to="/">Welcome page</Link>
            <a className="badge" href="/forgot-password">Forgot password</a>
            <a className="badge" href="/privacy">Privacy</a>
            <a className="badge" href="/terms">Terms</a>
            <a className="badge" href="/guidelines">Guidelines</a>
            <a className="badge" href="/support">Support</a>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Login;
