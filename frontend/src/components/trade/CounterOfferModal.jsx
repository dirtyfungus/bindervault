// frontend/src/components/trade/CounterOfferModal.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Plus, Minus } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import api from '../../lib/api'
import toast from 'react-hot-toast'

export default function CounterOfferModal({ offer, onClose }) {
  const { user: me } = useAuthStore()
  const qc = useQueryClient()
  const [selectedIds, setSelectedIds] = useState([])
  const [cashAddOn, setCashAddOn] = useState(0)
  const [message, setMessage] = useState('')
  const [deliveryMethod, setDeliveryMethod] = useState(offer.delivery_method || 'lgs')

  // Load MY binder — these are cards I can offer
  const { data: binderData, isLoading } = useQuery({
    queryKey: ['binder', 'mine'],
    queryFn: () => api.get('/binder/', { params: { per_page: 100, tradeable_only: true } }).then(r => r.data),
  })

  const counterMutation = useMutation({
    mutationFn: (payload) => api.post(`/trades/${offer.id}/counter`, payload),
    onSuccess: () => {
      toast.success('Counter offer sent!')
      qc.invalidateQueries({ queryKey: ['offer', String(offer.id)] })
      qc.invalidateQueries({ queryKey: ['trades'] })
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to send counter'),
  })

  const toggleCard = (id) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleSubmit = () => {
    if (selectedIds.length === 0) {
      toast.error('Select at least one card to offer')
      return
    }
    counterMutation.mutate({
      offered_entry_ids: selectedIds,
      cash_add_on: Number(cashAddOn) || 0,
      delivery_method: deliveryMethod,
      message: message.trim() || null,
    })
  }

  const myCards = binderData?.items || []

  // What the original sender offered me
  const theirOfferedItems = offer.offered_items || []
  const theirCash = offer.cash_add_on || 0

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>
        <div style={header}>
          <span style={title}>Counter offer</span>
          <button style={closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        <div style={body}>

          {/* Context: show the original offer so user knows what they're countering */}
          <div style={contextBox}>
            <div style={contextLabel}>Original offer from {offer.sender?.handle}</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {/* What they want (target card) */}
              <div style={contextCol}>
                <div style={contextColLabel}>They want</div>
                {offer.target_entry ? (
                  <div style={cardRow}>
                    {offer.target_entry.image_uri && (
                      <img src={offer.target_entry.image_uri} alt={offer.target_entry.card_name} style={thumb} />
                    )}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--white)' }}>{offer.target_entry.card_name}</div>
                      {offer.target_entry.price_usd && (
                        <div style={{ fontSize: 11, color: 'var(--teal)' }}>${Number(offer.target_entry.price_usd).toFixed(2)}</div>
                      )}
                    </div>
                  </div>
                ) : <span style={{ fontSize: 12, color: 'var(--grey)' }}>—</span>}
              </div>

              {/* What they offered */}
              <div style={contextCol}>
                <div style={contextColLabel}>They offered</div>
                {theirOfferedItems.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {theirOfferedItems.map(item => (
                      <div key={item.id} style={{ fontSize: 12, color: 'var(--white-dim)' }}>• {item.card_name}</div>
                    ))}
                    {theirCash > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--teal)' }}>+ ${Number(theirCash).toFixed(2)} cash</div>
                    )}
                  </div>
                ) : <span style={{ fontSize: 12, color: 'var(--grey)' }}>No cards</span>}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <div style={sectionLabel}>Your counter — what you'll offer instead</div>
          </div>

          {/* Pick cards from my binder */}
          <div style={section}>
            <div style={{ fontSize: 12, color: 'var(--grey)', marginBottom: 4 }}>
              Select cards from your binder to offer in exchange for{' '}
              <strong style={{ color: 'var(--white-dim)' }}>{offer.target_entry?.card_name}</strong>
            </div>
            {isLoading ? (
              <div style={{ fontSize: 13, color: 'var(--grey)' }}>Loading your binder…</div>
            ) : myCards.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--grey)' }}>No tradeable cards in your binder</div>
            ) : (
              <div style={cardGrid}>
                {myCards.map(card => {
                  const selected = selectedIds.includes(card.id)
                  return (
                    <button
                      key={card.id}
                      style={{
                        ...cardBtn,
                        border: selected ? '2px solid var(--teal)' : '2px solid var(--border)',
                        background: selected ? 'var(--teal-dim)' : 'var(--navy)',
                      }}
                      onClick={() => toggleCard(card.id)}
                    >
                      {card.image_uri && (
                        <img src={card.image_uri} alt={card.card_name} style={cardThumb} />
                      )}
                      <div style={{ fontSize: 10, color: 'var(--white-dim)', marginTop: 4, textAlign: 'center', lineHeight: 1.2 }}>
                        {card.card_name}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--grey)' }}>{card.condition}</div>
                      {card.price_usd && (
                        <div style={{ fontSize: 9, color: 'var(--teal)' }}>${Number(card.price_usd).toFixed(2)}</div>
                      )}
                      {selected && <div style={selectedBadge}>✓</div>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Cash add-on */}
          <div style={section}>
            <div style={sectionLabel}>Cash sweetener (optional)</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button style={stepBtn} onClick={() => setCashAddOn(v => Math.max(0, Number(v) - 5))}>
                <Minus size={12} />
              </button>
              <input
                type="number"
                min="0"
                step="0.50"
                value={cashAddOn}
                onChange={e => setCashAddOn(e.target.value)}
                className="input"
                style={{ width: 90, fontSize: 13, textAlign: 'center' }}
              />
              <button style={stepBtn} onClick={() => setCashAddOn(v => Number(v) + 5)}>
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Delivery method */}
          <div style={section}>
            <div style={sectionLabel}>Delivery</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['lgs', 'ship'].map(m => (
                <button
                  key={m}
                  className={`btn btn-sm ${deliveryMethod === m ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setDeliveryMethod(m)}
                >
                  {m === 'lgs' ? '🏪 LGS meetup' : '📦 Ship'}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div style={section}>
            <div style={sectionLabel}>Message (optional)</div>
            <textarea
              className="input"
              rows={2}
              placeholder="Explain your counter offer…"
              value={message}
              onChange={e => setMessage(e.target.value)}
              style={{ resize: 'none', fontSize: 13 }}
            />
          </div>
        </div>

        <div style={footer}>
          <div style={{ fontSize: 12, color: 'var(--grey)' }}>
            {selectedIds.length} card{selectedIds.length !== 1 ? 's' : ''} selected
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={selectedIds.length === 0 || counterMutation.isPending}
            >
              {counterMutation.isPending ? 'Sending…' : 'Send counter'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 20,
}
const modal = {
  background: 'var(--card)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)',
  width: '100%', maxWidth: 580,
  maxHeight: '90vh',
  display: 'flex', flexDirection: 'column',
  overflow: 'hidden',
}
const header = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 20px',
  borderBottom: '1px solid var(--border)',
  flexShrink: 0,
}
const title = { fontSize: 15, fontWeight: 600, color: 'var(--white)' }
const closeBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--grey)', display: 'flex', alignItems: 'center',
}
const body = {
  overflowY: 'auto', padding: '16px 20px',
  display: 'flex', flexDirection: 'column', gap: 16, flex: 1,
}
const footer = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '14px 20px',
  borderTop: '1px solid var(--border)',
  flexShrink: 0,
}
const section = { display: 'flex', flexDirection: 'column', gap: 8 }
const sectionLabel = {
  fontSize: 11, fontWeight: 600, color: 'var(--grey)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
}
const contextBox = {
  background: 'var(--navy)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '12px 14px',
  display: 'flex', flexDirection: 'column', gap: 10,
}
const contextLabel = {
  fontSize: 11, fontWeight: 600, color: 'var(--grey)',
  textTransform: 'uppercase', letterSpacing: '0.06em',
}
const contextCol = { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }
const contextColLabel = { fontSize: 10, color: 'var(--grey)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }
const cardRow = { display: 'flex', alignItems: 'center', gap: 8 }
const thumb = { width: 36, height: 50, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }
const cardGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
  gap: 8,
  maxHeight: 240,
  overflowY: 'auto',
}
const cardBtn = {
  position: 'relative',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  padding: 6, borderRadius: 8, cursor: 'pointer',
  transition: 'border-color 0.15s',
}
const cardThumb = { width: 60, height: 84, objectFit: 'cover', borderRadius: 4 }
const selectedBadge = {
  position: 'absolute', top: 4, right: 4,
  background: 'var(--teal)', color: 'var(--navy)',
  borderRadius: '50%', width: 16, height: 16,
  fontSize: 10, fontWeight: 700,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const stepBtn = {
  background: 'var(--navy)', border: '1px solid var(--border)',
  borderRadius: 6, cursor: 'pointer', color: 'var(--white)',
  width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
}