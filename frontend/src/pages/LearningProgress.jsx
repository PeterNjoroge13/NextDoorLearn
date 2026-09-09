import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpenCheck,
  CalendarDays,
  Check,
  CheckCircle2,
  Circle,
  Flag,
  Pause,
  Play,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import AppShell, { Avatar, EmptyState, ErrorState, LoadingState } from '../components/AppShell';

const blankGoal = { subject: '', title: '', description: '', targetDate: '' };

const targetDateLabel = (date) => {
  if (!date) return 'No target date';
  const parsed = new Date(`${date}T12:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);
};

const LearningProgress = () => {
  const { user } = useAuth();
  const [goals, setGoals] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [student, setStudent] = useState(null);
  const [form, setForm] = useState(blankGoal);
  const [milestoneDrafts, setMilestoneDrafts] = useState({});
  const [filter, setFilter] = useState('current');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const token = localStorage.getItem('token');
  const isStudent = user?.role === 'student';

  const loadGoals = useCallback(async (studentId, showSpinner = true) => {
    if (showSpinner) setLoading(true);
    setError('');
    try {
      const response = await api.getLearningGoals(token, studentId);
      if (response.error) setError(response.error);
      else {
        setStudent(response.student);
        setGoals(Array.isArray(response.goals) ? response.goals : []);
      }
    } catch {
      setError('Learning progress could not be loaded.');
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isStudent) {
      loadGoals();
      return;
    }

    const loadStudents = async () => {
      setLoading(true);
      try {
        const response = await api.getMyConnections(token);
        if (response.error) {
          setError(response.error);
          setLoading(false);
          return;
        }
        const connected = (Array.isArray(response) ? response : []).filter((item) => item.status === 'accepted');
        setStudents(connected);
        if (connected.length) setSelectedStudentId(String(connected[0].student_id));
        else setLoading(false);
      } catch {
        setError('Your student roster could not be loaded.');
        setLoading(false);
      }
    };
    loadStudents();
  }, [isStudent, loadGoals, token]);

  useEffect(() => {
    if (!isStudent && selectedStudentId) loadGoals(selectedStudentId);
  }, [isStudent, loadGoals, selectedStudentId]);

  const visibleGoals = useMemo(() => goals.filter((goal) => {
    if (filter === 'all') return true;
    if (filter === 'completed') return goal.status === 'completed';
    return goal.status !== 'completed';
  }), [goals, filter]);

  const completedCount = goals.filter((goal) => goal.status === 'completed').length;
  const averageProgress = goals.length
    ? Math.round(goals.reduce((total, goal) => total + Number(goal.progress_percent || 0), 0) / goals.length)
    : 0;

  const refresh = () => loadGoals(isStudent ? undefined : selectedStudentId, false);
  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3500);
  };

  const createGoal = async (event) => {
    event.preventDefault();
    setWorking('create');
    try {
      const response = await api.createLearningGoal(form, token);
      if (response.error) setError(response.error);
      else {
        setForm(blankGoal);
        setShowCreate(false);
        showNotice('Goal added to your learning plan.');
        await refresh();
      }
    } catch {
      setError('Your goal could not be created.');
    } finally {
      setWorking('');
    }
  };

  const updateGoal = async (goalId, updates, successMessage) => {
    setWorking(`goal-${goalId}`);
    try {
      const response = await api.updateLearningGoal(goalId, updates, token);
      if (response.error) setError(response.error);
      else {
        setGoals((current) => current.map((goal) => goal.id === goalId ? response : goal));
        if (successMessage) showNotice(successMessage);
      }
    } catch {
      setError('That goal could not be updated.');
    } finally {
      setWorking('');
    }
  };

  const deleteGoal = async (goalId) => {
    if (!window.confirm('Delete this goal and all of its milestones?')) return;
    setWorking(`goal-${goalId}`);
    const response = await api.deleteLearningGoal(goalId, token);
    if (response.error) setError(response.error);
    else {
      setGoals((current) => current.filter((goal) => goal.id !== goalId));
      showNotice('Goal deleted.');
    }
    setWorking('');
  };

  const addMilestone = async (event, goalId) => {
    event.preventDefault();
    const title = (milestoneDrafts[goalId] || '').trim();
    if (!title) return;
    setWorking(`milestone-${goalId}`);
    const response = await api.addGoalMilestone(goalId, title, token);
    if (response.error) setError(response.error);
    else {
      setMilestoneDrafts((current) => ({ ...current, [goalId]: '' }));
      await refresh();
    }
    setWorking('');
  };

  const toggleMilestone = async (milestone) => {
    setWorking(`milestone-${milestone.id}`);
    const response = await api.updateGoalMilestone(milestone.id, { isCompleted: !milestone.is_completed }, token);
    if (response.error) setError(response.error);
    else setGoals((current) => current.map((goal) => goal.id === response.id ? response : goal));
    setWorking('');
  };

  const deleteMilestone = async (milestoneId) => {
    setWorking(`milestone-${milestoneId}`);
    const response = await api.deleteGoalMilestone(milestoneId, token);
    if (response.error) setError(response.error);
    else await refresh();
    setWorking('');
  };

  if (loading) return <LoadingState label="Opening learning progress..." />;
  if (error && !goals.length) return <ErrorState message={error} action={<button className="btn btn-primary" type="button" onClick={refresh}>Try again</button>} />;

  return (
    <AppShell>
      <main className="page progress-page">
        <section className="progress-hero">
          <div>
            <span className="eyebrow"><TrendingUp size={15} />Learning progress</span>
            <h1>{isStudent ? 'Make progress visible.' : 'See where each student is headed.'}</h1>
            <p>{isStudent
              ? 'Break a big goal into practical milestones and give your tutor a clear picture of what success means to you.'
              : 'Review the goals and milestones your connected students chose, so each session can start with useful context.'}</p>
          </div>
          {isStudent ? (
            <button className="btn btn-primary" type="button" onClick={() => setShowCreate((current) => !current)}>
              <Plus size={18} />{showCreate ? 'Close form' : 'Add a goal'}
            </button>
          ) : (
            <div className="field progress-student-picker">
              <label htmlFor="progress-student">Student</label>
              <select id="progress-student" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
                {students.map((connection) => <option key={connection.student_id} value={connection.student_id}>{connection.student_name}</option>)}
              </select>
            </div>
          )}
        </section>

        {notice ? <div className="alert dashboard-notice" role="status">{notice}</div> : null}
        {error ? <div className="alert alert-error" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss error">Dismiss</button></div> : null}

        {!isStudent && !students.length ? (
          <EmptyState icon={Users} title="No connected students yet">Once you accept a student request, you can review the goals they choose to share here.</EmptyState>
        ) : (
          <>
            {showCreate && isStudent ? (
              <section className="card card-pad progress-create-panel">
                <div className="section-head compact"><div><h2>Add a focused goal</h2><p>Keep it specific enough to recognize when you have made progress.</p></div></div>
                <form className="form-grid" onSubmit={createGoal}>
                  <div className="grid grid-2">
                    <div className="field"><label htmlFor="goal-subject">Subject</label><input id="goal-subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} placeholder="Calculus" maxLength={80} required /></div>
                    <div className="field"><label htmlFor="goal-date">Target date</label><input id="goal-date" type="date" value={form.targetDate} onChange={(event) => setForm({ ...form, targetDate: event.target.value })} /></div>
                  </div>
                  <div className="field"><label htmlFor="goal-title">What do you want to achieve?</label><input id="goal-title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Feel confident solving derivatives on my own" maxLength={160} required /></div>
                  <div className="field"><label htmlFor="goal-description">Why this matters or where you feel stuck</label><textarea id="goal-description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Give your tutor a little context." maxLength={1200} /></div>
                  <div className="button-row"><button className="btn btn-primary" type="submit" disabled={working === 'create'}><Plus size={18} />{working === 'create' ? 'Adding...' : 'Add goal'}</button><button className="btn btn-ghost" type="button" onClick={() => setShowCreate(false)}>Cancel</button></div>
                </form>
              </section>
            ) : null}

            <section className="progress-overview" aria-label="Progress overview">
              <div><span className="stat-icon"><Target size={20} /></span><strong>{goals.filter((goal) => goal.status !== 'completed').length}</strong><p>Current goals</p></div>
              <div><span className="stat-icon blue"><TrendingUp size={20} /></span><strong>{averageProgress}%</strong><p>Overall progress</p></div>
              <div><span className="stat-icon gold"><CheckCircle2 size={20} /></span><strong>{completedCount}</strong><p>Goals completed</p></div>
            </section>

            <div className="progress-toolbar">
              <div className="segmented" aria-label="Filter goals">
                {['current', 'completed', 'all'].map((option) => <button type="button" key={option} className={filter === option ? 'active' : ''} onClick={() => setFilter(option)}>{option[0].toUpperCase() + option.slice(1)}</button>)}
              </div>
              {!isStudent && student ? <div className="progress-viewing"><Avatar name={student.name} src={student.avatar_url} size={34} /><span>Viewing <strong>{student.name}</strong></span></div> : null}
            </div>

            {visibleGoals.length ? (
              <section className="progress-goal-grid">
                {visibleGoals.map((goal) => {
                  const isWorking = working === `goal-${goal.id}`;
                  return (
                    <article className={`card progress-goal-card status-${goal.status}`} key={goal.id}>
                      <header className="progress-goal-head">
                        <div><span className="badge badge-primary">{goal.subject}</span><h2>{goal.title}</h2></div>
                        {isStudent ? <button className="icon-button" type="button" onClick={() => deleteGoal(goal.id)} disabled={isWorking} aria-label={`Delete ${goal.title}`} title="Delete goal"><Trash2 size={17} /></button> : <span className={`badge ${goal.status === 'completed' ? 'badge-success' : goal.status === 'paused' ? 'badge-warning' : ''}`}>{goal.status}</span>}
                      </header>
                      {goal.description ? <p className="progress-goal-description">{goal.description}</p> : null}
                      <div className="progress-goal-meta"><span><CalendarDays size={15} />{targetDateLabel(goal.target_date)}</span><span><Flag size={15} />{goal.milestones.length} milestone{goal.milestones.length === 1 ? '' : 's'}</span></div>
                      <div className="progress-goal-meter"><div><strong>Progress</strong><b>{goal.progress_percent}%</b></div><div className="progress"><span style={{ width: `${goal.progress_percent}%` }} /></div></div>

                      {!goal.milestones.length && isStudent ? (
                        <div className="field progress-slider"><label htmlFor={`goal-progress-${goal.id}`}>Update progress</label><input id={`goal-progress-${goal.id}`} type="range" min="0" max="100" step="5" value={goal.progress_percent} disabled={isWorking} onChange={(event) => setGoals((current) => current.map((item) => item.id === goal.id ? { ...item, progress_percent: Number(event.target.value) } : item))} onPointerUp={(event) => updateGoal(goal.id, { progressPercent: Number(event.currentTarget.value) })} onKeyUp={(event) => updateGoal(goal.id, { progressPercent: Number(event.currentTarget.value) })} /></div>
                      ) : null}

                      <div className="progress-milestones">
                        <h3>Milestones</h3>
                        {goal.milestones.length ? goal.milestones.map((milestone) => (
                          <div className={`progress-milestone${milestone.is_completed ? ' complete' : ''}`} key={milestone.id}>
                            <button type="button" onClick={() => isStudent && toggleMilestone(milestone)} disabled={!isStudent || working === `milestone-${milestone.id}`} aria-label={`${milestone.is_completed ? 'Mark incomplete' : 'Complete'} ${milestone.title}`}>{milestone.is_completed ? <CheckCircle2 size={20} /> : <Circle size={20} />}</button>
                            <span>{milestone.title}</span>
                            {isStudent ? <button className="progress-milestone-delete" type="button" onClick={() => deleteMilestone(milestone.id)} aria-label={`Delete ${milestone.title}`} title="Delete milestone"><Trash2 size={15} /></button> : null}
                          </div>
                        )) : <p className="muted">{isStudent ? 'Add the first small step toward this goal.' : 'No milestones added yet.'}</p>}
                        {isStudent ? (
                          <form className="progress-milestone-form" onSubmit={(event) => addMilestone(event, goal.id)}>
                            <label className="sr-only" htmlFor={`milestone-${goal.id}`}>New milestone</label>
                            <input id={`milestone-${goal.id}`} value={milestoneDrafts[goal.id] || ''} onChange={(event) => setMilestoneDrafts((current) => ({ ...current, [goal.id]: event.target.value }))} placeholder="Add a small next step" maxLength={160} />
                            <button className="icon-button" type="submit" disabled={working === `milestone-${goal.id}` || !milestoneDrafts[goal.id]?.trim()} aria-label="Add milestone" title="Add milestone"><Plus size={18} /></button>
                          </form>
                        ) : null}
                      </div>

                      {isStudent ? (
                        <footer className="progress-goal-actions">
                          {goal.status !== 'completed' ? <button className="btn btn-ghost btn-sm" type="button" onClick={() => updateGoal(goal.id, { status: goal.status === 'paused' ? 'active' : 'paused' }, goal.status === 'paused' ? 'Goal resumed.' : 'Goal paused.')} disabled={isWorking}>{goal.status === 'paused' ? <><Play size={16} />Resume</> : <><Pause size={16} />Pause</>}</button> : null}
                          {goal.status === 'completed' ? <button className="btn btn-ghost btn-sm" type="button" onClick={() => updateGoal(goal.id, { status: 'active', progressPercent: Math.min(95, goal.progress_percent) }, 'Goal reopened.')} disabled={isWorking}><Play size={16} />Reopen</button> : <button className="btn btn-primary btn-sm" type="button" onClick={() => updateGoal(goal.id, { status: 'completed', progressPercent: 100 }, 'Goal completed. Nice work.')} disabled={isWorking}><Check size={16} />Mark complete</button>}
                        </footer>
                      ) : null}
                    </article>
                  );
                })}
              </section>
            ) : (
              <EmptyState icon={BookOpenCheck} title={filter === 'completed' ? 'No completed goals yet' : 'No learning goals here'} action={isStudent && filter !== 'completed' ? <button className="btn btn-primary" type="button" onClick={() => setShowCreate(true)}><Plus size={18} />Add your first goal</button> : null}>{isStudent ? 'Start with one outcome that would make school feel more manageable.' : 'This student has not added goals in this view yet.'}</EmptyState>
            )}
          </>
        )}
      </main>
    </AppShell>
  );
};

export default LearningProgress;
