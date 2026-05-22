import React, { useEffect, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock, Plus, Trash2, X } from 'lucide-react';
import api from '../services/api';
import AppShell, { EmptyState, ErrorState, LoadingState } from '../components/AppShell';

const statusClass = {
  scheduled: 'badge-primary',
  completed: 'badge-success',
  cancelled: 'badge-error',
  no_show: 'badge-warning',
};

const Sessions = () => {
  const [sessions, setSessions] = useState([]);
  const [connections, setConnections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  const fetchSessions = async () => {
    try {
      const token = localStorage.getItem('token');
      const [sessionsResponse, connectionsResponse] = await Promise.all([
        api.getSessions(token, filters),
        api.getMyConnections(token),
      ]);
      if (sessionsResponse.error) {
        setError(sessionsResponse.error);
      } else {
        setSessions(Array.isArray(sessionsResponse) ? sessionsResponse : []);
        setConnections(Array.isArray(connectionsResponse) ? connectionsResponse : []);
        setError('');
      }
    } catch {
      setError('Sessions could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [filters.status, filters.month, filters.year]);

  const handleCreateSession = async (event) => {
    event.preventDefault();
    const token = localStorage.getItem('token');
    const response = await api.createSession(formData, token);
    if (response.error) {
      setError(response.error);
    } else {
      setSessions((current) => [response, ...current]);
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
  };

  const handleUpdateStatus = async (sessionId, status) => {
    const token = localStorage.getItem('token');
    const response = await api.updateSessionStatus(sessionId, status, '', token);
    if (!response.error) {
      setSessions((current) => current.map((session) => (session.id === sessionId ? response : session)));
    }
  };

  const handleDeleteSession = async (sessionId) => {
    const token = localStorage.getItem('token');
    const response = await api.deleteSession(sessionId, token);
    if (!response.error) {
      setSessions((current) => current.filter((session) => session.id !== sessionId));
    }
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

        <section className="card toolbar" style={{ gridTemplateColumns: 'repeat(3, minmax(150px, 1fr))' }}>
          <div className="field">
            <label>Status</label>
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="">All statuses</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No-show</option>
            </select>
          </div>
          <div className="field">
            <label>Month</label>
            <input
              type="number"
              min="1"
              max="12"
              value={filters.month}
              onChange={(event) => setFilters((current) => ({ ...current, month: event.target.value }))}
            />
          </div>
          <div className="field">
            <label>Year</label>
            <input
              type="number"
              value={filters.year}
              onChange={(event) => setFilters((current) => ({ ...current, year: event.target.value }))}
            />
          </div>
        </section>

        <section className="section">
          {sessions.length ? (
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
                    <span className={`badge ${statusClass[session.status] || 'badge'}`}>{session.status}</span>
                  </div>
                  <div className="button-row" style={{ marginTop: 18 }}>
                    {session.status !== 'completed' ? (
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
                    <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleDeleteSession(session.id)}>
                      <Trash2 size={16} />
                      Delete
                    </button>
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
