// A handful of trainers are unique, one-of-a-kind NPCs whose location is
// fixed, common Pokémon-Platinum knowledge — even though the source bundle
// never recorded a `location` for them (their set name carries no route
// token, e.g. "Lvl 51 Leader Roark2 " has no "|...|" segment). Recovering
// these is safe because each one only ever battles in a single building.
//
// Generic trainer classes (Youngster, Lass, Cowgirl, ...) that are missing
// location are NOT handled here: the same class name is reused at dozens of
// different routes, so there's no way to recover which specific one a given
// entry is without the original (inaccessible) source data — guessing would
// just replace one wrong answer with another.
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
