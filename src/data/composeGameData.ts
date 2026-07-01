import type {
  SourceBundle, GameData, MechanicsProfile, SpeciesData, MoveData,
  TrainerIndex, Trainer, TrainerSet, RawSet,
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

  const trainers = buildTrainerIndex(src.formatted_sets)

  const game: GameData = {
    id, title, mechanics, species, moves, trainers,
    moveReplacements: src.move_replacements ?? {},
    saveEnums: src.includes, // undefined for RP
  }
  return deepFreeze(game)
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
        ivs: s.ivs, location,
      }
      const t = (byId[s.tr_id] ??= {
        trId: s.tr_id,
        name,
        location,
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
  return setName.replace(/^Lvl\s+\d+\s+/, '').replace(/\s*\|[^|]*\|\s*$/, '').trim()
}

function deepFreeze<T>(o: T): T {
  Object.values(o as any).forEach(v => {
    if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v)
  })
  return Object.freeze(o)
}
