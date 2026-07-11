/// <reference lib="webworker" />
// Off-thread save parsing. Receives a transferred ArrayBuffer, returns RawMon[].
import { gen4Reader } from './gen4Reader'
import type { SaveReader, RawMon } from './types'

const READERS: Record<number, SaveReader> = { 4: gen4Reader }

export interface SaveWorkerRequest { saveGen: number; buffer: ArrayBuffer }
export type SaveWorkerResponse =
  | { ok: true; mons: RawMon[]; tmItemIds: number[] }
  | { ok: false; error: string }

self.onmessage = (e: MessageEvent<SaveWorkerRequest>) => {
  const { saveGen, buffer } = e.data
  try {
    const reader = READERS[saveGen]
    if (!reader) throw new Error(`No save reader for gen ${saveGen}`)
    if (!reader.detect(buffer)) throw new Error('Unrecognized save format')
    const mons = reader.read(buffer)
    const tmItemIds = reader.readBag?.(buffer) ?? []
    ;(self as any).postMessage({ ok: true, mons, tmItemIds } satisfies SaveWorkerResponse)
  } catch (err) {
    ;(self as any).postMessage({ ok: false, error: String(err) } satisfies SaveWorkerResponse)
  }
}
