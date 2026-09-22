import React, { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  GraduationCap,
  Home,
  Inbox,
  LogOut,
  MessageCircle,
  MailCheck,
  Menu,
  Search,
  ShieldCheck,
  Settings,
  UserRoundCheck,
  ClipboardCheck,
  Target,
  WalletCards,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import NotificationBell from './NotificationBell';
import { getApiAssetUrl, initials } from '../utils/format';
import api from '../services/api';

export const Avatar = ({ name, src, size = 38 }) => (
  <span className="avatar" style={{ width: size, height: size }}>
    {src ? <img src={getApiAssetUrl(src)} alt={name || 'Profile'} /> : initials(name)}
  </span>
);

const studentNavItems = [
  { to: '/dashboard', label: 'Home', icon: Home },
  { to: '/intake', label: 'My needs', icon: ClipboardCheck },
  { to: '/tutors', label: 'Find tutors', icon: Search },
  { to: '/messages', label: 'Messages', icon: MessageCircle },
  { to: '/sessions', label: 'Calendar', icon: CalendarDays },
  { to: '/payments', label: 'Payments', icon: WalletCards },
  { to: '/progress', label: 'My progress', icon: Target },
  { to: '/profile', label: 'Profile', icon: Settings },
];

const tutorNavItems = [
  { to: '/dashboard', label: 'Home', icon: Home },
  { to: '/requests', label: 'Requests', icon: Inbox },
  { to: '/messages', label: 'Students', icon: UserRoundCheck },
  { to: '/progress', label: 'Progress', icon: Target },
  { to: '/sessions', label: 'Calendar', icon: CalendarDays },
  { to: '/payments', label: 'Earnings', icon: WalletCards },
  { to: '/profile?tab=availability', label: 'Availability', icon: CalendarClock },
  { to: '/profile', label: 'Profile', icon: Settings, end: true },
];

const isAdminUser = (user) => {
  if (user?.isAdmin) return true;
  const adminEmails = (import.meta.env.VITE_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  return adminEmails.includes(String(user?.email || '').toLowerCase());
};

const AppShell = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [verificationMessage, setVerificationMessage] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navItems = [...(user?.role === 'tutor' ? tutorNavItems : studentNavItems)];
  const mobilePrimaryItems = user?.role === 'tutor'
    ? tutorNavItems.filter(({ to }) => ['/dashboard', '/requests', '/messages', '/sessions'].includes(to))
    : studentNavItems.filter(({ to }) => ['/dashboard', '/tutors', '/messages', '/sessions'].includes(to));

  if (isAdminUser(user)) {
    navItems.push({ to: '/admin', label: 'Admin', icon: ShieldCheck });
  }
  const mobileSecondaryItems = navItems.filter(({ to }) => !mobilePrimaryItems.some((item) => item.to === to));

  const handleLogout = () => {
    setMobileMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
  };

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileMenuOpen]);

  const resendVerification = async () => {
    const response = await api.resendVerification(user.email);
    setVerificationMessage(response.error || response.message || 'Verification email queued.');
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
            {navItems.map(({ to, label, icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  className={({ isActive }) => {
                    const targetsAvailability = to.includes('tab=availability');
                    const isAvailability = location.pathname === '/profile' && location.search.includes('tab=availability');
                    const active = targetsAvailability ? isAvailability : isActive && !(to === '/profile' && isAvailability);
                    return `nav-link${active ? ' active' : ''}`;
                  }}
                >
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
              <span>Log out</span>
            </button>
          </div>
        </div>
      </header>
      {user?.emailVerified === false ? (
        <div className="alert" style={{ margin: '12px auto 0', maxWidth: 1180 }}>
          <MailCheck size={18} />
          <span>{verificationMessage || 'Verify your email to unlock messaging and session requests.'}</span>
          <button className="btn btn-ghost btn-sm" type="button" onClick={resendVerification}>Resend email</button>
        </div>
      ) : null}
      {children}
      {mobileMenuOpen ? (
        <div className="mobile-menu-layer">
          <button className="mobile-menu-backdrop" type="button" aria-label="Close navigation menu" onClick={() => setMobileMenuOpen(false)} />
          <section className="mobile-menu-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-menu-title">
            <div className="mobile-menu-head">
              <div><span className="eyebrow">Your workspace</span><h2 id="mobile-menu-title">More</h2></div>
              <button className="icon-button" type="button" aria-label="Close navigation menu" onClick={() => setMobileMenuOpen(false)}><X size={20} /></button>
            </div>
            <div className="mobile-menu-grid">
              {mobileSecondaryItems.map(({ to, label, icon }) => (
                <NavLink key={to} to={to} className="mobile-menu-link">
                  {React.createElement(icon, { size: 20 })}<span>{label}</span>
                </NavLink>
              ))}
              <button className="mobile-menu-link mobile-menu-logout" type="button" onClick={handleLogout}>
                <LogOut size={20} /><span>Log out</span>
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <nav className="mobile-tabbar" aria-label="Mobile navigation">
        {mobilePrimaryItems.map(({ to, label, icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => `mobile-tab${isActive ? ' active' : ''}`}>
            {React.createElement(icon, { size: 21 })}<span>{label === 'Find tutors' ? 'Tutors' : label === 'Students' ? 'Messages' : label}</span>
          </NavLink>
        ))}
        <button className={`mobile-tab${mobileMenuOpen ? ' active' : ''}`} type="button" aria-expanded={mobileMenuOpen} aria-label="More navigation options" onClick={() => setMobileMenuOpen((open) => !open)}>
          <Menu size={21} /><span>More</span>
        </button>
      </nav>
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
