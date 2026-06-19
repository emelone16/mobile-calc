import { create } from 'zustand'
import type { GameData } from '../data/types'
import { loadRenegadePlatinum } from '../data/loader'

interface GameStore {
  game: GameData | null
  status: 'idle' | 'loading' | 'ready' | 'error'
  error?: string
  load(): Promise<void>
}

export const useGameStore = create<GameStore>((set) => ({
  game: null,
  status: 'idle',
  async load() {
    set({ status: 'loading' })
    try {
      set({ game: await loadRenegadePlatinum(), status: 'ready' })
    } catch (e) {
      set({ status: 'error', error: String(e) })
    }
  },
}))
