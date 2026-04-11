import { useState, useEffect, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import styles from './CardItem.module.css'

const RARITY_CLASS = { mythic: 'rarity-mythic', rare: 'rarity-rare', uncommon: 'rarity-uncommon', common: 'rarity-common' }
const CONDITIONS = ['M', 'NM', 'LP', 'MP', 'HP', 'D']
const CONDITION_LABELS = { M: 'Mint', NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played', HP: 'Heavily Played', D: 'Damaged' }

export default function CardItem({ entry, onOffer, onDelete, isOwner, isWanted }) {
  const qc = useQueryClient()
  const rarityClass = RARITY_CLASS[entry.rarity] || 'rarity-common'
  const [menu, setMenu] = useState(null)
  const [showDetails, setShowDetails] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const menuRef = useRef(null)

  // Edit state
  const [editCondition, setEditCondition] = useState(entry.condition)
  const [editQuantity, setEditQuantity] = useState(entry.quantity)
  const [editFoil, setEditFoil] = useState(entry.foil)
  const [editTradeable, setEditTradeable] = useState(entry.is_tradeable)

  useEffect(() => {
    if (!menu) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenu(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menu])

  const handleRightClick = (e) => {
    if (!isOwner) return
    e.preventDefault()
    // Keep menu inside viewport
    const x = Math.min(e.clientX, window.innerWidth - 200)
    const y = Math.min(e.clientY, window.innerHeight - 200)
    setMenu({ x, y })
  }

  const toggleTradeable = useMutation({
    mutationFn: () => api.patch(`/binder/${entry.id}`, { is_tradeable: !entry.is_tradeable }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['binder'] }); toast.success(entry.is_tradeable ? 'Hidden from trades' : 'Listed for trading'); setMenu(null) },
    onError: () => toast.error('Failed to update'),
  })

  const editMutation = useMutation({
    mutationFn: () => api.patch(`/binder/${entry.id}`, {
      condition: editCondition,
      quantity: Number(editQuantity),
      foil: editFoil,
      is_tradeable: editTradeable,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['binder'] }); toast.success('Card updated'); setShowEdit(false) },
    onError: () => toast.error('Failed to update card'),
  })

  const addToWishlist = useMutation({
    mutationFn: () => api.post('/binder/wants', {
      scryfall_id: entry.scryfall_id,
      card_name: entry.card_name,
      set_code: entry.set_code,
      image_uri: entry.image_uri,
      max_condition: editCondition,
    }),
    onSuccess: () => { toast.success(`${entry.card_name} added to wishlist`); setMenu(null) },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to add to wishlist'),
  })

  return (
    <>
      <div
        className={`${styles.card} fade-in`}
        style={{ opacity: isOwner && !entry.is_tradeable ? 0.6 : 1, cursor: isOwner ? 'context-menu' : 'default' }}
        onContextMenu={handleRightClick}
      >
        <div className={styles.imgWrap}>
          {entry.image_uri ? (
            <img src={entry.image_uri} alt={entry.card_name} className={styles.img} loading="lazy" />
          ) : (
            <div className={styles.imgPlaceholder}>
              <span className={styles.placeholderName}>{entry.card_name}</span>
            </div>
          )}
          <div className={`rarity-dot ${rarityClass}`} style={{ position: 'absolute', top: 7, right: 7 }} />
          {isWanted && <div className={styles.wantBadge}>WANT</div>}
          {entry.foil && <div className={styles.foilBadge}>✨ Foil</div>}
          {isOwner && !entry.is_tradeable && (
            <div style={{ position: 'absolute', top: 7, left: 7, background: 'rgba(0,0,0,0.75)', borderRadius: 4, fontSize: 9, fontWeight: 700, color: 'var(--grey)', padding: '2px 5px', letterSpacing: '0.05em' }}>
              NOT FOR TRADE
            </div>
          )}
        </div>

        <div className={styles.info}>
          <div className={styles.name} title={entry.card_name}>{entry.card_name}</div>
          <div className={styles.meta}>
            <span className={styles.set}>{entry.set_code?.toUpperCase()}</span>
            <span className={styles.condition}>{entry.condition}</span>
          </div>
          {entry.price_usd != null && (
            <div className={styles.price}>${Number(entry.price_usd).toFixed(2)}</div>
          )}
          <div className={styles.footer}>
            <span className={styles.qty}>×{entry.quantity}</span>
            {isOwner ? (
              <span style={{ fontSize: 10, color: 'var(--grey)' }}>Right-click to edit</span>
            ) : (
              entry.is_tradeable && (
                <button className="btn btn-sm btn-primary" onClick={() => onOffer?.(entry)}>Offer</button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Context menu */}
      {menu && (
        <div ref={menuRef} style={{ position: 'fixed', top: menu.y, left: menu.x, background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 9999, minWidth: 190, overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--grey)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {entry.card_name}
          </div>
          <button style={menuItem} onClick={() => { setMenu(null); setShowDetails(true) }}>🔍 View details</button>
          <button style={menuItem} onClick={() => { setMenu(null); setShowEdit(true) }}>✏️ Edit card</button>
          <button style={menuItem} onClick={() => addToWishlist.mutate()}>⭐ Add to wishlist</button>
          <button style={menuItem} onClick={() => toggleTradeable.mutate()}>
            {entry.is_tradeable ? '🔒 Hide from trades' : '✅ List for trading'}
          </button>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <button style={{ ...menuItem, color: '#fc5c65' }} onClick={() => { setMenu(null); onDelete?.(entry) }}>🗑 Remove from binder</button>
          </div>
          <div style={{ borderTop: '1px solid var(--border)' }}>
            <button style={{ ...menuItem, color: 'var(--grey)', fontSize: 12 }} onClick={() => setMenu(null)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Details modal */}
      {showDetails && (
        <div style={overlay} onClick={e => e.target === e.currentTarget && setShowDetails(false)}>
          <div style={modal}>
            <div style={modalHeader}>
              <span style={modalTitle}>Card details</span>
              <button style={closeBtn} onClick={() => setShowDetails(false)}><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', gap: 20, padding: 20 }}>
              {entry.image_uri && (
                <img src={entry.image_uri} alt={entry.card_name} style={{ width: 180, borderRadius: 8, flexShrink: 0 }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <div style={detailLabel}>Name</div>
                  <div style={detailValue}>{entry.card_name}</div>
                </div>
                <div>
                  <div style={detailLabel}>Set</div>
                  <div style={detailValue}>{entry.set_name} ({entry.set_code?.toUpperCase()}) #{entry.collector_number}</div>
                </div>
                <div>
                  <div style={detailLabel}>Rarity</div>
                  <div style={detailValue}>{entry.rarity}</div>
                </div>
                <div>
                  <div style={detailLabel}>Condition</div>
                  <div style={detailValue}>{CONDITION_LABELS[entry.condition] || entry.condition}</div>
                </div>
                <div>
                  <div style={detailLabel}>Quantity</div>
                  <div style={detailValue}>×{entry.quantity}</div>
                </div>
                <div>
                  <div style={detailLabel}>Foil</div>
                  <div style={detailValue}>{entry.foil ? '✨ Yes' : 'No'}</div>
                </div>
                {entry.price_usd != null && (
                  <div>
                    <div style={detailLabel}>Market price</div>
                    <div style={{ ...detailValue, color: 'var(--teal)' }}>${Number(entry.price_usd).toFixed(2)}</div>
                  </div>
                )}
                <div>
                  <div style={detailLabel}>Trade status</div>
                  <div style={detailValue}>{entry.is_tradeable ? '✅ Listed for trading' : '🔒 Not for trade'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEdit && (
        <div style={overlay} onClick={e => e.target === e.currentTarget && setShowEdit(false)}>
          <div style={modal}>
            <div style={modalHeader}>
              <span style={modalTitle}>Edit — {entry.card_name}</span>
              <button style={closeBtn} onClick={() => setShowEdit(false)}><X size={16} /></button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Condition */}
              <div>
                <div style={fieldLabel}>Condition</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {CONDITIONS.map(c => (
                    <button
                      key={c}
                      onClick={() => setEditCondition(c)}
                      title={CONDITION_LABELS[c]}
                      style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', border: '1px solid',
                        background: editCondition === c ? 'var(--teal)' : 'var(--navy)',
                        borderColor: editCondition === c ? 'var(--teal)' : 'var(--border)',
                        color: editCondition === c ? 'var(--navy)' : 'var(--white-dim)',
                      }}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 11, color: 'var(--grey)', marginTop: 4 }}>{CONDITION_LABELS[editCondition]}</div>
              </div>

              {/* Quantity */}
              <div>
                <div style={fieldLabel}>Quantity</div>
                <input
                  type="number" min={1} max={99}
                  value={editQuantity}
                  onChange={e => setEditQuantity(e.target.value)}
                  className="input"
                  style={{ width: 80 }}
                />
              </div>

              {/* Foil */}
              <div>
                <div style={fieldLabel}>Foil</div>
                <button
                  onClick={() => setEditFoil(f => !f)}
                  style={{
                    padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', border: '1px solid',
                    background: editFoil ? 'var(--teal)' : 'var(--navy)',
                    borderColor: editFoil ? 'var(--teal)' : 'var(--border)',
                    color: editFoil ? 'var(--navy)' : 'var(--white-dim)',
                  }}
                >
                  {editFoil ? '✨ Foil' : 'Not foil'}
                </button>
              </div>

              {/* Tradeable */}
              <div>
                <div style={fieldLabel}>Trade status</div>
                <button
                  onClick={() => setEditTradeable(t => !t)}
                  style={{
                    padding: '6px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', border: '1px solid',
                    background: editTradeable ? '#48bb7820' : 'var(--navy)',
                    borderColor: editTradeable ? '#48bb7840' : 'var(--border)',
                    color: editTradeable ? 'var(--success)' : 'var(--grey)',
                  }}
                >
                  {editTradeable ? '✅ Listed for trading' : '🔒 Not for trade'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '14px 20px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-ghost" onClick={() => setShowEdit(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
                {editMutation.isPending ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

const menuItem = {
  display: 'block', width: '100%', textAlign: 'left',
  padding: '10px 14px', fontSize: 13, color: 'var(--white-dim)',
  background: 'none', border: 'none', cursor: 'pointer',
}
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 20,
}
const modal = {
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', width: '100%', maxWidth: 520,
  maxHeight: '90vh', overflow: 'auto',
}
const modalHeader = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 20px', borderBottom: '1px solid var(--border)',
}
const modalTitle = { fontSize: 15, fontWeight: 600, color: 'var(--white)' }
const closeBtn = { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grey)', display: 'flex', alignItems: 'center' }
const detailLabel = { fontSize: 11, color: 'var(--grey)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }
const detailValue = { fontSize: 14, color: 'var(--white-dim)' }
const fieldLabel = { fontSize: 11, color: 'var(--grey)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }