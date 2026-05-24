import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  GraduationCap,
  Home,
  Inbox,
  LogOut,
  MessageCircle,
  Search,
  ShieldCheck,
  Settings,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { getApiAssetUrl, initials } from '../utils/format';

export const Avatar = ({ name, src, size = 38 }) => (
  <span className="avatar" style={{ width: size, height: size }}>
    {src ? <img src={getApiAssetUrl(src)} alt={name || 'Profile'} /> : initials(name)}
  </span>
);

const navItems = [
  { to: '/dashboard', label: 'Home', icon: Home },
  { to: '/tutors', label: 'Tutors', icon: Search },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/sessions', label: 'Sessions', icon: CalendarDays },
  { to: '/requests', label: 'Requests', icon: Inbox, tutorsOnly: true },
  { to: '/admin', label: 'Admin', icon: ShieldCheck, adminOnly: true },
  { to: '/profile', label: 'Profile', icon: Settings },
];

const isAdminUser = (user) => {
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(String(user?.email || '').toLowerCase());
};

const AppShell = ({ children }) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link to="/dashboard" className="brand-link" aria-label="NextDoorLearn dashboard">
            <span className="brand-mark">
              <BookOpen size={22} strokeWidth={2.4} />
            </span>
            <span>NextDoorLearn</span>
          </Link>

          <nav className="nav-links" aria-label="Main navigation">
            {navItems
              .filter((item) => !item.tutorsOnly || user?.role === 'tutor')
              .filter((item) => !item.adminOnly || isAdminUser(user))
              .map(({ to, label, icon }) => (
                <NavLink key={to} to={to} className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                  {React.createElement(icon, { size: 17 })}
                  {label}
                </NavLink>
              ))}
          </nav>

          <div className="topbar-actions">
            <NotificationBell />
            <div className="user-pill">
              <Avatar name={user?.name} src={user?.avatar_url} />
              <div>
                <strong style={{ display: 'block', fontSize: '0.86rem' }}>{user?.name?.split(' ')[0] || 'User'}</strong>
                <span className="muted" style={{ fontSize: '0.74rem', textTransform: 'capitalize' }}>
                  {user?.role || 'member'}
                </span>
              </div>
            </div>
            <button className="btn btn-ghost btn-sm" type="button" onClick={handleLogout} aria-label="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
};

export const LoadingState = ({ label = 'Loading...' }) => (
  <div className="loading-wrap">
    <div>
      <div className="spinner" />
      <p className="muted">{label}</p>
    </div>
  </div>
);

export const EmptyState = ({ icon = GraduationCap, title, children, action }) => (
  <div className="card empty-state">
    <span className="empty-icon">
      {React.createElement(icon, { size: 25 })}
    </span>
    <h2>{title}</h2>
    {children ? <p>{children}</p> : null}
    {action ? <div style={{ marginTop: 18 }}>{action}</div> : null}
  </div>
);

export const ErrorState = ({ title = 'Something went wrong', message, action }) => (
  <div className="loading-wrap">
    <div className="card card-pad" style={{ maxWidth: 520 }}>
      <div className="alert alert-error">
        <strong>{title}</strong>
      </div>
      <p className="page-copy">{message}</p>
      {action ? <div style={{ marginTop: 18 }}>{action}</div> : null}
    </div>
  </div>
);

export default AppShell;
