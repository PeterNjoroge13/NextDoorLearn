import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AppShell, { ErrorState, LoadingState } from '../components/AppShell';
import useDashboardData from '../hooks/useDashboardData';
import StudentDashboard from './StudentDashboard';
import TutorDashboard from './TutorDashboard';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, refetch, updateRequest } = useDashboardData(user?.role);

  const handleSignInAgain = () => {
    logout();
    navigate('/login', { replace: true });
  };

  if (loading) return <LoadingState label={`Preparing your ${user?.role || ''} workspace...`} />;
  if (error) {
    return (
      <ErrorState
        message={error}
        action={(
          <div className="button-row">
            <button className="btn btn-primary" type="button" onClick={refetch}>Try again</button>
            <button className="btn btn-ghost" type="button" onClick={handleSignInAgain}>Sign in again</button>
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
