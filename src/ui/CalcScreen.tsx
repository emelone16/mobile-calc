import { useMemo, useState } from 'react'
import { useGameStore } from '../state/gameStore'
import { useCalcStore } from '../state/calcStore'
import { useBoxStore } from '../state/boxStore'
import { predictSwitchIn } from '../engine/aiService'
import { computeStats, applyBoost, runCalc, effectiveSpeed, speedWeatherMultiplier, speedItemMultiplier } from '../engine/calcService'
import { getAllItemNames } from '../engine/generationsAdapter'
import { SearchablePicker } from './components/BottomSheet'
import {
  MoveTypeBadge, MoveDetailSheet, MoveChooserSheet, LearnsetSheet, ReplaceSlotSheet,
} from './components/MoveSheets'
import { NATURES, withDefaultMoves } from '../save/types'
import type { SetState, BoostKey } from '../save/types'
import type { StatKey, StatsTable, Trainer, TrainerSet, GameData } from '../data/types'
import type { FieldState } from '../state/calcStore'
import { groupTrainersByLocation, displayLocation } from '../data/trainerGroups'

function trainerSetToSetState(t: TrainerSet): SetState {
  return {
    species: t.species, level: t.level, nature: t.nature, ability: t.ability,
    item: t.item, moves: t.moves, defaultMoves: [...t.moves], ivs: t.ivs, evs: t.evs ?? {},
  }
}

// Short labels for the Speed modifiers folded into the displayed stat, so the
// tinted number says *why* it changed (weather ability, item, or paralysis).
const SPEED_ITEM_LABELS: Record<string, string> = {
  'Choice Scarf': 'Scarf', 'Quick Powder': '×2',
  'Iron Ball': 'Iron Ball', 'Macho Brace': 'Brace',
}
function speedModLabels(game: GameData, set: SetState, field: FieldState): string[] {
  const out: string[] = []
  // Weather Speed abilities are labelled with the weather that triggers them.
  if (field.weather && speedWeatherMultiplier(game, set, field) > 1) out.push(field.weather)
  const im = speedItemMultiplier(set.item, set.species)
  if (im !== 1) out.push(SPEED_ITEM_LABELS[set.item.trim()] ?? (im < 1 ? 'Power' : 'item'))
  if (set.paralyzed) out.push('PAR')
  return out
}

const STAT_KEYS: StatKey[] = ['hp', 'at', 'df', 'sa', 'sd', 'sp']
const STAT_LABELS: Record<StatKey, string> = { hp: 'HP', at: 'Atk', df: 'Def', sa: 'SpA', sd: 'SpD', sp: 'Spe' }

// Stats that have in-battle stat stages (everything except HP).
const BOOST_KEYS: BoostKey[] = ['at', 'df', 'sa', 'sd', 'sp']

// Common stat-boosting moves and the stages they add. Tapping one applies its
// deltas on top of the current boosts (clamped -6..+6), just like using the
// move in-battle. A second tap stacks, mirroring a second turn of setup.
const BOOST_MOVES: Array<{ name: string; deltas: Partial<Record<BoostKey, number>> }> = [
  { name: 'Swords Dance', deltas: { at: 2 } },
  { name: 'Nasty Plot', deltas: { sa: 2 } },
  { name: 'Dragon Dance', deltas: { at: 1, sp: 1 } },
  { name: 'Calm Mind', deltas: { sa: 1, sd: 1 } },
  { name: 'Bulk Up', deltas: { at: 1, df: 1 } },
  { name: 'Quiver Dance', deltas: { sa: 1, sd: 1, sp: 1 } },
  { name: 'Agility', deltas: { sp: 2 } },
  { name: 'Iron Defense', deltas: { df: 2 } },
  { name: 'Amnesia', deltas: { sd: 2 } },
  { name: 'Growth', deltas: { at: 1, sa: 1 } },
]

function fmtStage(n: number): string {
  return n > 0 ? `+${n}` : `${n}`
}

// Which stat each nature raises (+10%) and lowers (-10%); neutral natures absent.
const NATURE_EFFECTS: Record<string, { plus: StatKey; minus: StatKey }> = {
  Lonely: { plus: 'at', minus: 'df' }, Brave: { plus: 'at', minus: 'sp' },
  Adamant: { plus: 'at', minus: 'sa' }, Naughty: { plus: 'at', minus: 'sd' },
  Bold: { plus: 'df', minus: 'at' }, Relaxed: { plus: 'df', minus: 'sp' },
  Impish: { plus: 'df', minus: 'sa' }, Lax: { plus: 'df', minus: 'sd' },
  Timid: { plus: 'sp', minus: 'at' }, Hasty: { plus: 'sp', minus: 'df' },
  Jolly: { plus: 'sp', minus: 'sa' }, Naive: { plus: 'sp', minus: 'sd' },
  Modest: { plus: 'sa', minus: 'at' }, Mild: { plus: 'sa', minus: 'df' },
  Quiet: { plus: 'sa', minus: 'sp' }, Rash: { plus: 'sa', minus: 'sd' },
  Calm: { plus: 'sd', minus: 'at' }, Gentle: { plus: 'sd', minus: 'df' },
  Sassy: { plus: 'sd', minus: 'sp' }, Careful: { plus: 'sd', minus: 'sa' },
}
function toSpriteName(species: string): string {
  return species.toLowerCase().replace(/[.''']/g, '').replace(/\s+/g, '-')
}
function spriteUrl(species: string) {
  return `https://img.pokemondb.net/sprites/diamond-pearl/normal/${toSpriteName(species)}.png`
}
function iconUrl(species: string) {
  return `https://img.pokemondb.net/sprites/gen4-dp/icon/${toSpriteName(species)}.png`
}

export function CalcScreen() {
  const game = useGameStore(s => s.game)
  const { attacker, defender, defenderTeam, field, setAttacker, setDefender } = useCalcStore()

  const threats = useMemo(() => {
    if (!game || !attacker || defenderTeam.length <= 1 || !game.mechanics.features.ai) return null
    try { return predictSwitchIn(game, attacker, defenderTeam, field) }
    catch { return null }
  }, [game, attacker, defenderTeam, field])

  if (!game) return null

  return (
    <div style={{ padding: 'var(--sp-4)' }} className="col">
      <MonEditor
        label="Yours"
        game={game}
        value={attacker}
        opponent={defender}
        onChange={setAttacker}
      />
      <MonEditor
        label="Enemy"
        game={game}
        value={defender}
        opponent={attacker}
        onChange={setDefender}
      />
      {threats && threats.length > 0 && (
        <div className="card col">
          <div className="label">Enemy switch-in threats</div>
          {threats.map((t, i) => (
            <div key={`${t.set.species}-${i}`} className="row--between">
              <span>{i + 1}. {t.set.species}</span>
              <span className="muted">
                {t.bestMove ?? '—'} · {t.maxPct}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface MonEditorProps {
  label: string
  game: NonNullable<ReturnType<typeof useGameStore.getState>['game']>
  value: SetState | null
  /** The Pokémon on the other side — moves are calc'd against it. */
  opponent: SetState | null
  onChange(s: SetState): void
}

function MonEditor({ label, game, value, opponent, onChange }: MonEditorProps) {
  const {
    defenderTeam, defenderIndex, trainerName, switchDefender, setDefenderTeam, field,
    attackerTeam, attackerIndex, switchAttacker, addToAttackerParty, removeFromAttackerParty,
  } = useCalcStore()
  const boxSets = useBoxStore(s => s.sets)
  const ownedTmMoves = useBoxStore(s => s.ownedTmMoves)
  const isYours = label === 'Yours'
  // The enemy card shows a party switcher when a whole trainer team is carried.
  const showParty = !isYours && defenderTeam.length > 1
  // Move rows whose damage range is currently showing the critical-hit numbers.
  const [critRows, setCritRows] = useState<Set<number>>(new Set())
  const [showPartyAddPicker, setShowPartyAddPicker] = useState(false)
  const [showSpeciesPicker, setShowSpeciesPicker] = useState(false)
  const [showNaturePicker, setShowNaturePicker] = useState(false)
  const [showAbilityPicker, setShowAbilityPicker] = useState(false)
  const [showItemPicker, setShowItemPicker] = useState(false)
  // Which move slot's detail sheet is open (null = closed).
  const [detailIndex, setDetailIndex] = useState<number | null>(null)
  // Open move chooser: {mode:'add'} appends, {mode:'replace',index} swaps a slot.
  const [chooser, setChooser] = useState<{ mode: 'add' } | { mode: 'replace'; index: number } | null>(null)
  // A move waiting for the user to choose which full-set slot it replaces.
  const [pendingReplace, setPendingReplace] = useState<string | null>(null)
  const [showLearnset, setShowLearnset] = useState(false)
  const [showTrainerPicker, setShowTrainerPicker] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [showBoosts, setShowBoosts] = useState(false)

  // Grouped by (split, location) in story order, so the trainer picker reads
  // top-to-bottom the way the game is actually played instead of by trId.
  const trainerGroups = useMemo(
    () => (isYours ? [] : groupTrainersByLocation(Object.values(game.trainers.byId))),
    [game, isYours],
  )
  const allTrainers = useMemo(
    () => trainerGroups.flatMap(g => g.trainers),
    [trainerGroups],
  )
  const trainerGroupLabel = useMemo(() => {
    const labels = new Map<number, string>()
    for (const g of trainerGroups) {
      for (const t of g.trainers) labels.set(t.trId, `${g.split} — ${displayLocation(g.location)}`)
    }
    return labels
  }, [trainerGroups])
  const itemNames = useMemo(() => ['None', ...getAllItemNames(game)], [game])
  const speciesData = value ? game.species[value.species] : undefined
  const abilityOptions = speciesData ? Object.values(speciesData.abilities) : []
  // The headline numbers: actual stats at this level/nature/IV/EV spread.
  const stats = useMemo(() => {
    if (!value) return null
    try { return computeStats(game, value) }
    catch { return null }
  }, [game, value])
  const natureEffect = value ? NATURE_EFFECTS[value.nature] : undefined

  // Damage range for each move slot against the opposing mon, computed both
  // normal and on a critical hit so a tap can flip between them instantly.
  const moveOutcomes = useMemo(() => {
    if (!value || !opponent) return []
    return value.moves.map(m => {
      try {
        return {
          normal: runCalc(game, value, opponent, m, field, false),
          crit: runCalc(game, value, opponent, m, field, true),
        }
      } catch {
        return { normal: null, crit: null }
      }
    })
  }, [game, value, opponent, field])

  function toggleCritRow(i: number) {
    setCritRows(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  function pickFromBox(s: SetState) {
    onChange(withDefaultMoves({ ...s, moves: [...s.moves], ivs: { ...s.ivs }, evs: { ...s.evs } }))
  }

  function pickTrainer(trainer: Trainer) {
    const team = trainer.team.map(trainerSetToSetState)
    setDefenderTeam(team, 0, trainer.name)
    setShowTrainerPicker(false)
  }

  function patch(p: Partial<SetState>) {
    if (!value) return
    onChange({ ...value, ...p })
  }

  function patchIv(key: StatKey, v: number) {
    if (!value) return
    onChange({ ...value, ivs: { ...value.ivs, [key]: v } })
  }
  function patchEv(key: StatKey, v: number) {
    if (!value) return
    onChange({ ...value, evs: { ...value.evs, [key]: v } })
  }

  // Boosts are stored sparsely: a stage of 0 is dropped, and an all-zero table
  // becomes `undefined` so unboosted mons stay clean in storage and calc.
  function writeBoosts(next: Partial<Record<BoostKey, number>>) {
    if (!value) return
    const clean: Partial<Record<BoostKey, number>> = {}
    for (const k of BOOST_KEYS) {
      const s = next[k]
      if (typeof s === 'number' && s !== 0) clean[k] = Math.max(-6, Math.min(6, s))
    }
    onChange({ ...value, boosts: Object.keys(clean).length ? clean : undefined })
  }
  function toggleParalyzed() {
    if (!value) return
    onChange({ ...value, paralyzed: !value.paralyzed || undefined })
  }
  function setBoost(key: BoostKey, stage: number) {
    if (!value) return
    writeBoosts({ ...value.boosts, [key]: stage })
  }
  function applyBoostMove(deltas: Partial<Record<BoostKey, number>>) {
    if (!value) return
    const next: Partial<Record<BoostKey, number>> = { ...value.boosts }
    for (const k of BOOST_KEYS) {
      const d = deltas[k]
      if (typeof d === 'number') next[k] = (next[k] ?? 0) + d
    }
    writeBoosts(next)
  }

  // Add a move to a free slot; if the set is already full, let the user pick
  // which move it replaces (rather than silently dropping one).
  function handleAdd(m: string) {
    if (!value || value.moves.includes(m)) return
    if (value.moves.length >= 4) {
      setPendingReplace(m)
      return
    }
    onChange({ ...value, moves: [...value.moves, m] })
  }
  // Swap the move in slot `i`. If the incoming move already sits in another
  // slot, the two trade places so the set never holds a duplicate.
  function replaceMoveAt(i: number, m: string) {
    if (!value) return
    const moves = [...value.moves]
    const cur = moves[i]
    const j = moves.indexOf(m)
    if (j !== -1 && j !== i && cur !== undefined) moves[j] = cur
    moves[i] = m
    onChange({ ...value, moves })
  }
  function removeMoveAt(i: number) {
    if (!value) return
    onChange({ ...value, moves: value.moves.filter((_, idx) => idx !== i) })
  }
  // Restore the moveset captured when this Pokémon was loaded.
  function resetMoves() {
    if (!value?.defaultMoves) return
    onChange({ ...value, moves: [...value.defaultMoves] })
  }

  const defaultMoves = value?.defaultMoves
  const movesOverridden =
    !!defaultMoves &&
    (value!.moves.length !== defaultMoves.length ||
      value!.moves.some((m, i) => m !== defaultMoves[i]))
  // A slot holds an override when its move wasn't in the original moveset.
  const isDefaultMove = (m: string) => !defaultMoves || defaultMoves.includes(m)

  return (
    <div className="card col">
      <div className="row--between">
        <div className="label" style={{ margin: 0 }}>{label}</div>
      </div>

      {showParty && (
        <div className="col" style={{ gap: 4 }}>
          <div className="label" style={{ margin: 0 }}>
            {trainerName ? `${trainerName}'s party` : 'Party'}
          </div>
          <div className="scroll-x" style={{ paddingBottom: 4 }}>
            {defenderTeam.map((mon, i) => (
              <button
                key={`${mon.species}-${i}`}
                className={`chip ${i === defenderIndex ? 'chip--active' : ''}`}
                style={{ flexShrink: 0 }}
                onClick={() => switchDefender(i)}
              >
                <img
                  src={iconUrl(mon.species)}
                  alt=""
                  style={{ width: 32, height: 32, imageRendering: 'pixelated' }}
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                />
                {mon.species} <span className="muted" style={{ marginLeft: 4 }}>Lv{mon.level}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {isYours && attackerTeam.length >= 1 && (
        <div className="col" style={{ gap: 4 }}>
          <div className="label" style={{ margin: 0 }}>My Party</div>
          <div className="scroll-x" style={{ paddingBottom: 4 }}>
            {attackerTeam.map((mon, i) => (
              <div key={`${mon.species}-${i}`} style={{ display: 'flex', flexShrink: 0, alignItems: 'center', gap: 2 }}>
                <button
                  className={`chip ${i === attackerIndex ? 'chip--active' : ''}`}
                  onClick={() => switchAttacker(i)}
                >
                  <img
                    src={iconUrl(mon.species)}
                    alt=""
                    style={{ width: 32, height: 32, imageRendering: 'pixelated' }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                  {mon.species} <span className="muted" style={{ marginLeft: 4 }}>Lv{mon.level}</span>
                </button>
                <button
                  className="chip"
                  style={{ padding: '0 8px', opacity: 0.6 }}
                  onClick={() => removeFromAttackerParty(i)}
                  aria-label={`Remove ${mon.species} from party`}
                >
                  ×
                </button>
              </div>
            ))}
            {attackerTeam.length < 6 && (
              <button
                className="chip"
                style={{ flexShrink: 0 }}
                onClick={() => setShowPartyAddPicker(true)}
                aria-label="Add Pokémon to party"
              >
                + Add
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {value && (
          <img
            src={spriteUrl(value.species)}
            alt={value.species}
            style={{ width: 80, height: 80, imageRendering: 'pixelated', flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        )}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button
            className="field-btn"
            onClick={() => (isYours ? setShowSpeciesPicker(true) : setShowTrainerPicker(true))}
          >
            <span style={{ fontWeight: 700, fontSize: 'var(--fs-lg)' }}>
              {value?.species ?? (
                <span className="muted">{isYours ? 'Tap to choose' : 'Search trainer…'}</span>
              )}
            </span>
            <span className="muted">▾</span>
          </button>
          {speciesData && speciesData.types.length > 0 && (
            <div style={{ display: 'flex', gap: 4 }}>
              {speciesData.types.map(type => (
                <span key={type} className={`type-chip type-${type.toLowerCase()}`}>{type}</span>
              ))}
            </div>
          )}
          {!isYours && trainerName && (
            <span className="muted" style={{ fontSize: 12 }}>Trainer: {trainerName}</span>
          )}
          {isYours && boxSets.length === 0 && (
            <span className="muted" style={{ fontSize: 12 }}>
              Your box is empty — add Pokémon from the Box tab.
            </span>
          )}
        </div>
      </div>

      {value && (
        <>
          <div className="input-row">
            <div className="stat-input">
              <span className="label" style={{ margin: 0 }}>Level</span>
              <input
                type="number"
                min={1}
                max={100}
                value={value.level}
                onChange={e => patch({ level: clampInt(e.target.value, 1, 100, value.level) })}
              />
            </div>
            <button className="field-btn" style={{ minHeight: 44, alignSelf: 'end' }} onClick={() => setShowNaturePicker(true)}>
              {value.nature}
            </button>
            <button className="field-btn" style={{ minHeight: 44, alignSelf: 'end' }} onClick={() => setShowAbilityPicker(true)}>
              {value.ability || 'Ability'}
            </button>
          </div>

          <button className="field-btn" onClick={() => setShowItemPicker(true)}>
            <span>{value.item || <span className="muted">Item</span>}</span>
            <span className="muted">▾</span>
          </button>

          <div className="row--between">
            <div className="label" style={{ margin: 0 }}>Moves</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {movesOverridden && (
                <button className="btn btn--sm" onClick={resetMoves} title="Restore the moves from import">
                  Reset
                </button>
              )}
              <button
                className="btn btn--sm"
                disabled={!speciesData}
                onClick={() => setShowLearnset(true)}
              >
                Learnset
              </button>
            </div>
          </div>
          <div className="col" style={{ gap: 6 }}>
            {[0, 1, 2, 3].map(i => {
              const m = value.moves[i]
              if (!m) {
                return (
                  <button
                    key={i}
                    className="move-row move-row--empty"
                    onClick={() => setChooser({ mode: 'add' })}
                  >
                    + Add move
                  </button>
                )
              }
              const showCrit = critRows.has(i)
              const outcome = moveOutcomes[i]
              const o = showCrit ? outcome?.crit : outcome?.normal
              const range = !opponent
                ? 'No target'
                : o
                  ? (o.maxPct > 0 ? `${o.minPct}–${o.maxPct}%` : '—')
                  : '—'
              const moveType = game.moves[m]?.type
              const overridden = !isDefaultMove(m)
              return (
                <div key={i} className="move-row">
                  <button
                    className="move-row__tap"
                    onClick={() => setDetailIndex(i)}
                    aria-label={`Details for ${m}`}
                  >
                    <span className="move-row__name">{m}</span>
                    <MoveTypeBadge type={moveType} />
                    {overridden && (
                      <span className="move-override-dot" title="Overridden — not the imported move" />
                    )}
                  </button>
                  <button
                    className="move-row__dmg-btn"
                    onClick={() => toggleCritRow(i)}
                    aria-label={`Toggle crit damage for ${m}`}
                  >
                    <span
                      className="move-row__dmg"
                      style={showCrit ? { color: 'var(--danger)' } : undefined}
                    >
                      {showCrit && opponent ? 'crit ' : ''}{range}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>

          {stats && (
            <>
              <div className="label">Stats</div>
              <div className="stat-row">
                {STAT_KEYS.map(k => {
                  const stage = k === 'hp' ? 0 : (value.boosts?.[k as BoostKey] ?? 0)
                  const boosted = stage !== 0 ? applyBoost(stats[k], stage) : stats[k]
                  // Speed folds in the modifiers the game applies after the stat
                  // stage (weather abilities, held items, paralysis) so the
                  // headline number matches what the damage engine uses.
                  const shown = k === 'sp' ? effectiveSpeed(game, value, field, stats.sp) : boosted
                  const speedMods = k === 'sp' ? speedModLabels(game, value, field) : []
                  const spUp = k === 'sp' && shown > boosted
                  const spDown = k === 'sp' && shown < boosted
                  const tone =
                    stage > 0 || spUp ? 'var(--good)'
                      : stage < 0 || spDown ? 'var(--danger)'
                        : natureEffect?.plus === k ? 'var(--good)'
                          : natureEffect?.minus === k ? 'var(--danger)'
                            : 'var(--text)'
                  const mark = stage === 0
                    ? (natureEffect?.plus === k ? '＋' : natureEffect?.minus === k ? '－' : '')
                    : ''
                  return (
                    <div className="stat-cell" key={k}>
                      <span className="muted" style={{ fontSize: 11 }}>{STAT_LABELS[k]}</span>
                      <span style={{ fontWeight: 700, color: tone }}>{shown}{mark}</span>
                      {stage !== 0 && (
                        <span style={{ fontSize: 10, color: tone }}>{fmtStage(stage)}</span>
                      )}
                      {speedMods.length > 0 && (
                        <span style={{ fontSize: 10, color: tone }}>{speedMods.join(' ')}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <div className="row--between">
            <button className="btn btn--sm" onClick={() => setShowBoosts(v => !v)}>
              {showBoosts ? 'Hide' : 'Show'} Boosts
            </button>
            <button className="btn btn--sm" onClick={() => setExpanded(v => !v)}>
              {expanded ? 'Hide' : 'Show'} IVs / EVs
            </button>
          </div>

          {showBoosts && (
            <div className="col" style={{ gap: 8 }}>
              <div className="row--between">
                <div className="label" style={{ margin: 0 }}>Stat boosts</div>
                {value.boosts && (
                  <button className="btn btn--sm" onClick={() => writeBoosts({})}>Reset</button>
                )}
              </div>
              <div className="row--between">
                <span style={{ fontWeight: 600 }}>Paralyzed</span>
                <button
                  className={`chip ${value.paralyzed ? 'chip--active' : ''}`}
                  onClick={toggleParalyzed}
                  title="Quarters Speed (halves from gen 7)"
                >
                  {value.paralyzed ? 'On' : 'Off'}
                </button>
              </div>
              <div className="scroll-x" style={{ paddingBottom: 4 }}>
                {BOOST_MOVES.map(mv => (
                  <button
                    key={mv.name}
                    className="chip"
                    style={{ flexShrink: 0 }}
                    onClick={() => applyBoostMove(mv.deltas)}
                    title={BOOST_KEYS.filter(k => mv.deltas[k])
                      .map(k => `${STAT_LABELS[k]} ${fmtStage(mv.deltas[k]!)}`).join(', ')}
                  >
                    {mv.name}
                  </button>
                ))}
              </div>
              <div className="col" style={{ gap: 4 }}>
                {BOOST_KEYS.map(k => {
                  const stage = value.boosts?.[k] ?? 0
                  return (
                    <div className="row--between" key={k}>
                      <span style={{ fontWeight: 600 }}>{STAT_LABELS[k]}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          className="btn btn--sm"
                          disabled={stage <= -6}
                          onClick={() => setBoost(k, stage - 1)}
                          aria-label={`Lower ${STAT_LABELS[k]} boost`}
                        >
                          −
                        </button>
                        <span style={{
                          minWidth: 32, textAlign: 'center', fontWeight: 700,
                          color: stage > 0 ? 'var(--good)' : stage < 0 ? 'var(--danger)' : 'var(--text)',
                        }}>
                          {fmtStage(stage)}
                        </span>
                        <button
                          className="btn btn--sm"
                          disabled={stage >= 6}
                          onClick={() => setBoost(k, stage + 1)}
                          aria-label={`Raise ${STAT_LABELS[k]} boost`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {expanded && (
            <div className="col">
              <div className="label">IVs</div>
              <div className="input-row">
                {STAT_KEYS.map(k => (
                  <div className="stat-input" key={k}>
                    <span className="muted" style={{ fontSize: 11 }}>{STAT_LABELS[k]}</span>
                    <input
                      type="number" min={0} max={31}
                      value={value.ivs[k]}
                      onChange={e => patchIv(k, clampInt(e.target.value, 0, 31, value.ivs[k]))}
                    />
                  </div>
                ))}
              </div>
              <div className="label">EVs</div>
              <div className="input-row">
                {STAT_KEYS.map(k => (
                  <div className="stat-input" key={k}>
                    <span className="muted" style={{ fontSize: 11 }}>{STAT_LABELS[k]}</span>
                    <input
                      type="number" min={0} max={252}
                      value={value.evs[k] ?? 0}
                      onChange={e => patchEv(k, clampInt(e.target.value, 0, 252, value.evs[k] ?? 0))}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {isYours && (
        <SearchablePicker
          open={showSpeciesPicker}
          items={boxSets}
          getLabel={s => `${s.species} (Lv ${s.level})`}
          onPick={pickFromBox}
          onClose={() => setShowSpeciesPicker(false)}
          title="Choose from your box"
        />
      )}
      {isYours && (
        <SearchablePicker
          open={showPartyAddPicker}
          items={boxSets}
          getLabel={s => `${s.species} (Lv ${s.level})`}
          onPick={(s) => {
            addToAttackerParty(withDefaultMoves({ ...s, moves: [...s.moves], ivs: { ...s.ivs }, evs: { ...s.evs } }))
            setShowPartyAddPicker(false)
          }}
          onClose={() => setShowPartyAddPicker(false)}
          title="Add to party"
        />
      )}
      <SearchablePicker
        open={showTrainerPicker}
        items={allTrainers}
        getLabel={t => `${t.name} (${displayLocation(t.location)})`}
        getGroup={t => trainerGroupLabel.get(t.trId) ?? displayLocation(t.location)}
        onPick={pickTrainer}
        onClose={() => setShowTrainerPicker(false)}
        title="Search trainer"
      />
      <SearchablePicker
        open={showNaturePicker}
        items={[...NATURES]}
        getLabel={n => n}
        onPick={n => patch({ nature: n })}
        onClose={() => setShowNaturePicker(false)}
        title="Choose nature"
      />
      <SearchablePicker
        open={showAbilityPicker}
        items={abilityOptions}
        getLabel={a => a}
        onPick={a => patch({ ability: a })}
        onClose={() => setShowAbilityPicker(false)}
        title="Choose ability"
      />
      <SearchablePicker
        open={showItemPicker}
        items={itemNames}
        getLabel={i => i}
        onPick={i => patch({ item: i === 'None' ? '' : i })}
        onClose={() => setShowItemPicker(false)}
        title="Choose item"
      />
      <MoveDetailSheet
        open={detailIndex !== null}
        onClose={() => setDetailIndex(null)}
        game={game}
        moveName={detailIndex !== null ? value?.moves[detailIndex] : undefined}
        damage={detailIndex !== null ? moveOutcomes[detailIndex] ?? null : null}
        onReplace={detailIndex !== null ? () => setChooser({ mode: 'replace', index: detailIndex }) : undefined}
        onRemove={detailIndex !== null ? () => removeMoveAt(detailIndex) : undefined}
      />
      <MoveChooserSheet
        open={chooser !== null}
        onClose={() => setChooser(null)}
        game={game}
        species={value?.species}
        currentMoves={value?.moves ?? []}
        level={value?.level}
        ownedTmMoves={ownedTmMoves}
        title={chooser?.mode === 'replace' ? 'Swap move' : 'Add move'}
        onPick={m => {
          if (!chooser) return
          if (chooser.mode === 'add') handleAdd(m)
          else replaceMoveAt(chooser.index, m)
        }}
      />
      <LearnsetSheet
        open={showLearnset}
        onClose={() => setShowLearnset(false)}
        game={game}
        species={value?.species}
        currentMoves={value?.moves ?? []}
        monLevel={value?.level}
        ownedTmMoves={ownedTmMoves}
        onAdd={handleAdd}
      />
      <ReplaceSlotSheet
        open={pendingReplace !== null}
        onClose={() => setPendingReplace(null)}
        game={game}
        incoming={pendingReplace}
        currentMoves={value?.moves ?? []}
        defaultMoves={value?.defaultMoves}
        onPick={i => {
          if (pendingReplace) replaceMoveAt(i, pendingReplace)
          setPendingReplace(null)
        }}
      />
    </div>
  )
}

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
