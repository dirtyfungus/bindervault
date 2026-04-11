import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import styles from './CardItem.module.css'

const RARITY_CLASS = { mythic: 'rarity-mythic', rare: 'rarity-rare', uncommon: 'rarity-uncommon', common: 'rarity-common' }

export default function CardItem({ entry, onOffer, onDelete, isOwner, isWanted }) {
  const qc = useQueryClient()
  const rarityClass = RARITY_CLASS[entry.rarity] || 'rarity-common'

  const toggleTradeable = useMutation({
    mutationFn: () => api.patch(`/binder/${entry.id}`, { is_tradeable: !entry.is_tradeable }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['binder'] })
      toast.success(entry.is_tradeable ? 'Card hidden from trades' : 'Card listed for trading')
    },
    onError: () => toast.error('Failed to update card'),
  })

  return (
    <div className={`${styles.card} fade-in`} style={{ opacity: isOwner && !entry.is_tradeable ? 0.6 : 1 }}>
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
          <div style={{
            position: 'absolute', top: 7, left: 7,
            background: 'rgba(0,0,0,0.7)', borderRadius: 4,
            fontSize: 9, fontWeight: 700, color: 'var(--grey)',
            padding: '2px 5px', letterSpacing: '0.05em',
          }}>
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
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className={`btn btn-sm ${entry.is_tradeable ? 'btn-ghost' : 'btn-secondary'}`}
                onClick={() => toggleTradeable.mutate()}
                disabled={toggleTradeable.isPending}
                title={entry.is_tradeable ? 'Hide from trades' : 'List for trading'}
                style={{ fontSize: 10, padding: '2px 6px' }}
              >
                {entry.is_tradeable ? '🔒 Hide' : '✅ List'}
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => onDelete?.(entry)}>Remove</button>
            </div>
          ) : (
            entry.is_tradeable && (
              <button className="btn btn-sm btn-primary" onClick={() => onOffer?.(entry)}>Offer</button>
            )
          )}
        </div>
      </div>
    </div>
  )
}