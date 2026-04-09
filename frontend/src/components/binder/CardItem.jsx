import styles from './CardItem.module.css'

const RARITY_CLASS = { mythic: 'rarity-mythic', rare: 'rarity-rare', uncommon: 'rarity-uncommon', common: 'rarity-common' }

export default function CardItem({ entry, onOffer, onDelete, isOwner, isWanted }) {
  const rarityClass = RARITY_CLASS[entry.rarity] || 'rarity-common'

  return (
    <div className={`${styles.card} fade-in`}>
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
            <button className={`btn btn-sm btn-danger`} onClick={() => onDelete?.(entry)}>Remove</button>
          ) : (
            entry.is_tradeable && (
              <button className={`btn btn-sm btn-primary`} onClick={() => onOffer?.(entry)}>Offer</button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
