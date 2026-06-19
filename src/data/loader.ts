import type { GameData, MechanicsProfile, SourceBundle, SaveEnums } from './types'
import { composeGameData } from './composeGameData'

// RP profile = the typed version of the original `setGameSettings` block.
export const RENEGADE_PLATINUM: MechanicsProfile = {
  speciesGen: 4, damageGen: 4, typeChartGen: 6, critGen: 5,
  switchInGen: 4, saveGen: 4,
  features: { dex: true, ai: true, encounters: false, save: true },
}

/** A registered hack: where its bundle lives + how its mechanics behave. */
export interface HackConfig {
  id: string
  title: string
  bundleFile: string          // file under public/data/
  profile: MechanicsProfile
  /** Override save enums for reindexing hacks; RP omits it. */
  saveEnums?: SaveEnums
}

// The catalog. Architected for the wider hack catalog (Phase 7); RP ships first.
export const HACKS: Record<string, HackConfig> = {
  'renegade-platinum': {
    id: 'renegade-platinum',
    title: 'Renegade Platinum',
    bundleFile: 'renegade-platinum.json',
    profile: RENEGADE_PLATINUM,
  },
}

export const DEFAULT_HACK_ID = 'renegade-platinum'

/** Generic loader: fetch a hack's static JSON bundle and compose a frozen GameData. */
export async function loadHack(
  config: HackConfig,
  base = import.meta.env.BASE_URL,
): Promise<GameData> {
  const res = await fetch(`${base}data/${config.bundleFile}`)
  if (!res.ok) throw new Error(`Failed to load ${config.title}: ${res.status}`)
  const src = (await res.json()) as SourceBundle
  // A bundle-supplied `includes` block (reindexing hacks) takes precedence,
  // else the config's saveEnums, else the gen default applied downstream.
  if (config.saveEnums && !src.includes) src.includes = config.saveEnums
  return composeGameData(src, config.id, config.title, config.profile)
}

export async function loadHackById(id: string, base?: string): Promise<GameData> {
  const config = HACKS[id]
  if (!config) throw new Error(`Unknown hack: ${id}`)
  return loadHack(config, base)
}

export async function loadRenegadePlatinum(base?: string): Promise<GameData> {
  return loadHackById(DEFAULT_HACK_ID, base)
}
