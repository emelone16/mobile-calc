import type { GameData, MechanicsProfile, SourceBundle } from './types'
import { composeGameData } from './composeGameData'

// RP profile = the typed version of the original `setGameSettings` block.
export const RENEGADE_PLATINUM: MechanicsProfile = {
  speciesGen: 4, damageGen: 4, typeChartGen: 6, critGen: 5,
  switchInGen: 4, saveGen: 4,
  features: { dex: true, ai: true, encounters: false, save: true },
}

export async function loadRenegadePlatinum(base = import.meta.env.BASE_URL): Promise<GameData> {
  const res = await fetch(`${base}data/renegade-platinum.json`)
  if (!res.ok) throw new Error(`Failed to load RP data: ${res.status}`)
  const src = (await res.json()) as SourceBundle
  return composeGameData(src, 'renegade-platinum', 'Renegade Platinum', RENEGADE_PLATINUM)
}
