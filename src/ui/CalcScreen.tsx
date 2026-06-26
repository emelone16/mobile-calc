import { useMemo, useState } from 'react'
import { useGameStore } from '../state/gameStore'
import { useCalcStore } from '../state/calcStore'
import { useBoxStore } from '../state/boxStore'
import { predictSwitchIn } from '../engine/aiService'
import { computeStats, runCalc } from '../engine/calcService'
import { SearchablePicker, BottomSheet } from './components/BottomSheet'
import { NATURES } from '../save/types'
import type { SetState } from '../save/types'
import type { StatKey, StatsTable, Trainer, TrainerSet } from '../data/types'

function trainerSetToSetState(t: TrainerSet): SetState {
  return {
    species: t.species, level: t.level, nature: t.nature, ability: t.ability,
    item: t.item, moves: t.moves, ivs: t.ivs, evs: t.evs ?? {},
  }
}

const STAT_KEYS: StatKey[] = ['hp', 'at', 'df', 'sa', 'sd', 'sp']
const STAT_LABELS: Record<StatKey, string> = { hp: 'HP', at: 'Atk', df: 'Def', sa: 'SpA', sd: 'SpD', sp: 'Spe' }

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
const COMMON_ITEMS = [
  'None', 'Leftovers', 'Choice Band', 'Choice Specs', 'Choice Scarf', 'Life Orb',
  'Focus Sash', 'Expert Belt', 'Lum Berry', 'Sitrus Berry', 'Black Sludge',
  'Wide Lens', 'Scope Lens', 'Quick Claw', 'Shell Bell', 'King\'s Rock',
]

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
  } = useCalcStore()
  const boxSets = useBoxStore(s => s.sets)
  const isYours = label === 'Yours'
  // The enemy card shows a party switcher when a whole trainer team is carried.
  const showParty = !isYours && defenderTeam.length > 1
  // Move rows whose damage range is currently showing the critical-hit numbers.
  const [critRows, setCritRows] = useState<Set<number>>(new Set())
  const [showSpeciesPicker, setShowSpeciesPicker] = useState(false)
  const [showNaturePicker, setShowNaturePicker] = useState(false)
  const [showAbilityPicker, setShowAbilityPicker] = useState(false)
  const [showItemPicker, setShowItemPicker] = useState(false)
  const [showMovePicker, setShowMovePicker] = useState(false)
  const [showTrainerPicker, setShowTrainerPicker] = useState(false)
  const [activeTrainerParty, setActiveTrainerParty] = useState<Trainer | null>(null)
  const [expanded, setExpanded] = useState(false)

  const allTrainers = useMemo(
    () => (isYours ? [] : Object.values(game.trainers.byId)),
    [game, isYours],
  )
  const moveNames = useMemo(() => Object.keys(game.moves), [game])
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
    onChange({ ...s, moves: [...s.moves], ivs: { ...s.ivs }, evs: { ...s.evs } })
  }

  function pickTrainerMon(trainer: Trainer, index: number) {
    const team = trainer.team.map(trainerSetToSetState)
    setDefenderTeam(team, index, trainer.name)
    setActiveTrainerParty(null)
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

  function toggleMove(m: string) {
    if (!value) return
    const has = value.moves.includes(m)
    let moves: string[]
    if (has) {
      moves = value.moves.filter(x => x !== m)
    } else if (value.moves.length >= 4) {
      moves = [...value.moves.slice(1), m]
    } else {
      moves = [...value.moves, m]
    }
    onChange({ ...value, moves })
  }

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
                {mon.species} <span className="muted" style={{ marginLeft: 4 }}>Lv{mon.level}</span>
              </button>
            ))}
          </div>
        </div>
      )}

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
      {!isYours && trainerName && (
        <span className="muted" style={{ fontSize: 12 }}>Trainer: {trainerName}</span>
      )}
      {isYours && boxSets.length === 0 && (
        <span className="muted" style={{ fontSize: 12 }}>
          Your box is empty — add Pokémon from the Box tab.
        </span>
      )}

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
            <button className="btn btn--sm" onClick={() => setShowMovePicker(true)}>Edit</button>
          </div>
          <div className="col" style={{ gap: 6 }}>
            {[0, 1, 2, 3].map(i => {
              const m = value.moves[i]
              if (!m) {
                return (
                  <button
                    key={i}
                    className="move-row move-row--empty"
                    onClick={() => setShowMovePicker(true)}
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
              return (
                <button
                  key={i}
                  className="move-row"
                  onClick={() => toggleCritRow(i)}
                >
                  <span className="move-row__name">{m}</span>
                  <span
                    className="move-row__dmg"
                    style={showCrit ? { color: 'var(--danger)' } : undefined}
                  >
                    {showCrit && opponent ? 'crit ' : ''}{range}
                  </span>
                </button>
              )
            })}
          </div>

          {stats && (
            <>
              <div className="label">Stats</div>
              <div className="stat-row">
                {STAT_KEYS.map(k => {
                  const tone =
                    natureEffect?.plus === k ? 'var(--good)'
                      : natureEffect?.minus === k ? 'var(--danger)'
                        : 'var(--text)'
                  const mark = natureEffect?.plus === k ? '＋' : natureEffect?.minus === k ? '－' : ''
                  return (
                    <div className="stat-cell" key={k}>
                      <span className="muted" style={{ fontSize: 11 }}>{STAT_LABELS[k]}</span>
                      <span style={{ fontWeight: 700, color: tone }}>{stats[k]}{mark}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          <button className="btn btn--sm" style={{ alignSelf: 'flex-start' }} onClick={() => setExpanded(v => !v)}>
            {expanded ? 'Hide' : 'Show'} IVs / EVs
          </button>

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
      <SearchablePicker
        open={showTrainerPicker}
        items={allTrainers}
        getLabel={t => `${t.name} — ${t.location}`}
        onPick={t => { setShowTrainerPicker(false); setActiveTrainerParty(t) }}
        onClose={() => setShowTrainerPicker(false)}
        title="Search trainer"
      />
      <BottomSheet
        open={!!activeTrainerParty}
        title={activeTrainerParty ? `${activeTrainerParty.name}'s party` : undefined}
        onClose={() => setActiveTrainerParty(null)}
      >
        {activeTrainerParty && (
          <div className="scroll-x">
            {activeTrainerParty.team.map((set, i) => (
              <button
                key={`${set.species}-${i}`}
                className="card col"
                style={{ minWidth: 160, flexShrink: 0, textAlign: 'left', cursor: 'pointer' }}
                onClick={() => pickTrainerMon(activeTrainerParty, i)}
              >
                <div style={{ fontWeight: 700 }}>{set.species}</div>
                <div className="muted" style={{ fontSize: 12 }}>Lv {set.level}</div>
                <div className="col" style={{ gap: 2, marginTop: 4 }}>
                  {set.moves.map((m, mi) => (
                    <div key={mi} className="muted" style={{ fontSize: 12 }}>{m}</div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </BottomSheet>
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
        items={COMMON_ITEMS}
        getLabel={i => i}
        onPick={i => patch({ item: i === 'None' ? '' : i })}
        onClose={() => setShowItemPicker(false)}
        title="Choose item"
      />
      <SearchablePicker
        open={showMovePicker}
        items={moveNames}
        getLabel={m => m}
        onPick={toggleMove}
        onClose={() => setShowMovePicker(false)}
        title="Choose move"
      />
    </div>
  )
}

function clampInt(raw: string, min: number, max: number, fallback: number): number {
  const n = parseInt(raw, 10)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
