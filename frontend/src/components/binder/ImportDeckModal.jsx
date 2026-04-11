import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Upload, Link, FileText, CheckSquare, Square, AlertTriangle, Check, Loader } from 'lucide-react'
import api from '../../lib/api'
import toast from 'react-hot-toast'

// Parse plain text deck list: "4 Lightning Bolt" or "4x Lightning Bolt" or "4 Lightning Bolt (M21)"
function parseDeckList(text) {
  const lines = text.trim().split('\n')
  const cards = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith('//') || line.startsWith('#')) continue
    const match = line.match(/^(\d+)[x\s]+(.+?)(?:\s*\(([A-Z0-9]+)\))?(?:\s+\d+)?$/)
    if (match) {
      const quantity = parseInt(match[1], 10)
      const card_name = match[2].trim()
      const set_code = match[3]?.toLowerCase() || undefined
      if (card_name) cards.push({ card_name, quantity, set_code, selected: true })
    }
  }
  return cards
}

const STEPS = { INPUT: 'input', PREVIEW: 'preview', IMPORTING: 'importing', DONE: 'done' }

export default function ImportDeckModal({ onClose }) {
  const qc = useQueryClient()
  const [mode, setMode] = useState('text') // 'text' | 'url'
  const [input, setInput] = useState('')
  const [step, setStep] = useState(STEPS.INPUT)
  const [cards, setCards] = useState([])
  const [duplicateAction, setDuplicateAction] = useState(null)
  const [fetchError, setFetchError] = useState('')
  const [importResults, setImportResults] = useState([])
  const [isFetching, setIsFetching] = useState(false)

  const importMutation = useMutation({
    mutationFn: (payload) => api.post('/binder/import', payload).then(r => r.data),
    onSuccess: (data) => {
      setImportResults(data.results)
      setStep(STEPS.DONE)
      qc.invalidateQueries({ queryKey: ['binder'] })
    },
    onError: (err) => toast.error(err.response?.data?.detail || 'Import failed'),
  })

  const handleParse = async () => {
    setFetchError('')

    if (mode === 'text') {
      const parsed = parseDeckList(input)
      if (!parsed.length) {
        setFetchError('No valid cards found. Use format: "4 Lightning Bolt"')
        return
      }
      setCards(parsed)
      setStep(STEPS.PREVIEW)
    } else {
      const trimmed = input.trim()
      if (!trimmed.includes('moxfield.com') && !trimmed.includes('archidekt.com')) {
        setFetchError('Unrecognized URL. Paste a Moxfield or Archidekt deck URL.')
        return
      }
      setIsFetching(true)
      try {
        const r = await api.get(`/binder/import/fetch-deck?url=${encodeURIComponent(trimmed)}`)
        const parsed = r.data.cards.map(c => ({ ...c, selected: true }))
        if (!parsed.length) throw new Error('No cards found in deck')
        setCards(parsed)
        setStep(STEPS.PREVIEW)
      } catch (e) {
        setFetchError(e.response?.data?.detail || e.message || 'Failed to fetch deck')
      } finally {
        setIsFetching(false)
      }
    }
  }

  const toggleCard = (idx) => {
    setCards(prev => prev.map((c, i) => i === idx ? { ...c, selected: !c.selected } : c))
  }

  const toggleAll = () => {
    const allSelected = cards.every(c => c.selected)
    setCards(prev => prev.map(c => ({ ...c, selected: !allSelected })))
  }

  const handleImport = (action) => {
    const selected = cards.filter(c => c.selected).map(({ card_name, quantity, set_code }) => ({ card_name, quantity, set_code }))
    importMutation.mutate({ cards: selected, on_duplicate: action })
    setStep(STEPS.IMPORTING)
  }

  const selectedCount = cards.filter(c => c.selected).length
  const added = importResults.filter(r => r.status === 'added').length
  const incremented = importResults.filter(r => r.status === 'incremented').length
  const skipped = importResults.filter(r => r.status === 'skipped').length
  const notFound = importResults.filter(r => r.status === 'not_found').length

  return (
    <div style={overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={modal}>

        {/* Header */}
        <div style={modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Upload size={15} color="var(--teal)" />
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--white)' }}>Import Deck</span>
          </div>
          <button style={closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        {/* Step: Input */}
        {step === STEPS.INPUT && (
          <div style={modalBody}>
            <div style={modeToggle}>
              <button style={{ ...modeBtn, ...(mode === 'text' ? modeBtnActive : {}) }} onClick={() => setMode('text')}>
                <FileText size={13} /> Paste deck list
              </button>
              <button style={{ ...modeBtn, ...(mode === 'url' ? modeBtnActive : {}) }} onClick={() => setMode('url')}>
                <Link size={13} /> Import from URL
              </button>
            </div>

            {mode === 'text' ? (
              <>
                <p style={hint}>Paste your deck list in standard format. One card per line.</p>
                <textarea
                  style={textarea}
                  className="input"
                  placeholder={'4 Lightning Bolt\n2 Scalding Tarn (MH2)\n1 Black Lotus'}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  rows={12}
                  autoFocus
                />
              </>
            ) : (
              <>
                <p style={hint}>Paste a Moxfield or Archidekt deck URL.</p>
                <input
                  className="input"
                  placeholder="https://www.moxfield.com/decks/abc123"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  autoFocus
                />
                <div style={platformNote}>
                  Supported: <strong style={{ color: 'var(--white-dim)' }}>Moxfield</strong> and <strong style={{ color: 'var(--white-dim)' }}>Archidekt</strong>
                </div>
              </>
            )}

            {fetchError && (
              <div style={errorBox}>
                <AlertTriangle size={13} style={{ flexShrink: 0 }} /> {fetchError}
              </div>
            )}
          </div>
        )}

        {/* Step: Preview */}
        {step === STEPS.PREVIEW && (
          <div style={modalBody}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: 'var(--grey)' }}>
                {selectedCount} of {cards.length} cards selected
              </span>
              <button style={selectAllBtn} onClick={toggleAll}>
                {cards.every(c => c.selected) ? <CheckSquare size={13} /> : <Square size={13} />}
                {cards.every(c => c.selected) ? 'Deselect all' : 'Select all'}
              </button>
            </div>

            <div style={cardList}>
              {cards.map((card, idx) => (
                <button
                  key={idx}
                  style={{ ...cardRow, opacity: card.selected ? 1 : 0.4 }}
                  onClick={() => toggleCard(idx)}
                >
                  <span style={{ color: card.selected ? 'var(--teal)' : 'var(--grey)', flexShrink: 0 }}>
                    {card.selected ? <CheckSquare size={14} /> : <Square size={14} />}
                  </span>
                  <span style={cardQty}>{card.quantity}x</span>
                  <span style={cardName}>{card.card_name}</span>
                  {card.set_code && <span style={cardSet}>{card.set_code.toUpperCase()}</span>}
                </button>
              ))}
            </div>

            <div style={duplicateBox}>
              <div style={{ fontSize: 12, color: 'var(--grey)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                If a card already exists in your binder:
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  style={{ ...dupBtn, ...(duplicateAction === 'increment' ? dupBtnActive : {}) }}
                  onClick={() => setDuplicateAction('increment')}
                >
                  ➕ Add to quantity
                </button>
                <button
                  style={{ ...dupBtn, ...(duplicateAction === 'skip' ? dupBtnActive : {}) }}
                  onClick={() => setDuplicateAction('skip')}
                >
                  ⏭ Skip duplicates
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === STEPS.IMPORTING && (
          <div style={{ ...modalBody, alignItems: 'center', justifyContent: 'center', gap: 16, minHeight: 220 }}>
            <Loader size={28} color="var(--teal)" style={{ animation: 'spin 1s linear infinite' }} />
            <div style={{ fontSize: 14, color: 'var(--white-dim)' }}>Importing {selectedCount} cards…</div>
            <div style={{ fontSize: 12, color: 'var(--grey)' }}>Looking up each card on Scryfall</div>
          </div>
        )}

        {/* Step: Done */}
        {step === STEPS.DONE && (
          <div style={{ ...modalBody, gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Check size={18} color="var(--teal)" />
              <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--white)' }}>Import complete!</span>
            </div>
            <div style={resultGrid}>
              <div style={resultStat}>
                <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--teal)' }}>{added}</span>
                <span style={{ fontSize: 12, color: 'var(--grey)' }}>added</span>
              </div>
              <div style={resultStat}>
                <span style={{ fontSize: 22, fontWeight: 700, color: '#00d4c8' }}>{incremented}</span>
                <span style={{ fontSize: 12, color: 'var(--grey)' }}>qty updated</span>
              </div>
              <div style={resultStat}>
                <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--grey)' }}>{skipped}</span>
                <span style={{ fontSize: 12, color: 'var(--grey)' }}>skipped</span>
              </div>
              {notFound > 0 && (
                <div style={resultStat}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: '#fc5c65' }}>{notFound}</span>
                  <span style={{ fontSize: 12, color: 'var(--grey)' }}>not found</span>
                </div>
              )}
            </div>
            {notFound > 0 && (
              <div style={errorBox}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>Cards not found on Scryfall:</div>
                  {importResults.filter(r => r.status === 'not_found').map((r, i) => (
                    <div key={i} style={{ fontSize: 12 }}>{r.card_name}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={modalFooter}>
          {step === STEPS.INPUT && (
            <>
              <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleParse}
                disabled={!input.trim() || isFetching}
              >
                {isFetching
                  ? <><Loader size={13} style={{ animation: 'spin 1s linear infinite' }} /> Fetching…</>
                  : 'Preview cards →'}
              </button>
            </>
          )}
          {step === STEPS.PREVIEW && (
            <>
              <button className="btn btn-ghost" onClick={() => { setStep(STEPS.INPUT); setFetchError('') }}>← Back</button>
              <button
                className="btn btn-primary"
                onClick={() => handleImport(duplicateAction || 'increment')}
                disabled={selectedCount === 0}
              >
                Import {selectedCount} card{selectedCount !== 1 ? 's' : ''} to binder
              </button>
            </>
          )}
          {step === STEPS.DONE && (
            <button className="btn btn-primary" style={{ marginLeft: 'auto' }} onClick={onClose}>
              Done
            </button>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────
const overlay = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 1000, padding: 20,
}
const modal = {
  background: 'var(--card)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius-md)', width: '100%', maxWidth: 520,
  maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
}
const modalHeader = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0,
}
const modalBody = {
  padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
  overflowY: 'auto', flex: 1,
}
const modalFooter = {
  display: 'flex', justifyContent: 'flex-end', gap: 8,
  padding: '14px 20px', borderTop: '1px solid var(--border)', flexShrink: 0,
}
const closeBtn = {
  background: 'none', border: 'none', cursor: 'pointer',
  color: 'var(--grey)', display: 'flex', alignItems: 'center',
}
const modeToggle = {
  display: 'flex', gap: 4, background: 'var(--navy)',
  borderRadius: 8, padding: 4,
}
const modeBtn = {
  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  padding: '7px 12px', borderRadius: 6, fontSize: 13, fontWeight: 500,
  border: 'none', cursor: 'pointer', color: 'var(--grey)', background: 'none',
}
const modeBtnActive = {
  background: 'var(--card)', color: 'var(--white)',
  boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
}
const hint = { fontSize: 12, color: 'var(--grey)', margin: 0 }
const platformNote = { fontSize: 12, color: 'var(--grey)' }
const textarea = { resize: 'vertical', fontFamily: 'monospace', fontSize: 12, minHeight: 200 }
const errorBox = {
  display: 'flex', alignItems: 'flex-start', gap: 8,
  padding: '10px 14px', background: '#fc5c6515',
  border: '1px solid #fc5c6530', borderRadius: 8,
  fontSize: 13, color: '#fc5c65',
}
const selectAllBtn = {
  display: 'flex', alignItems: 'center', gap: 4,
  fontSize: 12, color: 'var(--teal)', background: 'none',
  border: 'none', cursor: 'pointer', padding: 0,
}
const cardList = {
  display: 'flex', flexDirection: 'column', gap: 2,
  maxHeight: 280, overflowY: 'auto',
  border: '1px solid var(--border)', borderRadius: 8, padding: 4,
}
const cardRow = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '7px 10px', borderRadius: 6,
  background: 'none', border: 'none', cursor: 'pointer',
  textAlign: 'left', width: '100%',
}
const cardQty = { fontSize: 12, fontWeight: 700, color: 'var(--teal)', width: 28, flexShrink: 0 }
const cardName = { fontSize: 13, color: 'var(--white-dim)', flex: 1 }
const cardSet = {
  fontSize: 10, fontWeight: 600, color: 'var(--grey)',
  background: 'var(--navy)', borderRadius: 3, padding: '1px 5px',
}
const duplicateBox = {
  padding: '12px 14px', background: 'var(--navy)',
  borderRadius: 8, border: '1px solid var(--border)',
}
const dupBtn = {
  flex: 1, padding: '8px 12px', borderRadius: 6, fontSize: 12,
  fontWeight: 500, border: '1px solid var(--border)',
  background: 'var(--card)', color: 'var(--white-dim)', cursor: 'pointer',
}
const dupBtnActive = {
  borderColor: 'var(--teal)', color: 'var(--teal)', background: '#00d4c815',
}
const resultGrid = {
  display: 'flex', gap: 12, justifyContent: 'center',
}
const resultStat = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
  minWidth: 80, padding: '12px 16px',
  background: 'var(--navy)', borderRadius: 8, border: '1px solid var(--border)',
}