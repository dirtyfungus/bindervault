// frontend/src/pages/TradeDetailPage.jsx
import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ArrowLeft, Store, Package, CheckCircle, X } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import api from '../lib/api'
import toast from 'react-hot-toast'
import CounterOfferModal from '../components/trade/CounterOfferModal'
import TradeChat from '../components/trade/TradeChat'

export default function TradeDetailPage() {
  const { offerId } = useParams()
  const { user: me } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const wsRef = useRef(null)

  const [showCounterModal, setShowCounterModal] = useState(false)
  const [showDeclineModal, setShowDeclineModal] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [lgsName, setLgsName] = useState('')
  const [lgsAddress, setLgsAddress] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [shippingAddress, setShippingAddress] = useState('')

  const { data: offer, isLoading } = useQuery({
    queryKey: ['offer', offerId],
    queryFn: () => api.get(`/trades/${offerId}`).then(r => r.data),
  })

  const { data: schedule } = useQuery({
    queryKey: ['schedule', offerId],
    queryFn: () => api.get(`/schedules/${offerId}`).then(r => r.data).catch(() => null),
    enabled: offer?.status === 'accepted',
  })

  const respondMutation = useMutation({
    mutationFn: (payload) => api.post(`/trades/${offerId}/respond`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['offer', offerId] })
      qc.invalidateQueries({ queryKey: ['trades'] })
      setShowDeclineModal(false)
      setDeclineReason('')
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed'),
  })

  const scheduleMutation = useMutation({
    mutationFn: (payload) => api.post(`/schedules/${offerId}`, payload),
    onSuccess: () => { toast.success('Schedule saved!'); qc.invalidateQueries({ queryKey: ['schedule', offerId] }) },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to save schedule'),
  })

  const confirmMutation = useMutation({
    mutationFn: () => api.post(`/schedules/${offerId}/confirm`),
    onSuccess: () => { toast.success('Confirmed!'); qc.invalidateQueries({ queryKey: ['schedule', offerId] }) },
  })

  const completeMutation = useMutation({
    mutationFn: () => api.post(`/trades/${offerId}/respond`, { action: 'complete' }),
    onSuccess: () => {
      toast.success('Trade completed! 🎉')
      qc.invalidateQueries({ queryKey: ['offer', offerId] })
      qc.invalidateQueries({ queryKey: ['trades'] })
      qc.invalidateQueries({ queryKey: ['binder'] })
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to complete trade'),
  })

  if (isLoading) return <div style={loadingStyle}>Loading trade…</div>
  if (!offer) return <div style={loadingStyle}>Trade not found</div>

  const isSender = offer.sender_id === me?.id
  const isReceiver = offer.receiver_id === me?.id
  const other = isSender ? offer.receiver : offer.sender

  // Who can act on a countered offer?
  // When status is 'countered', a NEW counter offer was created with sender/receiver swapped.
  // The original sender is now the receiver of the counter — they need to accept/decline/counter.
  // The original receiver (who countered) just waits.
  const isCountered = offer.status === 'countered'
  const canActOnPending = offer.status === 'pending' && isReceiver
  const canActOnCounter = isCountered && isSender // original sender receives the counter

  const isDeliveryLgs = offer.delivery_method === 'lgs'
  const iAmConfirmed = isSender ? schedule?.confirmed_sender : schedule?.confirmed_receiver
  const bothConfirmed = schedule?.confirmed_sender && schedule?.confirmed_receiver

  const grid = {
    display: 'grid',
    gridTemplateColumns: offer.status === 'accepted' ? '1fr 380px' : '1fr',
    gap: 16,
    alignItems: 'start',
  }

  // Determine labels based on perspective
  const theyGiveLabel = isSender ? "They're giving" : "You're giving"
  const youGiveLabel = isSender ? "You're giving" : "They're giving"
  const theyGiveEntry = isSender ? offer.target_entry : null
  const youGiveItems = isSender ? offer.offered_items : offer.offered_items

  return (
    <>
      <div style={page}>
        <div style={headerRow}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/trades')}>
            <ArrowLeft size={14} /> Back
          </button>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: 'var(--white)' }}>
            Trade #{offer.id}
          </h1>
          <span style={{ fontSize: 12, color: 'var(--grey)' }}>
            {formatDistanceToNow(new Date(offer.created_at), { addSuffix: true })}
          </span>
        </div>

        <div style={grid}>
          {/* LEFT COLUMN */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={card}>
              <h2 style={sectionTitle}>Trade details</h2>

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ ...avatar, background: other?.avatar_color || 'var(--teal-dim)' }}>
                  {other?.display_name?.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--white)' }}>{other?.handle}</div>
                  <div style={{ fontSize: 11, color: 'var(--grey)' }}>Trading partner</div>
                </div>
                <span style={{
                  ...statusBadge,
                  background: statusColors[offer.status]?.bg || '#00d4c820',
                  borderColor: statusColors[offer.status]?.border || '#00d4c840',
                  color: statusColors[offer.status]?.text || 'var(--teal)',
                  marginLeft: 'auto',
                }}>
                  {offer.status === 'countered' ? '↩ Countered' : offer.status}
                </span>
              </div>

              {/* Counter offer context banner */}
              {isCountered && (
                <div style={counterBanner}>
                  {canActOnCounter
                    ? '↩ The other party has countered this offer. Review and respond below.'
                    : '⏳ You sent a counter offer. Waiting for the other party to respond.'
                  }
                </div>
              )}

              {/* Trade items */}
              <div style={row}>
                <div style={col}>
                  <div style={colLabel}>They're giving</div>
                  {offer.target_entry && (
                    <div style={cardRowStyle}>
                      {offer.target_entry.image_uri && (
                        <img src={offer.target_entry.image_uri} style={thumbImg} alt={offer.target_entry.card_name} />
                      )}
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--white)' }}>{offer.target_entry.card_name}</div>
                        {offer.target_entry.price_usd && <div style={{ fontSize: 12, color: 'var(--teal)' }}>${Number(offer.target_entry.price_usd).toFixed(2)}</div>}
                      </div>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: 20, color: 'var(--grey)', alignSelf: 'center' }}>⇄</div>
                <div style={col}>
                  <div style={colLabel}>You're giving</div>
                  {offer.offered_items.map(item => (
                    <div key={item.id} style={{ fontSize: 13, color: 'var(--white-dim)', marginBottom: 4 }}>
                      • {item.card_name} ×{item.quantity}
                    </div>
                  ))}
                  {offer.cash_add_on > 0 && (
                    <div style={{ fontSize: 13, color: 'var(--teal)' }}>+ ${Number(offer.cash_add_on).toFixed(2)} cash</div>
                  )}
                </div>
              </div>

              {offer.message && (
                <div style={{ marginTop: 16, padding: '10px 14px', background: 'var(--navy)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--grey)', marginBottom: 4 }}>Message</div>
                  <div style={{ fontSize: 13, color: 'var(--white-dim)' }}>{offer.message}</div>
                </div>
              )}

              {/* Actions for pending offers — only receiver can act */}
              {canActOnPending && (
                <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                  <button className="btn btn-primary" onClick={() => respondMutation.mutate({ action: 'accept' })}>
                    Accept trade
                  </button>
                  <button className="btn btn-ghost" onClick={() => setShowCounterModal(true)}>
                    Counter
                  </button>
                  <button className="btn btn-danger" onClick={() => setShowDeclineModal(true)}>
                    Decline
                  </button>
                </div>
              )}

              {/* Actions for countered offers — original sender now responds */}
              {canActOnCounter && (
                <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
                  <button className="btn btn-primary" onClick={() => respondMutation.mutate({ action: 'accept' })}>
                    Accept counter
                  </button>
                  <button className="btn btn-ghost" onClick={() => setShowCounterModal(true)}>
                    Counter back
                  </button>
                  <button className="btn btn-danger" onClick={() => setShowDeclineModal(true)}>
                    Decline
                  </button>
                </div>
              )}

              {/* Sender can cancel a pending offer */}
              {offer.status === 'pending' && isSender && (
                <button className="btn btn-danger" style={{ marginTop: 20 }}
                  onClick={() => respondMutation.mutate({ action: 'cancel' })}>
                  Cancel offer
                </button>
              )}

              {/* Complete button when both confirmed */}
              {offer.status === 'accepted' && bothConfirmed && (
                <button className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => completeMutation.mutate()}>
                  <CheckCircle size={14} /> Mark as completed
                </button>
              )}
            </div>

            {/* Chat always below trade details */}
            <TradeChat offerId={Number(offerId)} wsRef={wsRef} />
          </div>

          {/* RIGHT COLUMN — schedule only when accepted */}
          {offer.status === 'accepted' && (
            <div style={card}>
              <h2 style={sectionTitle}>
                {isDeliveryLgs ? <><Store size={14} /> LGS meetup</> : <><Package size={14} /> Shipping</>}
              </h2>

              {schedule ? (
                <div>
                  {schedule.lgs_name && <div style={scheduleRow}><span style={scheduleLabel}>Store</span>{schedule.lgs_name}</div>}
                  {schedule.lgs_address && <div style={scheduleRow}><span style={scheduleLabel}>Address</span>{schedule.lgs_address}</div>}
                  {schedule.scheduled_at && <div style={scheduleRow}><span style={scheduleLabel}>When</span>{new Date(schedule.scheduled_at).toLocaleString()}</div>}
                  {schedule.shipping_address && <div style={scheduleRow}><span style={scheduleLabel}>Ship to</span>{schedule.shipping_address}</div>}
                  {schedule.tracking_number && <div style={scheduleRow}><span style={scheduleLabel}>Tracking</span>{schedule.tracking_number}</div>}

                  <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                    <div style={{ ...confirmChip, background: schedule.confirmed_sender ? '#48bb7820' : 'var(--card)', borderColor: schedule.confirmed_sender ? '#48bb7840' : 'var(--border)', color: schedule.confirmed_sender ? 'var(--success)' : 'var(--grey)' }}>
                      {offer.sender?.handle} {schedule.confirmed_sender ? '✓' : '○'}
                    </div>
                    <div style={{ ...confirmChip, background: schedule.confirmed_receiver ? '#48bb7820' : 'var(--card)', borderColor: schedule.confirmed_receiver ? '#48bb7840' : 'var(--border)', color: schedule.confirmed_receiver ? 'var(--success)' : 'var(--grey)' }}>
                      {offer.receiver?.handle} {schedule.confirmed_receiver ? '✓' : '○'}
                    </div>
                  </div>

                  {!iAmConfirmed && (
                    <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => confirmMutation.mutate()}>
                      Confirm meetup
                    </button>
                  )}
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: 13, color: 'var(--grey)', marginBottom: 16 }}>Set up how you'll exchange cards.</p>
                  {isDeliveryLgs ? (
                    <>
                      <div style={{ marginBottom: 10 }}>
                        <label style={inputLabel}>Store name</label>
                        <input className="input" value={lgsName} onChange={e => setLgsName(e.target.value)} placeholder="Face to Face Games" />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={inputLabel}>Address</label>
                        <input className="input" value={lgsAddress} onChange={e => setLgsAddress(e.target.value)} placeholder="123 Main St, Montreal" />
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <label style={inputLabel}>Date & time</label>
                        <input className="input" type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                      </div>
                    </>
                  ) : (
                    <div style={{ marginBottom: 10 }}>
                      <label style={inputLabel}>Shipping address</label>
                      <textarea className="input" rows={3} value={shippingAddress} onChange={e => setShippingAddress(e.target.value)} placeholder="Full mailing address" style={{ resize: 'none' }} />
                    </div>
                  )}
                  <button
                    className="btn btn-primary"
                    onClick={() => scheduleMutation.mutate({
                      lgs_name: lgsName || null,
                      lgs_address: lgsAddress || null,
                      scheduled_at: scheduledAt || null,
                      shipping_address: shippingAddress || null,
                    })}
                    disabled={scheduleMutation.isPending}
                  >
                    Save schedule
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showCounterModal && (
        <CounterOfferModal offer={offer} onClose={() => setShowCounterModal(false)} />
      )}

      {showDeclineModal && (
        <div style={overlayStyle} onClick={e => e.target === e.currentTarget && setShowDeclineModal(false)}>
          <div style={declineModal}>
            <div style={modalHeader}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--white)' }}>Decline trade</span>
              <button style={closeBtn} onClick={() => setShowDeclineModal(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 13, color: 'var(--grey)', margin: 0 }}>
                Let <strong style={{ color: 'var(--white)' }}>{other?.handle}</strong> know why you're declining this trade.
              </p>
              <textarea
                className="input"
                rows={3}
                placeholder="e.g. Not interested at this price, looking for cash instead… (optional)"
                value={declineReason}
                onChange={e => setDeclineReason(e.target.value)}
                style={{ resize: 'none', fontSize: 13 }}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-ghost" onClick={() => setShowDeclineModal(false)}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={() => respondMutation.mutate({ action: 'decline', message: declineReason.trim() || null })}
                disabled={respondMutation.isPending}
              >
                {respondMutation.isPending ? 'Declining…' : 'Decline trade'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const statusColors = {
  pending: { bg: '#00d4c820', border: '#00d4c840', text: 'var(--teal)' },
  countered: { bg: '#f6ad5520', border: '#f6ad5540', text: '#f6ad55' },
  accepted: { bg: '#48bb7820', border: '#48bb7840', text: 'var(--success)' },
  declined: { bg: '#fc5c6520', border: '#fc5c6540', text: '#fc5c65' },
  cancelled: { bg: '#71809620', border: '#71809640', text: 'var(--grey)' },
  completed: { bg: '#71809620', border: '#71809640', text: 'var(--grey)' },
}

const page = { padding: '24px 28px', overflowY: 'auto', height: '100%' }
const headerRow = { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }
const card = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20 }
const sectionTitle = { fontSize: 14, fontWeight: 600, color: 'var(--white)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }
const avatar = { width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: 'var(--navy)', flexShrink: 0 }
const statusBadge = { fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, border: '1px solid', textTransform: 'uppercase', letterSpacing: '0.04em' }
const counterBanner = { fontSize: 13, color: '#f6ad55', background: '#f6ad5510', border: '1px solid #f6ad5530', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }
const row = { display: 'flex', gap: 16, alignItems: 'flex-start' }
const col = { flex: 1 }
const colLabel = { fontSize: 11, color: 'var(--grey)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }
const cardRowStyle = { display: 'flex', alignItems: 'center', gap: 10 }
const thumbImg = { width: 40, height: 56, objectFit: 'cover', borderRadius: 4 }
const scheduleRow = { display: 'flex', gap: 10, marginBottom: 8, fontSize: 13, color: 'var(--white-dim)' }
const scheduleLabel = { fontSize: 11, color: 'var(--grey)', width: 60, flexShrink: 0 }
const confirmChip = { fontSize: 11, padding: '4px 12px', borderRadius: 20, border: '1px solid', fontWeight: 500 }
const inputLabel = { display: 'block', fontSize: 11, color: 'var(--grey)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }
const loadingStyle = { padding: 40, color: 'var(--grey)', textAlign: 'center' }
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }
const declineModal = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: 440, overflow: 'hidden' }
const modalHeader = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey)', display: 'flex', alignItems: 'center' }