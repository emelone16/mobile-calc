import type { SpeciesData, RawPok } from './types'

// Declarative version of the original initPlatinum() forme synthesis. Each entry
// derives its base stats from an existing base species (formes share stats in
// the gen-4 engine) and overrides types/abilities. Only synthesized when the
// base species is present and the forme isn't already in the bundle.
//
// The RP bundle already ships Rotom-*, Giratina-Origin, Wormadam-*, Deoxys-*,
// and Shaymin-Sky directly, so the one forme this actually adds is
// Cherrim-Sunshine. The full table is kept for parity with the original and so
// other Platinum-based bundles that omit these formes still get them.
export interface FormeDef {
  name: string
  base: string
  types: string[]
  abilities: Record<string, string>
  weightkg?: number
  otherFormes?: string[]
}

export const PLATINUM_FORMES: FormeDef[] = [
  { name: 'Cherrim-Sunshine', base: 'Cherrim', types: ['Grass'], abilities: { '0': 'Flower Gift' }, weightkg: 9.3, otherFormes: ['Cherrim', 'Cherrim-Sunshine'] },
  { name: 'Rotom-Heat', base: 'Rotom', types: ['Electric', 'Fire'], abilities: { '0': 'Levitate' }, weightkg: 0.3 },
  { name: 'Rotom-Wash', base: 'Rotom', types: ['Electric', 'Water'], abilities: { '0': 'Levitate' }, weightkg: 0.3 },
  { name: 'Rotom-Mow', base: 'Rotom', types: ['Electric', 'Grass'], abilities: { '0': 'Levitate' }, weightkg: 0.3 },
  { name: 'Rotom-Frost', base: 'Rotom', types: ['Electric', 'Ice'], abilities: { '0': 'Levitate' }, weightkg: 0.3 },
  { name: 'Rotom-Fan', base: 'Rotom', types: ['Electric', 'Flying'], abilities: { '0': 'Levitate' }, weightkg: 0.3 },
  { name: 'Deoxys-Attack', base: 'Deoxys', types: ['Psychic'], abilities: { '0': 'Pressure' }, weightkg: 60.8 },
  { name: 'Deoxys-Defense', base: 'Deoxys', types: ['Psychic'], abilities: { '0': 'Pressure' }, weightkg: 60.8 },
  { name: 'Deoxys-Speed', base: 'Deoxys', types: ['Psychic'], abilities: { '0': 'Pressure' }, weightkg: 60.8 },
  { name: 'Wormadam-Sandy', base: 'Wormadam', types: ['Bug', 'Ground'], abilities: { '0': 'Anticipation' }, weightkg: 6.5, otherFormes: ['Wormadam-Sandy', 'Wormadam-Trash'] },
  { name: 'Wormadam-Trash', base: 'Wormadam', types: ['Bug', 'Steel'], abilities: { '0': 'Anticipation' }, weightkg: 6.5, otherFormes: ['Wormadam-Sandy', 'Wormadam-Trash'] },
  { name: 'Shaymin-Sky', base: 'Shaymin', types: ['Grass', 'Flying'], abilities: { '0': 'Natural Cure' }, weightkg: 5.2, otherFormes: ['Shaymin', 'Shaymin-Sky'] },
]

/** Synthesize any missing Platinum formes into the species map (mutates `species`). */
export function mergePlatinumFormes(
  species: Record<string, SpeciesData>,
  poks: Record<string, RawPok>,
): void {
  for (const f of PLATINUM_FORMES) {
    if (species[f.name]) continue // bundle already ships it
    const base = poks[f.base]
    if (!base) continue
    species[f.name] = {
      name: f.name,
      baseStats: base.bs,
      types: f.types,
      abilities: f.abilities,
      learnset: base.learnset_info.learnset,
      tms: base.learnset_info.tms,
      weightkg: f.weightkg,
      forme: f.name.split('-').slice(1).join('-'),
      baseSpecies: f.base,
    }
  }
}
