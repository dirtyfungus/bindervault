import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Bell, Grid, ArrowLeftRight, Compass, LogOut, BookOpen, Heart } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useNotificationSocket } from '../../hooks/useNotificationSocket'
import api from '../../lib/api'
import styles from './AppShell.module.css'

export default function AppShell() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  useNotificationSocket()

  const { data: notifs } = useQuery({
    queryKey: ['notifications', 'unread'],
    queryFn: () => api.get('/notifications/?unread_only=true').then(r => r.data),
    refetchInterval: 30_000,
  })

  const unreadCount = notifs?.length || 0

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

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
          <NavLink to="/trades" className={styles.notifBtn} title="Notifications">
            <Bell size={14} color="var(--grey)" />
            {unreadCount > 0 && <span className={styles.notifDot}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </NavLink>
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
            <button onClick={handleLogout} className={styles.logoutBtn} title="Log out">
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
