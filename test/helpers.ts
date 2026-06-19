import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { composeGameData } from '../src/data/composeGameData'
import { RENEGADE_PLATINUM } from '../src/data/loader'
import type { GameData, SourceBundle } from '../src/data/types'

let cached: GameData | null = null

/** Load + compose the real RP bundle from disk (no fetch; works headless). */
export function loadRpFromDisk(): GameData {
  if (cached) return cached
  const path = fileURLToPath(new URL('../public/data/renegade-platinum.json', import.meta.url))
  const src = JSON.parse(readFileSync(path, 'utf8')) as SourceBundle
  cached = composeGameData(src, 'renegade-platinum', 'Renegade Platinum', RENEGADE_PLATINUM)
  return cached
}
