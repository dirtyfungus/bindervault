import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Star, MapPin, Trash2, Upload, X, CheckSquare } from 'lucide-react'
import { useAuthStore } from '../store/auth'
import api from '../lib/api'
import CardItem from '../components/binder/CardItem'
import AddCardModal from '../components/binder/AddCardModal'
import ImportDeckModal from '../components/binder/ImportDeckModal'
import toast from 'react-hot-toast'
import styles from './BinderPage.module.css'

const RARITIES = ['', 'mythic', 'rare', 'uncommon', 'common']
const RARITY_LABELS = { '': 'All', mythic: 'Mythic', rare: 'Rare', uncommon: 'Uncommon', common: 'Common' }
const CONDITION_LABELS = { M: 'Mint', NM: 'Near Mint', LP: 'Lightly Played', MP: 'Moderately Played', HP: 'Heavily Played', D: 'Damaged' }
const CONFIRM_SKIP_KEY = 'bv_skip_delete_confirm'

export default function BinderPage() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [rarity, setRarity] = useState('')
  const [page, setPage] = useState(1)
  const [showAdd, setShowAdd] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [activeTab, setActiveTab] = useState('binder')

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [confirmDelete, setConfirmDelete] = useState(null) // { ids, single } | null
  const [skipConfirm, setSkipConfirm] = useState(() => localStorage.getItem(CONFIRM_SKIP_KEY) === 'true')
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['binder', 'mine', search, rarity, page],
    queryFn: () => api.get('/binder/', {
      params: { search: search || undefined, rarity: rarity || undefined, page, per_page: 24 }
    }).then(r => r.data),
    keepPreviousData: true,
    enabled: activeTab === 'binder',
  })

  const { data: profileData } = useQuery({
    queryKey: ['user', user?.id],
    queryFn: () => api.get(`/users/${user?.id}`).then(r => r.data),
    enabled: !!user?.id,
  })

  const { data: wants = [], isLoading: wantsLoading } = useQuery({
    queryKey: ['wants'],
    queryFn: () => api.get('/binder/wants').then(r => r.data),
    enabled: activeTab === 'wishlist',
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/binder/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['binder'] }),
  })

  const deleteWantMutation = useMutation({
    mutationFn: (id) => api.delete(`/binder/wants/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wants'] })
      toast.success('Removed from wishlist')
    },
  })

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const clearSelection = () => setSelectedIds(new Set())

  const selectAll = () => {
    if (data?.items) setSelectedIds(new Set(data.items.map(e => e.id)))
  }

  // Trigger delete — single card or multi-select
  const requestDelete = (ids) => {
    if (skipConfirm) {
      executeDelete(ids)
    } else {
      setDontShowAgain(false)
      setConfirmDelete({ ids })
    }
  }

  const executeDelete = async (ids) => {
    const idArr = Array.isArray(ids) ? ids : [ids]
    await Promise.all(idArr.map(id => deleteMutation.mutateAsync(id)))
    toast.success(idArr.length > 1 ? `${idArr.length} cards removed` : 'Card removed')
    setSelectedIds(new Set())
    setConfirmDelete(null)
  }

  const handleConfirmDelete = () => {
    if (dontShowAgain) {
      localStorage.setItem(CONFIRM_SKIP_KEY, 'true')
      setSkipConfirm(true)
    }
    executeDelete(confirmDelete.ids)
  }

  const handleSearchChange = (e) => { setSearch(e.target.value); setPage(1) }
  const handleRarity = (r) => { setRarity(r); setPage(1) }
  const initials = user?.display_name?.slice(0, 2).toUpperCase() || '??'
  const selectionCount = selectedIds.size

  return (
    <div className={styles.page}>
      {/* Profile header */}
      <div className={styles.profileHeader}>
        <div className={styles.profileTop}>
          <div className={styles.avatar} style={{ background: user?.avatar_color || 'var(--teal-dim)' }}>
            {initials}
          </div>
          <div className={styles.profileInfo}>
            <div className={styles.profileName}>
              {user?.display_name || user?.username}
              <span className={styles.discriminator}>#{user?.discriminator}</span>
              {user?.is_verified && <span className="badge badge-teal">✓ verified</span>}
            </div>
            {user?.location && (
              <div className={styles.profileLocation}>
                <MapPin size={11} /> {user.location}
              </div>
            )}
            <div className={styles.profileStats}>
              <div className={styles.stat}>
                <span className={styles.statNum}>{profileData?.binder_count ?? '—'}</span>
                <span className={styles.statLbl}>cards listed</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNum}>{user?.trade_count ?? 0}</span>
                <span className={styles.statLbl}>trades done</span>
              </div>
              <div className={styles.stat}>
                <Star size={12} style={{ color: 'var(--rare)', marginRight: 2 }} />
                <span className={styles.statNum}>{user?.rating?.toFixed(1)}</span>
                <span className={styles.statLbl}>rating</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statNum}>{profileData?.follower_count ?? 0}</span>
                <span className={styles.statLbl}>followers</span>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
              <Upload size={14} /> Import deck
            </button>
            <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
              <Plus size={14} /> Add cards
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={tabRow}>
        <button style={{ ...tab, ...(activeTab === 'binder' ? tabActive : {}) }} onClick={() => setActiveTab('binder')}>
          My Binder
          {data?.total != null && <span style={tabCount}>{data.total}</span>}
        </button>
        <button style={{ ...tab, ...(activeTab === 'wishlist' ? tabActive : {}) }} onClick={() => setActiveTab('wishlist')}>
          ⭐ Wishlist
          {wants.length > 0 && <span style={tabCount}>{wants.length}</span>}
        </button>
      </div>

      {/* Multi-select toolbar */}
      {activeTab === 'binder' && selectionCount > 0 && (
        <div style={selectionBar}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <CheckSquare size={15} color="var(--teal)" />
            <span style={{ fontSize: 13, color: 'var(--white)', fontWeight: 600 }}>
              {selectionCount} card{selectionCount !== 1 ? 's' : ''} selected
            </span>
            <button style={selBarBtn} onClick={selectAll}>Select all</button>
            <button style={selBarBtn} onClick={clearSelection}>Clear</button>
          </div>
          <button
            style={{ ...selBarBtn, color: '#fc5c65', border: '1px solid #fc5c6540', background: '#fc5c6515' }}
            onClick={() => requestDelete([...selectedIds])}
          >
            <Trash2 size={13} /> Remove {selectionCount} card{selectionCount !== 1 ? 's' : ''}
          </button>
        </div>
      )}

      {/* Binder tab */}
      {activeTab === 'binder' && (
        <>
          <div className={styles.toolbar}>
            <div className={styles.searchBox}>
              <Search size={13} color="var(--grey)" />
              <input
                className={styles.searchInput}
                placeholder="Search your binder…"
                value={search}
                onChange={handleSearchChange}
              />
            </div>
            <div className={styles.rarityFilters}>
              {RARITIES.map(r => (
                <button
                  key={r}
                  className={`${styles.rarityBtn} ${rarity === r ? styles.rarityActive : ''}`}
                  onClick={() => handleRarity(r)}
                >
                  {RARITY_LABELS[r]}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.gridWrap}>
            {isLoading ? (
              <div className={styles.loading}>Loading binder…</div>
            ) : data?.items?.length === 0 ? (
              <div className={styles.empty}>
                <p>Your binder is empty.</p>
                <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
                  <Plus size={14} /> Add your first card
                </button>
              </div>
            ) : (
              <>
                <div className={styles.grid}>
                  {data.items.map(entry => (
                    <CardItem
                      key={entry.id}
                      entry={entry}
                      isOwner={true}
                      isSelected={selectedIds.has(entry.id)}
                      onToggleSelect={toggleSelect}
                      onDelete={(e) => requestDelete([e.id])}
                    />
                  ))}
                </div>
                {data.pages > 1 && (
                  <div className={styles.pagination}>
                    {Array.from({ length: data.pages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ''}`}
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Wishlist tab */}
      {activeTab === 'wishlist' && (
        <div className={styles.gridWrap}>
          {wantsLoading ? (
            <div className={styles.loading}>Loading wishlist…</div>
          ) : wants.length === 0 ? (
            <div className={styles.empty}>
              <p>⭐ Your wishlist is empty.</p>
              <p style={{ fontSize: 13, color: 'var(--grey)', marginTop: 8 }}>
                Right-click any card in your binder and choose <strong style={{ color: 'var(--white-dim)' }}>Add to wishlist</strong> to start tracking cards you want.
              </p>
            </div>
          ) : (
            <div className={styles.grid}>
              {wants.map(want => (
                <div key={want.id} style={wishCard}>
                  <div style={wishImgWrap}>
                    {want.image_uri ? (
                      <img src={want.image_uri} alt={want.card_name} style={wishImg} loading="lazy" />
                    ) : (
                      <div style={wishImgPlaceholder}>
                        <span style={{ fontSize: 11, color: 'var(--grey)', padding: 8, textAlign: 'center' }}>{want.card_name}</span>
                      </div>
                    )}
                    <div style={wishBadge}>WANT</div>
                    <button
                      style={wishDeleteBtn}
                      onClick={() => { if (confirm(`Remove ${want.card_name} from wishlist?`)) deleteWantMutation.mutate(want.id) }}
                      title="Remove from wishlist"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div style={wishInfo}>
                    <div style={wishName} title={want.card_name}>{want.card_name}</div>
                    <div style={wishMeta}>
                      {want.set_code && <span style={wishSet}>{want.set_code.toUpperCase()}</span>}
                      {want.max_condition && <span style={wishCond}>{want.max_condition}</span>}
                    </div>
                    {want.max_condition && (
                      <div style={wishCondNote}>Up to {CONDITION_LABELS[want.max_condition] || want.max_condition}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div style={overlayStyle} onClick={e => e.target === e.currentTarget && setConfirmDelete(null)}>
          <div style={confirmModal}>
            <div style={confirmHeader}>
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--white)' }}>
                Remove {confirmDelete.ids.length > 1 ? `${confirmDelete.ids.length} cards` : 'card'}?
              </span>
            </div>
            <div style={{ padding: '16px 20px', fontSize: 13, color: 'var(--white-dim)', lineHeight: 1.6 }}>
              {confirmDelete.ids.length > 1
                ? `Are you sure you want to remove ${confirmDelete.ids.length} cards from your binder? This cannot be undone.`
                : 'Are you sure you want to remove this card from your binder? This cannot be undone.'
              }
            </div>
            <div style={{ padding: '0 20px 12px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: 'var(--grey)' }}>
                <input
                  type="checkbox"
                  checked={dontShowAgain}
                  onChange={e => setDontShowAgain(e.target.checked)}
                  style={{ accentColor: 'var(--teal)', width: 14, height: 14 }}
                />
                Don't show this again
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
              <button className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>No, cancel</button>
              <button
                className="btn"
                style={{ background: '#fc5c65', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', padding: '8px 18px', fontWeight: 600, cursor: 'pointer' }}
                onClick={handleConfirmDelete}
              >
                Yes, remove
              </button>
            </div>
          </div>
        </div>
      )}

      {showAdd && <AddCardModal onClose={() => setShowAdd(false)} />}
      {showImport && <ImportDeckModal onClose={() => setShowImport(false)} />}
    </div>
  )
}

// ── Tab styles ───────────────────────────────────────────────────────────────
const tabRow = { display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 4 }
const tab = { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', fontSize: 13, fontWeight: 500, color: 'var(--grey)', background: 'none', border: 'none', borderBottom: '2px solid transparent', cursor: 'pointer', marginBottom: -1, transition: 'color 0.15s' }
const tabActive = { color: 'var(--teal)', borderBottomColor: 'var(--teal)' }
const tabCount = { fontSize: 11, fontWeight: 700, color: 'var(--teal)', background: '#00d4c815', border: '1px solid #00d4c830', borderRadius: 20, padding: '1px 7px' }

// ── Multi-select bar ─────────────────────────────────────────────────────────
const selectionBar = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 16px', background: '#00d4c810',
  border: '1px solid #00d4c830', borderRadius: 'var(--radius-sm)',
  marginBottom: 8,
}
const selBarBtn = {
  display: 'flex', alignItems: 'center', gap: 5,
  fontSize: 12, fontWeight: 500, color: 'var(--white-dim)',
  background: 'none', border: '1px solid var(--border)',
  borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
}

// ── Confirm modal ────────────────────────────────────────────────────────────
const overlayStyle = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 20 }
const confirmModal = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', width: '100%', maxWidth: 400, overflow: 'hidden' }
const confirmHeader = { padding: '16px 20px', borderBottom: '1px solid var(--border)' }

// ── Wishlist card styles ─────────────────────────────────────────────────────
const wishCard = { background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }
const wishImgWrap = { position: 'relative', aspectRatio: '63 / 88', background: 'var(--navy)', overflow: 'hidden' }
const wishImg = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }
const wishImgPlaceholder = { width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }
const wishBadge = { position: 'absolute', top: 7, left: 7, background: 'rgba(0,212,200,0.85)', color: 'var(--navy)', fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 3, letterSpacing: '0.05em' }
const wishDeleteBtn = { position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 4, color: '#fc5c65', cursor: 'pointer', padding: '4px 5px', display: 'flex', alignItems: 'center' }
const wishInfo = { padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }
const wishName = { fontSize: 12, fontWeight: 600, color: 'var(--white)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }
const wishMeta = { display: 'flex', gap: 6, alignItems: 'center' }
const wishSet = { fontSize: 10, color: 'var(--grey)', fontWeight: 600 }
const wishCond = { fontSize: 10, fontWeight: 700, color: 'var(--teal)', background: '#00d4c815', borderRadius: 3, padding: '1px 5px' }
const wishCondNote = { fontSize: 10, color: 'var(--grey)' }