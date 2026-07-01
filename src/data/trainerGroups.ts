// Groups trainers by (split, location) — the nuzlocke-community convention
// of naming a game segment after the gym leader it ends with (e.g.
// everything from the start through Oreburgh is the "Roark split").
//
// Split is a per-trainer attribute, not derived from location: the same
// route can host trainers from different splits (a story-progression
// battle and a much later rematch, say), so grouping by location alone
// would wrongly lump them together. Most trainers carry their own `split`
// (backfilled from a community-authored nuzlocke split guide, transcribed
// not guessed); LOCATION_SPLIT_ORDER below is only a fallback for the
// trainers that don't.
import type { Trainer } from './types'

export const UNKNOWN_LOCATION = 'unknown_location'
const UNKNOWN_SPLIT = 'Unknown'

const SPLIT_ORDER = [
  'Roark', 'Gardenia', 'Fantina', 'Maylene', 'Wake', 'Byron', 'Candice',
  'Volkner', 'Champion', 'Post Game', 'Rematches',
]

// Fallback-only: location -> (split, position within that split's location list),
// used for trainers with no `split` of their own.
const FALLBACK_TABLE: Array<{ split: string; locations: string[] }> = [
  { split: 'Roark', locations: ['Route 201', 'Route 202', 'Jubilife City', 'Route 204', 'Route 203', 'Oreburgh Gate', 'Oreburgh City', 'Oreburgh Mine'] },
  { split: 'Gardenia', locations: ['Floaroma Town', 'Valley Windworks', 'Floaroma Meadow', 'Route 205', 'Eterna Forest', 'Route 211', 'Route 216', 'Eterna City'] },
  { split: 'Fantina', locations: ['T.G. Eterna Bldg', 'Route 206', 'Wayward Cave', 'Route 207', 'Route 208', 'Hearthome City'] },
  { split: 'Maylene', locations: ['Route 212', 'Café', 'Pokémon Mansion', 'Route 209', 'Lost Tower', 'Solaceon Town', 'Solaceon Ruins', 'Route 210', 'Route 215', 'Veilstone City'] },
  { split: 'Wake', locations: ['Route 214', 'Route 213', 'Pastoria City'] },
  { split: 'Byron', locations: ['Valor Lakefront', 'Celestic Town', 'Fuego Ironworks', 'Route 219', 'Route 220', 'Route 221', 'Pal Park', 'Route 218', 'Canalave City', 'Iron Island'] },
  { split: 'Candice', locations: ['Lake Valor', 'Lake Verity', 'Route 217', 'Snowpoint City'] },
  { split: 'Volkner', locations: ['Galactic Warehouse', 'Galactic HQ', 'Mt. Coronet', 'Distortion World', 'Route 222', 'Sunyshore City'] },
  { split: 'Champion', locations: ['Route 223', 'Victory Road', 'Route 224', 'Pokémon League'] },
  { split: 'Post Game', locations: ['Fight Area', 'Route 225', 'Route 226', 'Route 227', 'Route 228', 'Route 229', 'Route 230', 'Stark Mountain', 'Top Trainer Cafe'] },
]

const fallbackSplitOf = new Map<string, string>()
const fallbackLocationOrder = new Map<string, number>()
for (const { split, locations } of FALLBACK_TABLE) {
  locations.forEach((location, i) => {
    fallbackSplitOf.set(location, split)
    fallbackLocationOrder.set(location, i)
  })
}

function splitRank(split: string): number {
  const i = SPLIT_ORDER.indexOf(split)
  return i === -1 ? SPLIT_ORDER.length : i
}

export function displayLocation(location: string): string {
  return location === UNKNOWN_LOCATION ? 'Unknown Location' : location
}

export interface TrainerGroup {
  split: string
  location: string
  trainers: Trainer[]
}

/** Buckets trainers by each trainer's own (split, location) in story order; within a group, by battle progression (trId). */
export function groupTrainersByLocation(trainers: Trainer[]): TrainerGroup[] {
  const byKey = new Map<string, TrainerGroup>()
  for (const t of trainers) {
    const split = t.split ?? fallbackSplitOf.get(t.location) ?? UNKNOWN_SPLIT
    const key = `${split}::${t.location}`
    const group = byKey.get(key) ?? { split, location: t.location, trainers: [] }
    group.trainers.push(t)
    byKey.set(key, group)
  }

  const groups = [...byKey.values()]
  groups.forEach(g => g.trainers.sort((a, b) => a.trId - b.trId))
  groups.sort((a, b) => {
    const splitDiff = splitRank(a.split) - splitRank(b.split)
    if (splitDiff !== 0) return splitDiff
    const locDiff = (fallbackLocationOrder.get(a.location) ?? Infinity) - (fallbackLocationOrder.get(b.location) ?? Infinity)
    if (locDiff !== 0) return locDiff
    return a.location.localeCompare(b.location)
  })
  return groups
}
