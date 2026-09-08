import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarClock, CalendarDays, Check, CheckCircle2, Clock3, GraduationCap, HeartHandshake, Inbox, Sparkles, Users, X } from 'lucide-react';
import api from '../services/api';
import { Avatar, EmptyState } from '../components/AppShell';
import { DashboardSection, PeopleList, ProfileProgress, SessionList, StatTile } from '../components/dashboard/DashboardUi';
import { parseList } from '../utils/format';

const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const formatTime = (time) => {
  if (!time) return '';
  const date = new Date(`2000-01-01T${time}`);
  return Number.isNaN(date.getTime()) ? time : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
};

const TutorDashboard = ({ user, data, updateRequest }) => {
  const [workingRequest, setWorkingRequest] = useState(null);
  const [notice, setNotice] = useState('');
  const pendingRequests = data.requests.filter((request) => request.status === 'pending');
  const roster = useMemo(() => {
    const people = [...data.conversations];
    const conversationIds = new Set(people.map((person) => Number(person.connection_id)));
    data.connections.forEach((connection) => {
      if (!conversationIds.has(Number(connection.id))) people.push(connection);
    });
    return people;
  }, [data.connections, data.conversations]);
  const profile = data.profile;
  const tutorProfile = profile?.profile || {};
  const subjects = parseList(tutorProfile.subjects);
  const firstName = user?.name?.split(' ')[0] || 'there';
  const hoursTaught = Math.round((data.sessionStats.totalMinutesTaught / 60) * 10) / 10;

  const handleRequest = async (requestId, action) => {
    setWorkingRequest(requestId);
    setNotice('');
    try {
      const token = localStorage.getItem('token');
      const response = await api.respondToRequest(requestId, action, token);
      if (response.error) setNotice(response.error);
      else {
        updateRequest(requestId, response.status);
        setNotice(action === 'accept' ? 'Student added to your roster.' : 'Request declined.');
      }
    } catch {
      setNotice('That request could not be updated. Please try again.');
    } finally {
      setWorkingRequest(null);
    }
  };

  return (
    <main className="page dashboard-page tutor-dashboard">
      <section className="dashboard-welcome dashboard-welcome-tutor">
        <div className="dashboard-welcome-copy">
          <span className="eyebrow"><Sparkles size={15} />Your teaching workspace</span>
          <h1>Your time can change someone's week, {firstName}.</h1>
          <p>See what needs your attention, prepare for upcoming sessions, and keep your availability open to the students who need it.</p>
          <div className="button-row dashboard-welcome-actions">
            <Link className="btn btn-primary" to="/requests"><Inbox size={18} />Review requests {pendingRequests.length ? `(${pendingRequests.length})` : ''}</Link>
            <Link className="btn btn-ghost" to="/profile?tab=availability"><CalendarClock size={18} />Set availability</Link>
          </div>
          <div className="dashboard-subject-links" aria-label="Subjects you teach">
            {subjects.slice(0, 5).map((subject) => <span key={subject}>{subject}</span>)}
            {!subjects.length ? <Link to="/profile">Add the subjects you teach</Link> : null}
          </div>
        </div>
        <ProfileProgress profile={profile} completion={data.profileCompletion} role="tutor" />
      </section>

      {notice ? <div className="alert dashboard-notice" role="status">{notice}</div> : null}

      <section className="dashboard-stats" aria-label="Teaching impact">
        <StatTile icon={Users} value={data.messageStats.peopleHelped || data.connections.length} label="Students supported" detail={`${data.connections.length} active connection${data.connections.length === 1 ? '' : 's'}`} />
        <StatTile icon={CheckCircle2} value={data.sessionStats.completedSessions} label="Sessions completed" detail={`${hoursTaught} volunteer hour${hoursTaught === 1 ? '' : 's'}`} tone="blue" />
        <StatTile icon={CalendarDays} value={data.sessionStats.scheduledSessions} label="Sessions ahead" detail="Your upcoming commitment" tone="gold" />
        <StatTile icon={Inbox} value={pendingRequests.length} label="Requests waiting" detail={pendingRequests.length ? 'Students need a response' : 'Your queue is clear'} tone="coral" />
      </section>

      <section className="dashboard-primary-grid tutor-primary-grid">
        <DashboardSection title="Needs your attention" copy="Students waiting to know whether you can help." action={<Link className="dashboard-text-link" to="/requests">Full queue <ArrowRight size={16} /></Link>} className="dashboard-request-panel">
          {pendingRequests.length ? (
            <div className="dashboard-request-list">
              {pendingRequests.slice(0, 4).map((request) => {
                const requestedSubjects = parseList(request.subjects_needed);
                const isWorking = workingRequest === request.id;
                return (
                  <article className="dashboard-request" key={request.id}>
                    <Avatar name={request.student_name} src={request.avatar_url} size={46} />
                    <div className="dashboard-request-copy"><strong>{request.student_name}</strong><span>{request.grade_level || 'Student'}{requestedSubjects.length ? ` - ${requestedSubjects.slice(0, 2).join(', ')}` : ''}</span>{request.student_bio ? <p>{request.student_bio}</p> : null}</div>
                    <div className="dashboard-request-actions">
                      <button className="icon-button is-accept" type="button" onClick={() => handleRequest(request.id, 'accept')} disabled={isWorking} aria-label={`Accept ${request.student_name}`} title="Accept request"><Check size={18} /></button>
                      <button className="icon-button is-decline" type="button" onClick={() => handleRequest(request.id, 'reject')} disabled={isWorking} aria-label={`Decline ${request.student_name}`} title="Decline request"><X size={18} /></button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : <EmptyState icon={HeartHandshake} title="Your request queue is clear">Keep your profile and availability current so the right students can find you.</EmptyState>}
        </DashboardSection>

        <DashboardSection title="Weekly availability" copy="The recurring hours students can book with you." className="dashboard-availability-panel">
          {data.availability.length ? (
            <div className="dashboard-availability-list">
              {data.availability.slice(0, 6).map((slot, index) => <div key={`${slot.dayOfWeek}-${slot.startTime}-${index}`}><span>{weekDays[Number(slot.dayOfWeek)] || 'Day'}</span><strong>{formatTime(slot.startTime)} - {formatTime(slot.endTime)}</strong></div>)}
            </div>
          ) : <div className="dashboard-availability-empty"><span><Clock3 size={22} /></span><strong>No office hours yet</strong><p>Add at least one recurring window before students try to schedule.</p></div>}
          <Link className="btn btn-ghost w-full" to="/profile?tab=availability">Manage availability <ArrowRight size={16} /></Link>
        </DashboardSection>
      </section>

      <DashboardSection title="Your upcoming sessions" copy="The students and topics on your teaching calendar." action={<Link className="dashboard-text-link" to="/sessions">Manage schedule <ArrowRight size={16} /></Link>}>
        <SessionList sessions={data.upcomingSessions} role="tutor" />
      </DashboardSection>

      <section className="dashboard-secondary-grid">
        <DashboardSection title="Your student roster" copy="Accepted students you can message and support." action={<Link className="dashboard-text-link" to="/messages">Open students <ArrowRight size={16} /></Link>}>
          <PeopleList people={roster} role="tutor" emptyTitle="Your roster is ready for its first student" emptyCopy="Accept a connection request and that student will appear here." />
        </DashboardSection>
        <DashboardSection title="Tutor readiness" copy="The essentials students look for before reaching out.">
          <div className="dashboard-checklist">
            <div className={subjects.length ? 'is-done' : ''}><span>{subjects.length ? <Check size={16} /> : '1'}</span><div><strong>Subjects listed</strong><small>{subjects.length ? subjects.slice(0, 3).join(', ') : 'Tell students where you can help.'}</small></div></div>
            <div className={data.availability.length ? 'is-done' : ''}><span>{data.availability.length ? <Check size={16} /> : '2'}</span><div><strong>Availability published</strong><small>{data.availability.length ? `${data.availability.length} weekly window${data.availability.length === 1 ? '' : 's'}` : 'Open time for student sessions.'}</small></div></div>
            <div className={profile?.bio ? 'is-done' : ''}><span>{profile?.bio ? <Check size={16} /> : '3'}</span><div><strong>Personal introduction</strong><small>{profile?.bio ? 'Students can get to know you.' : 'Add a warm, specific tutor bio.'}</small></div></div>
          </div>
          <Link className="btn btn-primary w-full" to="/profile"><GraduationCap size={18} />Strengthen profile</Link>
        </DashboardSection>
      </section>

      <section className="dashboard-impact-band"><div><span><HeartHandshake size={22} /></span><div><strong>{hoursTaught} hours given</strong><p>Every completed session helps make support more reachable.</p></div></div><Link className="dashboard-text-link" to="/sessions">See your session history <ArrowRight size={16} /></Link></section>
    </main>
  );
};

export default TutorDashboard;
