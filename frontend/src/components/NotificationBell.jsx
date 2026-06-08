import { Bell, CheckCheck, ExternalLink } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../api/client';
import { formatDate } from '../utils/format';

function playNotificationTone() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 820;
    gain.gain.setValueAtTime(0.001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.2);
  } catch {
    // Browsers may block audio until the user interacts with the page.
  }
}

export default function NotificationBell({ role }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState('');
  const lastUnreadCount = useRef(null);
  const soundReady = useRef(false);
  const wrapRef = useRef(null);

  const loadNotifications = useCallback(async () => {
    try {
      const data = await apiRequest('/notifications?limit=20', { authRole: role });
      if (
        lastUnreadCount.current !== null &&
        data.unread_count > lastUnreadCount.current &&
        soundReady.current
      ) {
        playNotificationTone();
      }
      lastUnreadCount.current = data.unread_count;
      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [role]);

  useEffect(() => {
    const enableSound = () => {
      soundReady.current = true;
    };
    window.addEventListener('pointerdown', enableSound, { once: true });
    window.addEventListener('keydown', enableSound, { once: true });
    return () => {
      window.removeEventListener('pointerdown', enableSound);
      window.removeEventListener('keydown', enableSound);
    };
  }, []);

  useEffect(() => {
    loadNotifications();
    const intervalId = window.setInterval(loadNotifications, 10000);
    const handleFocus = () => loadNotifications();
    const handleVisibility = () => {
      if (!document.hidden) loadNotifications();
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  async function markOneRead(notification) {
    if (!notification.read_at) {
      await apiRequest(`/notifications/${notification.id}/read`, {
        method: 'PATCH',
        authRole: role
      });
      setNotifications((items) =>
        items.map((item) =>
          item.id === notification.id ? { ...item, read_at: new Date().toISOString() } : item
        )
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      lastUnreadCount.current = Math.max(0, (lastUnreadCount.current || 0) - 1);
    }
  }

  async function openNotification(notification) {
    await markOneRead(notification);
    setOpen(false);
    if (notification.link_path) {
      navigate(notification.link_path);
    }
  }

  async function markAllRead() {
    await apiRequest('/notifications/read-all', {
      method: 'PATCH',
      authRole: role
    });
    setNotifications((items) =>
      items.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() }))
    );
    setUnreadCount(0);
    lastUnreadCount.current = 0;
  }

  return (
    <div className="notification-wrap" ref={wrapRef}>
      <button
        className={`notification-trigger ${unreadCount > 0 ? 'has-unread' : ''}`}
        type="button"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={20} aria-hidden="true" />
        {unreadCount > 0 ? <span className="notification-count">{unreadCount}</span> : null}
      </button>

      {open ? (
        <div className="notification-panel" role="dialog" aria-label="Notifications">
          <div className="notification-panel-header">
            <div>
              <strong>Notifications</strong>
              <span>{unreadCount} unread</span>
            </div>
            <button className="ghost-button small-icon" type="button" onClick={markAllRead}>
              <CheckCheck size={17} aria-hidden="true" />
              Mark read
            </button>
          </div>

          {error ? <div className="notification-error">{error}</div> : null}
          {!notifications.length && !error ? (
            <div className="notification-empty">No notifications yet.</div>
          ) : null}

          <div className="notification-list">
            {notifications.map((notification) => (
              <button
                key={notification.id}
                className={`notification-item ${notification.read_at ? '' : 'unread'}`}
                type="button"
                onClick={() => openNotification(notification)}
              >
                <span>
                  <strong>{notification.title}</strong>
                  <small>{notification.message}</small>
                  <em>{formatDate(notification.created_at)}</em>
                </span>
                {notification.link_path ? <ExternalLink size={16} aria-hidden="true" /> : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
