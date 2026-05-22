import React, { useState } from 'react';
import { BookOpen, GraduationCap, HeartHandshake, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    role: 'student',
    bio: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();

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
      const response = isLogin
        ? await api.login({ email: formData.email, password: formData.password })
        : await api.register(formData);

      if (response.error) {
        setError(response.error);
      } else {
        login(response.user, response.token);
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
        <div className="auth-brand">
          <span className="brand-mark">
            <BookOpen size={22} />
          </span>
          NextDoorLearn
        </div>

        <div>
          <span className="eyebrow">
            <HeartHandshake size={15} />
            Community tutoring
          </span>
          <h1>Find the right help, right nearby.</h1>
          <p>
            NextDoorLearn connects students with tutors and mentors who can make homework, tests,
            and big learning goals feel less overwhelming.
          </p>
        </div>

        <div className="auth-metrics">
          <div className="auth-metric">
            <strong>1:1</strong>
            <span>student and tutor connections</span>
          </div>
          <div className="auth-metric">
            <strong>Fast</strong>
            <span>requests, messages, and sessions</span>
          </div>
          <div className="auth-metric">
            <strong>Local</strong>
            <span>support built around community</span>
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
              : 'Tell us who you are, then build a profile students and tutors can trust.'}
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
                    <button
                      type="button"
                      className={`role-choice${formData.role === 'tutor' ? ' active' : ''}`}
                      onClick={() => setFormData((current) => ({ ...current, role: 'tutor' }))}
                    >
                      <Users size={24} />
                      <span>
                        <strong>Tutor</strong>
                        <span className="muted" style={{ display: 'block', fontSize: '0.82rem' }}>Offer help</span>
                      </span>
                    </button>
                  </div>
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

            <button className="btn btn-primary w-full" type="submit" disabled={loading}>
              <ShieldCheck size={18} />
              {loading ? 'Working...' : isLogin ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};

export default Login;
