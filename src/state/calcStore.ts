import { create } from 'zustand'
import type { SetState } from '../save/types'

export interface FieldState {
  weather?: string
  terrain?: string
  gravity: boolean
  crit: boolean
}

/**
 * Which way the damage is being calculated:
 *  - 'offense' — your move hitting the enemy (the original behavior)
 *  - 'defense' — the enemy's move hitting you
 */
export type CalcDirection = 'offense' | 'defense'

interface CalcStore {
  attacker: SetState | null
  defender: SetState | null
  /** Whole enemy team carried from a trainer, for the AI switch-in preview. */
  defenderTeam: SetState[]
  /** Active calc direction. Tapping a move on either card flips this to match. */
  direction: CalcDirection
  /** Your selected move (used in 'offense'). */
  selectedMove: string | null
  /** The enemy's selected move (used in 'defense'). */
  selectedEnemyMove: string | null
  field: FieldState
  setAttacker(s: SetState): void
  setDefender(s: SetState): void
  /** Load an enemy mon plus its whole team (e.g. from a trainer detail view). */
  setDefenderTeam(active: SetState, team: SetState[]): void
  selectMove(m: string): void
  selectEnemyMove(m: string): void
  setDirection(d: CalcDirection): void
  patchField(p: Partial<FieldState>): void
}

export const useCalcStore = create<CalcStore>((set) => ({
  attacker: null,
  defender: null,
  defenderTeam: [],
  direction: 'offense',
  selectedMove: null,
  selectedEnemyMove: null,
  field: { gravity: false, crit: false },
  setAttacker: (s) => set({ attacker: s, selectedMove: s.moves[0] ?? null }),
  setDefender: (s) => set({ defender: s, defenderTeam: [s], selectedEnemyMove: s.moves[0] ?? null }),
  setDefenderTeam: (active, team) =>
    set({ defender: active, defenderTeam: team, selectedEnemyMove: active.moves[0] ?? null }),
  // Selecting a move also flips the direction so the result bar follows the tap.
  selectMove: (m) => set({ selectedMove: m, direction: 'offense' }),
  selectEnemyMove: (m) => set({ selectedEnemyMove: m, direction: 'defense' }),
  setDirection: (d) => set({ direction: d }),
  patchField: (p) => set((st) => ({ field: { ...st.field, ...p } })),
}))
