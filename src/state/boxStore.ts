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

export const useBoxStore = create<BoxStore>((set, get) => ({
  sets: [],
  async load() {
    set({ sets: (await (await db()).getAll('box')) as SetState[] })
  },
  async addMany(incoming) {
    const d = await db()
    const tx = d.transaction('box', 'readwrite')
    for (const s of incoming) await tx.store.add(s)
    await tx.done
    await get().load()
  },
  async clear() {
    await (await db()).clear('box')
    set({ sets: [] })
  },
  exportJson() { return JSON.stringify(get().sets, null, 2) },
}))
