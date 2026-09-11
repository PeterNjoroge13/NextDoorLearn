import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, FileText, List, Plus, Star, UserX, X } from 'lucide-react';
import api from '../services/api';
import AppShell, { EmptyState, ErrorState, LoadingState } from '../components/AppShell';
import { useAuth } from '../context/AuthContext';

const statusClass = {
  scheduled: 'badge-primary',
  completed: 'badge-success',
  cancelled: 'badge-error',
  no_show: 'badge-warning',
};

const dateKey = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const sessionHasStarted = (session) => !session.starts_at || new Date(session.starts_at).getTime() <= Date.now() + 5 * 60 * 1000;

const Sessions = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [outcomeSession, setOutcomeSession] = useState(null);
  const [reviewSession, setReviewSession] = useState(null);
  const [outcomeForm, setOutcomeForm] = useState({
    attendance: 'completed', tutorSummary: '', skillsPracticed: '', nextSteps: '',
    studentReflection: '', confidenceBefore: 3, confidenceAfter: 3,
  });
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: '' });
  const [view, setView] = useState('calendar');
  const [filters, setFilters] = useState({ status: '', month: new Date().getMonth() + 1, year: new Date().getFullYear() });
  const [formData, setFormData] = useState({
    connectionId: '',
    title: '',
    description: '',
    subject: '',
    scheduledDate: '',
    startTime: '',
    endTime: '',
    meetingLink: '',
  });

  const fetchSessions = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const [sessionsResponse, connectionsResponse] = await Promise.all([
        api.getSessions(token, filters),
        api.getMyConnections(token),
      ]);
      if (sessionsResponse.error) {
        setError(sessionsResponse.error);
      } else if (connectionsResponse.error) {
        setError(connectionsResponse.error);
      } else {
        setSessions(Array.isArray(sessionsResponse) ? sessionsResponse : []);
        setConnections((Array.isArray(connectionsResponse) ? connectionsResponse : []).filter((connection) => connection.status === 'accepted'));
        setError('');
      }
    } catch {
      setError('Sessions could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleCreateSession = async (event) => {
    event.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await api.createSession(formData, token);
      if (response.error) {
        setActionError(response.error);
      } else {
        setSessions((current) => [response, ...current]);
        setActionError('');
        setShowCreateModal(false);
        setFormData({
          connectionId: '',
          title: '',
          description: '',
          subject: '',
          scheduledDate: '',
          startTime: '',
          endTime: '',
          meetingLink: '',
        });
      }
    } catch {
      setActionError('The session could not be scheduled. Please try again.');
    }
  };

  const handleUpdateStatus = async (sessionId, status) => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.updateSessionStatus(sessionId, status, '', token);
      if (response.error) setActionError(response.error);
      else {
        setActionError('');
        setSessions((current) => current.map((session) => (session.id === sessionId ? response : session)));
      }
    } catch {
      setActionError('The session status could not be updated.');
    }
  };

  const handleConfirmation = async (sessionId, decision) => {
    try {
      const response = await api.respondToSessionRequest(sessionId, decision, localStorage.getItem('token'));
      if (response.error) setActionError(response.error);
      else setSessions((current) => current.map((session) => session.id === sessionId ? { ...session, ...response } : session));
    } catch {
      setActionError('The session request could not be updated.');
    }
  };

  const openOutcome = (session, attendance = 'completed') => {
    setOutcomeSession(session);
    setOutcomeForm({
      attendance,
      tutorSummary: session.tutor_summary || '',
      skillsPracticed: session.skills_practiced || '',
      nextSteps: session.next_steps || '',
      studentReflection: session.student_reflection || '',
      confidenceBefore: Number(session.confidence_before || 3),
      confidenceAfter: Number(session.confidence_after || 3),
    });
    setActionError('');
  };

  const handleSaveOutcome = async (event) => {
    event.preventDefault();
    const payload = user?.role === 'tutor'
      ? {
          attendance: outcomeForm.attendance,
          tutorSummary: outcomeForm.tutorSummary,
          skillsPracticed: outcomeForm.skillsPracticed,
          nextSteps: outcomeForm.nextSteps,
        }
      : {
          studentReflection: outcomeForm.studentReflection,
          confidenceBefore: Number(outcomeForm.confidenceBefore),
          confidenceAfter: Number(outcomeForm.confidenceAfter),
        };
    try {
      const response = await api.updateSessionOutcome(outcomeSession.id, payload, localStorage.getItem('token'));
      if (response.error) return setActionError(response.error);
      setSessions((current) => current.map((session) => session.id === outcomeSession.id ? { ...session, ...response } : session));
      setActionError('');
      setOutcomeSession(null);
    } catch {
      setActionError('The session outcome could not be saved.');
    }
  };

  const openReview = (session) => {
    setReviewSession(session);
    setReviewForm({ rating: Number(session.review_rating || 5), comment: session.review_comment || '' });
    setActionError('');
  };

  const handleSaveReview = async (event) => {
    event.preventDefault();
    try {
      const response = await api.createReview(
        reviewSession.tutor_id,
        Number(reviewForm.rating),
        reviewForm.comment,
        reviewSession.id,
        localStorage.getItem('token')
      );
      if (response.error) return setActionError(response.error);
      setSessions((current) => current.map((session) => Number(session.tutor_id) === Number(reviewSession.tutor_id)
        ? { ...session, review_id: response.review.id, review_rating: response.review.rating, review_comment: response.review.comment }
        : session));
      setActionError('');
      setReviewSession(null);
    } catch {
      setActionError('Your review could not be saved.');
    }
  };

  const calendarDays = useMemo(() => {
    const year = Number(filters.year);
    const month = Number(filters.month);
    const firstDay = new Date(year, month - 1, 1).getDay();
    const daysInMonth = new Date(year, month, 0).getDate();
    const previousMonthDays = new Date(year, month - 1, 0).getDate();
    return Array.from({ length: 42 }, (_, index) => {
      const rawDay = index - firstDay + 1;
      if (rawDay < 1) return { day: previousMonthDays + rawDay, outside: true, key: `previous-${index}`, sessions: [] };
      if (rawDay > daysInMonth) return { day: rawDay - daysInMonth, outside: true, key: `next-${index}`, sessions: [] };
      const key = dateKey(year, month, rawDay);
      return { day: rawDay, outside: false, key, sessions: sessions.filter((session) => session.scheduled_date === key) };
    });
  }, [filters.month, filters.year, sessions]);

  const changeMonth = (offset) => {
    const next = new Date(Number(filters.year), Number(filters.month) - 1 + offset, 1);
    setFilters((current) => ({ ...current, month: next.getMonth() + 1, year: next.getFullYear() }));
  };

  if (loading) return <LoadingState label="Loading sessions..." />;
  if (error) return <ErrorState message={error} action={<button className="btn btn-primary" onClick={fetchSessions}>Try again</button>} />;

  return (
    <AppShell>
      <main className="page">
        <section className="section-head">
          <div>
            <span className="eyebrow">
              <CalendarDays size={15} />
              Session planning
            </span>
            <h1 className="page-title">A calm calendar for tutoring work.</h1>
            <p className="page-copy">Schedule sessions, track outcomes, and keep meeting details in one place.</p>
          </div>
          <button className="btn btn-primary" type="button" onClick={() => setShowCreateModal(true)}>
            <Plus size={18} />
            New session
          </button>
        </section>

        {actionError ? <div className="alert alert-error" role="alert">{actionError}<button type="button" onClick={() => setActionError('')} aria-label="Dismiss error">Dismiss</button></div> : null}

        <section className="card calendar-toolbar">
          <div className="calendar-navigation">
            <button className="icon-button" type="button" onClick={() => changeMonth(-1)} aria-label="Previous month"><ChevronLeft size={19} /></button>
            <strong>{monthNames[Number(filters.month) - 1]} {filters.year}</strong>
            <button className="icon-button" type="button" onClick={() => changeMonth(1)} aria-label="Next month"><ChevronRight size={19} /></button>
          </div>
          <div className="field">
            <label htmlFor="session-status">Status</label>
            <select id="session-status" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No-show</option>
            </select>
          </div>
          <div className="segmented calendar-view-toggle">
            <button type="button" className={view === 'calendar' ? 'active' : ''} onClick={() => setView('calendar')}><CalendarDays size={16} />Month</button>
            <button type="button" className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={16} />List</button>
          </div>
        </section>

        <section className="section">
          {view === 'calendar' ? (
            <div className="calendar-shell card">
              <div className="calendar-weekdays">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
              <div className="calendar-grid">
                {calendarDays.map((day) => (
                  <div className={`calendar-day${day.outside ? ' outside' : ''}`} key={day.key}>
                    <span className="calendar-day-number">{day.day}</span>
                    <div className="calendar-events">
                      {day.sessions.slice(0, 3).map((session) => <button type="button" className={`calendar-event ${statusClass[session.status] || ''}`} key={session.id} onClick={() => setView('list')} title={`${session.start_time} ${session.title}`}><strong>{session.start_time?.slice(0, 5)}</strong><span>{session.title || session.subject || 'Tutoring'}</span></button>)}
                      {day.sessions.length > 3 ? <button className="calendar-more" type="button" onClick={() => setView('list')}>+{day.sessions.length - 3} more</button> : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : sessions.length ? (
            <div className="grid">
              {sessions.map((session) => (
                <article className="card card-pad" key={session.id}>
                  <div className="list-item" style={{ border: 0, padding: 0 }}>
                    <div className="item-main">
                      <span className="stat-icon"><Clock size={21} /></span>
                      <div>
                        <h2 style={{ fontSize: '1.18rem' }}>{session.title || session.subject || 'Tutoring session'}</h2>
                        <p className="muted">
                          {session.scheduled_date} from {session.start_time} to {session.end_time}
                        </p>
                        {session.description ? <p className="page-copy">{session.description}</p> : null}
                        <p className="muted">{user?.role === 'tutor' ? `Student: ${session.student_name}` : `Tutor: ${session.tutor_name}`}</p>
                      </div>
                    </div>
                    <div className="button-row">
                      {session.confirmation_status === 'pending' ? <span className="badge badge-warning">Awaiting tutor confirmation</span> : null}
                      <span className={`badge ${statusClass[session.status] || 'badge'}`}>{session.status}</span>
                    </div>
                  </div>
                  {session.status === 'completed' && (session.tutor_summary || session.skills_practiced || session.next_steps) ? (
                    <div className="session-outcome-summary">
                      <div><FileText size={18} /><span><strong>Session summary</strong><p>{session.tutor_summary || 'Summary not added.'}</p></span></div>
                      {session.skills_practiced ? <div><CheckCircle2 size={18} /><span><strong>Skills practiced</strong><p>{session.skills_practiced}</p></span></div> : null}
                      {session.next_steps ? <div><ChevronRight size={18} /><span><strong>Next steps</strong><p>{session.next_steps}</p></span></div> : null}
                      {user?.role === 'student' && session.student_reflection ? <div><Star size={18} /><span><strong>Your private reflection</strong><p>{session.student_reflection}</p></span></div> : null}
                    </div>
                  ) : null}
                  <div className="button-row" style={{ marginTop: 18 }}>
                    {user?.role === 'tutor' && session.confirmation_status === 'pending' ? (
                      <>
                        <button className="btn btn-primary btn-sm" type="button" onClick={() => handleConfirmation(session.id, 'confirmed')}><CheckCircle2 size={16} />Confirm</button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleConfirmation(session.id, 'declined')}><X size={16} />Decline</button>
                      </>
                    ) : null}
                    {user?.role === 'tutor' && session.status === 'scheduled' && session.confirmation_status === 'confirmed' ? (
                      <button className="btn btn-primary btn-sm" type="button" onClick={() => openOutcome(session)} disabled={!sessionHasStarted(session)} title={sessionHasStarted(session) ? 'Record session outcome' : 'Available when the session begins'}><FileText size={16} />Record outcome</button>
                    ) : null}
                    {user?.role === 'tutor' && session.status === 'scheduled' && session.confirmation_status === 'confirmed' ? (
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => openOutcome(session, 'no_show')} disabled={!sessionHasStarted(session)} title={sessionHasStarted(session) ? 'Record a no-show' : 'Available when the session begins'}><UserX size={16} />No-show</button>
                    ) : null}
                    {user?.role === 'tutor' && session.status === 'completed' ? (
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => openOutcome(session)}><FileText size={16} />Edit notes</button>
                    ) : null}
                    {user?.role === 'student' && session.status === 'completed' ? (
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => openOutcome(session)}><FileText size={16} />{session.student_reflection ? 'Edit reflection' : 'Add reflection'}</button>
                    ) : null}
                    {user?.role === 'student' && session.status === 'completed' ? (
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => openReview(session)}><Star size={16} />{session.review_id ? `Update review (${session.review_rating}/5)` : 'Review tutor'}</button>
                    ) : null}
                    {session.status === 'scheduled' ? (
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleUpdateStatus(session.id, 'cancelled')}>
                        <X size={16} />
                        Cancel
                      </button>
                    ) : null}
                    {session.meeting_link && session.status === 'scheduled' && session.confirmation_status === 'confirmed' ? (
                      <a className="btn btn-primary btn-sm" href={session.meeting_link} target="_blank" rel="noreferrer">
                        Join meeting
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title="No sessions in this view" action={<button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>Schedule one</button>}>
              Sessions you create with accepted connections will appear here.
            </EmptyState>
          )}
        </section>
      </main>

      {showCreateModal ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="modal-head">
              <div>
                <h2>Schedule a session</h2>
                <p className="muted">Choose a connection and add the key details.</p>
              </div>
              <button className="btn btn-ghost btn-sm" type="button" onClick={() => setShowCreateModal(false)}>
                <X size={17} />
              </button>
            </div>
            <form className="modal-body form-grid" onSubmit={handleCreateSession}>
              <div className="field">
                <label>Connection</label>
                <select
                  value={formData.connectionId}
                  onChange={(event) => setFormData((current) => ({ ...current, connectionId: event.target.value }))}
                  required
                >
                  <option value="">Select a connection</option>
                  {connections.map((connection) => (
                    <option key={connection.id} value={connection.id}>
                      {connection.tutor_name || connection.student_name || connection.name || `Connection ${connection.id}`}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-2">
                <div className="field">
                  <label>Title</label>
                  <input value={formData.title} onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))} required />
                </div>
                <div className="field">
                  <label>Subject</label>
                  <input value={formData.subject} onChange={(event) => setFormData((current) => ({ ...current, subject: event.target.value }))} />
                </div>
              </div>
              <div className="grid grid-3">
                <div className="field">
                  <label>Date</label>
                  <input type="date" value={formData.scheduledDate} onChange={(event) => setFormData((current) => ({ ...current, scheduledDate: event.target.value }))} required />
                </div>
                <div className="field">
                  <label>Start</label>
                  <input type="time" value={formData.startTime} onChange={(event) => setFormData((current) => ({ ...current, startTime: event.target.value }))} required />
                </div>
                <div className="field">
                  <label>End</label>
                  <input type="time" value={formData.endTime} onChange={(event) => setFormData((current) => ({ ...current, endTime: event.target.value }))} required />
                </div>
              </div>
              <div className="field">
                <label>Meeting link</label>
                <input value={formData.meetingLink} onChange={(event) => setFormData((current) => ({ ...current, meetingLink: event.target.value }))} placeholder="https://..." />
              </div>
              <div className="field">
                <label>Description</label>
                <textarea value={formData.description} onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div className="button-row">
                <button className="btn btn-primary" type="submit">Create session</button>
                <button className="btn btn-ghost" type="button" onClick={() => setShowCreateModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {outcomeSession ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="outcome-title">
          <div className="modal">
            <div className="modal-head">
              <div><span className="eyebrow">Learning outcome</span><h2 id="outcome-title">{user?.role === 'tutor' ? 'Record what happened' : 'Reflect on your session'}</h2><p className="muted">{outcomeSession.title}</p></div>
              <button className="icon-button" type="button" onClick={() => setOutcomeSession(null)} aria-label="Close outcome form"><X size={18} /></button>
            </div>
            <form className="modal-body form-grid" onSubmit={handleSaveOutcome}>
              {user?.role === 'tutor' ? (
                <>
                  <div className="field"><label htmlFor="session-attendance">Attendance</label><select id="session-attendance" value={outcomeForm.attendance} onChange={(event) => setOutcomeForm((current) => ({ ...current, attendance: event.target.value }))}><option value="completed">Session completed</option><option value="no_show">Student did not attend</option></select></div>
                  {outcomeForm.attendance === 'completed' ? <>
                    <div className="field"><label htmlFor="tutor-summary">Session summary</label><textarea id="tutor-summary" value={outcomeForm.tutorSummary} onChange={(event) => setOutcomeForm((current) => ({ ...current, tutorSummary: event.target.value }))} placeholder="What did you cover and how did the session go?" maxLength="2000" /></div>
                    <div className="field"><label htmlFor="skills-practiced">Skills practiced</label><input id="skills-practiced" value={outcomeForm.skillsPracticed} onChange={(event) => setOutcomeForm((current) => ({ ...current, skillsPracticed: event.target.value }))} placeholder="Factoring, essay structure, debugging loops" maxLength="800" /></div>
                    <div className="field"><label htmlFor="next-steps">Next steps</label><textarea id="next-steps" value={outcomeForm.nextSteps} onChange={(event) => setOutcomeForm((current) => ({ ...current, nextSteps: event.target.value }))} placeholder="A focused practice task or goal for next time" maxLength="1200" /></div>
                  </> : <div className="alert alert-warning">This records attendance and closes the session without adding learning notes.</div>}
                </>
              ) : (
                <>
                  <div className="grid grid-2">
                    <div className="field"><label htmlFor="confidence-before">Confidence before</label><select id="confidence-before" value={outcomeForm.confidenceBefore} onChange={(event) => setOutcomeForm((current) => ({ ...current, confidenceBefore: event.target.value }))}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></div>
                    <div className="field"><label htmlFor="confidence-after">Confidence after</label><select id="confidence-after" value={outcomeForm.confidenceAfter} onChange={(event) => setOutcomeForm((current) => ({ ...current, confidenceAfter: event.target.value }))}>{[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></div>
                  </div>
                  <div className="field"><label htmlFor="student-reflection">Private reflection</label><textarea id="student-reflection" value={outcomeForm.studentReflection} onChange={(event) => setOutcomeForm((current) => ({ ...current, studentReflection: event.target.value }))} placeholder="What makes more sense now, and what still feels difficult?" maxLength="1600" required /></div>
                  <p className="muted">Your reflection is private to your account. Your tutor only sees the notes they shared.</p>
                </>
              )}
              {actionError ? <div className="alert alert-error" role="alert">{actionError}</div> : null}
              <div className="button-row"><button className="btn btn-primary" type="submit">Save outcome</button><button className="btn btn-ghost" type="button" onClick={() => setOutcomeSession(null)}>Cancel</button></div>
            </form>
          </div>
        </div>
      ) : null}

      {reviewSession ? (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="review-title">
          <div className="modal">
            <div className="modal-head"><div><span className="eyebrow">Student feedback</span><h2 id="review-title">Review {reviewSession.tutor_name}</h2><p className="muted">Share feedback after your completed session.</p></div><button className="icon-button" type="button" onClick={() => setReviewSession(null)} aria-label="Close review form"><X size={18} /></button></div>
            <form className="modal-body form-grid" onSubmit={handleSaveReview}>
              <div className="field"><label>Your rating</label><div className="session-rating" role="radiogroup" aria-label="Tutor rating">{[1, 2, 3, 4, 5].map((value) => <button type="button" role="radio" aria-checked={reviewForm.rating === value} className={reviewForm.rating >= value ? 'active' : ''} onClick={() => setReviewForm((current) => ({ ...current, rating: value }))} key={value} aria-label={`${value} star${value === 1 ? '' : 's'}`}><Star size={24} fill={reviewForm.rating >= value ? 'currentColor' : 'none'} /></button>)}</div></div>
              <div className="field"><label htmlFor="review-comment">What should future students know?</label><textarea id="review-comment" value={reviewForm.comment} onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))} placeholder="Describe what felt helpful, patient, or clear." maxLength="1200" /></div>
              {actionError ? <div className="alert alert-error" role="alert">{actionError}</div> : null}
              <div className="button-row"><button className="btn btn-primary" type="submit">Save review</button><button className="btn btn-ghost" type="button" onClick={() => setReviewSession(null)}>Cancel</button></div>
            </form>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
};

export default Sessions;
