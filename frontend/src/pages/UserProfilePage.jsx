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

export default function UserProfilePage() {
  const { userId } = useParams()
  const { user: me } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [rarity, setRarity] = useState('')
  const [page, setPage] = useState(1)
  const [offerTarget, setOfferTarget] = useState(null)

  const { data: profile } = useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.get(`/users/${userId}`).then(r => r.data),
  })

  const { data: isFollowing } = useQuery({
    queryKey: ['following', userId],
    queryFn: async () => {
      // Simple check by trying to unfollow would cause side effects.
      // Instead we check follows list — for Phase 1 we'll just show a toggle that updates.
      return false
    },
  })

  const { data: binderData, isLoading } = useQuery({
    queryKey: ['binder', userId, search, rarity, page],
    queryFn: () => api.get(`/binder/user/${userId}`, {
      params: { search: search || undefined, rarity: rarity || undefined, page, per_page: 24, tradeable_only: true }
    }).then(r => r.data),
    keepPreviousData: true,
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
        {isLoading ? (
          <div className={styles.loading}>Loading binder…</div>
        ) : binderData?.items?.length === 0 ? (
          <div className={styles.empty}>
            <p>No tradeable cards in this binder yet.</p>
          </div>
        ) : (
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
        )}
      </div>

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
