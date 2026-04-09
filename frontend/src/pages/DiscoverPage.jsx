import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Search, Star, MapPin } from 'lucide-react'
import api from '../lib/api'
import styles from './DiscoverPage.module.css'

function UserCard({ user }) {
  const navigate = useNavigate()
  const initials = user.display_name?.slice(0, 2).toUpperCase() || '??'

  return (
    <div className={styles.userCard} onClick={() => navigate(`/binder/${user.id}`)}>
      <div className={styles.userAvatar} style={{ background: user.avatar_color || 'var(--teal-dim)' }}>
        {initials}
      </div>
      <div className={styles.userInfo}>
        <div className={styles.userName}>{user.display_name || user.username}</div>
        <div className={styles.userHandle}>{user.handle}</div>
        {user.location && (
          <div className={styles.userLocation}>
            <MapPin size={10} /> {user.location}
          </div>
        )}
      </div>
      <div className={styles.userStats}>
        <div className={styles.userStat}>
          <span className={styles.statNum}>{user.trade_count}</span>
          <span className={styles.statLbl}>trades</span>
        </div>
        <div className={styles.userStat}>
          <Star size={10} style={{ color: 'var(--rare)' }} />
          <span className={styles.statNum}>{user.rating?.toFixed(1)}</span>
        </div>
      </div>
    </div>
  )
}

export default function DiscoverPage() {
  const [q, setQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')

  const handleChange = (e) => {
    setQ(e.target.value)
    clearTimeout(window._discoverTimer)
    window._discoverTimer = setTimeout(() => setDebouncedQ(e.target.value), 350)
  }

  const { data: users = [], isFetching } = useQuery({
    queryKey: ['users-search', debouncedQ],
    queryFn: () => api.get(`/users/search?q=${encodeURIComponent(debouncedQ)}`).then(r => r.data),
    enabled: debouncedQ.length >= 1,
    staleTime: 30_000,
  })

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Discover traders</h1>
        <p className={styles.subtitle}>Find other players, browse their binders, and make trade offers.</p>

        <div className={styles.searchBox}>
          <Search size={15} color="var(--grey)" />
          <input
            className={styles.searchInput}
            placeholder="Search by username…"
            value={q}
            onChange={handleChange}
            autoFocus
          />
        </div>
      </div>

      <div className={styles.content}>
        {debouncedQ.length === 0 && (
          <div className={styles.hint}>
            Search for a username to find traders near you or in your local Commander playgroup.
          </div>
        )}

        {isFetching && <div className={styles.loading}>Searching…</div>}

        {!isFetching && debouncedQ.length > 0 && users.length === 0 && (
          <div className={styles.empty}>No traders found for "{debouncedQ}"</div>
        )}

        {users.length > 0 && (
          <div className={styles.grid}>
            {users.map(u => <UserCard key={u.id} user={u} />)}
          </div>
        )}
      </div>
    </div>
  )
}
