import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Filter, Star, MapPin } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import api from '../lib/api'
import CardItem from '../components/binder/CardItem'
import AddCardModal from '../components/binder/AddCardModal'
import toast from 'react-hot-toast'
import styles from './BinderPage.module.css'

const RARITIES = ['', 'mythic', 'rare', 'uncommon', 'common']
const RARITY_LABELS = { '': 'All', mythic: 'Mythic', rare: 'Rare', uncommon: 'Uncommon', common: 'Common' }

export default function BinderPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [rarity, setRarity] = useState('')
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['binder', 'mine', search, rarity, page],
    queryFn: () => api.get('/binder/', {
      params: { search: search || undefined, rarity: rarity || undefined, page, per_page: 24 }
    }).then(r => r.data),
    keepPreviousData: true,
  })

  const { data: profileData } = useQuery({
    queryKey: ['user', user?.id],
    queryFn: () => api.get(`/users/${user?.id}`).then(r => r.data),
    enabled: !!user?.id,
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/binder/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['binder'] })
      toast.success('Card removed')
    },
  })

  const handleSearchChange = (e) => {
    setSearch(e.target.value)
    setPage(1)
  }

  const handleRarity = (r) => {
    setRarity(r)
    setPage(1)
  }

  const initials = user?.display_name?.slice(0, 2).toUpperCase() || '??'

  return (
    <div className={styles.page}>
      {/* Profile header */}
      <div className={styles.profileHeader}>
        <div className={styles.profileTop}>
          <div className={styles.avatar} style={{ background: user?.avatar_color || 'var(--teal-dim)' }}>
            {initials}
          </div>
          <div className={styles.profileInfo}>
            <div className={styles.profileName}>
              {user?.display_name || user?.username}
              <span className={styles.discriminator}>#{user?.discriminator}</span>
              {user?.is_verified && <span className="badge badge-teal">✓ verified</span>}
            </div>
            {user?.location && (
              <div className={styles.profileLocation}>
                <MapPin size={11} /> {user.location}
              </div>
            )}
            <div className={styles.profileStats}>
              <div className={styles.stat}>
                <span className={styles.statNum}>{profileData?.binder_count ?? '—'}</span>
                <span className={styles.statLbl}>cards listed</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNum}>{user?.trade_count ?? 0}</span>
                <span className={styles.statLbl}>trades done</span>
              </div>
              <div className={styles.stat}>
                <Star size={12} style={{ color: 'var(--rare)', marginRight: 2 }} />
                <span className={styles.statNum}>{user?.rating?.toFixed(1)}</span>
                <span className={styles.statLbl}>rating</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNum}>{profileData?.follower_count ?? 0}</span>
                <span className={styles.statLbl}>followers</span>
              </div>
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add cards
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <Search size={13} color="var(--grey)" />
          <input
            className={styles.searchInput}
            placeholder="Search your binder…"
            value={search}
            onChange={handleSearchChange}
          />
        </div>
        <div className={styles.rarityFilters}>
          {RARITIES.map(r => (
            <button
              key={r}
              className={`${styles.rarityBtn} ${rarity === r ? styles.rarityActive : ''}`}
              onClick={() => handleRarity(r)}
            >
              {RARITY_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className={styles.gridWrap}>
        {isLoading ? (
          <div className={styles.loading}>Loading binder…</div>
        ) : data?.items?.length === 0 ? (
          <div className={styles.empty}>
            <p>Your binder is empty.</p>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Add your first card
            </button>
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {data.items.map(entry => (
                <CardItem
                  key={entry.id}
                  entry={entry}
                  isOwner={true}
                  onDelete={(e) => {
                    if (confirm(`Remove ${e.card_name} from binder?`)) deleteMutation.mutate(e.id)
                  }}
                />
              ))}
            </div>
            {/* Pagination */}
            {data.pages > 1 && (
              <div className={styles.pagination}>
                {Array.from({ length: data.pages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ''}`}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showAdd && <AddCardModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}
