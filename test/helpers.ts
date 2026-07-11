import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { composeGameData } from '../src/data/composeGameData'
import { RENEGADE_PLATINUM } from '../src/data/loader'
import type { GameData, SourceBundle, EvolutionBundle } from '../src/data/types'

let cached: GameData | null = null

/** Load + compose the real RP bundle from disk (no fetch; works headless). */
export function loadRpFromDisk(): GameData {
  if (cached) return cached
  const src = JSON.parse(
    readFileSync(fileURLToPath(new URL('../public/data/renegade-platinum.json', import.meta.url)), 'utf8'),
  ) as SourceBundle
  const evolutions = JSON.parse(
    readFileSync(fileURLToPath(new URL('../public/data/renegade-platinum-evolutions.json', import.meta.url)), 'utf8'),
  ) as EvolutionBundle
  cached = composeGameData(src, 'renegade-platinum', 'Renegade Platinum', RENEGADE_PLATINUM, evolutions)
  return cached
}
