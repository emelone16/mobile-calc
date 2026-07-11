import { create } from 'zustand'
import { openDB, type IDBPDatabase } from 'idb'
import type { SetState } from '../save/types'

let dbp: Promise<IDBPDatabase> | null = null
const db = () => (dbp ??= openDB('dcm', 2, {
  upgrade(d) {
    if (!d.objectStoreNames.contains('box')) d.createObjectStore('box', { autoIncrement: true })
    // 'meta' holds small singletons keyed by name, e.g. the bag's owned TM moves.
    if (!d.objectStoreNames.contains('meta')) d.createObjectStore('meta')
  },
}))

const OWNED_TMS_KEY = 'ownedTmMoves'

interface BoxStore {
  sets: SetState[]
  /** Moves the player owns a TM/HM for; null until a save is imported. */
  ownedTmMoves: string[] | null
  load(): Promise<void>
  addMany(sets: SetState[]): Promise<void>
  setOwnedTmMoves(moves: string[]): Promise<void>
  clear(): Promise<void>
  exportJson(): string
}

/** Content signature for dedupe — re-importing the same save/clipboard is a no-op. */
function sig(s: SetState): string {
  return JSON.stringify([s.species, s.level, s.nature, s.ability, s.item, [...s.moves].sort(), s.ivs, s.evs])
}

export const useBoxStore = create<BoxStore>((set, get) => ({
  sets: [],
  ownedTmMoves: null,
  async load() {
    const d = await db()
    const [sets, owned] = await Promise.all([
      d.getAll('box') as Promise<SetState[]>,
      d.get('meta', OWNED_TMS_KEY) as Promise<string[] | undefined>,
    ])
    set({ sets, ownedTmMoves: owned ?? null })
  },
  async setOwnedTmMoves(moves) {
    await (await db()).put('meta', moves, OWNED_TMS_KEY)
    set({ ownedTmMoves: moves })
  },
  async addMany(incoming) {
    const d = await db()
    const seen = new Set(get().sets.map(sig))
    const tx = d.transaction('box', 'readwrite')
    for (const s of incoming) {
      const k = sig(s)
      if (seen.has(k)) continue // skip exact duplicates already in the box / batch
      seen.add(k)
      await tx.store.add(s)
    }
    await tx.done
    await get().load()
  },
  async clear() {
    const d = await db()
    await d.clear('box')
    await d.delete('meta', OWNED_TMS_KEY)
    set({ sets: [], ownedTmMoves: null })
  },
  exportJson() { return JSON.stringify(get().sets, null, 2) },
}))
