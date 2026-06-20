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
  /** Index of the active defender within `defenderTeam` (-1 if none). */
  defenderIndex: number
  /** Name of the trainer the team was loaded from, if any. */
  trainerName?: string
  /** Active calc direction. Tapping a move on either card flips this to match. */
  direction: CalcDirection
  /** Your selected move (used in 'offense'). */
  selectedMove: string | null
  /** The enemy's selected move (used in 'defense'). */
  selectedEnemyMove: string | null
  field: FieldState
  setAttacker(s: SetState): void
  setDefender(s: SetState): void
  /** Load an enemy team (e.g. from a trainer detail view) and make member `index` active. */
  setDefenderTeam(team: SetState[], index: number, trainerName?: string): void
  /** Swap the active defender to another member of the carried trainer team. */
  switchDefender(index: number): void
  selectMove(m: string): void
  selectEnemyMove(m: string): void
  setDirection(d: CalcDirection): void
  patchField(p: Partial<FieldState>): void
}

export const useCalcStore = create<CalcStore>((set) => ({
  attacker: null,
  defender: null,
  defenderTeam: [],
  defenderIndex: -1,
  trainerName: undefined,
  direction: 'offense',
  selectedMove: null,
  selectedEnemyMove: null,
  field: { gravity: false, crit: false },
  setAttacker: (s) => set({ attacker: s, selectedMove: s.moves[0] ?? null }),
  // Editing the enemy keeps the carried trainer team in sync: if the active mon
  // belongs to a team, update it in place so the rest of the party survives the
  // edit; otherwise treat it as a standalone one-mon defender.
  setDefender: (s) => set((st) => {
    const keepMove = st.selectedEnemyMove && s.moves.includes(st.selectedEnemyMove)
      ? st.selectedEnemyMove
      : s.moves[0] ?? null
    if (st.defenderIndex >= 0 && st.defenderTeam.length > 1) {
      const team = st.defenderTeam.slice()
      team[st.defenderIndex] = s
      return { defender: s, defenderTeam: team, selectedEnemyMove: keepMove }
    }
    return { defender: s, defenderTeam: [s], defenderIndex: 0, trainerName: undefined, selectedEnemyMove: keepMove }
  }),
  setDefenderTeam: (team, index, trainerName) =>
    set({
      defender: team[index] ?? null,
      defenderTeam: team,
      defenderIndex: index,
      trainerName,
      selectedEnemyMove: team[index]?.moves[0] ?? null,
    }),
  switchDefender: (index) => set((st) => {
    const member = st.defenderTeam[index]
    if (!member) return {}
    return { defender: member, defenderIndex: index, selectedEnemyMove: member.moves[0] ?? null }
  }),
  // Selecting a move also flips the direction so the result bar follows the tap.
  selectMove: (m) => set({ selectedMove: m, direction: 'offense' }),
  selectEnemyMove: (m) => set({ selectedEnemyMove: m, direction: 'defense' }),
  setDirection: (d) => set({ direction: d }),
  patchField: (p) => set((st) => ({ field: { ...st.field, ...p } })),
}))
