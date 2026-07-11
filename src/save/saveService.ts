import type { GameData } from '../data/types'
import { mapRawMon, type SetState } from './types'
import { GEN4_ENUMS } from './gen4Enums'
import { applyMoveReplacements } from '../import/moveReplacements'
import { tmMovesFromItemIds } from './renegadePlatinumTms'

export interface SaveImport {
  sets: SetState[]
  /** Moves the player owns a TM/HM for; empty if the bag couldn't be read. */
  ownedTmMoves: string[]
}

/** Orchestrates the worker, maps RawMon[] -> SetState[], dedupes for the box. */
export async function importSave(game: GameData, file: File): Promise<SaveImport> {
  const buffer = await file.arrayBuffer()
  const worker = new Worker(new URL('./saveWorker.ts', import.meta.url), { type: 'module' })

  const { mons, tmItemIds } = await new Promise<{ mons: any[]; tmItemIds: number[] }>((resolve, reject) => {
    worker.onmessage = (e) => e.data.ok
      ? resolve({ mons: e.data.mons, tmItemIds: e.data.tmItemIds })
      : reject(new Error(e.data.error))
    worker.onerror = (e) => reject(e.error ?? new Error('worker failed'))
    worker.postMessage({ saveGen: game.mechanics.saveGen, buffer }, [buffer])
  }).finally(() => worker.terminate())

  const enums = game.saveEnums ?? GEN4_ENUMS // RP -> vanilla gen-4 enums
  const sets = mons
    .map(m => mapRawMon(m, enums))
    .filter((s): s is SetState => s !== null)
    .map(s => ({ ...s, moves: applyMoveReplacements(s.moves, game.moveReplacements) }))

  // The TM-id -> move table is Renegade Platinum's; other hacks skip TM gating.
  const ownedTmMoves = game.id === 'renegade-platinum' ? tmMovesFromItemIds(tmItemIds) : []
  return { sets, ownedTmMoves }
}
