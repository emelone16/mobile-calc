// Thin pure wrapper over @smogon/calc. UI never touches engine ctors directly.
import { calculate, Pokemon, Move, Field } from '@smogon/calc'
import type { GameData, StatKey, StatsTable } from '../data/types'
import { makeAdapterGen } from './generationsAdapter'
import type { SetState } from '../save/types'
import type { FieldState } from '../state/calcStore'

export interface CalcOutcome {
  rolls: number[] | number[][]
  koText: string
  desc: string
  minPct: number
  maxPct: number
}

/**
 * Compute a mon's actual in-game stats at its level (base stats + nature + IVs
 * + EVs), via the same engine the calc uses. Returns the app's StatKey table.
 */
export function computeStats(game: GameData, set: SetState): StatsTable {
  const gen = makeAdapterGen(game) as any
  const mon = new Pokemon(gen, set.species, {
    level: set.level, nature: set.nature, item: set.item, ability: set.ability,
    ivs: toEngineStats(set.ivs), evs: toEngineStats(set.evs),
  })
  const s = mon.rawStats as Record<string, number>
  const map: Array<[StatKey, string]> = [
    ['hp', 'hp'], ['at', 'atk'], ['df', 'def'], ['sa', 'spa'], ['sd', 'spd'], ['sp', 'spe'],
  ]
  const out = {} as StatsTable
  for (const [to, from] of map) out[to] = s[from] ?? 0
  return out
}

export function runCalc(
  game: GameData,
  attacker: SetState,
  defender: SetState,
  moveName: string,
  field: FieldState,
  crit: boolean = field.crit,
): CalcOutcome {
  const gen = makeAdapterGen(game) as any

  const atk = new Pokemon(gen, attacker.species, {
    level: attacker.level, nature: attacker.nature, item: attacker.item,
    ability: attacker.ability, ivs: toEngineStats(attacker.ivs),
    evs: toEngineStats(attacker.evs), moves: attacker.moves,
  })
  const def = new Pokemon(gen, defender.species, {
    level: defender.level, nature: defender.nature, item: defender.item,
    ability: defender.ability, ivs: toEngineStats(defender.ivs),
    evs: toEngineStats(defender.evs),
  })
  const move = new Move(gen, moveName, { isCrit: crit })
  const f = new Field(toEngineField(field))

  const result = calculate(gen, atk, def, move, f)
  const range = result.range()
  const hp = (def as any).maxHP?.() ?? (def as any).stats?.hp ?? 1
  // kochance()/desc() throw when the move does no damage (immunity/status).
  // Treat that as a clean "0%" outcome rather than an error.
  const deals = range[1] > 0 && hp > 0
  let koText = ''
  let desc = ''
  try { desc = result.desc() } catch { /* desc can throw on 0-damage */ }
  if (deals) {
    try { koText = result.kochance().text } catch { koText = '' }
  }
  return {
    rolls: result.damage as any,
    koText,
    desc: desc || (deals ? '' : 'No damage'),
    minPct: deals ? +(range[0] / hp * 100).toFixed(1) : 0,
    maxPct: deals ? +(range[1] / hp * 100).toFixed(1) : 0,
  }
}

function toEngineStats(s?: Partial<Record<'hp'|'at'|'df'|'sa'|'sd'|'sp', number>>) {
  if (!s) return undefined
  // Only include defined keys — passing `undefined` makes the engine compute
  // NaN stats; omitting them lets it apply its defaults (IV 31 / EV 0).
  const out: Record<string, number> = {}
  const pairs: Array<[keyof typeof s, string]> = [
    ['hp', 'hp'], ['at', 'atk'], ['df', 'def'], ['sa', 'spa'], ['sd', 'spd'], ['sp', 'spe'],
  ]
  for (const [from, to] of pairs) {
    const v = s[from]
    if (typeof v === 'number') out[to] = v
  }
  return out
}
function toEngineField(f: FieldState) {
  return {
    weather: f.weather, terrain: f.terrain, isGravity: f.gravity,
    // TODO: map screens/tailwind/status onto Side as needed
  } as any
}
