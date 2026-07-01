// Groups trainers by battle location, then buckets locations into "splits" —
// the nuzlocke-community convention of naming a game segment after the gym
// leader it ends with (e.g. everything from the start through Oreburgh is
// the "Roark split"). RP keeps vanilla Platinum's map, so vanilla route
// order applies. Locations the bundle couldn't resolve fall into their own
// bucket rather than being guessed at.
import type { Trainer } from './types'

export const UNKNOWN_LOCATION = 'unknown_location'
const UNKNOWN_SPLIT = 'Unknown'

const SPLIT_TABLE: Array<{ split: string; locations: string[] }> = [
  { split: 'Roark', locations: ['Lake Verity', 'Route 202', 'Route 203', 'Oreburgh Gate', 'Oreburgh Mine', 'Oreburgh City'] },
  { split: 'Gardenia', locations: ['Route 204', 'Valley Windworks', 'Fuego Ironworks', 'Route 205', 'Eterna Forest'] },
  { split: 'Fantina', locations: ['T.G. Eterna Bldg', 'Route 206', 'Wayward Cave', 'Route 207', 'Route 208', 'Hearthome City'] },
  { split: 'Maylene', locations: ['Route 209', 'Solaceon Ruins', 'Route 210', 'Route 215', 'Galactic HQ', 'Veilstone City'] },
  { split: 'Wake', locations: ['Route 212', 'Café', 'Route 213', 'Route 214', 'Lake Valor', 'Pastoria City'] },
  { split: 'Byron', locations: ['Route 211', 'Route 218', 'Iron Island', 'Canalave City', 'Mt. Coronet'] },
  { split: 'Candice', locations: ['Route 216', 'Route 217', 'Snowpoint City'] },
  { split: 'Volkner', locations: ['Route 222', 'Sunyshore City'] },
  { split: 'Elite Four', locations: ['Route 219', 'Route 220', 'Route 221', 'Route 223', 'Route 224', 'Route 225', 'Route 226', 'Route 227', 'Route 228', 'Route 229', 'Route 230', 'Stark Mountain', 'Victory Road', 'Pokémon League'] },
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
