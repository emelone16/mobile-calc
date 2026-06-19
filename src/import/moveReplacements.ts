import type { SetState } from '../save/types'
import type { StatKey, StatsTable } from '../data/types'

/** PKHex import autocorrect, e.g. Horn Drill -> Drill Run (from move_replacements). */
export function applyMoveReplacements(moves: string[], map: Record<string, string>): string[] {
  return moves.map(m => map[m] ?? m)
}

// Showdown stat abbreviations -> our StatKey.
const STAT_ALIASES: Record<string, StatKey> = {
  hp: 'hp', atk: 'at', def: 'df', spa: 'sa', spd: 'sd', spe: 'sp',
  // tolerate a few alternates seen in PKHex/older exports
  at: 'at', df: 'df', sat: 'sa', sdf: 'sd', spc: 'sa', spe_: 'sp',
}

const DEFAULT_IVS: StatsTable = { hp: 31, at: 31, df: 31, sa: 31, sd: 31, sp: 31 }

/**
 * Parse one or more Showdown/PKHex sets (blank-line separated) into SetState[].
 * Applies `moveReplacements` to each move. Mirrors the standard export format:
 *
 *   Nickname (Species) (M) @ Item
 *   Ability: X
 *   Level: 50
 *   Adamant Nature
 *   EVs: 252 Atk / 4 Def / 252 Spe
 *   IVs: 0 Atk
 *   - Move 1
 */
export function parseSets(text: string, moveReplacements: Record<string, string> = {}): SetState[] {
  const blocks = text
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map(b => b.trim())
    .filter(Boolean)
  const out: SetState[] = []
  for (const block of blocks) {
    const set = parseSet(block, moveReplacements)
    if (set) out.push(set)
  }
  return out
}

/** Parse a single set block. Returns null if no species could be identified. */
export function parseSet(block: string, moveReplacements: Record<string, string> = {}): SetState | null {
  const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return null

  let species = ''
  let item = ''
  let ability = ''
  let level = 100
  let nature = 'Hardy'
  const moves: string[] = []
  const ivs: StatsTable = { ...DEFAULT_IVS }
  const evs: Partial<StatsTable> = {}

  // First non-empty line is the header: "Nickname (Species) (Gender) @ Item"
  const header = lines[0] ?? ''
  const atSplit = header.split('@')
  const left = (atSplit[0] ?? '').trim()
  if (atSplit[1]) item = atSplit[1].trim()

  // Species: prefer text inside the last "(...)" that isn't a gender token.
  const parens = [...left.matchAll(/\(([^)]+)\)/g)].map(m => (m[1] ?? '').trim())
  const nonGender = parens.filter(p => !/^(m|f|male|female)$/i.test(p))
  if (nonGender.length > 0) {
    species = nonGender[nonGender.length - 1] ?? ''
  } else {
    species = left.replace(/\([^)]*\)/g, '').trim()
  }

  for (const line of lines.slice(1)) {
    if (line.startsWith('-') || line.startsWith('~')) {
      const mv = line.replace(/^[-~]\s*/, '').replace(/\s*\/\/.*$/, '').trim()
      // strip hidden-power type suffix nuance is left intact; just take the name
      if (mv) moves.push(mv)
      continue
    }
    const lower = line.toLowerCase()
    if (lower.startsWith('ability:')) {
      ability = line.slice(line.indexOf(':') + 1).trim()
    } else if (lower.startsWith('level:')) {
      const n = parseInt(line.slice(line.indexOf(':') + 1).trim(), 10)
      if (Number.isFinite(n)) level = n
    } else if (lower.startsWith('evs:')) {
      assignStats(line.slice(line.indexOf(':') + 1), evs)
    } else if (lower.startsWith('ivs:')) {
      assignStats(line.slice(line.indexOf(':') + 1), ivs)
    } else if (lower.endsWith('nature')) {
      nature = line.replace(/nature/i, '').trim() || nature
    }
    // Shiny/Tera/Happiness/Gigantamax etc. are ignored — irrelevant to the calc.
  }

  if (!species) return null
  return {
    species,
    level,
    nature,
    ability,
    item: item || '',
    moves: applyMoveReplacements(moves, moveReplacements),
    ivs,
    evs,
    source: 'clipboard',
  }
}

/** Parse "252 Atk / 4 Def / 252 Spe" into the given stats object. */
function assignStats(segment: string, target: Partial<StatsTable>): void {
  for (const part of segment.split('/')) {
    const m = part.trim().match(/^(\d+)\s+([A-Za-z]+)$/)
    if (!m || !m[1] || !m[2]) continue
    const value = parseInt(m[1], 10)
    const key = STAT_ALIASES[m[2].toLowerCase()]
    if (key && Number.isFinite(value)) target[key] = value
  }
}
