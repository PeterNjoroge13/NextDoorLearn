import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CalendarDays, Clock } from 'lucide-react';
import { Avatar, EmptyState } from '../AppShell';

export const StatTile = ({ icon, value, label, detail, tone = 'brand' }) => (
  <article className={`dashboard-stat dashboard-tone-${tone}`}>
    <span className="dashboard-stat-icon">{React.createElement(icon, { size: 20 })}</span>
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
      {detail ? <small>{detail}</small> : null}
    </div>
  </article>
);

export const DashboardSection = ({ title, copy, action, children, className = '' }) => (
  <section className={`dashboard-section ${className}`.trim()}>
    <div className="dashboard-section-head">
      <div>
        <h2>{title}</h2>
        {copy ? <p>{copy}</p> : null}
      </div>
      {action}
    </div>
    {children}
  </section>
);

export const ProfileProgress = ({ profile, completion, role }) => {
  const hasCompletion = Boolean(completion && !completion.error);
  const percentage = completion?.percentage || 0;
  const missing = completion?.missingFields || 0;
  return (
    <aside className="dashboard-profile-panel">
      <div className="dashboard-profile-person">
        <Avatar name={profile?.name} src={profile?.avatar_url} size={52} />
        <div>
          <strong>{profile?.name}</strong>
          <span>{role === 'tutor' ? 'Volunteer tutor' : profile?.profile?.grade_level || 'Student'}</span>
        </div>
      </div>
      <div className="dashboard-progress-label">
        <span>Profile strength</span>
        <strong>{percentage}%</strong>
      </div>
      <div className="progress" aria-label={`Profile ${percentage}% complete`}>
        <span style={{ width: `${percentage}%` }} />
      </div>
      <p>
        {!hasCompletion
          ? 'Review your details to make sure your profile is ready.'
          : missing > 0
            ? `${missing} detail${missing === 1 ? '' : 's'} left to help people understand ${role === 'tutor' ? 'what you offer' : 'what you need'}.`
            : 'Your profile is ready to make strong connections.'}
      </p>
      <Link className="dashboard-text-link" to="/profile">
        {missing > 0 ? 'Finish your profile' : 'Review profile'}
        <ArrowRight size={16} />
      </Link>
    </aside>
  );
};

const formatSessionDate = (session) => {
  if (!session?.scheduled_date) return 'Date to be confirmed';
  const date = new Date(`${session.scheduled_date}T${session.start_time || '12:00'}`);
  if (Number.isNaN(date.getTime())) return session.scheduled_date;
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
};

const formatTime = (time) => {
  if (!time) return '';
  const date = new Date(`2000-01-01T${time}`);
  return Number.isNaN(date.getTime())
    ? time
    : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
};

export const SessionList = ({ sessions, role, limit = 4 }) => {
  if (!sessions.length) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="Nothing scheduled yet"
        action={<Link className="btn btn-primary" to="/sessions">Plan a session</Link>}
      >
        Once a connection is accepted, sessions and meeting details will live here.
      </EmptyState>
    );
  }

  return (
    <div className="dashboard-list">
      {sessions.slice(0, limit).map((session, index) => {
        const person = role === 'tutor' ? session.student_name : session.tutor_name;
        return (
          <article className={`dashboard-session-row${index === 0 ? ' is-next' : ''}`} key={session.id}>
            <div className="dashboard-date-block">
              <CalendarDays size={18} />
              <span>{formatSessionDate(session)}</span>
            </div>
            <div className="dashboard-row-main">
              <strong>{session.title || session.subject || 'Tutoring session'}</strong>
              <span>{person ? `With ${person}` : 'Tutoring session'}</span>
            </div>
            <span className="dashboard-time"><Clock size={15} />{formatTime(session.start_time)}</span>
            {session.meeting_link && index === 0 ? (
              <a className="btn btn-primary btn-sm" href={session.meeting_link} target="_blank" rel="noreferrer">Join</a>
            ) : null}
          </article>
        );
      })}
    </div>
  );
};

export const PeopleList = ({ people, role, emptyTitle, emptyCopy, limit = 4 }) => {
  if (!people.length) {
    return <EmptyState title={emptyTitle}>{emptyCopy}</EmptyState>;
  }

  return (
    <div className="dashboard-list">
      {people.slice(0, limit).map((person) => {
        const name = role === 'tutor' ? person.student_name : person.tutor_name;
        const avatar = person.student_avatar || person.avatar_url;
        return (
          <article className="dashboard-person-row" key={person.id || person.connection_id}>
            <Avatar name={name} src={avatar} size={42} />
            <div className="dashboard-row-main">
              <strong>{name || 'NextDoorLearn member'}</strong>
              <span>{person.last_message || person.student_bio || person.tutor_bio || 'Ready to connect'}</span>
            </div>
            <Link className="icon-button" to="/messages" aria-label={`Message ${name || 'connection'}`} title="Open messages">
              <ArrowRight size={17} />
            </Link>
          </article>
        );
      })}
    </div>
  );
};
