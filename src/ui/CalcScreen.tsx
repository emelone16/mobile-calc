import { useMemo, useState } from 'react'
import { useGameStore } from '../state/gameStore'
import { useCalcStore } from '../state/calcStore'
import { predictSwitchIn } from '../engine/aiService'
import { SearchablePicker } from './components/BottomSheet'
import { NATURES } from '../save/types'
import type { SetState } from '../save/types'
import type { StatKey, StatsTable } from '../data/types'

const STAT_KEYS: StatKey[] = ['hp', 'at', 'df', 'sa', 'sd', 'sp']
const STAT_LABELS: Record<StatKey, string> = { hp: 'HP', at: 'Atk', df: 'Def', sa: 'SpA', sd: 'SpD', sp: 'Spe' }
const DEFAULT_IVS: StatsTable = { hp: 31, at: 31, df: 31, sa: 31, sd: 31, sp: 31 }
const COMMON_ITEMS = [
  'None', 'Leftovers', 'Choice Band', 'Choice Specs', 'Choice Scarf', 'Life Orb',
  'Focus Sash', 'Expert Belt', 'Lum Berry', 'Sitrus Berry', 'Black Sludge',
  'Wide Lens', 'Scope Lens', 'Quick Claw', 'Shell Bell', 'King\'s Rock',
]

function blankSet(species: string): SetState {
  return {
    species, level: 100, nature: 'Hardy', ability: '', item: '',
    moves: [], ivs: { ...DEFAULT_IVS }, evs: {},
  }
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
        onChange={setAttacker}
      />
      <MonEditor
        label="Enemy"
        game={game}
        value={defender}
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
  onChange(s: SetState): void
}

function MonEditor({ label, game, value, onChange }: MonEditorProps) {
  const { selectedMove, selectMove } = useCalcStore()
  const [showSpeciesPicker, setShowSpeciesPicker] = useState(false)
  const [showNaturePicker, setShowNaturePicker] = useState(false)
  const [showAbilityPicker, setShowAbilityPicker] = useState(false)
  const [showItemPicker, setShowItemPicker] = useState(false)
  const [showMovePicker, setShowMovePicker] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const speciesNames = useMemo(() => Object.keys(game.species), [game])
  const moveNames = useMemo(() => Object.keys(game.moves), [game])
  const speciesData = value ? game.species[value.species] : undefined
  const abilityOptions = speciesData ? Object.values(speciesData.abilities) : []

  function pickSpecies(species: string) {
    const data = game.species[species]
    const firstAbility = data ? Object.values(data.abilities)[0] ?? '' : ''
    const learnsetMoves = data
      ? [...data.learnset].reverse().slice(0, 4).map(([, m]) => m)
      : []
    onChange({ ...blankSet(species), ability: firstAbility, moves: learnsetMoves })
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
    if (label === 'Yours' && !has) selectMove(m)
  }

  return (
    <div className="card col">
      <div className="row--between">
        <div className="label" style={{ margin: 0 }}>{label}</div>
      </div>

      <button className="field-btn" onClick={() => setShowSpeciesPicker(true)}>
        <span style={{ fontWeight: 700, fontSize: 'var(--fs-lg)' }}>
          {value?.species ?? <span className="muted">Tap to choose</span>}
        </span>
        <span className="muted">▾</span>
      </button>

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

          <div className="label">Moves</div>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            {[0, 1, 2, 3].map(i => {
              const m = value.moves[i]
              return (
                <button
                  key={i}
                  className={`chip ${!m ? 'chip--empty' : ''} ${label === 'Yours' && m && selectedMove === m ? 'chip--active' : ''}`}
                  onClick={() => {
                    if (m && label === 'Yours') selectMove(m)
                    else setShowMovePicker(true)
                  }}
                >
                  {m ?? '+ Add move'}
                </button>
              )
            })}
          </div>

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

      <SearchablePicker
        open={showSpeciesPicker}
        items={speciesNames}
        getLabel={s => s}
        onPick={pickSpecies}
        onClose={() => setShowSpeciesPicker(false)}
        title="Choose species"
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
