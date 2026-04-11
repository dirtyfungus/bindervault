import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeftRight, CheckCircle, X } from 'lucide-react'
import api from '../lib/api'
import toast from 'react-hot-toast'
import styles from './TradesPage.module.css'

const STATUS_COLORS = {
  pending: 'var(--teal)',
  countered: 'var(--rare)',
  accepted: 'var(--success)',
  declined: 'var(--danger)',
  cancelled: 'var(--grey)',
  completed: 'var(--grey)',
}

function DeclineModal({ offer, onConfirm, onClose, isPending }) {
  const [reason, setReason] = useState('')
  const other = offer.sender
  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={declineModal}>
        <div style={modalHeader}>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--white)' }}>Decline trade</span>
          <button style={closeBtn} onClick={onClose}><X size={16} /></button>
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ fontSize: 13, color: 'var(--grey)', margin: 0 }}>
            Let <strong style={{ color: 'var(--white)' }}>{other?.handle}</strong> know why you're declining.
          </p>
          <textarea
            className="input"
            rows={3}
            placeholder="e.g. Not interested at this price… (optional)"
            value={reason}
            onChange={e => setReason(e.target.value)}
            style={{ resize: 'none', fontSize: 13 }}
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-danger"
            onClick={() => onConfirm(reason.trim() || null)}
            disabled={isPending}
          >
            {isPending ? 'Declining…' : 'Decline trade'}
          </button>
        </div>
      </div>
    </div>
  )
}

function OfferCard({ offer, type, onRespond, onDecline }) {
  const navigate = useNavigate()
  const other = type === 'incoming' ? offer.sender : offer.receiver

  return (
    <div className={styles.offerCard} onClick={() => navigate(`/trades/${offer.id}`)}>
      <div className={styles.offerTop}>
        <div className={styles.offerUser}>
          <div className={styles.offerAvatar} style={{ background: other?.avatar_color || 'var(--teal-dim)' }}>
            {other?.display_name?.slice(0, 2).toUpperCase() || '??'}
          </div>
          <div>
            <div className={styles.offerHandle}>{other?.handle}</div>
            <div className={styles.offerTime}>
              {formatDistanceToNow(new Date(offer.created_at), { addSuffix: true })}
            </div>
          </div>
        </div>
        <span className={styles.statusBadge} style={{ color: STATUS_COLORS[offer.status], borderColor: STATUS_COLORS[offer.status] + '44', background: STATUS_COLORS[offer.status] + '18' }}>
          {offer.status}
        </span>
      </div>

      <div className={styles.offerBody}>
        <div className={styles.offerLabel}>{type === 'incoming' ? 'They want' : 'You want'}</div>
        <div className={styles.cardRow}>
          {offer.target_entry?.image_uri && (
            <img src={offer.target_entry.image_uri} className={styles.cardThumb} alt={offer.target_entry.card_name} />
          )}
          <div>
            <div className={styles.cardName}>{offer.target_entry?.card_name || '—'}</div>
            {offer.target_entry?.price_usd && (
              <div className={styles.cardPrice}>${Number(offer.target_entry.price_usd).toFixed(2)}</div>
            )}
          </div>
        </div>

        {offer.offered_items?.length > 0 && (
          <>
            <div className={styles.offerLabel} style={{ marginTop: 10 }}>
              {type === 'incoming' ? 'They offer' : 'You offer'}
            </div>
            <div className={styles.offeredThumbs}>
              {offer.offered_items.slice(0, 5).map(item => (
                <div key={item.id} className={styles.offeredThumb} title={item.card_name}>
                  {item.card_name[0]}
                </div>
              ))}
              {offer.offered_items.length > 5 && (
                <span className={styles.moreItems}>+{offer.offered_items.length - 5}</span>
              )}
              {offer.cash_add_on > 0 && (
                <span className={styles.cashChip}>+${Number(offer.cash_add_on).toFixed(2)}</span>
              )}
            </div>
          </>
        )}
      </div>

      {type === 'incoming' && offer.status === 'pending' && (
        <div className={styles.offerActions} onClick={e => e.stopPropagation()}>
          <button className="btn btn-primary btn-sm" onClick={() => onRespond(offer.id, 'accept')}>Accept</button>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/trades/${offer.id}`)}>Counter</button>
          <button className="btn btn-danger btn-sm" onClick={() => onDecline(offer)}>Decline</button>
        </div>
      )}

      {type === 'outgoing' && offer.status === 'pending' && (
        <div className={styles.offerActions} onClick={e => e.stopPropagation()}>
          <button className="btn btn-danger btn-sm" onClick={() => onRespond(offer.id, 'cancel')}>Cancel offer</button>
        </div>
      )}

      {offer.status === 'accepted' && (
        <div className={styles.acceptedBanner}>
          <CheckCircle size={14} color="var(--success)" />
          Accepted — go to detail to schedule the trade
        </div>
      )}
    </div>
  )
}

export default function TradesPage() {
  const [tab, setTab] = useState('incoming')
  const [decliningOffer, setDecliningOffer] = useState(null)
  const qc = useQueryClient()

  const { data: incoming = [], isLoading: loadingIn } = useQuery({
    queryKey: ['trades', 'incoming'],
    queryFn: () => api.get('/trades/incoming').then(r => r.data),
  })

  const { data: outgoing = [], isLoading: loadingOut } = useQuery({
    queryKey: ['trades', 'outgoing'],
    queryFn: () => api.get('/trades/outgoing').then(r => r.data),
  })

  const { data: history = [] } = useQuery({
    queryKey: ['trades', 'history'],
    queryFn: () => api.get('/trades/history').then(r => r.data),
  })

  const respondMutation = useMutation({
    mutationFn: ({ id, action, message }) => api.post(`/trades/${id}/respond`, { action, message }),
    onSuccess: (_, { action }) => {
      qc.invalidateQueries({ queryKey: ['trades'] })
      const msgs = { accept: 'Trade accepted!', decline: 'Trade declined', cancel: 'Offer cancelled' }
      toast.success(msgs[action] || 'Done')
      setDecliningOffer(null)
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Action failed'),
  })

  const tabs = [
    { key: 'incoming', label: 'Incoming', count: incoming.length },
    { key: 'outgoing', label: 'Outgoing', count: outgoing.length },
    { key: 'history', label: 'History', count: null },
  ]

  const lists = { incoming, outgoing, history }
  const loadings = { incoming: loadingIn, outgoing: loadingOut, history: false }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.headerTitle}>
          <ArrowLeftRight size={18} color="var(--teal)" />
          Trades
        </div>
        <div className={styles.tabs}>
          {tabs.map(t => (
            <button
              key={t.key}
              className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.count != null && t.count > 0 && (
                <span className={styles.tabCount}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.content}>
        {loadings[tab] ? (
          <div className={styles.loading}>Loading…</div>
        ) : lists[tab].length === 0 ? (
          <div className={styles.empty}>No {tab} trades</div>
        ) : (
          <div className={styles.offerGrid}>
            {lists[tab].map(offer => (
              <OfferCard
                key={offer.id}
                offer={offer}
                type={tab === 'history' ? (offer.sender_id === offer.sender?.id ? 'outgoing' : 'incoming') : tab}
                onRespond={(id, action) => respondMutation.mutate({ id, action })}
                onDecline={(offer) => setDecliningOffer(offer)}
              />
            ))}
          </div>
        )}
      </div>

      {decliningOffer && (
        <DeclineModal
          offer={decliningOffer}
          onConfirm={(reason) => respondMutation.mutate({ id: decliningOffer.id, action: 'decline', message: reason })}
          onClose={() => setDecliningOffer(null)}
          isPending={respondMutation.isPending}
        />
      )}
    </div>
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }
const declineModal = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: 440, overflow: 'hidden' }
const modalHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey)', display: 'flex', alignItems: 'center' }