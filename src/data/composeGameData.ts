import type {
  SourceBundle, GameData, MechanicsProfile, SpeciesData, MoveData,
  TrainerIndex, Trainer, TrainerSet, RawSet, EvolutionBundle,
} from './types'
import { mergePlatinumFormes } from './platinumFormes'
import { knownLocationFor } from './knownTrainerLocations'

// Move base-power special cases preserved from the original engine loader.
const MOVE_BP_OVERRIDES: Record<string, number> = { Return: 102, Magnitude: 70 }

export function composeGameData(
  src: SourceBundle,
  id: string,
  title: string,
  mechanics: MechanicsProfile,
  evolutions?: EvolutionBundle,
): GameData {
  const species: Record<string, SpeciesData> = {}
  for (const [name, p] of Object.entries(src.poks)) {
    species[name] = {
      name,
      baseStats: p.bs,
      types: p.types,
      abilities: p.abilities,
      learnset: p.learnset_info.learnset,
      tms: p.learnset_info.tms,
    }
  }

  const moves: Record<string, MoveData> = {}
  for (const [name, m] of Object.entries(src.moves)) {
    moves[name] = {
      name,
      basePower: MOVE_BP_OVERRIDES[name] ?? m.basePower,
      type: m.type, category: m.category,
      pp: m.pp, acc: m.acc, priority: m.priority, eId: m.e_id,
    }
  }

  // Merge synthesized Platinum formes (Cherrim-Sunshine etc.) that the bundle
  // doesn't already ship. Declarative table transcribed from initPlatinum().
  if (mechanics.speciesGen === 4 && /platinum/i.test(title)) {
    mergePlatinumFormes(species, src.poks)
  }

  if (evolutions) attachEvolutions(species, evolutions)

  const trainers = buildTrainerIndex(src.formatted_sets)

  const game: GameData = {
    id, title, mechanics, species, moves, trainers,
    moveReplacements: src.move_replacements ?? {},
    saveEnums: src.includes, // undefined for RP
  }
  return deepFreeze(game)
}

/**
 * Attach forward evolutions to each species and synthesize the reverse
 * (`preEvolutions`) links. Entries pointing at species the bundle doesn't ship
 * are skipped so the two data sources can drift without breaking the loader.
 */
function attachEvolutions(
  species: Record<string, SpeciesData>,
  evolutions: EvolutionBundle,
): void {
  for (const [from, evos] of Object.entries(evolutions)) {
    const source = species[from]
    if (!source) continue
    const valid = evos.filter(e => species[e.into])
    if (valid.length === 0) continue
    source.evolutions = valid
    for (const { into, method } of valid) {
      const target = species[into]!
      ;(target.preEvolutions ??= []).push({ from, method })
    }
  }
}

/** Invert species-first source into a trainer-centric index. */
function buildTrainerIndex(
  formatted: Record<string, Record<string, RawSet>>,
): TrainerIndex {
  const byId: Record<number, Trainer> = {}
  const byLocation: Record<string, number[]> = {}

  for (const [species, sets] of Object.entries(formatted)) {
    for (const [setName, s] of Object.entries(sets)) {
      const name = parseTrainerName(setName)
      const location = s.location === 'unknown_location'
        ? (knownLocationFor(name) ?? s.location)
        : s.location
      const set: TrainerSet = {
        setName, species, level: s.level, trId: s.tr_id, subIndex: s.sub_index,
        ai: s.ai, battleType: s.battle_type === 'Doubles' ? 'Doubles' : 'Singles',
        nature: s.nature, ability: s.ability, item: s.item, moves: s.moves,
        ivs: s.ivs, location, split: s.split,
      }
      const t = (byId[s.tr_id] ??= {
        trId: s.tr_id,
        name,
        location,
        split: s.split,
        battleType: set.battleType,
        team: [],
      })
      t.team.push(set)
    }
  }
  for (const t of Object.values(byId)) {
    t.team.sort((a, b) => a.subIndex - b.subIndex)
    ;(byLocation[t.location] ??= []).push(t.trId)
  }
  const order = Object.keys(byId).map(Number).sort((a, b) => a - b)
  return { byId, byLocation, order }
}

/** "Lvl 7 Youngster Tristan |Route 202| " -> "Youngster Tristan" */
function parseTrainerName(setName: string): string {
  const name = setName.replace(/^Lvl\s+\d+\s+/, '').replace(/\s*\|[^|]*\|\s*$/, '').trim()
  return renameRival(name)
}

// The rival's battles ship under the ROM's internal placeholder name
// "Pkmn Trainer Cedric" (every one carries Barry's signature team —
// Staraptor, Heracross, Snorlax, Roserade/Azumarill, Arcanine, and a starter
// countering yours). Nuzlocke players know this trainer as Barry, so
// searching the picker for "Barry" turned up nothing and all his fights
// looked missing. Surface him by his known name while keeping the per-battle
// numeric suffix (Cedric4 -> Rival Barry4) so the separate fights stay
// distinguishable.
function renameRival(name: string): string {
  return name.replace(/^Pkmn Trainer Cedric(?=\d*$)/, 'Rival Barry')
}

function deepFreeze<T>(o: T): T {
  Object.values(o as any).forEach(v => {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v)
  })
  return Object.freeze(o)
}
