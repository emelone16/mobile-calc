import { create } from 'zustand'
import type { SetState } from '../save/types'

export interface FieldState {
  weather?: string
  terrain?: string
  gravity: boolean
  crit: boolean
}

interface CalcStore {
  attacker: SetState | null
  defender: SetState | null
  /** Whole enemy team carried from a trainer, for the AI switch-in preview. */
  defenderTeam: SetState[]
  selectedMove: string | null
  field: FieldState
  setAttacker(s: SetState): void
  setDefender(s: SetState): void
  /** Load an enemy mon plus its whole team (e.g. from a trainer detail view). */
  setDefenderTeam(active: SetState, team: SetState[]): void
  selectMove(m: string): void
  patchField(p: Partial<FieldState>): void
}

export const useCalcStore = create<CalcStore>((set) => ({
  attacker: null,
  defender: null,
  defenderTeam: [],
  selectedMove: null,
  field: { gravity: false, crit: false },
  setAttacker: (s) => set({ attacker: s, selectedMove: s.moves[0] ?? null }),
  setDefender: (s) => set({ defender: s, defenderTeam: [s] }),
  setDefenderTeam: (active, team) => set({ defender: active, defenderTeam: team }),
  selectMove: (m) => set({ selectedMove: m }),
  patchField: (p) => set((st) => ({ field: { ...st.field, ...p } })),
}))
