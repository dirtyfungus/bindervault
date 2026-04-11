import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Trash2, Star } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'

const CONDITION_LABELS = { M: 'Mint', NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played', HP: 'Heavily Played', D: 'Damaged' }

export default function WishlistPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')

  const { data: wants = [], isLoading } = useQuery({
    queryKey: ['wants'],
    queryFn: () => api.get('/binder/wants').then(r => r.data),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/binder/wants/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wants'] })
      toast.success('Removed from wishlist')
    },
    onError: () => toast.error('Failed to remove'),
  })

  const filtered = wants.filter(w =>
    w.card_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={page}>
      {/* Header */}
      <div style={header}>
        <div>
          <h1 style={heading}>
            <Star size={18} style={{ color: 'var(--teal)', marginRight: 8, flexShrink: 0 }} />
            My Wishlist
          </h1>
          <p style={subheading}>Cards you're looking to trade for</p>
        </div>
        <div style={countBadge}>{wants.length} card{wants.length !== 1 ? 's' : ''}</div>
      </div>

      {/* Search */}
      <div style={searchBox}>
        <Search size={13} color="var(--grey)" style={{ flexShrink: 0 }} />
        <input
          style={searchInput}
          placeholder="Search your wishlist…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <div style={emptyState}>Loading wishlist…</div>
      ) : wants.length === 0 ? (
        <div style={emptyCard}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>⭐</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--white)', marginBottom: 8 }}>
            Your wishlist is empty
          </div>
          <div style={{ fontSize: 13, color: 'var(--grey)', lineHeight: 1.6, maxWidth: 340, textAlign: 'center' }}>
            Right-click any card in a binder and choose <strong style={{ color: 'var(--white-dim)' }}>Add to wishlist</strong> to start tracking cards you want.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={emptyState}>No cards match "{search}"</div>
      ) : (
        <div style={grid}>
          {filtered.map(want => (
            <WantCard key={want.id} want={want} onDelete={() => {
              if (confirm(`Remove ${want.card_name} from wishlist?`)) deleteMutation.mutate(want.id)
            }} />
          ))}
        </div>
      )}
    </div>
  )
}

function WantCard({ want, onDelete }) {
  return (
    <div style={card}>
      <div style={cardImgWrap}>
        {want.image_uri ? (
          <img src={want.image_uri} alt={want.card_name} style={cardImg} loading="lazy" />
        ) : (
          <div style={cardImgPlaceholder}>
            <span style={{ fontSize: 11, color: 'var(--grey)', textAlign: 'center', padding: 8 }}>{want.card_name}</span>
          </div>
        )}
        <button
          style={deleteBtn}
          onClick={onDelete}
          title="Remove from wishlist"
        >
          <Trash2 size={12} />
        </button>
      </div>
      <div style={cardInfo}>
        <div style={cardName} title={want.card_name}>{want.card_name}</div>
        <div style={cardMeta}>
          {want.set_code && <span style={setCode}>{want.set_code.toUpperCase()}</span>}
          {want.max_condition && (
            <span style={conditionBadge} title={CONDITION_LABELS[want.max_condition] || want.max_condition}>
              {want.max_condition}
            </span>
          )}
        </div>
        {want.max_condition && (
          <div style={conditionNote}>
            Up to {CONDITION_LABELS[want.max_condition] || want.max_condition}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────────────────────

const page = {
  padding: '24px 28px',
  overflowY: 'auto',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: 20,
}
const header = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
}
const heading = {
  fontSize: 20,
  fontWeight: 700,
  color: 'var(--white)',
  margin: 0,
  display: 'flex',
  alignItems: 'center',
}
const subheading = {
  fontSize: 13,
  color: 'var(--grey)',
  margin: '4px 0 0 26px',
}
const countBadge = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--teal)',
  background: '#00d4c815',
  border: '1px solid #00d4c830',
  borderRadius: 20,
  padding: '4px 12px',
  flexShrink: 0,
}
const searchBox = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  padding: '8px 12px',
  maxWidth: 360,
}
const searchInput = {
  background: 'none',
  border: 'none',
  outline: 'none',
  color: 'var(--white)',
  fontSize: 13,
  width: '100%',
}
const emptyState = {
  fontSize: 13,
  color: 'var(--grey)',
  padding: '40px 0',
  textAlign: 'center',
}
const emptyCard = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '60px 20px',
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
}
const grid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: 16,
}
const card = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-sm)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  transition: 'border-color 0.15s',
}
const cardImgWrap = {
  position: 'relative',
  aspectRatio: '63 / 88',
  background: 'var(--navy)',
  overflow: 'hidden',
}
const cardImg = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
}
const cardImgPlaceholder = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}
const deleteBtn = {
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
const cardInfo = {
  padding: '8px 10px',
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
}
const cardName = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--white)',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}
const cardMeta = {
  display: 'flex',
  gap: 6,
  alignItems: 'center',
}
const setCode = {
  fontSize: 10,
  color: 'var(--grey)',
  fontWeight: 600,
  textTransform: 'uppercase',
}
const conditionBadge = {
  fontSize: 10,
  fontWeight: 700,
  color: 'var(--teal)',
  background: '#00d4c815',
  borderRadius: 3,
  padding: '1px 5px',
}
const conditionNote = {
  fontSize: 10,
  color: 'var(--grey)',
}