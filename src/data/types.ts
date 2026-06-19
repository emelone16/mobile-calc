// ---------------------------------------------------------------------------
// Data-layer types. These define the shape your RP JSON is composed INTO.
// The source bundle (your Python parser output) stays as-is:
//   { formatted_sets, poks, moves, move_replacements }
// The loader (loader.ts) transforms it into a frozen `GameData`.
// ---------------------------------------------------------------------------

export type StatKey = 'hp' | 'at' | 'df' | 'sa' | 'sd' | 'sp'
export type StatsTable = Record<StatKey, number>

/** The hardcoded `if (title === 'Renegade Platinum') {...}` block, as data. */
export interface MechanicsProfile {
  speciesGen: number    // movepool/species pool        (RP: 4)
  damageGen: number     // which damage formula          (RP: 4 -> DPP)
  typeChartGen: number  // type effectiveness table      (RP: 6 -> Fairy)
  critGen: number       // crit mechanics                (RP: 5)
  switchInGen: number   // AI / switch-in prediction     (RP: 4)
  saveGen: number       // which SaveReader              (RP: 4 -> DS DPPt)
  features: {
    dex: boolean
    ai: boolean
    encounters: boolean
    save: boolean
  }
}

export interface SpeciesData {
  name: string
  baseStats: StatsTable
  types: string[]
  abilities: Record<string, string>   // { "0": "...", "1": "...", "H"?: "..." }
  learnset: Array<[level: number, move: string]>
  tms?: string[]
  weightkg?: number
  /** Synthesized formes (Rotom appliances, Cherrim-Sunshine, etc.). */
  forme?: string
  baseSpecies?: string
}

export interface MoveData {
  name: string
  basePower: number
  type: string
  category: 'Physical' | 'Special' | 'Status'
  pp?: number
  acc?: number | true
  priority?: number
  /** ROM-hack move-effect id from the source bundle. */
  eId?: number
  // optional engine flags carried from the source when present
  multihit?: number | [number, number]
  recoil?: [number, number]
  drain?: [number, number]
  flags?: Record<string, 1 | 0>
}

export interface TrainerSet {
  setName: string        // e.g. "Lvl 7 Youngster Tristan |Route 202| "
  species: string
  level: number
  trId: number
  subIndex: number
  ai: number
  battleType: 'Singles' | 'Doubles'
  nature: string
  ability: string
  item: string
  moves: string[]
  ivs: StatsTable
  evs?: Partial<StatsTable>
  location: string
}

export interface Trainer {
  trId: number
  name: string
  location: string
  battleType: 'Singles' | 'Doubles'
  team: TrainerSet[]   // ordered by subIndex
}

export interface TrainerIndex {
  byId: Record<number, Trainer>
  byLocation: Record<string, number[]>
  order: number[]
}

/** Per-species ID->name override tables for hacks that REINDEX their enums.
 *  RP omits this and uses the vanilla gen-4 enums. (mirrors original `includes`) */
export interface SaveEnums {
  species: string[]   // index = in-game species id
  moves: string[]
  items: string[]
  abilities: string[]
  growths: number[]   // index = species id -> growth-rate type (0..5)
}

export interface GameData {
  id: string
  title: string
  mechanics: MechanicsProfile
  species: Record<string, SpeciesData>
  moves: Record<string, MoveData>
  trainers: TrainerIndex
  moveReplacements: Record<string, string>
  /** present only for reindexing hacks; RP -> undefined */
  saveEnums?: SaveEnums
}

/** Raw source-bundle shape (input to the loader). */
export interface SourceBundle {
  title: string
  formatted_sets: Record<string, Record<string, RawSet>>
  poks: Record<string, RawPok>
  moves: Record<string, RawMove>
  move_replacements?: Record<string, string>
  includes?: SaveEnums   // only reindexing hacks ship this
}

export interface RawSet {
  level: number; tr_id: number; ai: number; battle_type: string
  reward_item?: string; form?: string; item: string
  ivs: StatsTable; nature: string; moves: string[]
  sub_index: number; ability: string; gender?: string
  location: string; spriteId?: number | null; orientation?: number | null
}
export interface RawPok {
  bs: StatsTable; types: string[]; abilities: Record<string, string>
  learnset_info: { learnset: Array<[number, string]>; tms?: string[] }
}
export interface RawMove {
  basePower: number; pp?: number; acc?: number; type: string
  category: 'Physical' | 'Special' | 'Status'; priority?: number; e_id?: number
}
