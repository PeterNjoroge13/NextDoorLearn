import React, { useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import api from '../services/api';

const NotificationBell = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  const fetchUnreadCount = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const response = await api.getUnreadCount(token);
    if (!response.error) setUnreadCount(response.count || 0);
  };

  const fetchNotifications = async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    const response = await api.getNotifications(token, 20);
    if (!response.error) {
      setNotifications(response.notifications || []);
      setUnreadCount(response.unreadCount || 0);
    }
  };

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBellClick = async () => {
    if (!isOpen) {
      setLoading(true);
      await fetchNotifications();
      setLoading(false);
    }
    setIsOpen((current) => !current);
  };

  const handleMarkAllRead = async () => {
    const token = localStorage.getItem('token');
    await api.markAllNotificationsRead(token);
    setNotifications((current) => current.map((notification) => ({ ...notification, is_read: 1 })));
    setUnreadCount(0);
  };

  const handleNotificationClick = async (notification) => {
    const token = localStorage.getItem('token');
    if (!notification.is_read) {
      await api.markNotificationRead(notification.id, token);
      setUnreadCount((current) => Math.max(0, current - 1));
    }
    if (notification.link) window.location.href = notification.link;
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button className="btn btn-ghost btn-sm" type="button" onClick={handleBellClick} aria-label="Notifications">
        <Bell size={17} />
        {unreadCount > 0 ? <span className="badge badge-error">{unreadCount > 99 ? '99+' : unreadCount}</span> : null}
      </button>

      {isOpen ? (
        <div className="card" style={{ position: 'absolute', top: 46, right: 0, zIndex: 40, width: 360, maxWidth: 'calc(100vw - 28px)', overflow: 'hidden' }}>
          <div className="list-item" style={{ borderRadius: 0, borderTop: 0, borderLeft: 0, borderRight: 0 }}>
            <strong>Notifications</strong>
            {unreadCount > 0 ? (
              <button className="btn btn-ghost btn-sm" type="button" onClick={handleMarkAllRead}>
                <CheckCheck size={15} />
                Read all
              </button>
            ) : null}
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {loading ? (
              <div className="empty-state"><div className="spinner" /></div>
            ) : notifications.length === 0 ? (
              <div className="empty-state">
                <p>No notifications yet.</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className="conversation-button"
                  onClick={() => handleNotificationClick(notification)}
                  style={{ background: notification.is_read ? 'transparent' : 'var(--brand-soft)' }}
                >
                  <span className="stat-icon"><Bell size={16} /></span>
                  <span>
                    <strong>{notification.title}</strong>
                    <span className="muted" style={{ display: 'block', fontSize: '0.84rem' }}>{notification.message}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default NotificationBell;
