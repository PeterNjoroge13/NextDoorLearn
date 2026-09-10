import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock, List, Plus, Trash2, X } from 'lucide-react';
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

const Sessions = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  const handleDeleteSession = async (sessionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await api.deleteSession(sessionId, token);
      if (response.error) setActionError(response.error);
      else {
        setActionError('');
        setSessions((current) => current.filter((session) => session.id !== sessionId));
      }
    } catch {
      setActionError('The session could not be deleted.');
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
                      </div>
                    </div>
                    <div className="button-row">
                      {session.confirmation_status === 'pending' ? <span className="badge badge-warning">Awaiting tutor confirmation</span> : null}
                      <span className={`badge ${statusClass[session.status] || 'badge'}`}>{session.status}</span>
                    </div>
                  </div>
                  <div className="button-row" style={{ marginTop: 18 }}>
                    {user?.role === 'tutor' && session.confirmation_status === 'pending' ? (
                      <>
                        <button className="btn btn-primary btn-sm" type="button" onClick={() => handleConfirmation(session.id, 'confirmed')}><CheckCircle2 size={16} />Confirm</button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleConfirmation(session.id, 'declined')}><X size={16} />Decline</button>
                      </>
                    ) : null}
                    {session.status !== 'completed' && session.confirmation_status !== 'pending' ? (
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleUpdateStatus(session.id, 'completed')}>
                        <CheckCircle2 size={16} />
                        Mark complete
                      </button>
                    ) : null}
                    {session.status !== 'cancelled' ? (
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleUpdateStatus(session.id, 'cancelled')}>
                        <X size={16} />
                        Cancel
                      </button>
                    ) : null}
                    {session.status === 'scheduled' ? (
                      <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleDeleteSession(session.id)}>
                        <Trash2 size={16} />
                        Delete
                      </button>
                    ) : null}
                    {session.meeting_link ? (
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
    </AppShell>
  );
};

export default Sessions;
