import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, X, Plus, Loader } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'
import styles from './AddCardModal.module.css'

const CONDITIONS = ['M', 'NM', 'LP', 'MP', 'HP', 'D']
const CONDITION_LABELS = { M: 'Mint', NM: 'NM', LP: 'LP', MP: 'MP', HP: 'HP', D: 'D' }

export default function AddCardModal({ onClose }) {
  const qc = useQueryClient()
  const [searchQ, setSearchQ] = useState('')
  const [debouncedQ, setDebouncedQ] = useState('')
  const [selected, setSelected] = useState(null)
  const [condition, setCondition] = useState('NM')
  const [quantity, setQuantity] = useState(1)
  const [foil, setFoil] = useState(false)

  // Debounce search
  const handleSearchChange = (e) => {
    const val = e.target.value
    setSearchQ(val)
    clearTimeout(window._bvSearchTimer)
    window._bvSearchTimer = setTimeout(() => setDebouncedQ(val), 400)
  }

  const { data: results, isFetching } = useQuery({
    queryKey: ['scryfall-search', debouncedQ],
    queryFn: () => api.get(`/scryfall/search?q=${encodeURIComponent(debouncedQ)}`).then(r => r.data.data),
    enabled: debouncedQ.length >= 2,
    staleTime: 60_000,
  })

  const addMutation = useMutation({
    mutationFn: (payload) => api.post('/binder/', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['binder'] })
      toast.success(`${selected.card_name} added to binder`)
      onClose()
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Failed to add card'),
  })

  const handleAdd = () => {
    if (!selected) return
    addMutation.mutate({
      scryfall_id: selected.scryfall_id,
      card_name: selected.card_name,
      set_code: selected.set_code,
      set_name: selected.set_name,
      collector_number: selected.collector_number,
      rarity: selected.rarity,
      image_uri: selected.image_uri,
      price_usd: selected.price_usd,
      condition,
      quantity: Number(quantity),
      foil,
    })
  }

  return (
    <div className={styles.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <span className={styles.title}>Add card to binder</span>
          <button className={styles.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        <div className={styles.body}>
          {/* Search */}
          <div className={styles.searchRow}>
            <Search size={14} color="var(--grey)" style={{ flexShrink: 0 }} />
            <input
              className={styles.searchInput}
              placeholder="Search card name… (e.g. Orcish Bowmasters)"
              value={searchQ}
              onChange={handleSearchChange}
              autoFocus
            />
            {isFetching && <Loader size={14} color="var(--grey)" className={styles.spin} />}
          </div>

{/* Results */}
          {results && results.length > 0 && !selected && (
            <div className={styles.results}>
              {results.slice(0, 30).map(card => (
                <button key={card.scryfall_id} className={styles.resultItem} onClick={() => setSelected(card)}>
                  {card.image_uri && (
                    <img src={card.image_uri} alt={card.card_name} className={styles.resultThumb} />
                  )}
                  <div className={styles.resultInfo}>
                    <span className={styles.resultName}>{card.card_name}</span>
                    <span className={styles.resultMeta}>
                      {card.set_code?.toUpperCase()} #{card.collector_number} · {card.set_name} · {card.rarity}
                    </span>
                    {card.price_usd && <span className={styles.resultPrice}>${card.price_usd.toFixed(2)}</span>}
                  </div>
                  <Plus size={14} color="var(--teal)" style={{ flexShrink: 0, marginLeft: 'auto' }} />
                </button>
              ))}
            </div>
          )}

          {debouncedQ.length >= 2 && results?.length === 0 && !isFetching && (
            <p className={styles.noResults}>No cards found for "{debouncedQ}"</p>
          )}

          {/* Selected card config */}
          {selected && (
            <div className={styles.selectedConfig}>
              <div className={styles.selectedCard}>
                {selected.image_uri && (
                  <img src={selected.image_uri} alt={selected.card_name} className={styles.selectedImg} />
                )}
                <div className={styles.selectedInfo}>
                  <div className={styles.selectedName}>{selected.card_name}</div>
                  <div className={styles.selectedSet}>{selected.set_name} · #{selected.collector_number}</div>
                  {selected.price_usd && <div className={styles.selectedPrice}>${selected.price_usd.toFixed(2)}</div>}
                </div>
                <button className={styles.clearSelected} onClick={() => setSelected(null)}>
                  <X size={14} />
                </button>
              </div>

              <div className={styles.configRow}>
                <div className={styles.configField}>
                  <label className={styles.configLabel}>Condition</label>
                  <div className={styles.conditionGroup}>
                    {CONDITIONS.map(c => (
                      <button
                        key={c}
                        className={`${styles.condBtn} ${condition === c ? styles.condActive : ''}`}
                        onClick={() => setCondition(c)}
                        title={CONDITION_LABELS[c]}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.configField}>
                  <label className={styles.configLabel}>Qty</label>
                  <input
                    type="number"
                    className={`input ${styles.qtyInput}`}
                    min={1}
                    max={99}
                    value={quantity}
                    onChange={e => setQuantity(e.target.value)}
                  />
                </div>

                <div className={styles.configField}>
                  <label className={styles.configLabel}>Foil</label>
                  <button
                    className={`${styles.foilToggle} ${foil ? styles.foilActive : ''}`}
                    onClick={() => setFoil(f => !f)}
                  >
                    {foil ? '✨ Yes' : 'No'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleAdd}
            disabled={!selected || addMutation.isPending}
          >
            {addMutation.isPending ? 'Adding…' : 'Add to binder'}
          </button>
        </div>
      </div>
    </div>
  )
}
