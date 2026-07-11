import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../state/gameStore'
import { useBoxStore } from '../state/boxStore'
import { useCalcStore } from '../state/calcStore'
import { BottomSheet } from './components/BottomSheet'
import { parseSets } from '../import/moveReplacements'
import { importSave } from '../save/saveService'
import { withDefaultMoves, type SetState } from '../save/types'

function toSpriteName(species: string): string {
  return species.toLowerCase().replace(/[.''']/g, '').replace(/\s+/g, '-')
}
function iconUrl(species: string) {
  return `https://img.pokemondb.net/sprites/gen4-dp/icon/${toSpriteName(species)}.png`
}

export function BoxScreen() {
  const navigate = useNavigate()
  const game = useGameStore(s => s.game)
  const { sets, addMany, clear, setOwnedTmMoves } = useBoxStore()
  const { setAttacker } = useCalcStore()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [reviewSets, setReviewSets] = useState<SetState[] | null>(null)
  // Owned TM/HM moves from the save being reviewed; applied on commit.
  const [pendingTms, setPendingTms] = useState<string[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!game) return null
  const g = game

  async function importFromClipboard() {
    setError(null)
    try {
      if (!navigator.clipboard?.readText) {
        setPasteOpen(true)
        return
      }
      const text = await navigator.clipboard.readText()
      const parsed = parseSets(text, g.moveReplacements)
      if (parsed.length === 0) {
        setError('No sets found in clipboard.')
        return
      }
      await addMany(parsed)
    } catch {
      setPasteOpen(true)
    }
  }

  function commitPaste() {
    const parsed = parseSets(pasteText, g.moveReplacements)
    if (parsed.length === 0) {
      setError('No sets found in pasted text.')
      return
    }
    addMany(parsed)
    setPasteText('')
    setPasteOpen(false)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    try {
      const { sets: parsed, ownedTmMoves } = await importSave(g, file)
      if (parsed.length === 0) {
        setError('No Pokémon found in save file.')
        return
      }
      setPendingTms(ownedTmMoves)
      setReviewSets(parsed)
    } catch (err) {
      setError(String(err))
    }
  }

  function commitReview() {
    if (reviewSets) addMany(reviewSets)
    if (pendingTms) setOwnedTmMoves(pendingTms)
    setPendingTms(null)
    setReviewSets(null)
  }

  function exportJson() {
    const json = useBoxStore.getState().exportJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'box.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ padding: 'var(--sp-4)' }} className="col">
      <div className="row" style={{ flexWrap: 'wrap' }}>
        <button className="btn btn--primary" onClick={importFromClipboard}>Import from clipboard</button>
        <button className="btn" onClick={() => fileInputRef.current?.click()}>Import save (.sav)</button>
        <button className="btn" onClick={exportJson}>Export JSON</button>
        <button className="btn btn--danger" onClick={() => clear()}>Clear box</button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
        iOS may evict app storage — export your box regularly to avoid losing it.
      </div>

      {error && <div className="card" style={{ color: 'var(--danger)' }}>{error}</div>}

      <div className="col">
        {sets.length === 0 && <div className="muted">Box is empty.</div>}
        {sets.map((s, i) => (
          <button
            key={i}
            className="card row--between"
            style={{ cursor: 'pointer', textAlign: 'left' }}
            onClick={() => { setAttacker(withDefaultMoves(s)); navigate('/') }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <img
                src={iconUrl(s.species)}
                alt=""
                style={{ width: 40, height: 40, imageRendering: 'pixelated', flexShrink: 0 }}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
              <div>
                <div style={{ fontWeight: 700 }}>{s.species}</div>
                <div className="muted" style={{ fontSize: 12 }}>Lv {s.level} · {s.nature}</div>
              </div>
            </div>
            {s.source && (
              <span className={`badge badge--${s.source}`}>{s.source}</span>
            )}
          </button>
        ))}
      </div>

      <BottomSheet open={pasteOpen} title="Paste set(s)" onClose={() => setPasteOpen(false)}>
        <div className="col">
          <textarea
            rows={10}
            placeholder="Paste Showdown-format set(s) here…"
            value={pasteText}
            onChange={e => setPasteText(e.target.value)}
          />
          <button className="btn btn--primary btn--block" onClick={commitPaste}>Add to box</button>
        </div>
      </BottomSheet>

      <BottomSheet
        open={!!reviewSets}
        title="Review import"
        onClose={() => { setReviewSets(null); setPendingTms(null) }}
      >
        <div className="col">
          <div className="muted">
            {reviewSets?.length ?? 0} Pokémon found
            {pendingTms && pendingTms.length > 0 && ` · ${pendingTms.length} TM/HM moves in bag`}
          </div>
          <div className="col">
            {reviewSets?.map((s, i) => (
              <div key={i} className="card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <img
                  src={iconUrl(s.species)}
                  alt=""
                  style={{ width: 40, height: 40, imageRendering: 'pixelated', flexShrink: 0 }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                <div>
                  <div style={{ fontWeight: 700 }}>{s.species}</div>
                  <div className="muted" style={{ fontSize: 12 }}>Lv {s.level} · {s.nature}</div>
                </div>
              </div>
            ))}
          </div>
          <button className="btn btn--primary btn--block" onClick={commitReview}>
            Commit {reviewSets?.length ?? 0} to box
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}
