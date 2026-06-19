import { describe, it, expect } from 'vitest'
import { parseSet, parseSets } from '../src/import/moveReplacements'

describe('clipboard set parser', () => {
  it('parses a full Showdown set', () => {
    const text = `Garchomp (M) @ Choice Band
Ability: Rough Skin
Level: 78
Adamant Nature
EVs: 4 HP / 252 Atk / 252 Spe
IVs: 0 SpA
- Earthquake
- Outrage
- Stone Edge
- Swords Dance`
    const set = parseSet(text, { 'Outrage': 'Outrage' })
    expect(set).not.toBeNull()
    expect(set!.species).toBe('Garchomp')
    expect(set!.item).toBe('Choice Band')
    expect(set!.ability).toBe('Rough Skin')
    expect(set!.level).toBe(78)
    expect(set!.nature).toBe('Adamant')
    expect(set!.evs).toEqual({ hp: 4, at: 252, sp: 252 })
    expect(set!.ivs.sa).toBe(0)
    expect(set!.ivs.hp).toBe(31)
    expect(set!.moves).toEqual(['Earthquake', 'Outrage', 'Stone Edge', 'Swords Dance'])
    expect(set!.source).toBe('clipboard')
  })

  it('handles nickname + gender header and applies move replacements', () => {
    const text = `Sharky (Garchomp) (M) @ Life Orb
- Dragon Rush`
    const set = parseSet(text, { 'Dragon Rush': 'Dragon Claw' })
    expect(set!.species).toBe('Garchomp')
    expect(set!.moves).toEqual(['Dragon Claw'])
    expect(set!.level).toBe(100)
  })

  it('parses multiple blank-line-separated sets', () => {
    const text = `Skarmory @ Leftovers\nAbility: Sturdy\n- Roost\n\nBlissey @ Leftovers\n- Soft-Boiled`
    const sets = parseSets(text)
    expect(sets.map(s => s.species)).toEqual(['Skarmory', 'Blissey'])
  })

  it('returns null for an unparseable block', () => {
    expect(parseSet('   ')).toBeNull()
  })
})
