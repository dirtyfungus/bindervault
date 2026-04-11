import { useState, useRef, useEffect } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, LogOut, CheckCheck } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useNotificationSocket } from '../../hooks/useNotificationSocket'
import api from '../../lib/api'
import styles from './AppShell.module.css'
import { formatDistanceToNow } from 'date-fns'

export default function AppShell() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  useNotificationSocket()

  const [showNotifs, setShowNotifs] = useState(false)
  const dropdownRef = useRef(null)

  const { data: notifs } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get('/notifications/?unread_only=true').then(r => r.data),
    refetchInterval: 30_000,
  })

  const { data: allNotifs } = useQuery({
    queryKey: ['notifications', 'all'],
    queryFn: () => api.get('/notifications/').then(r => r.data),
    enabled: showNotifs,
  })

  const markAllRead = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  const markOneRead = useMutation({
    mutationFn: (id) => api.post(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] })
    },
  })

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowNotifs(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleBellClick = () => {
    setShowNotifs(v => !v)
    if (!showNotifs && notifs?.length > 0) {
      markAllRead.mutate()
    }
  }

  const handleNotifClick = (notif) => {
    if (!notif.is_read) markOneRead.mutate(notif.id)
    setShowNotifs(false)
    if (notif.reference_type === 'trade_offer' && notif.reference_id) {
      navigate(`/trades/${notif.reference_id}`)
    }
  }

  const unreadCount = notifs?.length || 0
  const initials = user?.display_name?.slice(0, 2).toUpperCase() || 'BV'

  return (
    <div className={styles.shell}>
      <nav className={styles.topNav}>
        <div className={styles.logo}>
          <div className={styles.logoMark} />
          <span className={styles.logoText}>Binder<span>Vault</span></span>
        </div>

        <div className={styles.navLinks}>
          <NavLink to="/binder" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
            My Binder
          </NavLink>
          <NavLink to="/discover" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
            Discover
          </NavLink>
          <NavLink to="/trades" className={({ isActive }) => `${styles.navLink} ${isActive ? styles.active : ''}`}>
            Trades
          </NavLink>
        </div>

        <div className={styles.navRight}>
          {/* Notification bell with dropdown */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              className={styles.notifBtn}
              onClick={handleBellClick}
              title="Notifications"
            >
              <Bell size={14} color={unreadCount > 0 ? 'var(--teal)' : 'var(--grey)'} />
              {unreadCount > 0 && (
                <span className={styles.notifDot}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>

            {showNotifs && (
              <div style={dropdown}>
                <div style={dropdownHeader}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)' }}>Notifications</span>
                  {allNotifs?.some(n => !n.is_read) && (
                    <button
                      style={markAllBtn}
                      onClick={() => markAllRead.mutate()}
                    >
                      <CheckCheck size={12} /> Mark all read
                    </button>
                  )}
                </div>

                <div style={dropdownList}>
                  {!allNotifs?.length && (
                    <div style={emptyNotif}>No notifications</div>
                  )}
                  {allNotifs?.map(notif => (
                    <button
                      key={notif.id}
                      style={{
                        ...notifItem,
                        background: notif.is_read ? 'transparent' : 'var(--teal-dim)',
                      }}
                      onClick={() => handleNotifClick(notif)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <span style={{ fontSize: 13, color: 'var(--white)', fontWeight: notif.is_read ? 400 : 600 }}>
                          {notif.title}
                        </span>
                        {!notif.is_read && <span style={unreadDot} />}
                      </div>
                      {notif.body && (
                        <div style={{ fontSize: 12, color: 'var(--grey)', marginTop: 2 }}>{notif.body}</div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--grey)', marginTop: 4 }}>
                        {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true })}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={styles.userChip}>
            <div
              className={styles.avatar}
              style={{ background: user?.avatar_color || 'var(--teal-dim)' }}
            >
              {initials}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{user?.display_name || user?.username}</span>
              <span className={styles.userHandle}>#{user?.discriminator}</span>
            </div>
            <button onClick={() => { logout(); navigate('/login') }} className={styles.logoutBtn} title="Log out">
              <LogOut size={13} />
            </button>
          </div>
        </div>
      </nav>

      <main className={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

const dropdown = {
  position: 'absolute',
  top: 'calc(100% + 8px)',
  right: 0,
  width: 320,
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  zIndex: 1000,
  overflow: 'hidden',
}
const dropdownHeader = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '12px 16px',
  borderBottom: '1px solid var(--border)',
}
const dropdownList = {
  maxHeight: 360,
  overflowY: 'auto',
}
const notifItem = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '12px 16px',
  cursor: 'pointer',
  border: 'none',
  borderBottom: '1px solid var(--border)',
  transition: 'background 0.15s',
}
const emptyNotif = {
  padding: '24px 16px',
  textAlign: 'center',
  fontSize: 13,
  color: 'var(--grey)',
}
const markAllBtn = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  color: 'var(--teal)',
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  padding: 0,
}
const unreadDot = {
  width: 7,
  height: 7,
  borderRadius: '50%',
  background: 'var(--teal)',
  flexShrink: 0,
  marginTop: 3,
}