import React, { useEffect, useMemo, useState } from 'react';
import { Check, Inbox, UserCheck, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AppShell, { Avatar, EmptyState, ErrorState, LoadingState } from '../components/AppShell';
import { parseList } from '../utils/format';

const Requests = () => {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const token = localStorage.getItem('token');
        const data = await api.getRequests(token);
        if (data.error) {
          setError(data.error);
        } else {
          setRequests(Array.isArray(data) ? data : []);
        }
      } catch {
        setError('Requests could not be loaded.');
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

  const groups = useMemo(() => ({
    pending: requests.filter((request) => request.status === 'pending'),
    accepted: requests.filter((request) => request.status === 'accepted'),
    rejected: requests.filter((request) => request.status === 'rejected'),
  }), [requests]);

  const handleRespondToRequest = async (requestId, action) => {
    try {
      const token = localStorage.getItem('token');
      const result = await api.respondToRequest(requestId, action, token);
      if (result.error) {
        setToast(result.error);
      } else {
        setRequests((current) =>
          current.map((request) => (request.id === requestId ? { ...request, status: result.status } : request))
        );
        setToast(action === 'accept' ? 'Request accepted.' : 'Request declined.');
      }
    } catch {
      setToast('Could not respond to that request.');
    } finally {
      setTimeout(() => setToast(''), 3600);
    }
  };

  if (loading) return <LoadingState label="Loading requests..." />;
  if (error) return <ErrorState message={error} />;
  if (user?.role !== 'tutor') {
    return (
      <AppShell>
        <main className="page">
          <EmptyState icon={UserCheck} title="Tutor access required" action={<Link className="btn btn-primary" to="/dashboard">Back home</Link>}>
            Only tutors can review student connection requests.
          </EmptyState>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main className="page">
        <section className="section-head">
          <div>
            <span className="eyebrow">
              <Inbox size={15} />
              Request queue
            </span>
            <h1 className="page-title">Review students who want your help.</h1>
            <p className="page-copy">Accept the right fits, decline what you cannot take on, and keep the queue clear.</p>
          </div>
          <div className="chip-row">
            <span className="badge badge-warning">{groups.pending.length} pending</span>
            <span className="badge badge-success">{groups.accepted.length} accepted</span>
          </div>
        </section>

        {toast ? <div className="alert" style={{ marginBottom: 16 }}>{toast}</div> : null}

        {requests.length === 0 ? (
          <EmptyState icon={Inbox} title="No requests yet">
            Students will appear here after they send you a connection request.
          </EmptyState>
        ) : (
          <div className="grid">
            {requests.map((request) => {
              const subjects = parseList(request.subjects_needed);
              return (
                <article className="card card-pad" key={request.id}>
                  <div className="list-item" style={{ border: 0, padding: 0 }}>
                    <div className="item-main">
                      <Avatar name={request.student_name} src={request.avatar_url} size={54} />
                      <div>
                        <h2 style={{ fontSize: '1.2rem' }}>{request.student_name}</h2>
                        <p className="muted">{request.student_email}</p>
                        <p className="muted" style={{ fontSize: '0.86rem' }}>
                          Sent {new Date(request.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`badge ${
                        request.status === 'pending'
                          ? 'badge-warning'
                          : request.status === 'accepted'
                            ? 'badge-success'
                            : 'badge-error'
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>

                  <div className="chip-row" style={{ marginTop: 18 }}>
                    {subjects.map((subject) => (
                      <span className="badge badge-primary" key={subject}>{subject}</span>
                    ))}
                    {subjects.length === 0 ? <span className="badge">Subjects not listed</span> : null}
                  </div>

                  {request.message ? <p className="page-copy">{request.message}</p> : null}

                  {request.status === 'pending' ? (
                    <div className="button-row" style={{ marginTop: 18 }}>
                      <button className="btn btn-primary" type="button" onClick={() => handleRespondToRequest(request.id, 'accept')}>
                        <Check size={18} />
                        Accept
                      </button>
                      <button className="btn btn-ghost" type="button" onClick={() => handleRespondToRequest(request.id, 'reject')}>
                        <X size={18} />
                        Decline
                      </button>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </main>
    </AppShell>
  );
};

export default Requests;
