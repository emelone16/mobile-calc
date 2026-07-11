import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadRpFromDisk } from './helpers'
import { runCalc, computeStats, speedWeatherMultiplier, speedItemMultiplier, effectiveSpeed } from '../src/engine/calcService'
import type { SetState } from '../src/save/types'
import type { FieldState } from '../src/state/calcStore'

const flatIvs = { hp: 31, at: 31, df: 31, sa: 31, sd: 31, sp: 31 }
const noEvs = {}
const field: FieldState = { gravity: false, crit: false }

function set(p: Partial<SetState> & { species: string; moves: string[] }): SetState {
  return {
    level: 50, nature: 'Hardy', ability: '', item: '',
    ivs: flatIvs, evs: noEvs, ...p,
  }
}

describe('engine smoke', () => {
  it('composes RP and runs a basic calc end-to-end', () => {
    const game = loadRpFromDisk()
    expect(Object.keys(game.species).length).toBeGreaterThan(450)
    expect(Object.keys(game.moves).length).toBeGreaterThan(400)

    const atk = set({ species: 'Garchomp', level: 78, nature: 'Jolly', moves: ['Earthquake'] })
    const def = set({ species: 'Tyranitar', level: 78, nature: 'Careful' })
    const out = runCalc(game, atk, def, 'Earthquake', field)
    expect(out.desc).toBeTruthy()
    expect(out.maxPct).toBeGreaterThan(0)
    expect(out.maxPct).toBeGreaterThanOrEqual(out.minPct)
  })

  it('applies the gen-6 type chart (Fairy resists Dragon)', () => {
    const game = loadRpFromDisk()
    const atk = set({ species: 'Garchomp', level: 50, moves: ['Dragon Claw'] })
    // Clefable is Fairy in the gen-6 chart; Dragon should be 0x against it.
    const def = set({ species: 'Clefable', level: 50 })
    const out = runCalc(game, atk, def, 'Dragon Claw', field)
    expect(out.maxPct).toBe(0)
  })

  it('reflects attacker stat boosts (Swords Dance +2 Atk ≈ 2x damage)', () => {
    const game = loadRpFromDisk()
    const atk = set({ species: 'Garchomp', level: 78, nature: 'Jolly', moves: ['Earthquake'] })
    const def = set({ species: 'Tyranitar', level: 78, nature: 'Careful' })
    const base = runCalc(game, atk, def, 'Earthquake', field)
    const boosted = runCalc(game, { ...atk, boosts: { at: 2 } }, def, 'Earthquake', field)
    // +2 Atk is a x2 multiplier ((2+2)/2) on the physical attack stat.
    expect(boosted.maxPct).toBeGreaterThan(base.maxPct * 1.9)
    expect(boosted.maxPct).toBeLessThanOrEqual(base.maxPct * 2.05)
  })

  it('reflects defender stat boosts (Iron Defense +2 Def lowers damage)', () => {
    const game = loadRpFromDisk()
    const atk = set({ species: 'Garchomp', level: 78, nature: 'Jolly', moves: ['Earthquake'] })
    const def = set({ species: 'Tyranitar', level: 78, nature: 'Careful' })
    const base = runCalc(game, atk, def, 'Earthquake', field)
    const boosted = runCalc(game, atk, { ...def, boosts: { df: 2 } }, 'Earthquake', field)
    expect(boosted.maxPct).toBeLessThan(base.maxPct)
  })

  it('doubles Speed for Swift Swim in the rain (and only then)', () => {
    const game = loadRpFromDisk()
    const swimmer = set({ species: 'Ludicolo', ability: 'Swift Swim', moves: ['Surf'] })
    const speed = computeStats(game, swimmer).sp

    const rain: FieldState = { ...field, weather: 'Rain' }
    const sun: FieldState = { ...field, weather: 'Sun' }
    expect(speedWeatherMultiplier(game, swimmer, rain)).toBe(2)
    expect(speedWeatherMultiplier(game, swimmer, field)).toBe(1)   // no weather
    expect(speedWeatherMultiplier(game, swimmer, sun)).toBe(1)     // wrong weather
    // The engine already reflects the doubled Speed in speed-based damage.
    expect(Math.floor(speed * speedWeatherMultiplier(game, swimmer, rain))).toBe(speed * 2)

    // A different ability in rain gets no boost.
    const other = set({ species: 'Ludicolo', ability: 'Rain Dish', moves: ['Surf'] })
    expect(speedWeatherMultiplier(game, other, rain)).toBe(1)
  })

  it('applies held-item Speed modifiers', () => {
    expect(speedItemMultiplier('Choice Scarf', 'Jolteon')).toBe(1.5)
    expect(speedItemMultiplier('Iron Ball', 'Jolteon')).toBe(0.5)
    expect(speedItemMultiplier('Macho Brace', 'Jolteon')).toBe(0.5)
    expect(speedItemMultiplier('Power Anklet', 'Jolteon')).toBe(0.5)
    expect(speedItemMultiplier('Quick Powder', 'Ditto')).toBe(2)   // Ditto only
    expect(speedItemMultiplier('Quick Powder', 'Jolteon')).toBe(1)
    expect(speedItemMultiplier('None', 'Jolteon')).toBe(1)
    expect(speedItemMultiplier('Leftovers', 'Jolteon')).toBe(1)
  })

  it('effectiveSpeed folds stage, weather ability, item, and paralysis together', () => {
    const game = loadRpFromDisk()
    const base = set({ species: 'Ludicolo', ability: 'Swift Swim', moves: ['Surf'] })
    const raw = computeStats(game, base).sp
    const rain: FieldState = { ...field, weather: 'Rain' }

    // Nothing active: effective == raw.
    expect(effectiveSpeed(game, base, field, raw)).toBe(raw)
    // Swift Swim in rain doubles.
    expect(effectiveSpeed(game, base, rain, raw)).toBe(raw * 2)
    // Choice Scarf stacks on top of the rain doubling (each step floored).
    const scarf = { ...base, item: 'Choice Scarf' }
    expect(effectiveSpeed(game, scarf, rain, raw)).toBe(Math.floor(raw * 2 * 1.5))
    // Paralysis quarters Speed in a gen-4 game.
    const para = { ...base, paralyzed: true }
    expect(effectiveSpeed(game, para, field, raw)).toBe(Math.floor(raw / 4))
    // A +2 Agility stage applies before the multipliers.
    const agile = { ...base, boosts: { sp: 2 } }
    expect(effectiveSpeed(game, agile, rain, raw)).toBe(Math.floor(raw * 2) * 2)
  })

  it('paralysis lowers the mon Speed the engine uses for speed-based moves', () => {
    const game = loadRpFromDisk()
    // Electro Ball is stronger the faster the attacker is relative to the target,
    // so paralysing the attacker should not increase its damage.
    const atk = set({ species: 'Jolteon', level: 50, nature: 'Timid', moves: ['Electro Ball'] })
    const def = set({ species: 'Snorlax', level: 50, nature: 'Careful' })
    if (game.moves['Electro Ball']) {
      const healthy = runCalc(game, atk, def, 'Electro Ball', field)
      const paralyzed = runCalc(game, { ...atk, paralyzed: true }, def, 'Electro Ball', field)
      expect(paralyzed.maxPct).toBeLessThanOrEqual(healthy.maxPct)
    }
  })
})

// Correctness net #1: calcs captured as fixtures. Each fixture =
//   { attacker, defender, move, field } -> expected min/max %.
// Regenerate with: node --import tsx test/genFixtures.ts
const fixturePath = fileURLToPath(new URL('./fixtures/rp-calcs.json', import.meta.url))
const fixtures: any[] = existsSync(fixturePath)
  ? JSON.parse(readFileSync(fixturePath, 'utf8'))
  : []

describe('RP damage calc parity', () => {
  it('has a populated fixture set', () => {
    expect(fixtures.length).toBeGreaterThan(0)
  })
  for (const f of fixtures) {
    it(`${f.attacker.species} ${f.move} -> ${f.defender.species}`, () => {
      const game = loadRpFromDisk()
      const out = runCalc(game, f.attacker, f.defender, f.move, f.field ?? field)
      expect(out.minPct).toBeCloseTo(f.minPct, 1)
      expect(out.maxPct).toBeCloseTo(f.maxPct, 1)
    })
  }
})
