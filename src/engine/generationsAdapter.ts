// ---------------------------------------------------------------------------
// THE CRUX. Wraps @smogon/calc's own `Generations` data layer with a proxy
// that answers species/move/type lookups from the composed GameData first,
// falling back to vanilla. This is how the gen-4 + gen-6-type-chart hybrid is
// expressed, and it replaces the original's global-table mutation entirely.
//
// Verified engine contract (from the compiled fork):
//   Generations.get(num) -> Generation
//   Generation = { num, abilities, items, moves, species, types, natures }
//   each store exposes .get(id);  items/types also expose .gen
//   Species.get(id) -> { name, baseStats, types[], abilities, weightkg, nfe?, otherFormes? }
//   Move.get(id)    -> { name, bp, type, category, flags, target, secondaries?, ... }
// ---------------------------------------------------------------------------
import { Generations } from '@smogon/calc'
// NOTE: import path for the bundled data layer. If '@smogon/calc' re-exports
// Generations directly (it does in 0.11.x), this is enough; otherwise use
// `import { Generations } from '@smogon/calc/dist/data'`.
import type { GameData, SpeciesData, MoveData } from '../data/types'
import { toId } from '../util/id'

type AnyStore = { get(id: string): any; gen?: number }
type AnyGen = {
  num: number
  abilities: AnyStore; items: AnyStore; moves: AnyStore
  species: AnyStore; types: AnyStore; natures: AnyStore
}

// Overlay RP's species data ONTO the vanilla engine Specie, so engine-required
// fields (nfe, otherFormes, gender, etc.) survive while stats/types/abilities
// reflect the ROM hack. `base` is the vanilla engine object (may be undefined
// for hack-only species).
function speciesToEngine(s: SpeciesData, base: any) {
  return {
    kind: 'Species',
    ...(base ?? {}),
    id: base?.id ?? toId(s.name),
    name: s.name,
    types: s.types,
    weightkg: s.weightkg ?? base?.weightkg ?? 1,
    baseStats: {
      hp: s.baseStats.hp, atk: s.baseStats.at, def: s.baseStats.df,
      spa: s.baseStats.sa, spd: s.baseStats.sd, spe: s.baseStats.sp,
    },
    abilities: s.abilities,
    ...(s.baseSpecies ? { baseSpecies: s.baseSpecies } : {}),
  }
}

// Overlay RP's move data ONTO the vanilla engine Move, preserving flags/target
// the gen-4 mechanics read (e.g. flags.sound, flags.contact).
function moveToEngine(m: MoveData, base: any) {
  return {
    kind: 'Move',
    flags: {},
    target: 'normal',
    ...(base ?? {}),
    id: base?.id ?? toId(m.name),
    name: m.name,
    basePower: m.basePower,
    bp: m.basePower,
    type: m.type,
    category: m.category,
    priority: m.priority ?? base?.priority ?? 0,
    ...(m.multihit !== undefined ? { multihit: m.multihit } : {}),
    ...(m.recoil ? { recoil: m.recoil } : {}),
    ...(m.drain ? { drain: m.drain } : {}),
    ...(m.flags ? { flags: m.flags } : {}),
  }
}

/**
 * Build a single Generation object the engine will accept, whose species/move
 * lookups are overridden by `game`, and whose TYPE lookups come from
 * `mechanics.typeChartGen` (so RP gets gen-6 effectiveness on a gen-4 calc).
 */
export function makeAdapterGen(game: GameData): AnyGen {
  const getGen = (n: number) => Generations.get(n as Parameters<typeof Generations.get>[0])
  const mechGen = getGen(game.mechanics.speciesGen) as unknown as AnyGen
  const typeGen = getGen(game.mechanics.typeChartGen) as unknown as AnyGen

  const speciesByName = game.species
  const { species: speciesIds, moves: moveIds } = maps(game)

  const proxy: AnyGen = {
    num: game.mechanics.speciesGen,
    abilities: mechGen.abilities,
    items: mechGen.items,
    natures: mechGen.natures,
    moves: {
      gen: (mechGen.moves as any).gen,
      get(id: string) {
        const name = moveIds.get(id)
        const override = name ? game.moves[name] : undefined
        const base = mechGen.moves.get(id)
        if (override) return moveToEngine(override, base)
        return base
      },
    },
    species: {
      gen: (mechGen.species as any).gen,
      get(id: string) {
        const name = speciesIds.get(id)
        const override = name ? speciesByName[name] : undefined
        const base = mechGen.species.get(id)
        if (override) return speciesToEngine(override, base)
        return base
      },
    },
    // Type effectiveness comes from the type-chart gen, NOT the mechanics gen.
    types: typeGen.types,
  }
  return proxy
}

/** Per-GameData memo of id->display-name maps, so lookups don't rescan keys. */
const nameMapCache = new WeakMap<GameData, { species: Map<string, string>; moves: Map<string, string> }>()

function maps(game: GameData) {
  let m = nameMapCache.get(game)
  if (!m) {
    m = { species: buildIdMap(game.species), moves: buildIdMap(game.moves) }
    nameMapCache.set(game, m)
  }
  return m
}

function buildIdMap(table: Record<string, unknown>): Map<string, string> {
  const out = new Map<string, string>()
  for (const key of Object.keys(table)) out.set(toId(key), key)
  return out
}
