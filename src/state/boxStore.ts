import { create } from 'zustand'
import { openDB, type IDBPDatabase } from 'idb'
import type { SetState } from '../save/types'

let dbp: Promise<IDBPDatabase> | null = null
const db = () => (dbp ??= openDB('dcm', 1, {
  upgrade(d) { d.createObjectStore('box', { autoIncrement: true }) },
}))

interface BoxStore {
  sets: SetState[]
  load(): Promise<void>
  addMany(sets: SetState[]): Promise<void>
  clear(): Promise<void>
  exportJson(): string
}

/** Content signature for dedupe — re-importing the same save/clipboard is a no-op. */
function sig(s: SetState): string {
  return JSON.stringify([s.species, s.level, s.nature, s.ability, s.item, [...s.moves].sort(), s.ivs, s.evs])
}

export const useBoxStore = create<BoxStore>((set, get) => ({
  sets: [],
  async load() {
    set({ sets: (await (await db()).getAll('box')) as SetState[] })
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
    await (await db()).clear('box')
    set({ sets: [] })
  },
  exportJson() { return JSON.stringify(get().sets, null, 2) },
}))
