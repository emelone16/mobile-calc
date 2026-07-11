// Move-focused bottom sheets shared by the calc screen:
//  - MoveDetailSheet: tap a move to see its power / accuracy / PP / etc.
//  - MoveChooserSheet: pick a move to add or swap into a slot (learnable vs all).
//  - LearnsetSheet:    browse a species' level-up moves and TMs.
import { useMemo, useState } from 'react'
import { BottomSheet } from './BottomSheet'
import { buildEvolutionFamily } from '../../data/evolutionFamily'
import type { GameData, MoveData } from '../../data/types'
import type { CalcOutcome } from '../../engine/calcService'

export const TYPE_COLORS: Record<string, string> = {
  Normal: '#A8A878', Fire: '#F08030', Water: '#6890F0', Electric: '#F8D030',
  Grass: '#78C850', Ice: '#98D8D8', Fighting: '#C03028', Poison: '#A040A0',
  Ground: '#E0C068', Flying: '#A890F0', Psychic: '#F85888', Bug: '#A8B820',
  Rock: '#B8A038', Ghost: '#705898', Dragon: '#7038F8', Dark: '#705848',
  Steel: '#B8B8D0', Fairy: '#EE99AC',
}

export function MoveTypeBadge({ type }: { type?: string }) {
  if (!type) return null
  return (
    <span
      className="type-badge"
      style={{ background: TYPE_COLORS[type] ?? 'var(--surface-3)' }}
    >
      {type}
    </span>
  )
}

const CATEGORY_LABEL: Record<string, string> = {
  Physical: 'Physical', Special: 'Special', Status: 'Status',
}

/** Base power as text; 0/undefined (status moves) render as an em dash. */
function fmtPower(bp?: number): string {
  return bp && bp > 0 ? String(bp) : '—'
}
/** Accuracy as text; 0/undefined/true (never-miss or N/A) render as an em dash. */
function fmtAcc(acc?: number | true): string {
  return typeof acc === 'number' && acc > 0 ? `${acc}%` : '—'
}

/** Lowest level at which `species` learns each move by level-up. */
function minLevelByMove(game: GameData, species?: string): Map<string, number> {
  const data = species ? game.species[species] : undefined
  const out = new Map<string, number>()
  for (const [lvl, move] of data?.learnset ?? []) {
    const cur = out.get(move)
    if (cur === undefined || lvl < cur) out.set(move, lvl)
  }
  return out
}

/** Small greyed "🔒 Lv N" hint shown on a move gated behind a level-up. */
function LockHint({ level }: { level: number }) {
  return (
    <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
      🔒 Lv{level}
    </span>
  )
}

/** Small greyed "🔒 No TM" hint for a TM/HM move the player doesn't own. */
function NoTmHint() {
  return (
    <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
      🔒 No TM
    </span>
  )
}

/** Compact inline summary — type badge + "BP · Acc" — used in move lists. */
export function MoveSummary({ move }: { move?: MoveData }) {
  if (!move) return <span className="muted" style={{ fontSize: 12 }}>—</span>
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <MoveTypeBadge type={move.type} />
      <span className="muted" style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
        {fmtPower(move.basePower)} BP · {fmtAcc(move.acc)}
      </span>
    </span>
  )
}

// ---------------------------------------------------------------------------
// Move detail
// ---------------------------------------------------------------------------

export interface MoveDetailSheetProps {
  open: boolean
  onClose(): void
  game: GameData
  moveName?: string
  /** Damage against the current opponent, if any, for both normal & crit. */
  damage?: { normal: CalcOutcome | null; crit: CalcOutcome | null } | null
  onReplace?(): void
  onRemove?(): void
}

export function MoveDetailSheet({
  open, onClose, game, moveName, damage, onReplace, onRemove,
}: MoveDetailSheetProps) {
  const move = moveName ? game.moves[moveName] : undefined
  const priority = move?.priority ?? 0
  const normal = damage?.normal
  const crit = damage?.crit

  return (
    <BottomSheet open={open} title={moveName ?? 'Move'} onClose={onClose}>
      {!move ? (
        <div className="muted" style={{ padding: 12 }}>No data for this move.</div>
      ) : (
        <div className="col" style={{ gap: 12, padding: '4px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MoveTypeBadge type={move.type} />
            <span className="muted">{CATEGORY_LABEL[move.category] ?? move.category}</span>
          </div>

          <div className="stat-row">
            <div className="stat-cell">
              <span className="muted" style={{ fontSize: 11 }}>Power</span>
              <span style={{ fontWeight: 700 }}>{fmtPower(move.basePower)}</span>
            </div>
            <div className="stat-cell">
              <span className="muted" style={{ fontSize: 11 }}>Accuracy</span>
              <span style={{ fontWeight: 700 }}>{fmtAcc(move.acc)}</span>
            </div>
            <div className="stat-cell">
              <span className="muted" style={{ fontSize: 11 }}>PP</span>
              <span style={{ fontWeight: 700 }}>{move.pp ?? '—'}</span>
            </div>
            <div className="stat-cell">
              <span className="muted" style={{ fontSize: 11 }}>Priority</span>
              <span style={{ fontWeight: 700 }}>{priority > 0 ? `+${priority}` : priority}</span>
            </div>
          </div>

          {normal && (
            <div className="col" style={{ gap: 4 }}>
              <div className="label" style={{ margin: 0 }}>Vs current target</div>
              <div className="row--between">
                <span className="muted">Damage</span>
                <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                  {normal.maxPct > 0 ? `${normal.minPct}–${normal.maxPct}%` : 'No damage'}
                </span>
              </div>
              {crit && crit.maxPct > 0 && (
                <div className="row--between">
                  <span className="muted">On crit</span>
                  <span style={{ fontWeight: 700, color: 'var(--danger)', fontVariantNumeric: 'tabular-nums' }}>
                    {crit.minPct}–{crit.maxPct}%
                  </span>
                </div>
              )}
              {normal.koText && (
                <div className="muted" style={{ fontSize: 12 }}>{normal.koText}</div>
              )}
            </div>
          )}

          {(onReplace || onRemove) && (
            <div style={{ display: 'flex', gap: 8 }}>
              {onReplace && (
                <button
                  className="btn btn--block"
                  onClick={() => { onReplace(); onClose() }}
                >
                  Swap move
                </button>
              )}
              {onRemove && (
                <button
                  className="btn btn--danger btn--block"
                  onClick={() => { onRemove(); onClose() }}
                >
                  Remove
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  )
}

// ---------------------------------------------------------------------------
// Move chooser (add / swap)
// ---------------------------------------------------------------------------

export interface MoveChooserSheetProps {
  open: boolean
  onClose(): void
  game: GameData
  /** Species whose learnset scopes the "Learnable" filter. */
  species?: string
  /** Moves already on the set — shown as ticked so you don't re-pick them. */
  currentMoves: string[]
  /** The mon's level; level-up moves above it are greyed (still tappable). */
  level?: number
  /** Moves the player owns a TM/HM for; null = unknown (no save imported). */
  ownedTmMoves?: string[] | null
  onPick(move: string): void
  title?: string
}

/** Union of a species' level-up moves and TMs, in a stable, de-duplicated order. */
function learnableMoves(game: GameData, species?: string): string[] {
  const data = species ? game.species[species] : undefined
  if (!data) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const [, move] of data.learnset) {
    if (!seen.has(move)) { seen.add(move); out.push(move) }
  }
  for (const move of data.tms ?? []) {
    if (!seen.has(move)) { seen.add(move); out.push(move) }
  }
  return out
}

export function MoveChooserSheet({
  open, onClose, game, species, currentMoves, level, ownedTmMoves, onPick, title,
}: MoveChooserSheetProps) {
  const [scope, setScope] = useState<'learn' | 'all'>('learn')
  const [query, setQuery] = useState('')

  const learnable = useMemo(() => learnableMoves(game, species), [game, species])
  const tmSet = useMemo(
    () => new Set(species ? game.species[species]?.tms ?? [] : []),
    [game, species],
  )
  const minLevel = useMemo(() => minLevelByMove(game, species), [game, species])
  // Owned-TM set; null means "no save imported", so TM ownership is unknown.
  const ownedSet = useMemo(
    () => (ownedTmMoves ? new Set(ownedTmMoves) : null),
    [ownedTmMoves],
  )
  const allNames = useMemo(() => Object.keys(game.moves), [game])
  const hasLearnable = learnable.length > 0
  const effectiveScope = hasLearnable ? scope : 'all'

  const base = effectiveScope === 'learn' ? learnable : allNames
  const q = query.trim().toLowerCase()
  const filtered = q ? base.filter(m => m.toLowerCase().includes(q)) : base

  function handleClose() {
    setQuery('')
    onClose()
  }

  return (
    <BottomSheet
      open={open}
      title={title ?? 'Choose move'}
      onClose={handleClose}
      pinned={
        <div className="col" style={{ gap: 8 }}>
          {hasLearnable && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className={`chip ${effectiveScope === 'learn' ? 'chip--active' : ''}`}
                onClick={() => setScope('learn')}
              >
                Learnable
              </button>
              <button
                className={`chip ${effectiveScope === 'all' ? 'chip--active' : ''}`}
                onClick={() => setScope('all')}
              >
                All moves
              </button>
            </div>
          )}
          <input
            className="sheet-search"
            type="text"
            placeholder="Search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      }
    >
      <div>
        {filtered.length === 0 && (
          <div className="muted" style={{ padding: 12 }}>No matches</div>
        )}
        {filtered.map(name => {
          const inSet = currentMoves.includes(name)
          // Availability (learnable scope only): reachable now by level-up, or
          // via an owned TM. Unknown TM ownership counts as available.
          const req = minLevel.get(name)
          const levelReachable = req !== undefined && (level === undefined || req <= level)
          const isTm = tmSet.has(name)
          const tmOwned = ownedSet ? ownedSet.has(name) : true
          const locked =
            effectiveScope === 'learn' && !levelReachable && !(isTm && tmOwned)
          // Prefer the TM hint when a TM is the intended path but isn't owned.
          const hint = !locked ? null
            : isTm && !tmOwned ? <NoTmHint />
              : req !== undefined ? <LockHint level={req} />
                : null
          return (
            <button
              key={name}
              className={`picker-row ${locked ? 'picker-row--locked' : ''}`}
              onClick={() => { onPick(name); handleClose() }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </span>
                {inSet && <span className="muted" style={{ fontSize: 12 }}>✓</span>}
                {hint}
              </span>
              <MoveSummary move={game.moves[name]} />
            </button>
          )
        })}
      </div>
    </BottomSheet>
  )
}

// ---------------------------------------------------------------------------
// Evolution-line learnset comparison
// ---------------------------------------------------------------------------

export interface EvolutionLearnsetSheetProps {
  open: boolean
  onClose(): void
  game: GameData
  /** The mon whose evolution family is compared; its column is highlighted. */
  species?: string
}

/**
 * Side-by-side learnsets for every stage in a species' evolution family, so you
 * can see at a glance which moves each stage gets (and at what level) — e.g. a
 * move the fully-evolved form learns that the base stage never does.
 */
export function EvolutionLearnsetSheet({ open, onClose, game, species }: EvolutionLearnsetSheetProps) {
  const [tab, setTab] = useState<'level' | 'tm'>('level')
  const [query, setQuery] = useState('')

  const family = useMemo(
    () => (species ? buildEvolutionFamily(game, species) : []),
    [game, species],
  )
  // Per-stage lookups, aligned by index with `family`.
  const levelMaps = useMemo(() => family.map(s => minLevelByMove(game, s)), [game, family])
  const tmSets = useMemo(
    () => family.map(s => new Set(game.species[s]?.tms ?? [])),
    [game, family],
  )

  const moves = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (tab === 'level') {
      // Union of level-up moves, sorted by the earliest level any stage learns.
      const minAcross = new Map<string, number>()
      for (const m of levelMaps) {
        for (const [move, lvl] of m) {
          const cur = minAcross.get(move)
          if (cur === undefined || lvl < cur) minAcross.set(move, lvl)
        }
      }
      let rows = [...minAcross.entries()]
      if (q) rows = rows.filter(([m]) => m.toLowerCase().includes(q))
      rows.sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      return rows.map(([m]) => m)
    }
    const union = new Set<string>()
    for (const s of tmSets) for (const m of s) union.add(m)
    let rows = [...union]
    if (q) rows = rows.filter(m => m.toLowerCase().includes(q))
    rows.sort((a, b) => a.localeCompare(b))
    return rows
  }, [tab, query, levelMaps, tmSets])

  function handleClose() {
    setQuery('')
    onClose()
  }

  function cellFor(i: number, move: string): string {
    if (tab === 'level') {
      const lvl = levelMaps[i]!.get(move)
      return lvl !== undefined ? String(lvl) : '·'
    }
    return tmSets[i]!.has(move) ? '✓' : '·'
  }

  return (
    <BottomSheet
      open={open}
      title={species ? `${species} — evolution learnsets` : 'Evolution learnsets'}
      onClose={handleClose}
      pinned={
        <div className="col" style={{ gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={`chip ${tab === 'level' ? 'chip--active' : ''}`}
              onClick={() => setTab('level')}
            >
              Level-up
            </button>
            <button
              className={`chip ${tab === 'tm' ? 'chip--active' : ''}`}
              onClick={() => setTab('tm')}
            >
              TMs
            </button>
          </div>
          <input
            className="sheet-search"
            type="text"
            placeholder="Search moves…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <div className="muted" style={{ fontSize: 12 }}>
            {tab === 'level' ? 'Numbers = level learned' : '✓ = learns via TM'} · · = not learned
          </div>
        </div>
      }
    >
      {family.length <= 1 ? (
        <div className="muted" style={{ padding: 12 }}>
          This Pokémon has no evolution line to compare.
        </div>
      ) : moves.length === 0 ? (
        <div className="muted" style={{ padding: 12 }}>No matches</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="evo-table">
            <thead>
              <tr>
                <th className="evo-move">Move</th>
                {family.map(s => (
                  <th key={s} className={s === species ? 'evo-col--current' : undefined}>{s}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {moves.map(move => (
                <tr key={move}>
                  <td className="evo-move">{move}</td>
                  {family.map((s, i) => {
                    const cell = cellFor(i, move)
                    const current = s === species
                    const none = cell === '·'
                    const cls = [
                      current ? 'evo-col--current' : '',
                      none ? 'evo-cell--none' : '',
                    ].filter(Boolean).join(' ')
                    return <td key={s} className={cls || undefined}>{cell}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </BottomSheet>
  )
}

// ---------------------------------------------------------------------------
// Learnset browser
// ---------------------------------------------------------------------------

export interface LearnsetSheetProps {
  open: boolean
  onClose(): void
  game: GameData
  species?: string
  currentMoves: string[]
  /** The mon's level; level-up moves above it are greyed (still tappable). */
  monLevel?: number
  /** Moves the player owns a TM/HM for; null = unknown (no save imported). */
  ownedTmMoves?: string[] | null
  /** When provided, tapping a move adds it to the set. */
  onAdd?(move: string): void
}

export function LearnsetSheet({
  open, onClose, game, species, currentMoves, monLevel, ownedTmMoves, onAdd,
}: LearnsetSheetProps) {
  const [tab, setTab] = useState<'level' | 'tm'>('level')
  const [query, setQuery] = useState('')
  const data = species ? game.species[species] : undefined

  const q = query.trim().toLowerCase()
  const levelRows = useMemo(() => {
    const rows = data?.learnset ?? []
    return q ? rows.filter(([, m]) => m.toLowerCase().includes(q)) : rows
  }, [data, q])
  const tmRows = useMemo(() => {
    const rows = data?.tms ?? []
    return q ? rows.filter(m => m.toLowerCase().includes(q)) : rows
  }, [data, q])

  function handleClose() {
    setQuery('')
    onClose()
  }

  const rows: Array<{ key: string; level?: number; move: string }> =
    tab === 'level'
      ? levelRows.map(([lvl, m], i) => ({ key: `${m}-${lvl}-${i}`, level: lvl, move: m }))
      : tmRows.map((m, i) => ({ key: `${m}-${i}`, move: m }))

  return (
    <BottomSheet
      open={open}
      title={species ? `${species} — learnset` : 'Learnset'}
      onClose={handleClose}
      pinned={
        <div className="col" style={{ gap: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={`chip ${tab === 'level' ? 'chip--active' : ''}`}
              onClick={() => setTab('level')}
            >
              Level-up ({data?.learnset.length ?? 0})
            </button>
            <button
              className={`chip ${tab === 'tm' ? 'chip--active' : ''}`}
              onClick={() => setTab('tm')}
            >
              TMs ({data?.tms?.length ?? 0})
            </button>
          </div>
          <input
            className="sheet-search"
            type="text"
            placeholder="Search…"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>
      }
    >
      <div>
        {!data && <div className="muted" style={{ padding: 12 }}>No species selected.</div>}
        {data && rows.length === 0 && (
          <div className="muted" style={{ padding: 12 }}>
            {tab === 'tm' ? 'No TM moves.' : 'No level-up moves.'}
          </div>
        )}
        {rows.map(({ key, level, move }) => {
          const inSet = currentMoves.includes(move)
          // Level-up tab: greyed if the mon hasn't reached the level yet.
          // TM tab: greyed if the bag is known and lacks this TM/HM.
          const locked = tab === 'level'
            ? (level !== undefined && monLevel !== undefined && level > monLevel)
            : (ownedTmMoves != null && !ownedTmMoves.includes(move))
          const content = (
            <>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                {level !== undefined && (
                  <span
                    className="muted"
                    style={{ fontVariantNumeric: 'tabular-nums', minWidth: 34, fontSize: 12 }}
                  >
                    Lv{level}
                  </span>
                )}
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {move}
                </span>
                {inSet && <span className="muted" style={{ fontSize: 12 }}>✓</span>}
                {locked && !inSet && (
                  <span className="muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>
                    {tab === 'tm' ? '🔒 No TM' : '🔒'}
                  </span>
                )}
              </span>
              <MoveSummary move={game.moves[move]} />
            </>
          )
          const cls = `picker-row ${locked ? 'picker-row--locked' : ''}`
          return onAdd ? (
            <button
              key={key}
              className={cls}
              disabled={inSet}
              onClick={() => { onAdd(move); handleClose() }}
            >
              {content}
            </button>
          ) : (
            <div key={key} className={cls} style={{ cursor: 'default' }}>
              {content}
            </div>
          )
        })}
      </div>
    </BottomSheet>
  )
}
