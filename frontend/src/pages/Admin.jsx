import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, ClipboardList, HandCoins, Mail, RefreshCw, ShieldCheck, UserCheck, Users } from 'lucide-react';
import api from '../services/api';
import AppShell, { Avatar, EmptyState, ErrorState, LoadingState } from '../components/AppShell';

const reportStatuses = ['open', 'reviewing', 'resolved', 'dismissed'];
const inquiryStatuses = ['new', 'contacted', 'closed'];

const Admin = () => {
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [applications, setApplications] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [waitlist, setWaitlist] = useState([]);
  const [overview, setOverview] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [emailDelivery, setEmailDelivery] = useState({ providerConfigured: false, emails: [] });
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [moderationDrafts, setModerationDrafts] = useState({});
  const [activeTab, setActiveTab] = useState('reports');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  const fetchAdminData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const [overviewResponse, usersResponse, reportsResponse, applicationsResponse, inquiriesResponse, waitlistResponse, auditResponse, emailResponse] = await Promise.all([
        api.getAdminOverview(token),
        api.getAdminUsers(token),
        api.getAdminReports(token),
        api.getAdminTutorApplications(token),
        api.getAdminSponsorInquiries(token),
        api.getAdminWaitlist(token),
        api.getAdminAuditLog(token),
        api.getAdminEmailOutbox(token),
      ]);

      if (overviewResponse.error || usersResponse.error || reportsResponse.error || applicationsResponse.error || inquiriesResponse.error || waitlistResponse.error || auditResponse.error || emailResponse.error) {
        setError(overviewResponse.error || usersResponse.error || reportsResponse.error || applicationsResponse.error || inquiriesResponse.error || waitlistResponse.error || auditResponse.error || emailResponse.error);
        return;
      }

      setUsers(Array.isArray(usersResponse) ? usersResponse : []);
      setReports(Array.isArray(reportsResponse) ? reportsResponse : []);
      setApplications(Array.isArray(applicationsResponse) ? applicationsResponse : []);
      setInquiries(Array.isArray(inquiriesResponse) ? inquiriesResponse : []);
      setWaitlist(Array.isArray(waitlistResponse) ? waitlistResponse : []);
      setOverview(overviewResponse);
      setAuditLog(Array.isArray(auditResponse) ? auditResponse : []);
      setEmailDelivery(emailResponse?.emails ? emailResponse : { providerConfigured: false, emails: [] });
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

  const handleModerationAction = async (reportId, action) => {
    const reason = reviewDrafts[`report-${reportId}`]?.reason || '';
    if (!reason.trim()) return showToast('Add a moderation reason before applying an action.');
    const response = await api.applyAdminModeration(reportId, action, reason, localStorage.getItem('token'));
    if (response.error) return showToast(response.error);
    setReports((current) => current.map((report) => report.id === reportId ? { ...report, status: response.reportStatus } : report));
    showToast(`Moderation action ${action} recorded.`);
  };

  const handleModerationAction = async (reportId, action) => {
    const reason = moderationDrafts[reportId] || '';
    if (!reason.trim()) return showToast('Add a moderation reason before taking action.');
    const response = await api.applyAdminModeration(reportId, action, reason, localStorage.getItem('token'));
    if (response.error) return showToast(response.error);
    setReports((current) => current.map((report) => report.id === reportId ? { ...report, status: response.reportStatus } : report));
    showToast(`Moderation action ${action} recorded.`);
  };

  const handleUpdateApplication = async (applicationId, status) => {
    const draft = reviewDrafts[applicationId] || {};
    const response = await api.updateAdminTutorApplication(applicationId, {
      status,
      reason: draft.reason || '',
      internalNotes: draft.internalNotes || '',
    }, localStorage.getItem('token'));
    if (response.error) return showToast(response.error);
    setApplications((current) => current.map((item) => item.id === response.id ? { ...item, ...response } : item));
    showToast(status === 'approved' ? 'Tutor approved and activation invitation queued.' : 'Application updated.');
  };

  const updateReviewDraft = (applicationId, field, value) => {
    setReviewDrafts((current) => ({ ...current, [applicationId]: { ...current[applicationId], [field]: value } }));
  };

  const handleProcessEmail = async () => {
    const response = await api.processAdminEmailOutbox(localStorage.getItem('token'));
    if (response.error) return showToast(response.error);
    showToast(`Processed ${response.processed} queued email${response.processed === 1 ? '' : 's'}.`);
    fetchAdminData();
  };

  const handleUpdateInquiry = async (inquiryId, status) => {
    const response = await api.updateAdminSponsorInquiry(inquiryId, status, localStorage.getItem('token'));
    if (response.error) return showToast(response.error);
    setInquiries((current) => current.map((item) => item.id === response.id ? { ...item, ...response } : item));
    showToast('Sponsor inquiry updated.');
  };

  const stats = useMemo(() => ({
    openReports: reports.filter((report) => ['open', 'reviewing'].includes(report.status)).length,
    suspendedUsers: users.filter((user) => user.status === 'suspended').length,
    verifiedTutors: users.filter((user) => user.role === 'tutor' && user.verified_at).length,
    pendingApplications: overview?.applications?.awaiting_review ?? applications.filter((application) => ['pending', 'reviewing'].includes(application.status)).length,
  }), [applications, overview, reports, users]);

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
            <h1 className="page-title">Run the community with care.</h1>
            <p className="page-copy">Review tutor applicants, student demand, sponsorship interest, safety reports, and member accounts.</p>
          </div>
        </section>

        {toast ? <div className="alert" style={{ marginBottom: 16 }}>{toast}</div> : null}

        <section className="grid grid-4">
          <div className="card stat">
            <span className="stat-icon"><ClipboardList size={21} /></span>
            <strong>{stats.pendingApplications}</strong>
            <span>Applications to review</span>
          </div>
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
            <button className={`tab${activeTab === 'applications' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('applications')}>
              Applications
            </button>
            <button className={`tab${activeTab === 'waitlist' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('waitlist')}>
              Student waitlist
            </button>
            <button className={`tab${activeTab === 'sponsors' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('sponsors')}>
              Sponsors
            </button>
            <button className={`tab${activeTab === 'reports' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('reports')}>
              Reports
            </button>
            <button className={`tab${activeTab === 'users' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('users')}>
              Users
            </button>
            <button className={`tab${activeTab === 'delivery' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('delivery')}>
              Email delivery
            </button>
            <button className={`tab${activeTab === 'audit' ? ' active' : ''}`} type="button" onClick={() => setActiveTab('audit')}>
              Audit log
            </button>
          </div>

          {activeTab === 'applications' ? (
            applications.length ? (
              <div className="admin-list">
                {applications.map((application) => (
                  <article className="card card-pad admin-row" key={application.id}>
                    <div>
                      <div className="button-row">
                        <span className={`badge ${application.review_state === 'approved' ? 'badge-success' : application.review_state === 'declined' ? 'badge-error' : 'badge-warning'}`}>{(application.review_state || application.status).replaceAll('_', ' ')}</span>
                        {application.activation_status === 'invited' ? <span className="badge badge-blue"><Mail size={14} />Invitation sent</span> : null}
                        {application.activation_status === 'activated' ? <span className="badge badge-success"><UserCheck size={14} />Activated</span> : null}
                        {application.subjects.map((subject) => <span className="badge" key={subject}>{subject}</span>)}
                      </div>
                      <div className="admin-applicant">
                        <Avatar name={application.name} src={application.profile_picture_url} size={58} />
                        <h2>{application.name}</h2>
                      </div>
                      <p className="muted">{application.email} · {application.location || 'Location not provided'} · {application.tutoring_mode || 'Format flexible'}</p>
                      <p className="page-copy"><strong>Motivation:</strong> {application.motivation}</p>
                      <p className="page-copy"><strong>Background:</strong> {application.education || application.experience || 'Not provided'}</p>
                      <p className="muted">Availability: {application.availability || 'Not provided'} · {Number(application.hourly_rate || 0) === 0 ? 'Volunteer' : `$${application.hourly_rate}/hr`}</p>
                    </div>
                    <div className="admin-actions">
                      <label className="field">
                        <span>Applicant-facing note</span>
                        <textarea rows="3" value={reviewDrafts[application.id]?.reason || ''} onChange={(event) => updateReviewDraft(application.id, 'reason', event.target.value)} placeholder="Decision context or information needed" />
                      </label>
                      <label className="field">
                        <span>Private admin notes</span>
                        <textarea rows="3" value={reviewDrafts[application.id]?.internalNotes || ''} onChange={(event) => updateReviewDraft(application.id, 'internalNotes', event.target.value)} placeholder="Internal review notes" />
                      </label>
                      <div className="button-row">
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleUpdateApplication(application.id, 'reviewing')}>Reviewing</button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleUpdateApplication(application.id, 'needs_information')}>Request info</button>
                        {application.activation_status !== 'activated' ? <button className="btn btn-primary btn-sm" type="button" onClick={() => handleUpdateApplication(application.id, 'approved')}>{application.activation_status === 'invited' ? 'Resend invite' : 'Approve'}</button> : null}
                        <button className="btn btn-danger btn-sm" type="button" onClick={() => handleUpdateApplication(application.id, 'declined')}>Decline</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : <EmptyState icon={CheckCircle2} title="No tutor applications">New applicants will appear here for review.</EmptyState>
          ) : activeTab === 'waitlist' ? (
            waitlist.length ? <div className="admin-list">{waitlist.map((entry) => <article className="card card-pad admin-row" key={entry.id}><div><div className="button-row"><span className={`badge ${entry.status === 'open' ? 'badge-warning' : 'badge-success'}`}>{entry.status}</span>{entry.subjects.map((subject) => <span className="badge badge-primary" key={subject}>{subject}</span>)}</div><h2>{entry.name}</h2><p className="muted">{entry.email} · {entry.grade_level || 'Grade not listed'} · {entry.budget_preference || 'Budget flexible'} · {entry.tutoring_mode || 'Any format'}</p><p className="page-copy">{entry.learning_goals || 'No learning goal provided.'}</p><p className="muted">Preferred schedule: {entry.preferred_schedule || 'Not listed'}</p></div></article>)}</div> : <EmptyState icon={CheckCircle2} title="No students waiting">Unmatched students will appear here.</EmptyState>
          ) : activeTab === 'sponsors' ? (
            inquiries.length ? <div className="admin-list">{inquiries.map((inquiry) => <article className="card card-pad admin-row" key={inquiry.id}><div><div className="button-row"><span className={`badge ${inquiry.status === 'new' ? 'badge-warning' : 'badge-success'}`}>{inquiry.status}</span><span className="badge"><HandCoins size={14} />{inquiry.sponsor_type}</span></div><h2>{inquiry.name}{inquiry.organization ? ` · ${inquiry.organization}` : ''}</h2><p className="muted">{inquiry.email}</p><p className="page-copy">{inquiry.message || 'No message provided.'}</p></div><div className="admin-actions"><select value={inquiry.status} onChange={(event) => handleUpdateInquiry(inquiry.id, event.target.value)}>{inquiryStatuses.map((status) => <option key={status} value={status}>{status}</option>)}</select></div></article>)}</div> : <EmptyState icon={CheckCircle2} title="No sponsor inquiries">Partnership interest will appear here.</EmptyState>
          ) : activeTab === 'reports' ? (
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
                      <label className="field">
                        <span>Required action reason</span>
                        <textarea rows="3" value={reviewDrafts[`report-${report.id}`]?.reason || ''} onChange={(event) => updateReviewDraft(`report-${report.id}`, 'reason', event.target.value)} placeholder="What was reviewed and why this action is appropriate" />
                      </label>
                      <div className="button-row">
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleModerationAction(report.id, 'warn')}>Warn</button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleModerationAction(report.id, 'suspend')}>Suspend</button>
                        <button className="btn btn-danger btn-sm" type="button" onClick={() => handleModerationAction(report.id, 'ban')}>Ban</button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleModerationAction(report.id, 'dismiss')}>Dismiss</button>
                      </div>
                      <label className="field"><span>Moderation reason</span><textarea rows="3" value={moderationDrafts[report.id] || ''} onChange={(event) => setModerationDrafts((current) => ({ ...current, [report.id]: event.target.value }))} placeholder="Required for account action" /></label>
                      <div className="button-row">
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleModerationAction(report.id, 'warn')}>Warn</button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleModerationAction(report.id, 'suspend')}>Suspend</button>
                        <button className="btn btn-danger btn-sm" type="button" onClick={() => handleModerationAction(report.id, 'ban')}>Ban</button>
                        <button className="btn btn-ghost btn-sm" type="button" onClick={() => handleModerationAction(report.id, 'dismiss')}>Dismiss</button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState icon={CheckCircle2} title="No reports yet">
                Safety reports submitted by users will appear here.
              </EmptyState>
            )
          ) : activeTab === 'delivery' ? (
            <div>
              <div className="section-head" style={{ marginBottom: 16 }}>
                <div>
                  <span className={`badge ${emailDelivery.providerConfigured ? 'badge-success' : 'badge-warning'}`}>
                    <Mail size={14} />{emailDelivery.providerConfigured ? 'Email provider connected' : 'Waiting for email provider configuration'}
                  </span>
                </div>
                <button className="btn btn-primary btn-sm" type="button" onClick={handleProcessEmail}><RefreshCw size={16} />Retry queued mail</button>
              </div>
              {emailDelivery.emails.length ? <div className="admin-list">{emailDelivery.emails.map((email) => (
                <article className="card card-pad admin-row" key={email.id}>
                  <div><div className="button-row"><span className={`badge ${email.status === 'sent' ? 'badge-success' : email.last_error ? 'badge-error' : 'badge-warning'}`}>{email.status}</span><span className="badge">{email.template.replaceAll('_', ' ')}</span></div><h2>{email.subject}</h2><p className="muted">{email.recipient} · {email.attempts} attempt{email.attempts === 1 ? '' : 's'}</p>{email.last_error ? <p className="page-copy">{email.last_error}</p> : null}</div>
                </article>
              ))}</div> : <EmptyState icon={Mail} title="No transactional email yet">Verification, activation, and reminder deliveries will appear here.</EmptyState>}
            </div>
          ) : activeTab === 'audit' ? (
            auditLog.length ? <div className="admin-list">{auditLog.map((entry) => (
              <article className="card card-pad admin-row" key={entry.id}>
                <div><div className="button-row"><span className="badge badge-blue"><Activity size={14} />{entry.action.replaceAll('.', ' ')}</span><span className="badge">{entry.target_type} #{entry.target_id || 'system'}</span></div><h2>{entry.admin_name}</h2><p className="muted">{entry.admin_email} · {new Date(entry.created_at).toLocaleString()}</p>{entry.details?.reason ? <p className="page-copy">{entry.details.reason}</p> : null}</div>
              </article>
            ))}</div> : <EmptyState icon={Activity} title="No administrative actions">Sensitive account and application decisions will be recorded here.</EmptyState>
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
