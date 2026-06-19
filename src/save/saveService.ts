import type { GameData } from '../data/types'
import { mapRawMon, type SetState } from './types'
import { GEN4_ENUMS } from './gen4Enums'
import { applyMoveReplacements } from '../import/moveReplacements'

/** Orchestrates the worker, maps RawMon[] -> SetState[], dedupes for the box. */
export async function importSave(game: GameData, file: File): Promise<SetState[]> {
  const buffer = await file.arrayBuffer()
  const worker = new Worker(new URL('./saveWorker.ts', import.meta.url), { type: 'module' })

  const mons = await new Promise<any[]>((resolve, reject) => {
    worker.onmessage = (e) => e.data.ok ? resolve(e.data.mons) : reject(new Error(e.data.error))
    worker.onerror = (e) => reject(e.error ?? new Error('worker failed'))
    worker.postMessage({ saveGen: game.mechanics.saveGen, buffer }, [buffer])
  }).finally(() => worker.terminate())

  const enums = game.saveEnums ?? GEN4_ENUMS // RP -> vanilla gen-4 enums
  return mons
    .map(m => mapRawMon(m, enums))
    .filter((s): s is SetState => s !== null)
    .map(s => ({ ...s, moves: applyMoveReplacements(s.moves, game.moveReplacements) }))
}
