import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  TM_MOVES, HM_MOVES, moveForTmItemId, tmMovesFromItemIds,
  TM_HM_ITEM_ID_MIN, TM_HM_ITEM_ID_MAX,
} from '../src/save/renegadePlatinumTms'

// The bundle never lists TM numbers, only per-species move names. The mapping's
// correctness therefore rests on one invariant: the set of moves it can produce
// must be EXACTLY the set of moves that appear in some species' `tms` list. If a
// TM entry is wrong or stale, that equality breaks and this test fails.
const bundle = JSON.parse(
  readFileSync(fileURLToPath(new URL('../public/data/renegade-platinum.json', import.meta.url)), 'utf8'),
) as { poks: Record<string, { learnset_info: { tms?: string[] } }> }

const tmUnion = new Set<string>()
for (const p of Object.values(bundle.poks)) {
  for (const m of p.learnset_info.tms ?? []) tmUnion.add(m)
}

describe('Renegade Platinum TM/HM map', () => {
  it('covers exactly the bundle TM/HM move union', () => {
    const mapped = new Set([...TM_MOVES, ...HM_MOVES])
    expect(mapped.size).toBe(TM_MOVES.length + HM_MOVES.length) // no duplicate moves
    expect([...mapped].sort()).toEqual([...tmUnion].sort())
  })

  it('has 92 TMs and 8 HMs at the vanilla Gen-4 item ids', () => {
    expect(TM_MOVES).toHaveLength(92)
    expect(HM_MOVES).toHaveLength(8)
    expect(TM_HM_ITEM_ID_MIN).toBe(328)
    expect(TM_HM_ITEM_ID_MAX).toBe(427)
    expect(moveForTmItemId(328)).toBe('Focus Punch') // TM01
    expect(moveForTmItemId(420)).toBe('Cut')         // HM01
    expect(moveForTmItemId(327)).toBeUndefined()
    expect(moveForTmItemId(428)).toBeUndefined()
  })

  it('applies the six RP TM swaps', () => {
    expect(moveForTmItemId(327 + 55)).toBe('Scald')          // TM55
    expect(moveForTmItemId(327 + 57)).toBe('Wild Charge')    // TM57
    expect(moveForTmItemId(327 + 62)).toBe('Bug Buzz')       // TM62
    expect(moveForTmItemId(327 + 83)).toBe('Hyper Voice')    // TM83
    expect(moveForTmItemId(327 + 85)).toBe('Dazzling Gleam') // TM85
    expect(moveForTmItemId(327 + 88)).toBe('Hurricane')      // TM88
  })

  it('maps owned item ids to distinct moves', () => {
    // TM01 (328), TM85 (412), HM01 (420), plus a junk id.
    expect(tmMovesFromItemIds([328, 412, 420, 999]).sort())
      .toEqual(['Cut', 'Dazzling Gleam', 'Focus Punch'])
  })
})
