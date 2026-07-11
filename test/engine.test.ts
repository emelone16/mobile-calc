import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { loadRpFromDisk } from './helpers'
import { runCalc } from '../src/engine/calcService'
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
