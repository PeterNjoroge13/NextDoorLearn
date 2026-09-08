import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppShell, { ErrorState, LoadingState } from '../components/AppShell';
import useDashboardData from '../hooks/useDashboardData';
import StudentDashboard from './StudentDashboard';
import TutorDashboard from './TutorDashboard';

const Dashboard = () => {
  const { user } = useAuth();
  const { data, loading, error, refetch, updateRequest } = useDashboardData(user?.role);

  if (loading) return <LoadingState label={`Preparing your ${user?.role || ''} workspace...`} />;
  if (error) {
    return (
      <ErrorState
        message={error}
        action={(
          <div className="button-row">
            <button className="btn btn-primary" type="button" onClick={refetch}>Try again</button>
            <Link className="btn btn-ghost" to="/login">Sign in again</Link>
          </div>
        )}
      />
    );
  }

  return (
    <AppShell>
      {user?.role === 'tutor'
        ? <TutorDashboard user={user} data={data} updateRequest={updateRequest} />
        : <StudentDashboard user={user} data={data} />}
    </AppShell>
  );
};

export default Dashboard;
