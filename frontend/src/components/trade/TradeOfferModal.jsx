import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Package, Store, Plus, Minus } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import styles from './TradeOfferModal.module.css'

export default function TradeOfferModal({ targetEntry, receiverId, onClose }) {
  const qc = useQueryClient()
  const [selectedIds, setSelectedIds] = useState([])
  const [cash, setCash] = useState(0)
  const [delivery, setDelivery] = useState('lgs')
  const [message, setMessage] = useState('')

  const { data: myBinder } = useQuery({
    queryKey: ['binder', 'mine'],
    queryFn: () => api.get('/binder/').then(r => r.data.items),
  })

  const toggleSelect = (id) => {
    setSelectedIds(ids => ids.includes(id) ? ids.filter(i => i !== id) : [...ids, id])
  }

  const sendMutation = useMutation({
    mutationFn: () => api.post('/trades/', {
      receiver_id: receiverId,
      target_entry_id: targetEntry.id,
      offered_entry_ids: selectedIds,
      cash_add_on: parseFloat(cash) || 0,
      delivery_method: delivery,
      message: message || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trades'] })
      toast.success('Trade offer sent!')
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to send offer'),
  })

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>Make a trade offer</span>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        <div className={styles.body}>
          {/* Target card */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>They're giving up</div>
            <div className={styles.targetCard}>
              {targetEntry.image_uri && (
                <img src={targetEntry.image_uri} alt={targetEntry.card_name} className={styles.targetImg} />
              )}
              <div>
                <div className={styles.targetName}>{targetEntry.card_name}</div>
                <div className={styles.targetMeta}>{targetEntry.set_code?.toUpperCase()} · {targetEntry.condition}</div>
                {targetEntry.price_usd && (
                  <div className={styles.targetPrice}>${Number(targetEntry.price_usd).toFixed(2)}</div>
                )}
              </div>
            </div>
          </div>

          {/* Offer from my binder */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>
              You're offering
              {selectedIds.length > 0 && <span className={styles.selectedCount}>{selectedIds.length} selected</span>}
            </div>
            <div className={styles.binderGrid}>
              {myBinder?.map(entry => (
                <button
                  key={entry.id}
                  className={`${styles.binderCard} ${selectedIds.includes(entry.id) ? styles.binderSelected : ''}`}
                  onClick={() => toggleSelect(entry.id)}
                >
                  {entry.image_uri ? (
                    <img src={entry.image_uri} alt={entry.card_name} className={styles.binderImg} />
                  ) : (
                    <div className={styles.binderImgPlaceholder}>{entry.card_name[0]}</div>
                  )}
                  <div className={styles.binderCardName}>{entry.card_name}</div>
                  {selectedIds.includes(entry.id) && <div className={styles.checkMark}>✓</div>}
                </button>
              ))}
              {(!myBinder || myBinder.length === 0) && (
                <p className={styles.emptyBinder}>Your binder is empty — add cards first</p>
              )}
            </div>
          </div>

          {/* Cash sweetener */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Cash add-on (CAD)</div>
            <div className={styles.cashRow}>
              <button className={styles.cashStepBtn} onClick={() => setCash(v => Math.max(0, Number(v) - 5))}>
                <Minus size={12} />
              </button>
              <input
                type="number"
                className={`input ${styles.cashInput}`}
                min={0}
                step={0.5}
                value={cash}
                onChange={e => setCash(e.target.value)}
                placeholder="0.00"
              />
              <button className={styles.cashStepBtn} onClick={() => setCash(v => Number(v) + 5)}>
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Delivery */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Meet-up preference</div>
            <div className={styles.deliveryRow}>
              <button
                className={`${styles.deliveryOpt} ${delivery === 'lgs' ? styles.deliveryActive : ''}`}
                onClick={() => setDelivery('lgs')}
              >
                <Store size={18} />
                <div>
                  <div className={styles.deliveryLabel}>Local LGS</div>
                  <div className={styles.deliverySub}>Schedule at your store</div>
                </div>
              </button>
              <button
                className={`${styles.deliveryOpt} ${delivery === 'ship' ? styles.deliveryActive : ''}`}
                onClick={() => setDelivery('ship')}
              >
                <Package size={18} />
                <div>
                  <div className={styles.deliveryLabel}>Ship</div>
                  <div className={styles.deliverySub}>Tracked mail</div>
                </div>
              </button>
            </div>
          </div>

          {/* Optional message */}
          <div className={styles.section}>
            <div className={styles.sectionLabel}>Message (optional)</div>
            <textarea
              className="input"
              rows={2}
              placeholder="Hey, interested in trading…"
              value={message}
              onChange={e => setMessage(e.target.value)}
              style={{ resize: 'none' }}
            />
          </div>
        </div>

        <div className={styles.footer}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={() => sendMutation.mutate()}
            disabled={sendMutation.isPending || selectedIds.length === 0}
          >
            {sendMutation.isPending ? 'Sending…' : 'Send offer'}
          </button>
        </div>
      </div>
    </div>
  )
}
