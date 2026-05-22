import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  GraduationCap,
  MessageCircle,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AppShell, { Avatar, EmptyState, ErrorState, LoadingState } from '../components/AppShell';
import { parseList } from '../utils/format';

const Dashboard = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [connections, setConnections] = useState([]);
  const [upcomingSessions, setUpcomingSessions] = useState([]);
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ messagesSent: 0, activeConnections: 0, peopleHelped: 0 });
  const [sessionStats, setSessionStats] = useState({
    totalSessions: 0,
    scheduledSessions: 0,
    completedSessions: 0,
    totalMinutesTaught: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboard = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please sign in again to load your dashboard.');
        return;
      }

      const [profileResponse, connectionsResponse, upcomingResponse, messageStats, sessionStatsResponse] =
        await Promise.all([
          api.getProfile(token),
          api.getMyConnections(token),
          api.getUpcomingSessions(token, 4),
          api.getMessageStats(token),
          api.getSessionStats(token),
        ]);

      if (profileResponse.error) {
        setError(profileResponse.error);
        return;
      }

      setProfile(profileResponse);
      setConnections(Array.isArray(connectionsResponse) ? connectionsResponse : []);
      setUpcomingSessions(Array.isArray(upcomingResponse) ? upcomingResponse : []);
      if (!messageStats.error) setStats(messageStats);
      if (!sessionStatsResponse.error) {
        setSessionStats({
          totalSessions: sessionStatsResponse.total_sessions || 0,
          scheduledSessions: sessionStatsResponse.scheduled_sessions || 0,
          completedSessions: sessionStatsResponse.completed_sessions || 0,
          totalMinutesTaught: sessionStatsResponse.total_minutes_taught || 0,
        });
      }

      if (user?.role === 'tutor') {
        const requestResponse = await api.getRequests(token);
        setRequests(Array.isArray(requestResponse) ? requestResponse : []);
      }
      setError('');
    } catch {
      setError('Dashboard data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchDashboard();
    window.refreshDashboardStats = fetchDashboard;
    return () => {
      delete window.refreshDashboardStats;
    };
  }, [fetchDashboard]);

  if (loading) return <LoadingState label="Preparing your dashboard..." />;
  if (error) return <ErrorState message={error} action={<Link className="btn btn-primary" to="/login">Go to login</Link>} />;

  const firstName = user?.name?.split(' ')[0] || 'there';
  const profileSubjects = parseList(profile?.profile?.subjects || profile?.profile?.subjects_needed);
  const pendingRequests = requests.filter((request) => request.status === 'pending');

  return (
    <AppShell>
      <main className="page">
        <section className="hero-panel">
          <div className="hero-card">
            <span className="eyebrow">
              <Sparkles size={15} />
              {user?.role === 'tutor' ? 'Tutor workspace' : 'Student workspace'}
            </span>
            <h1>Good to see you, {firstName}.</h1>
            <p>
              {user?.role === 'tutor'
                ? 'Review new requests, keep sessions on track, and make your profile easy for students to trust.'
                : 'Find the right tutor, keep conversations moving, and stay ready for your next session.'}
            </p>
            <div className="button-row" style={{ marginTop: 24 }}>
              <Link className="btn btn-primary" to={user?.role === 'tutor' ? '/requests' : '/tutors'}>
                {user?.role === 'tutor' ? <Users size={18} /> : <Search size={18} />}
                {user?.role === 'tutor' ? 'Review requests' : 'Find tutors'}
              </Link>
              <Link className="btn btn-ghost" to="/sessions">
                <CalendarDays size={18} />
                View sessions
              </Link>
            </div>
          </div>

          <aside className="card card-pad">
            <div className="item-main">
              <Avatar name={profile?.name || user?.name} src={profile?.avatar_url} size={54} />
              <div>
                <h2 style={{ fontSize: '1.2rem' }}>{profile?.name || user?.name}</h2>
                <p className="muted" style={{ textTransform: 'capitalize' }}>{user?.role}</p>
              </div>
            </div>
            <div className="chip-row" style={{ marginTop: 18 }}>
              {profileSubjects.slice(0, 5).map((subject) => (
                <span className="badge badge-primary" key={subject}>{subject}</span>
              ))}
              {profileSubjects.length === 0 ? <span className="badge">Profile needs subjects</span> : null}
            </div>
            <p className="page-copy">{profile?.bio || 'Add a short bio so people understand how to connect with you.'}</p>
            <Link className="btn btn-secondary w-full" style={{ marginTop: 18 }} to="/profile">
              Complete profile
              <ArrowRight size={17} />
            </Link>
          </aside>
        </section>

        <section className="grid grid-4">
          <div className="card stat">
            <span className="stat-icon"><MessageCircle size={21} /></span>
            <strong>{stats.messagesSent || 0}</strong>
            <span>Messages sent</span>
          </div>
          <div className="card stat">
            <span className="stat-icon"><Users size={21} /></span>
            <strong>{stats.activeConnections || connections.length || 0}</strong>
            <span>Active connections</span>
          </div>
          <div className="card stat">
            <span className="stat-icon"><CalendarDays size={21} /></span>
            <strong>{sessionStats.scheduledSessions || 0}</strong>
            <span>Upcoming sessions</span>
          </div>
          <div className="card stat">
            <span className="stat-icon"><CheckCircle2 size={21} /></span>
            <strong>{sessionStats.completedSessions || 0}</strong>
            <span>Completed sessions</span>
          </div>
        </section>

        <section className="section grid grid-2">
          <div>
            <div className="section-head">
              <div>
                <h2>Upcoming sessions</h2>
                <p>What is next on your learning calendar.</p>
              </div>
              <Link className="btn btn-ghost btn-sm" to="/sessions">All sessions</Link>
            </div>
            {upcomingSessions.length ? (
              <div className="list">
                {upcomingSessions.map((session) => (
                  <article className="list-item" key={session.id}>
                    <div className="item-main">
                      <span className="stat-icon"><Clock size={20} /></span>
                      <div>
                        <h3>{session.title || session.subject || 'Tutoring session'}</h3>
                        <p>
                          {session.scheduled_date} at {session.start_time}
                        </p>
                      </div>
                    </div>
                    <span className="badge badge-blue">{session.status}</span>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState icon={CalendarDays} title="No sessions scheduled">
                Schedule a session once a connection is accepted.
              </EmptyState>
            )}
          </div>

          <div>
            <div className="section-head">
              <div>
                <h2>{user?.role === 'tutor' ? 'Student requests' : 'Connections'}</h2>
                <p>{user?.role === 'tutor' ? 'Students waiting for your response.' : 'Tutors you are connected with.'}</p>
              </div>
              <Link className="btn btn-ghost btn-sm" to={user?.role === 'tutor' ? '/requests' : '/messages'}>
                Open
              </Link>
            </div>
            {user?.role === 'tutor' ? (
              pendingRequests.length ? (
                <div className="list">
                  {pendingRequests.slice(0, 4).map((request) => (
                    <article className="list-item" key={request.id}>
                      <div className="item-main">
                        <Avatar name={request.student_name} />
                        <div>
                          <h3>{request.student_name}</h3>
                          <p>{request.student_email}</p>
                        </div>
                      </div>
                      <span className="badge badge-warning">Pending</span>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState icon={GraduationCap} title="No pending requests">
                  Your request queue is clear. Keep your profile updated so students know when you can help.
                </EmptyState>
              )
            ) : connections.length ? (
              <div className="list">
                {connections.slice(0, 4).map((connection) => {
                  const name = connection.tutor_name || connection.student_name || connection.name || 'Connection';
                  return (
                    <article className="list-item" key={connection.id || connection.connection_id}>
                      <div className="item-main">
                        <Avatar name={name} />
                        <div>
                          <h3>{name}</h3>
                          <p>{connection.status || 'Connected'}</p>
                        </div>
                      </div>
                      <Link className="btn btn-ghost btn-sm" to="/messages">Message</Link>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyState icon={Search} title="No connections yet" action={<Link className="btn btn-primary" to="/tutors">Browse tutors</Link>}>
                Send a request to a tutor to start messaging and scheduling.
              </EmptyState>
            )}
          </div>
        </section>
      </main>
    </AppShell>
  );
};

export default Dashboard;
