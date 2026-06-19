// ---------------------------------------------------------------------------
// Gen-4 trainer AI — switch-in / bait-order preview. The primitives
// (gen4AiU8/gen4AiDivide/gen4AiApplyEffectiveness) are ported verbatim from the
// original js/calc_ui/switch_preview/g4.js. The full phase-2 scoring there reads
// g4Phase2* fields off the FORKED engine's rawDesc, which upstream @smogon/calc
// does not expose; so we use the same fallback the original uses when those are
// absent: the move's max damage roll truncated to u8. That is enough to rank the
// enemy team's threats against the player's active mon for a bait-order preview.
// ---------------------------------------------------------------------------
import type { GameData } from '../data/types'
import type { SetState } from '../save/types'
import type { FieldState } from '../state/calcStore'
import { runCalc } from './calcService'

export function gen4AiU8(value: number): number {
  return Number(value) & 0xff
}

export function gen4AiDivide(dividend: number, divisor: number): number {
  if (dividend === 0) return dividend
  const signedFloor = dividend < 0 ? -1 : 1
  const quotient = dividend < 0 ? Math.ceil(dividend / divisor) : Math.floor(dividend / divisor)
  return quotient === 0 ? signedFloor : quotient
}

export function gen4AiApplyEffectiveness(score: number, effectiveness: number): number {
  if (effectiveness === 0) return 0
  if (effectiveness === 0.5) return gen4AiDivide(score * 5, 10)
  if (effectiveness === 2) return gen4AiDivide(score * 20, 10)
  return score
}

export interface ThreatPrediction {
  set: SetState
  bestMove: string | null
  score: number
  maxPct: number
}

function maxRoll(rolls: number[] | number[][]): number {
  if (typeof rolls === 'number') return rolls
  if (!Array.isArray(rolls) || rolls.length === 0) return 0
  const flat = Array.isArray(rolls[0]) ? (rolls as number[][]).flat() : (rolls as number[])
  return flat.length ? Math.max(...flat) : 0
}

/**
 * Rank an enemy team by how hard each mon can hit the player's active mon.
 * Returns the team ordered by descending damage score — the AI's threat /
 * switch-in priority — each with its best damaging move and that move's % .
 */
export function predictSwitchIn(
  game: GameData,
  playerActive: SetState,
  enemyTeam: SetState[],
  field: FieldState,
): ThreatPrediction[] {
  const out: ThreatPrediction[] = enemyTeam.map(set => {
    let best = 0
    let bestMove: string | null = null
    let bestPct = 0
    for (const move of set.moves) {
      if (!move) continue
      try {
        const res = runCalc(game, set, playerActive, move, field)
        const score = gen4AiU8(maxRoll(res.rolls))
        if (score > best || (score === best && res.maxPct > bestPct)) {
          best = score
          bestMove = move
          bestPct = res.maxPct
        }
      } catch {
        /* skip status/undefined moves */
      }
    }
    return { set, bestMove, score: best, maxPct: bestPct }
  })

  // Mirrors sort_trpoks_g4: order by damage score descending (biggest threat first).
  out.sort((a, b) => (b.score - a.score) || (b.maxPct - a.maxPct))
  return out
}
