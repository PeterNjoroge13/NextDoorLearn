import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Landing from './pages/Landing';
import Login from './pages/Login';

const Admin = lazy(() => import('./pages/Admin'));
const AuthUtilityPage = lazy(() => import('./pages/AuthUtilityPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Donate = lazy(() => import('./pages/Donate'));
const LearningProgress = lazy(() => import('./pages/LearningProgress'));
const LegalPage = lazy(() => import('./pages/LegalPage'));
const Messages = lazy(() => import('./pages/Messages'));
const Payments = lazy(() => import('./pages/Payments'));
const Profile = lazy(() => import('./pages/Profile'));
const PublicTutorProfile = lazy(() => import('./pages/PublicTutorProfile'));
const Requests = lazy(() => import('./pages/Requests'));
const Sessions = lazy(() => import('./pages/Sessions'));
const StudentIntake = lazy(() => import('./pages/StudentIntake'));
const TutorActivation = lazy(() => import('./pages/TutorActivation'));
const TutorApplication = lazy(() => import('./pages/TutorApplication'));
const TutorBrowse = lazy(() => import('./pages/TutorBrowse'));
const TutorProfile = lazy(() => import('./pages/TutorProfile'));

const LoadingScreen = () => (
  <div className="loading-wrap">
    <div>
      <div className="spinner" />
      <p className="muted">Loading NextDoorLearn...</p>
    </div>
  </div>
);

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  return user ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { loading } = useAuth();
  
  if (loading) {
    return <LoadingScreen />;
  }
  
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="app-root">
          <a className="skip-link" href="#main-content">Skip to main content</a>
          <div id="main-content" tabIndex="-1">
          <Suspense fallback={<LoadingScreen />}>
            <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/apply/tutor" element={<TutorApplication />} />
            <Route path="/activate-tutor" element={<TutorActivation />} />
            <Route path="/donate" element={<Donate />} />
            <Route path="/community/tutors/:tutorId" element={<PublicTutorProfile />} />
            <Route 
              path="/login" 
              element={
                <PublicRoute>
                  <Login initialMode="login" />
                </PublicRoute>
              } 
            />
            <Route
              path="/signup"
              element={
                <PublicRoute>
                  <Login initialMode="signup" />
                </PublicRoute>
              }
            />
            <Route 
              path="/dashboard" 
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/tutors" 
              element={
                <ProtectedRoute>
                  <TutorBrowse />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/intake"
              element={
                <ProtectedRoute>
                  <StudentIntake />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tutors/:tutorId"
              element={
                <ProtectedRoute>
                  <TutorProfile />
                </ProtectedRoute>
              }
            />
            <Route 
              path="/profile" 
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <Profile />
                  </ErrorBoundary>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/messages" 
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/requests" 
              element={
                <ProtectedRoute>
                  <Requests />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/sessions" 
              element={
                <ProtectedRoute>
                  <Sessions />
                </ProtectedRoute>
              } 
            />
            <Route
              path="/payments"
              element={<ProtectedRoute><Payments /></ProtectedRoute>}
            />
            <Route
              path="/progress"
              element={
                <ProtectedRoute>
                  <LearningProgress />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route path="/privacy" element={<LegalPage type="/privacy" />} />
            <Route path="/terms" element={<LegalPage type="/terms" />} />
            <Route path="/guidelines" element={<LegalPage type="/guidelines" />} />
            <Route path="/support" element={<LegalPage type="/support" />} />
            <Route path="/delete-account" element={<LegalPage type="/delete-account" />} />
            <Route path="/forgot-password" element={<AuthUtilityPage mode="forgot" />} />
            <Route path="/reset-password" element={<AuthUtilityPage mode="reset" />} />
            <Route path="/verify-email" element={<AuthUtilityPage mode="verify" />} />
            <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
          </div>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
