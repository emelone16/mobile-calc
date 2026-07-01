// Most of the "unknown_location" gap was fixed directly in
// renegade-platinum.json by matching trainer teams (species/level/moveset)
// against a community-authored nuzlocke split guide. A handful of unique
// story NPCs didn't have a matching team recorded in that guide, but their
// location is fixed, common Pokémon-Platinum knowledge regardless (each one
// only ever battles in a single building), so they're backfilled here as a
// fallback instead of being left unknown.
//
// Generic trainer classes (Youngster, Lass, Cowgirl, ...) that are still
// missing location are NOT handled here: the same class name is reused at
// dozens of different routes, so there's no way to recover which specific
// one a given remaining entry is — guessing would just replace one wrong
// answer with another.
const KNOWN_BASE_LOCATIONS: Record<string, string> = {
  'Leader Roark': 'Oreburgh City',
  'Leader Gardenia': 'Eterna City',
  'Leader Fantina': 'Hearthome City',
  'Leader Maylene': 'Veilstone City',
  'Leader Wake': 'Pastoria City',
  'Leader Byron': 'Canalave City',
  'Leader Candice': 'Snowpoint City',
  'Leader Volkner': 'Sunyshore City',
  'Elite Four Aaron': 'Pokémon League',
  'Elite Four Bertha': 'Pokémon League',
  'Elite Four Flint': 'Pokémon League',
  'Elite Four Lucian': 'Pokémon League',
  'Champion Cynthia': 'Pokémon League',
}

/** `trainerName` is the display name after "Lvl N " has been stripped, e.g. "Leader Roark2". */
export function knownLocationFor(trainerName: string): string | undefined {
  const base = trainerName.replace(/\d+$/, '').trim()
  return KNOWN_BASE_LOCATIONS[base]
}
