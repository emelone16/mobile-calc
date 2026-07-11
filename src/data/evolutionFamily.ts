import type { GameData } from './types'

/**
 * Every species in `species`'s evolution family, in evolutionary order: the
 * root first, then each evolution branch depth-first (so Eevee comes before all
 * the eeveelutions). Returns `[species]` when it neither evolves nor pre-evolves,
 * and `[]` when the species is unknown. Guards against malformed cyclic data.
 */
export function buildEvolutionFamily(game: GameData, species: string): string[] {
  if (!game.species[species]) return []

  // Walk up pre-evolutions to the family root (branches up don't occur in the
  // gen-4 dex, so following the first link is sufficient).
  let root = species
  const climbed = new Set<string>([root])
  for (;;) {
    const pre = game.species[root]?.preEvolutions?.[0]?.from
    if (!pre || climbed.has(pre) || !game.species[pre]) break
    climbed.add(pre)
    root = pre
  }

  // Depth-first walk down the evolutions from the root.
  const order: string[] = []
  const seen = new Set<string>()
  const visit = (name: string) => {
    if (seen.has(name) || !game.species[name]) return
    seen.add(name)
    order.push(name)
    for (const evo of game.species[name]?.evolutions ?? []) visit(evo.into)
  }
  visit(root)
  return order
}
