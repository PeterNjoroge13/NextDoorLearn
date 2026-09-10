import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Bookmark, BookOpenCheck, CalendarDays, CheckCircle2, Compass, MessageCircle, Search, Sparkles, Star, Target, Users } from 'lucide-react';
import { Avatar, EmptyState } from '../components/AppShell';
import { DashboardSection, PeopleList, ProfileProgress, SessionList, StatTile } from '../components/dashboard/DashboardUi';
import { parseList } from '../utils/format';

const StudentDashboard = ({ user, data }) => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const profile = data.profile;
  const studentProfile = profile?.profile || {};
  const neededSubjects = useMemo(() => parseList(studentProfile.subjects_needed), [studentProfile.subjects_needed]);
  const activeConnections = data.connections.filter((connection) => connection.status === 'accepted');
  const pendingConnections = data.connections.filter((connection) => connection.status === 'pending');
  const connectedTutorIds = useMemo(() => new Set(data.connections.map((connection) => Number(connection.tutor_id))), [data.connections]);
  const savedIds = useMemo(() => new Set(data.favorites.map((favorite) => Number(favorite.id))), [data.favorites]);
  const recommendedTutors = useMemo(() => data.tutors
    .filter((tutor) => !connectedTutorIds.has(Number(tutor.id)))
    .slice(0, 3), [data.tutors, connectedTutorIds]);
  const supportPeople = data.conversations.length ? data.conversations : activeConnections;
  const firstName = user?.name?.split(' ')[0] || 'there';

  const handleSearch = (event) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/tutors?search=${encodeURIComponent(query)}` : '/tutors');
  };

  return (
    <main className="page dashboard-page student-dashboard">
      <section className="dashboard-welcome dashboard-welcome-student">
        <div className="dashboard-welcome-copy">
          <span className="eyebrow"><Sparkles size={15} />Your learning home</span>
          <h1>What can we make easier today, {firstName}?</h1>
          <p>Find the right person, keep your tutoring plans organized, and take the next small step toward your goals.</p>
          <form className="dashboard-search" onSubmit={handleSearch}>
            <Search size={20} aria-hidden="true" />
            <label className="sr-only" htmlFor="dashboard-tutor-search">Search for tutoring help</label>
            <input id="dashboard-tutor-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="What subject do you need help with?" />
            <button className="btn btn-primary" type="submit">Find help</button>
          </form>
          <div className="dashboard-subject-links" aria-label="Your learning subjects">
            {neededSubjects.slice(0, 5).map((subject) => <Link key={subject} to={`/tutors?search=${encodeURIComponent(subject)}`}>{subject}</Link>)}
            {!neededSubjects.length ? <Link to="/profile">Add the subjects you are working on</Link> : null}
          </div>
        </div>
        <ProfileProgress profile={profile} completion={data.profileCompletion} role="student" />
      </section>

      <section className="dashboard-stats" aria-label="Learning overview">
        <StatTile icon={Users} value={activeConnections.length} label="Tutors in your circle" detail={`${pendingConnections.length} request${pendingConnections.length === 1 ? '' : 's'} pending`} />
        <StatTile icon={CalendarDays} value={data.sessionStats.scheduledSessions} label="Sessions ahead" detail={`${data.sessionStats.completedSessions} completed`} tone="blue" />
        <StatTile icon={Bookmark} value={data.favorites.length} label="Saved tutors" detail="Your personal shortlist" tone="gold" />
        <StatTile icon={MessageCircle} value={data.messageStats.messagesSent || 0} label="Messages sent" detail="Keep the conversation moving" tone="coral" />
      </section>

      <section className="dashboard-primary-grid">
        <DashboardSection title="Coming up" copy="Your next tutoring sessions and meeting details." action={<Link className="dashboard-text-link" to="/sessions">Full schedule <ArrowRight size={16} /></Link>}>
          <SessionList sessions={data.upcomingSessions} role="student" />
        </DashboardSection>
        <DashboardSection title="Your learning plan" copy="A clear view of what you are working toward." className="dashboard-goals-panel">
          <div className="dashboard-goal-block"><span className="dashboard-goal-icon"><Target size={20} /></span><div><strong>Current goal</strong><p>{studentProfile.learning_goals || 'Add a goal so tutors know what progress looks like for you.'}</p></div></div>
          <div className="dashboard-goal-block"><span className="dashboard-goal-icon"><BookOpenCheck size={20} /></span><div><strong>Focus subjects</strong><div className="chip-row">{neededSubjects.map((subject) => <span className="badge badge-primary" key={subject}>{subject}</span>)}{!neededSubjects.length ? <span className="muted">No subjects added yet</span> : null}</div></div></div>
          <Link className="btn btn-ghost w-full" to="/progress">Track your progress <ArrowRight size={16} /></Link>
        </DashboardSection>
      </section>

      <DashboardSection title="Tutors picked for your goals" copy={neededSubjects.length ? `Matched using ${neededSubjects.slice(0, 2).join(' and ')}.` : 'Affordable tutors ready to help you get started.'} action={<Link className="dashboard-text-link" to="/tutors">See every tutor <ArrowRight size={16} /></Link>}>
        {recommendedTutors.length ? (
          <div className="dashboard-tutor-grid">
            {recommendedTutors.map((tutor) => {
              const subjects = parseList(tutor.subjects);
              const rating = Number(tutor.averageRating || tutor.average_rating || 0);
              return (
                <article className="dashboard-tutor" key={tutor.id}>
                  <div className="dashboard-tutor-head"><Avatar name={tutor.name} src={tutor.avatar_url} size={50} /><div><h3>{tutor.name}</h3><span>{tutor.location || 'Remote tutoring'}</span></div><span className="dashboard-rating"><Star size={14} />{rating ? rating.toFixed(1) : 'New'}</span></div>
                  <p>{tutor.bio || tutor.teaching_style || 'Ready to help students build skill and confidence.'}</p>
                  <div className="chip-row">
                    {tutor.matchScore ? <span className="badge badge-primary">{tutor.matchScore}% match</span> : null}
                    {subjects.slice(0, 2).map((subject) => <span className="badge" key={subject}>{subject}</span>)}
                  </div>
                  {tutor.matchReasons?.length ? <p className="muted">{tutor.matchReasons.join(' · ')}</p> : null}
                  <div className="dashboard-tutor-footer"><strong>{Number(tutor.hourly_rate || 0) === 0 ? 'Free' : `$${tutor.hourly_rate}/hr`}</strong><Link className="btn btn-primary btn-sm" to={`/tutors/${tutor.id}`}>View tutor</Link></div>
                  {savedIds.has(Number(tutor.id)) ? <span className="dashboard-saved-label"><Bookmark size={14} />Saved</span> : null}
                </article>
              );
            })}
          </div>
        ) : <EmptyState icon={Compass} title="Your matches will appear here" action={<Link className="btn btn-primary" to="/tutors">Browse tutors</Link>}>Add subjects to your profile or explore the full tutor directory.</EmptyState>}
      </DashboardSection>

      {data.favorites.length ? (
        <DashboardSection title="Saved for later" copy="Your shortlist of tutors worth coming back to." action={<Link className="dashboard-text-link" to="/tutors">Add more <ArrowRight size={16} /></Link>}>
          <div className="dashboard-shortlist">
            {data.favorites.slice(0, 4).map((tutor) => (
              <Link to={`/tutors/${tutor.id}`} key={tutor.id}>
                <Avatar name={tutor.name} src={tutor.avatar_url} size={42} />
                <div><strong>{tutor.name}</strong><span>{parseList(tutor.subjects).slice(0, 2).join(', ') || 'Tutor'}</span></div>
                <b>{Number(tutor.hourly_rate || 0) === 0 ? 'Free' : `$${tutor.hourly_rate}/hr`}</b>
                <ArrowRight size={17} />
              </Link>
            ))}
          </div>
        </DashboardSection>
      ) : null}

      <section className="dashboard-secondary-grid">
        <DashboardSection title="Your support circle" copy="Tutors you can message and plan sessions with." action={<Link className="dashboard-text-link" to="/messages">Messages <ArrowRight size={16} /></Link>}>
          <PeopleList people={supportPeople} role="student" emptyTitle="Build your support circle" emptyCopy="Connect with a tutor and they will appear here." />
        </DashboardSection>
        <DashboardSection title="Next steps" copy="A few useful actions to keep momentum.">
          <div className="dashboard-action-list">
            <Link to="/tutors"><span><Search size={19} /></span><div><strong>Find a tutor</strong><small>Compare subjects, rates, and teaching styles.</small></div><ArrowRight size={17} /></Link>
            <Link to="/sessions"><span><CalendarDays size={19} /></span><div><strong>Plan a session</strong><small>Schedule time with a connected tutor.</small></div><ArrowRight size={17} /></Link>
            <Link to="/progress"><span><CheckCircle2 size={19} /></span><div><strong>Track your goals</strong><small>Turn a big outcome into achievable steps.</small></div><ArrowRight size={17} /></Link>
          </div>
        </DashboardSection>
      </section>
    </main>
  );
};

export default StudentDashboard;
