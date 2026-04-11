import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Star, MapPin, UserPlus, UserMinus } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import api from '../lib/api'
import CardItem from '../components/binder/CardItem'
import TradeOfferModal from '../components/trade/TradeOfferModal'
import toast from 'react-hot-toast'
import styles from './BinderPage.module.css'

const CONDITION_LABELS = { M: 'Mint', NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played', HP: 'Heavily Played', D: 'Damaged' }

export default function UserProfilePage() {
  const { userId } = useParams()
  const { user: me } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [rarity, setRarity] = useState('')
  const [page, setPage] = useState(1)
  const [offerTarget, setOfferTarget] = useState(null)
  const [activeTab, setActiveTab] = useState('binder') // 'binder' | 'wishlist'

  const { data: profile } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.get(`/users/${userId}`).then(r => r.data),
  })

  const { data: isFollowing } = useQuery({
    queryKey: ['following', userId],
    queryFn: async () => false,
  })

  const { data: binderData, isLoading: binderLoading } = useQuery({
    queryKey: ['binder', userId, search, rarity, page],
    queryFn: () => api.get(`/binder/user/${userId}`, {
      params: { search: search || undefined, rarity: rarity || undefined, page, per_page: 24, tradeable_only: true }
    }).then(r => r.data),
    keepPreviousData: true,
    enabled: activeTab === 'binder',
  })

  const { data: wishlist = [], isLoading: wishlistLoading } = useQuery({
    queryKey: ['user-wishlist', userId],
    queryFn: () => api.get(`/users/${userId}/wants`).then(r => r.data),
    enabled: activeTab === 'wishlist',
  })

  const followMutation = useMutation({
    mutationFn: () => api.post(`/users/${userId}/follow`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['user', userId] }); toast.success('Following!') },
  })
  const unfollowMutation = useMutation({
    mutationFn: () => api.delete(`/users/${userId}/follow`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['user', userId] }); toast.success('Unfollowed') },
  })

  if (!profile) return <div style={{ padding: 40, color: 'var(--grey)' }}>Loading profile…</div>

  const initials = profile.display_name?.slice(0, 2).toUpperCase() || '??'
  const isMe = profile.id === me?.id

  return (
    <div className={styles.page}>
      {/* Profile header */}
      <div className={styles.profileHeader}>
        <div className={styles.profileTop}>
          <div className={styles.avatar} style={{ background: profile.avatar_color || 'var(--teal-dim)' }}>
            {initials}
          </div>
          <div className={styles.profileInfo}>
            <div className={styles.profileName}>
              {profile.display_name || profile.username}
              <span className={styles.discriminator}>#{profile.discriminator}</span>
              {profile.is_verified && <span className="badge badge-teal">✓ verified</span>}
            </div>
            {profile.location && (
              <div className={styles.profileLocation}>
                <MapPin size={11} /> {profile.location}
              </div>
            )}
            <div className={styles.profileStats}>
              <div className={styles.stat}>
                <span className={styles.statNum}>{profile.binder_count}</span>
                <span className={styles.statLbl}>tradeable cards</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNum}>{profile.trade_count}</span>
                <span className={styles.statLbl}>trades</span>
              </div>
              <div className={styles.stat}>
                <Star size={12} style={{ color: 'var(--rare)', marginRight: 2 }} />
                <span className={styles.statNum}>{profile.rating?.toFixed(1)}</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNum}>{profile.follower_count}</span>
                <span className={styles.statLbl}>followers</span>
              </div>
            </div>
          </div>
          {!isMe && (
            <button
              className={`btn ${isFollowing ? 'btn-ghost' : 'btn-secondary'}`}
              onClick={() => isFollowing ? unfollowMutation.mutate() : followMutation.mutate()}
            >
              {isFollowing ? <><UserMinus size={14} /> Unfollow</> : <><UserPlus size={14} /> Follow</>}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={tabRow}>
        <button
          style={{ ...tab, ...(activeTab === 'binder' ? tabActive : {}) }}
          onClick={() => setActiveTab('binder')}
        >
          For Trade
          {binderData?.total != null && (
            <span style={tabCount}>{binderData.total}</span>
          )}
        </button>
        <button
          style={{ ...tab, ...(activeTab === 'wishlist' ? tabActive : {}) }}
          onClick={() => setActiveTab('wishlist')}
        >
          Wishlist
          {wishlist.length > 0 && (
            <span style={tabCount}>{wishlist.length}</span>
          )}
        </button>
      </div>

      {/* Binder tab */}
      {activeTab === 'binder' && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <input
                className={styles.searchInput}
                placeholder={`Search ${profile.display_name}'s binder…`}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1) }}
              />
            </div>
          </div>

          <div className={styles.gridWrap}>
            {binderLoading ? (
              <div className={styles.loading}>Loading binder…</div>
            ) : binderData?.items?.length === 0 ? (
              <div className={styles.empty}>
                <p>No tradeable cards in this binder yet.</p>
              </div>
            ) : (
              <>
                <div className={styles.grid}>
                  {binderData?.items.map(entry => (
                    <CardItem
                      key={entry.id}
                      entry={entry}
                      isOwner={false}
                      onOffer={() => setOfferTarget(entry)}
                    />
                  ))}
                </div>
                {binderData?.pages > 1 && (
                  <div className={styles.pagination}>
                    {Array.from({ length: binderData.pages }, (_, i) => i + 1).map(p => (
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
          {wishlistLoading ? (
            <div className={styles.loading}>Loading wishlist…</div>
          ) : wishlist.length === 0 ? (
            <div className={styles.empty}>
              <p>{profile.display_name} hasn't added any cards to their wishlist yet.</p>
            </div>
          ) : (
            <div className={styles.grid}>
              {wishlist.map(want => (
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
                  </div>
                  <div style={wishInfo}>
                    <div style={wishName} title={want.card_name}>{want.card_name}</div>
                    <div style={wishMeta}>
                      {want.set_code && <span style={wishSet}>{want.set_code.toUpperCase()}</span>}
                      {want.max_condition && (
                        <span style={wishCond}>{want.max_condition}</span>
                      )}
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

      {offerTarget && (
        <TradeOfferModal
          targetEntry={offerTarget}
          receiverId={profile.id}
          onClose={() => setOfferTarget(null)}
        />
      )}
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