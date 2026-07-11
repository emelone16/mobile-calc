import { describe, it, expect } from 'vitest'
import { loadRpFromDisk } from './helpers'
import { HACKS, DEFAULT_HACK_ID, RENEGADE_PLATINUM } from '../src/data/loader'

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

describe('multi-hack registry', () => {
  it('registers Renegade Platinum as the default hack', () => {
    expect(DEFAULT_HACK_ID).toBe('renegade-platinum')
    expect(HACKS[DEFAULT_HACK_ID]?.profile).toBe(RENEGADE_PLATINUM)
    expect(HACKS[DEFAULT_HACK_ID]?.bundleFile).toBe('renegade-platinum.json')
  })
})
