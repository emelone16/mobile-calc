import { describe, it, expect } from 'vitest'
import { loadRpFromDisk } from './helpers'
import { HACKS, DEFAULT_HACK_ID, RENEGADE_PLATINUM } from '../src/data/loader'
import { buildEvolutionFamily } from '../src/data/evolutionFamily'

describe('composed GameData', () => {
  const game = loadRpFromDisk()

  it('has the expected species/move counts', () => {
    expect(Object.keys(game.species).length).toBeGreaterThanOrEqual(507)
    expect(Object.keys(game.moves).length).toBeGreaterThanOrEqual(470)
  })

  it('synthesizes the missing Cherrim-Sunshine forme from Cherrim', () => {
    const cherrim = game.species['Cherrim']
    const sunshine = game.species['Cherrim-Sunshine']
    expect(sunshine).toBeDefined()
    expect(sunshine!.baseStats).toEqual(cherrim!.baseStats)
    expect(sunshine!.abilities['0']).toBe('Flower Gift')
    expect(sunshine!.baseSpecies).toBe('Cherrim')
  })

  it('keeps formes the bundle already ships (Rotom-Heat) intact', () => {
    expect(game.species['Rotom-Heat']?.types).toEqual(['Electric', 'Fire'])
  })

  it('applies move base-power overrides (Return, Magnitude)', () => {
    expect(game.moves['Return']?.basePower).toBe(102)
    expect(game.moves['Magnitude']?.basePower).toBe(70)
  })

  it('builds a trainer index keyed by location and id', () => {
    expect(game.trainers.order.length).toBeGreaterThan(0)
    const firstId = game.trainers.order[0]!
    const trainer = game.trainers.byId[firstId]
    expect(trainer).toBeDefined()
    expect(trainer!.team.length).toBeGreaterThan(0)
    // team is ordered by subIndex
    const subs = trainer!.team.map(t => t.subIndex)
    expect([...subs]).toEqual([...subs].sort((a, b) => a - b))
    // location index points back at real trainers
    expect(Object.keys(game.trainers.byLocation).length).toBeGreaterThan(0)
  })

  it('surfaces the rival as Barry (ROM ships him as "Pkmn Trainer Cedric")', () => {
    const names = game.trainers.order.map(id => game.trainers.byId[id]!.name)
    // The internal placeholder name must not leak into the picker...
    expect(names.some(n => n.includes('Cedric'))).toBe(false)
    // ...and the rival's fights are now findable under "Barry".
    const barry = names.filter(n => n.startsWith('Rival Barry'))
    expect(barry.length).toBeGreaterThan(0)
    // The per-battle numeric suffix is preserved so fights stay distinct.
    expect(barry).toContain('Rival Barry')
    expect(barry.some(n => /^Rival Barry\d+$/.test(n))).toBe(true)
  })

  it('is deeply frozen (immutable data layer)', () => {
    expect(Object.isFrozen(game)).toBe(true)
    expect(Object.isFrozen(game.species)).toBe(true)
  })

  it('attaches forward evolutions with RP methods', () => {
    expect(game.species['Bulbasaur']?.evolutions).toEqual([
      { into: 'Ivysaur', method: 'Level 16' },
    ])
    // RP replaces trade evolutions with held-item methods.
    expect(game.species['Onix']?.evolutions).toEqual([
      { into: 'Steelix', method: 'Metal Coat' },
    ])
    // Fully-evolved species carry no forward evolutions.
    expect(game.species['Venusaur']?.evolutions).toBeUndefined()
  })

  it('keeps branching evolutions (Eevee -> all eeveelutions)', () => {
    const eevee = game.species['Eevee']?.evolutions
    expect(eevee?.length).toBe(7)
    // RP moves Espeon/Umbreon onto stones.
    expect(eevee).toContainEqual({ into: 'Espeon', method: 'Sun Stone' })
    expect(eevee).toContainEqual({ into: 'Glaceon', method: 'Ice Stone' })
  })

  it('synthesizes reverse preEvolutions links', () => {
    expect(game.species['Ivysaur']?.preEvolutions).toEqual([
      { from: 'Bulbasaur', method: 'Level 16' },
    ])
    expect(game.species['Steelix']?.preEvolutions).toEqual([
      { from: 'Onix', method: 'Metal Coat' },
    ])
    // Base-stage species have no pre-evolution.
    expect(game.species['Bulbasaur']?.preEvolutions).toBeUndefined()
  })
})

describe('wild encounters', () => {
  const game = loadRpFromDisk()

  it('attaches the wild-encounter table in game order', () => {
    expect(game.mechanics.features.encounters).toBe(true)
    expect(game.encounters?.length).toBe(100)
    // Game-progression order is preserved from the source file.
    expect(game.encounters?.[0]?.name).toBe('Twinleaf Town')
    expect(game.encounters?.[1]?.name).toBe('Route 201')
  })

  it('carries typed slots (species, rate, level range) per method', () => {
    const route201 = game.encounters?.find(l => l.name === 'Route 201')
    expect(route201).toBeDefined()
    const starly = route201!.encounters.morning?.find(e => e.pokemon === 'Starly')
    expect(starly).toEqual({ pokemon: 'Starly', rate: 30, levels: [4, 5] })
  })

  it('represents fixed gift slots with a null rate', () => {
    const twinleaf = game.encounters?.find(l => l.name === 'Twinleaf Town')
    const eevee = twinleaf!.encounters.gift?.find(e => e.pokemon === 'Eevee')
    expect(eevee?.rate).toBeNull()
  })

  it('freezes the encounter table with the rest of the data layer', () => {
    expect(Object.isFrozen(game.encounters)).toBe(true)
    expect(Object.isFrozen(game.encounters?.[0])).toBe(true)
  })
})

describe('evolution family', () => {
  const game = loadRpFromDisk()

  it('orders a linear family root-first', () => {
    expect(buildEvolutionFamily(game, 'Ivysaur')).toEqual(['Bulbasaur', 'Ivysaur', 'Venusaur'])
    // Works the same starting from the root or the final stage.
    expect(buildEvolutionFamily(game, 'Charmander')).toEqual(['Charmander', 'Charmeleon', 'Charizard'])
  })

  it('includes every branch (Eevee family)', () => {
    const fam = buildEvolutionFamily(game, 'Vaporeon')
    expect(fam[0]).toBe('Eevee')
    expect(fam).toContain('Glaceon')
    expect(fam.length).toBe(8) // Eevee + 7 eeveelutions
  })

  it('returns a singleton for a species with no evolution line', () => {
    expect(buildEvolutionFamily(game, 'Ditto')).toEqual(['Ditto'])
  })

  it('returns empty for an unknown species', () => {
    expect(buildEvolutionFamily(game, 'NotAMon')).toEqual([])
  })
})

describe('multi-hack registry', () => {
  it('registers Renegade Platinum as the default hack', () => {
    expect(DEFAULT_HACK_ID).toBe('renegade-platinum')
    expect(HACKS[DEFAULT_HACK_ID]?.profile).toBe(RENEGADE_PLATINUM)
    expect(HACKS[DEFAULT_HACK_ID]?.bundleFile).toBe('renegade-platinum.json')
  })
})
