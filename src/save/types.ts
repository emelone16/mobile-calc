import type { StatsTable, StatKey, SaveEnums } from '../data/types'

/** The unified box entry. BOTH clipboard import and .sav import produce this. */
export interface SetState {
  species: string
  level: number
  nature: string
  ability: string
  item: string
  moves: string[]
  /**
   * The Pokémon's moves as originally loaded (from the save/box/trainer),
   * captured before any in-calc edits. Move swaps are temporary overrides on top
   * of this; "Reset moves" restores it. Absent only for sets that predate the
   * feature, in which case the editor stamps it on load.
   */
  defaultMoves?: string[]
  ivs: StatsTable
  evs: Partial<StatsTable>
  /**
   * In-battle stat-stage boosts (-6..+6) from moves like Swords Dance, applied
   * on top of the computed stats during damage calc. HP is never boosted, so it
   * is omitted. Absent means no boosts (all stages 0).
   */
  boosts?: Partial<BoostsTable>
  /**
   * Paralysis flag. Paralysis cuts Speed (¼ in gens ≤6, ½ from gen 7) and is the
   * only major status that changes a stat, so it is tracked here to fold into the
   * displayed Speed and the damage engine. Absent/false means healthy.
   */
  paralyzed?: boolean
  source?: 'clipboard' | 'save'
}

/** Boostable stats — every stat except HP, which has no stat stages. */
export type BoostKey = Exclude<StatKey, 'hp'>
export type BoostsTable = Record<BoostKey, number>

/** Raw fields pulled out of one decrypted save Pokemon, IDs not yet named. */
export interface RawMon {
  speciesId: number
  moveIds: number[]
  itemId: number
  abilityId: number   // gen 4: low/high ability bit resolved to an index
  level: number
  natureId: number    // PID % 25
  ivs: StatsTable
  evs: StatsTable
  isEgg: boolean
}

export interface SaveReader {
  /** size/footer heuristic */
  detect(buf: ArrayBuffer): boolean
  /** decrypt + unshuffle + extract; pure, no DOM */
  read(buf: ArrayBuffer): RawMon[]
  /** Owned TM/HM bag item ids, when the reader supports bag parsing. */
  readBag?(buf: ArrayBuffer): number[]
}

export interface MappedMon extends SetState {}

/** Stamp `defaultMoves` from the current moves if absent (idempotent). Call when
 *  a set is first loaded into the calc so its original moveset can be restored. */
export function withDefaultMoves(s: SetState): SetState {
  return s.defaultMoves ? s : { ...s, defaultMoves: [...s.moves] }
}

/** RawMon -> SetState using enum tables (vanilla gen-4 or hack override). */
export function mapRawMon(raw: RawMon, enums: SaveEnums): SetState | null {
  if (raw.isEgg) return null
  const species = enums.species[raw.speciesId]
  if (!species || species.trim() === '') return null
  return {
    species,
    level: raw.level,
    nature: NATURES[raw.natureId] ?? 'Hardy',
    ability: enums.abilities[raw.abilityId] ?? 'None',
    item: enums.items[raw.itemId] ?? 'None',
    moves: raw.moveIds.map(id => enums.moves[id] ?? '-').filter(m => m !== '-'),
    ivs: raw.ivs,
    evs: raw.evs,
    source: 'save',
  }
}

export const NATURES = [
  'Hardy','Lonely','Brave','Adamant','Naughty','Bold','Docile','Relaxed',
  'Impish','Lax','Timid','Hasty','Serious','Jolly','Naive','Modest','Mild',
  'Quiet','Bashful','Rash','Calm','Gentle','Sassy','Careful','Quirky',
] as const
