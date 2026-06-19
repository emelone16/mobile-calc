import type { StatsTable, SaveEnums } from '../data/types'

/** The unified box entry. BOTH clipboard import and .sav import produce this. */
export interface SetState {
  species: string
  level: number
  nature: string
  ability: string
  item: string
  moves: string[]
  ivs: StatsTable
  evs: Partial<StatsTable>
  source?: 'clipboard' | 'save'
}

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
}

export interface MappedMon extends SetState {}

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
