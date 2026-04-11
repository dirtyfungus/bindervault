import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Star, MapPin, Trash2 } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import api from '../lib/api'
import CardItem from '../components/binder/CardItem'
import AddCardModal from '../components/binder/AddCardModal'
import toast from 'react-hot-toast'
import styles from './BinderPage.module.css'

const RARITIES = ['', 'mythic', 'rare', 'uncommon', 'common']
const RARITY_LABELS = { '': 'All', mythic: 'Mythic', rare: 'Rare', uncommon: 'Uncommon', common: 'Common' }
const CONDITION_LABELS = { M: 'Mint', NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played', HP: 'Heavily Played', D: 'Damaged' }

export default function BinderPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [rarity, setRarity] = useState('')
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [activeTab, setActiveTab] = useState('binder') // 'binder' | 'wishlist'

  const { data, isLoading } = useQuery({
    queryKey: ['binder', 'mine', search, rarity, page],
    queryFn: () => api.get('/binder/', {
      params: { search: search || undefined, rarity: rarity || undefined, page, per_page: 24 }
    }).then(r => r.data),
    keepPreviousData: true,
    enabled: activeTab === 'binder',
  })

  const { data: profileData } = useQuery({
    queryKey: ['user', user?.id],
    queryFn: () => api.get(`/users/${user?.id}`).then(r => r.data),
    enabled: !!user?.id,
  })

  const { data: wants = [], isLoading: wantsLoading } = useQuery({
    queryKey: ['wants'],
    queryFn: () => api.get('/binder/wants').then(r => r.data),
    enabled: activeTab === 'wishlist',
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/binder/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['binder'] })
      toast.success('Card removed')
    },
  })

  const deleteWantMutation = useMutation({
    mutationFn: (id) => api.delete(`/binder/wants/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wants'] })
      toast.success('Removed from wishlist')
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

      {/* Tabs */}
      <div style={tabRow}>
        <button
          style={{ ...tab, ...(activeTab === 'binder' ? tabActive : {}) }}
          onClick={() => setActiveTab('binder')}
        >
          My Binder
          {data?.total != null && (
            <span style={tabCount}>{data.total}</span>
          )}
        </button>
        <button
          style={{ ...tab, ...(activeTab === 'wishlist' ? tabActive : {}) }}
          onClick={() => setActiveTab('wishlist')}
        >
          ⭐ Wishlist
          {wants.length > 0 && (
            <span style={tabCount}>{wants.length}</span>
          )}
        </button>
      </div>

      {/* Binder tab */}
      {activeTab === 'binder' && (
        <>
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
        </>
      )}

      {/* Wishlist tab */}
      {activeTab === 'wishlist' && (
        <div className={styles.gridWrap}>
          {wantsLoading ? (
            <div className={styles.loading}>Loading wishlist…</div>
          ) : wants.length === 0 ? (
            <div className={styles.empty}>
              <p>⭐ Your wishlist is empty.</p>
              <p style={{ fontSize: 13, color: 'var(--grey)', marginTop: 8 }}>
                Right-click any card in your binder and choose <strong style={{ color: 'var(--white-dim)' }}>Add to wishlist</strong> to start tracking cards you want.
              </p>
            </div>
          ) : (
            <div className={styles.grid}>
              {wants.map(want => (
                <div key={want.id} style={wishCard}>
                  <div style={wishImgWrap}>
                    {want.image_uri ? (
                      <img src={want.image_uri} alt={want.card_name} style={wishImg} loading="lazy" />
                    ) : (
                      <div style={wishImgPlaceholder}>
                        <span style={{ fontSize: 11, color: 'var(--grey)', padding: 8, textAlign: 'center' }}>
                          {want.card_name}
                        </span>
                      </div>
                    )}
                    <div style={wishBadge}>WANT</div>
                    <button
                      style={wishDeleteBtn}
                      onClick={() => {
                        if (confirm(`Remove ${want.card_name} from wishlist?`)) deleteWantMutation.mutate(want.id)
                      }}
                      title="Remove from wishlist"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div style={wishInfo}>
                    <div style={wishName} title={want.card_name}>{want.card_name}</div>
                    <div style={wishMeta}>
                      {want.set_code && <span style={wishSet}>{want.set_code.toUpperCase()}</span>}
                      {want.max_condition && <span style={wishCond}>{want.max_condition}</span>}
                    </div>
                    {want.max_condition && (
                      <div style={wishCondNote}>Up to {CONDITION_LABELS[want.max_condition] || want.max_condition}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAdd && <AddCardModal onClose={() => setShowAdd(false)} />}
    </div>
  )
}

// ── Tab styles ───────────────────────────────────────────────────────────────
const tabRow = {
  display: 'flex',
  gap: 4,
  borderBottom: '1px solid var(--border)',
  marginBottom: 4,
}
const tab = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '10px 18px',
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--grey)',
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  cursor: 'pointer',
  marginBottom: -1,
  transition: 'color 0.15s',
}
const tabActive = {
  color: 'var(--teal)',
  borderBottomColor: 'var(--teal)',
}
const tabCount = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--teal)',
  background: '#00d4c815',
  border: '1px solid #00d4c830',
  borderRadius: 20,
  padding: '1px 7px',
}

// ── Wishlist card styles ─────────────────────────────────────────────────────
const wishCard = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}
const wishImgWrap = {
  position: 'relative',
  aspectRatio: '63 / 88',
  background: 'var(--navy)',
  overflow: 'hidden',
}
const wishImg = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}
const wishImgPlaceholder = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
const wishBadge = {
  position: 'absolute',
  top: 7,
  left: 7,
  background: 'rgba(0,212,200,0.85)',
  color: 'var(--navy)',
  fontSize: 9,
  fontWeight: 700,
  padding: '2px 5px',
  borderRadius: 3,
  letterSpacing: '0.05em',
}
const wishDeleteBtn = {
  position: 'absolute',
  top: 6,
  right: 6,
  background: 'rgba(0,0,0,0.7)',
  border: 'none',
  borderRadius: 4,
  color: '#fc5c65',
  cursor: 'pointer',
  padding: '4px 5px',
  display: 'flex',
  alignItems: 'center',
}
const wishInfo = {
  padding: '8px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}
const wishName = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--white)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
const wishMeta = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
}
const wishSet = {
  fontSize: 10,
  color: 'var(--grey)',
  fontWeight: 600,
}
const wishCond = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--teal)',
  background: '#00d4c815',
  borderRadius: 3,
  padding: '1px 5px',
}
const wishCondNote = {
  fontSize: 10,
  color: 'var(--grey)',
}