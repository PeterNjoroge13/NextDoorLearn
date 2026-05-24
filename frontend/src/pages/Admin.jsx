import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, UserCheck, Users } from 'lucide-react';
import api from '../services/api';
import AppShell, { EmptyState, ErrorState, LoadingState } from '../components/AppShell';

const reportStatuses = ['open', 'reviewing', 'resolved', 'dismissed'];

const Admin = () => {
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [activeTab, setActiveTab] = useState('reports');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const fetchAdminData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const [usersResponse, reportsResponse] = await Promise.all([
        api.getAdminUsers(token),
        api.getAdminReports(token),
      ]);

      if (usersResponse.error || reportsResponse.error) {
        setError(usersResponse.error || reportsResponse.error);
        return;
      }

      setUsers(Array.isArray(usersResponse) ? usersResponse : []);
      setReports(Array.isArray(reportsResponse) ? reportsResponse : []);
      setError('');
    } catch {
      setError('Admin data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAdminData();
  }, [fetchAdminData]);

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(''), 3600);
  };

  const handleUpdateUser = async (userId, updates) => {
    const token = localStorage.getItem('token');
    const response = await api.updateAdminUser(userId, updates, token);
    if (response.error) {
      showToast(response.error);
      return;
    }
    setUsers((current) => current.map((user) => (user.id === response.id ? response : user)));
    showToast('User updated.');
  };

  const handleUpdateReport = async (reportId, status) => {
    const token = localStorage.getItem('token');
    const response = await api.updateAdminReport(reportId, status, token);
    if (response.error) {
      showToast(response.error);
      return;
    }
    setReports((current) => current.map((report) => (
      report.id === response.id ? { ...report, status: response.status, updated_at: response.updated_at } : report
    )));
    showToast('Report updated.');
  };

  const stats = useMemo(() => ({
    openReports: reports.filter((report) => ['open', 'reviewing'].includes(report.status)).length,
    suspendedUsers: users.filter((user) => user.status === 'suspended').length,
    verifiedTutors: users.filter((user) => user.role === 'tutor' && user.verified_at).length,
  }), [reports, users]);

  if (loading) return <LoadingState label="Opening admin console..." />;
  if (error) return <ErrorState title="Admin access unavailable" message={error} />;

  return (
    <AppShell>
      <main className="page">
        <section className="section-head">
          <div>
            <span className="eyebrow">
              <ShieldCheck size={15} />
              Admin console
            </span>
            <h1 className="page-title">Moderate reports and accounts.</h1>
            <p className="page-copy">Review safety reports, suspend problematic accounts, and verify tutor profiles.</p>
          </div>
        </section>

        {toast ? <div className="alert" style={{ marginBottom: 16 }}>{toast}</div> : null}

        <section className="grid grid-3">
          <div className="card stat">
            <span className="stat-icon"><AlertTriangle size={21} /></span>
            <strong>{stats.openReports}</strong>
            <span>Open reports</span>
          </div>
          <div className="card stat">
            <span className="stat-icon"><Users size={21} /></span>
            <strong>{stats.suspendedUsers}</strong>
            <span>Suspended users</span>
          </div>
          <div className="card stat">
            <span className="stat-icon"><UserCheck size={21} /></span>
            <strong>{stats.verifiedTutors}</strong>
            <span>Verified tutors</span>
          </div>
        </section>

        <section className="section">
          <div className="tabs" style={{ marginBottom: 16 }}>
            <button className={`tab${activeTab === 'reports' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('reports')}>
              Reports
            </button>
            <button className={`tab${activeTab === 'users' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('users')}>
              Users
            </button>
          </div>

          {activeTab === 'reports' ? (
            reports.length ? (
              <div className="admin-list">
                {reports.map((report) => (
                  <article className="card card-pad admin-row" key={report.id}>
                    <div>
                      <div className="button-row">
                        <span className={`badge ${report.status === 'open' ? 'badge-error' : 'badge-blue'}`}>{report.status}</span>
                        <span className="badge">{report.reason}</span>
                      </div>
                      <h2>Report #{report.id}</h2>
                      <p className="page-copy">{report.details || 'No additional details provided.'}</p>
                      <p className="muted">
                        Reporter: {report.reporter_email} · Reported: {report.reported_email}
                      </p>
                    </div>
                    <div className="admin-actions">
                      <select value={report.status} onChange={(event) => handleUpdateReport(report.id, event.target.value)}>
                        {reportStatuses.map((status) => (
                          <option key={status} value={status}>{status}</option>
                        ))}
                      </select>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState icon={CheckCircle2} title="No reports yet">
                Safety reports submitted by users will appear here.
              </EmptyState>
            )
          ) : (
            <div className="admin-list">
              {users.map((account) => (
                <article className="card card-pad admin-row" key={account.id}>
                  <div>
                    <div className="button-row">
                      <span className={`badge ${account.status === 'suspended' ? 'badge-error' : 'badge-success'}`}>{account.status}</span>
                      <span className="badge">{account.role}</span>
                      {account.verified_at ? <span className="badge badge-blue">Verified</span> : null}
                    </div>
                    <h2>{account.name}</h2>
                    <p className="muted">{account.email}</p>
                  </div>
                  <div className="admin-actions">
                    <button
                      className={`btn btn-sm ${account.status === 'suspended' ? 'btn-primary' : 'btn-danger'}`}
                      type="button"
                      onClick={() => handleUpdateUser(account.id, { status: account.status === 'suspended' ? 'active' : 'suspended' })}
                    >
                      {account.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                    </button>
                    {account.role === 'tutor' ? (
                      <button
                        className="btn btn-ghost btn-sm"
                        type="button"
                        onClick={() => handleUpdateUser(account.id, { verified: !account.verified_at })}
                      >
                        {account.verified_at ? 'Unverify' : 'Verify'}
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </AppShell>
  );
};

export default Admin;
