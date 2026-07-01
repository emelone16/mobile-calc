// Groups trainers by battle location, then buckets locations into "splits" —
// the nuzlocke-community convention of naming a game segment after the gym
// leader it ends with (e.g. everything from the start through Oreburgh is
// the "Roark split"). This table is transcribed from a community-authored
// Renegade Platinum nuzlocke split guide (per-split trainer walkthroughs),
// not guessed: each location is placed under the split whose walkthrough
// first documents a battle there. Locations the bundle couldn't resolve
// fall into their own bucket rather than being guessed at.
import type { Trainer } from './types'

export const UNKNOWN_LOCATION = 'unknown_location'
const UNKNOWN_SPLIT = 'Unknown'

const SPLIT_TABLE: Array<{ split: string; locations: string[] }> = [
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

const locationToSplit = new Map<string, string>()
const locationOrder: string[] = []
for (const { split, locations } of SPLIT_TABLE) {
  for (const location of locations) {
    locationToSplit.set(location, split)
    locationOrder.push(location)
  }
}
locationOrder.push(UNKNOWN_LOCATION)

export function splitOf(location: string): string {
  return locationToSplit.get(location) ?? UNKNOWN_SPLIT
}

export function displayLocation(location: string): string {
  return location === UNKNOWN_LOCATION ? 'Unknown Location' : location
}

export interface TrainerGroup {
  split: string
  location: string
  trainers: Trainer[]
}

/** Buckets trainers by (split, location) in story order; within a location, by battle progression (trId). */
export function groupTrainersByLocation(trainers: Trainer[]): TrainerGroup[] {
  const byLocation = new Map<string, Trainer[]>()
  for (const t of trainers) {
    const list = byLocation.get(t.location) ?? []
    list.push(t)
    byLocation.set(t.location, list)
  }

  const orderedLocations = [
    ...locationOrder,
    ...[...byLocation.keys()].filter(loc => !locationOrder.includes(loc)),
  ]

  const groups: TrainerGroup[] = []
  for (const location of orderedLocations) {
    const list = byLocation.get(location)
    if (!list?.length) continue
    list.sort((a, b) => a.trId - b.trId)
    groups.push({ split: splitOf(location), location, trainers: list })
  }
  return groups
}
