import { describe, it, expect } from 'vitest'
import { loadRpFromDisk } from './helpers'
import { predictSwitchIn, gen4AiU8, gen4AiDivide, gen4AiApplyEffectiveness } from '../src/engine/aiService'
import type { SetState } from '../src/save/types'

const flat = { hp: 31, at: 31, df: 31, sa: 31, sd: 31, sp: 31 }
const mon = (species: string, moves: string[], nature = 'Hardy'): SetState => ({
  species, level: 50, nature, ability: '', item: '', ivs: flat, evs: {}, moves,
})

describe('gen4 AI primitives', () => {
  it('u8 truncates', () => expect(gen4AiU8(300)).toBe(44))
  it('divide rounds toward zero but never to zero from nonzero', () => {
    expect(gen4AiDivide(0, 4)).toBe(0)
    expect(gen4AiDivide(3, 4)).toBe(1) // would floor to 0 -> bumped to 1
    expect(gen4AiDivide(20, 10)).toBe(2)
  })
  it('effectiveness scaling', () => {
    expect(gen4AiApplyEffectiveness(100, 0)).toBe(0)
    expect(gen4AiApplyEffectiveness(100, 0.5)).toBe(50)
    expect(gen4AiApplyEffectiveness(100, 2)).toBe(200)
    expect(gen4AiApplyEffectiveness(100, 1)).toBe(100)
  })
})

describe('predictSwitchIn', () => {
  it('ranks the harder-hitting enemy first', () => {
    const game = loadRpFromDisk()
    const player = mon('Skarmory', ['Roost'])
    const team = [
      mon('Blissey', ['Seismic Toss']),       // weak physical/special vs Skarmory
      mon('Magnezone', ['Thunderbolt'], 'Modest'), // super effective-ish, strong
    ]
    const ranked = predictSwitchIn(game, player, team, { gravity: false, crit: false })
    expect(ranked).toHaveLength(2)
    expect(ranked[0].set.species).toBe('Magnezone')
    expect(ranked[0].bestMove).toBe('Thunderbolt')
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score)
  })
})
