import { describe, it, expect } from 'vitest'
import { gen4Reader } from '../src/save/gen4Reader'
import { GEN4_ENUMS, EXP_TABLES, BLOCK_ORDERS } from '../src/save/gen4Enums'
import { mapRawMon, type RawMon } from '../src/save/types'

// ---------------------------------------------------------------------------
// Correctness net for the gen-4 reader. No real .sav is available, so this test
// is an INDEPENDENT encoder: it builds a DPPt-format 512KB save from known mon
// data (inverting the decrypt/unshuffle/pack the reader undoes) and asserts the
// reader recovers every field. Covers: party + box, empty slots, eggs, and
// save-counter block-2 selection.
// ---------------------------------------------------------------------------

const PT = { partyCountOffset: 0x9c, smallBlockSize: 0xcf2c, boxDataOffset: 0xcf30, bigBlockSize: 0x121e4 }
const BLOCK2 = 0x40000
const lcrngNext = (s: number) => (Math.imul(s, 0x41c64e6d) + 0x6073) >>> 0
const sid = (name: string) => GEN4_ENUMS.species.indexOf(name)
const mid = (name: string) => GEN4_ENUMS.moves.indexOf(name)
const iid = (name: string) => GEN4_ENUMS.items.indexOf(name)
const aid = (name: string) => GEN4_ENUMS.abilities.indexOf(name)

interface MonSpec {
  species: string; item: string; ability: string; level: number; moves: string[]
  nature: number   // 0..24 -> PID % 25
  ivs: { hp: number; at: number; df: number; sa: number; sd: number; sp: number }
  evs: { hp: number; at: number; df: number; sa: number; sd: number; sp: number }
  egg?: boolean
}

/** exp for the start of `level` under this species' growth rate. */
function expForLevel(species: string, level: number): number {
  const rate = GEN4_ENUMS.growths[sid(species)]
  return EXP_TABLES[rate][level - 1]
}

/** Build a 136-byte encrypted stored mon (optionally padded to 236 for party). */
function encodeMon(m: MonSpec, size = 136): Uint8Array {
  const out = new Uint8Array(size)
  const dv = new DataView(out.buffer)

  // Choose a PID that yields nature m.nature; shiftValue derives from it.
  let pid = 0x12345678
  while (pid % 25 !== m.nature) pid++
  const shiftValue = ((pid & 0x3e000) >> 0xd) % 24
  const order = BLOCK_ORDERS[shiftValue]

  // logical block words
  const blocks: number[][] = [new Array(16).fill(0), new Array(16).fill(0), new Array(16).fill(0), new Array(16).fill(0)]
  const G = blocks[0], A = blocks[1]
  const exp = expForLevel(m.species, m.level)
  G[0] = sid(m.species)
  G[1] = iid(m.item)
  G[4] = exp & 0xffff
  G[5] = (exp >>> 16) & 0xffff
  G[6] = (aid(m.ability) & 0xff) << 8
  G[8] = (m.evs.hp & 0xff) | ((m.evs.at & 0xff) << 8)
  G[9] = (m.evs.df & 0xff) | ((m.evs.sp & 0xff) << 8)
  G[10] = (m.evs.sa & 0xff) | ((m.evs.sd & 0xff) << 8)
  A[0] = mid(m.moves[0] ?? '-'); A[1] = mid(m.moves[1] ?? '-')
  A[2] = mid(m.moves[2] ?? '-'); A[3] = mid(m.moves[3] ?? '-')
  let ivVal =
    (m.ivs.hp & 0x1f) | ((m.ivs.at & 0x1f) << 5) | ((m.ivs.df & 0x1f) << 10) |
    ((m.ivs.sp & 0x1f) << 15) | ((m.ivs.sa & 0x1f) << 20) | ((m.ivs.sd & 0x1f) << 25)
  if (m.egg) ivVal |= 1 << 30
  ivVal = ivVal >>> 0
  A[8] = ivVal & 0xffff
  A[9] = (ivVal >>> 16) & 0xffff

  // place logical blocks at physical positions per the shuffle order
  const body = new Uint16Array(64)
  for (let p = 0; p < 4; p++) {
    const logical = order[p]
    for (let w = 0; w < 16; w++) body[p * 16 + w] = blocks[logical][w]
  }

  // checksum = 16-bit sum of body words; seeds the (symmetric) encrypt stream
  let checksum = 0
  for (let i = 0; i < 64; i++) checksum = (checksum + body[i]) & 0xffff

  dv.setUint32(0x00, pid >>> 0, true)
  dv.setUint16(0x06, checksum, true)
  let seed = checksum
  for (let i = 0; i < 64; i++) {
    seed = lcrngNext(seed)
    dv.setUint16(0x08 + i * 2, body[i] ^ (seed >>> 16), true)
  }
  return out
}

function buildSave(opts: { party: MonSpec[]; box?: MonSpec[]; block2?: boolean }): ArrayBuffer {
  const buf = new ArrayBuffer(0x80000)
  const view = new DataView(buf)
  const u8 = new Uint8Array(buf)
  const shift = opts.block2 ? BLOCK2 : 0

  // party
  view.setUint8(shift + PT.partyCountOffset, opts.party.length)
  let p = shift + PT.partyCountOffset + 4
  for (const m of opts.party) { u8.set(encodeMon(m, 236), p); p += 236 }

  // box (contiguous 136-byte slots from boxDataOffset)
  let b = (opts.block2 ? BLOCK2 : 0) + PT.boxDataOffset
  for (const m of (opts.box ?? [])) { u8.set(encodeMon(m, 136), b); b += 136 }

  // save counters: make the chosen block "newest valid", the other invalid (0).
  const writeU32 = (off: number, v: number) => view.setUint32(off, v >>> 0, true)
  const smallC1 = PT.smallBlockSize - 16
  const smallC2 = PT.smallBlockSize + BLOCK2 - 16
  const bigStart = PT.boxDataOffset - 4
  const bigC1 = bigStart + PT.bigBlockSize - 16
  const bigC2 = bigStart + BLOCK2 + PT.bigBlockSize - 16
  if (opts.block2) {
    writeU32(smallC1, 0); writeU32(smallC2, 200)
    writeU32(bigC1, 0); writeU32(bigC2, 200)
  } else {
    writeU32(smallC1, 200); writeU32(smallC2, 0)
    writeU32(bigC1, 200); writeU32(bigC2, 0)
  }
  return buf
}

const garchomp: MonSpec = {
  species: 'Garchomp', item: 'Choice Band', ability: 'Sand Veil', level: 78,
  moves: ['Earthquake', 'Outrage', 'Stone Edge', 'Swords Dance'], nature: 3, // Adamant
  ivs: { hp: 31, at: 31, df: 31, sa: 2, sd: 31, sp: 31 },
  evs: { hp: 4, at: 252, df: 0, sa: 0, sd: 0, sp: 252 },
}
const blissey: MonSpec = {
  species: 'Blissey', item: 'Leftovers', ability: 'Natural Cure', level: 64,
  moves: ['Seismic Toss', 'Soft-Boiled', 'Toxic', 'Aromatherapy'], nature: 23, // Careful
  ivs: { hp: 30, at: 0, df: 20, sa: 31, sd: 31, sp: 10 },
  evs: { hp: 252, at: 0, df: 252, sa: 0, sd: 4, sp: 0 },
}

describe('gen4 save reader', () => {
  it('recovers party mon fields (species/level/moves/IVs/EVs/nature/ability/item)', () => {
    const buf = buildSave({ party: [garchomp] })
    const mons = gen4Reader.read(buf)
    expect(mons.length).toBeGreaterThanOrEqual(1)
    const r = mons[0] as RawMon
    expect(GEN4_ENUMS.species[r.speciesId]).toBe('Garchomp')
    expect(r.level).toBe(78)
    expect(r.natureId).toBe(3)
    expect(GEN4_ENUMS.items[r.itemId]).toBe('Choice Band')
    expect(GEN4_ENUMS.abilities[r.abilityId]).toBe('Sand Veil')
    expect(r.moveIds.map(id => GEN4_ENUMS.moves[id])).toEqual(['Earthquake', 'Outrage', 'Stone Edge', 'Swords Dance'])
    expect(r.ivs).toEqual(garchomp.ivs)
    expect(r.evs).toEqual(garchomp.evs)
    expect(r.isEgg).toBe(false)
  })

  it('recovers box mons and maps them to SetState', () => {
    const buf = buildSave({ party: [garchomp], box: [blissey] })
    const mons = gen4Reader.read(buf)
    const sets = mons.map(m => mapRawMon(m, GEN4_ENUMS)).filter(Boolean)
    const names = sets.map(s => s!.species)
    expect(names).toContain('Garchomp')
    expect(names).toContain('Blissey')
    const b = sets.find(s => s!.species === 'Blissey')!
    expect(b.level).toBe(64)
    expect(b.nature).toBe('Careful')
    expect(b.ability).toBe('Natural Cure')
    expect(b.item).toBe('Leftovers')
    expect(b.moves).toEqual(['Seismic Toss', 'Soft-Boiled', 'Toxic', 'Aromatherapy'])
  })

  it('skips eggs and empty slots', () => {
    const egg: MonSpec = { ...blissey, species: 'Togepi', egg: true }
    const buf = buildSave({ party: [garchomp], box: [egg] })
    const mons = gen4Reader.read(buf)
    expect(mons.some(m => m.isEgg)).toBe(true)
    const sets = mons.map(m => mapRawMon(m, GEN4_ENUMS)).filter(Boolean)
    expect(sets.every(s => s!.species !== 'Togepi')).toBe(true)
    expect(sets.length).toBe(1) // only Garchomp survives
  })

  it('excludes boxes 17 and 18 from import', () => {
    const buf = new ArrayBuffer(0x80000)
    const view = new DataView(buf)
    const u8 = new Uint8Array(buf)
    view.setUint8(PT.partyCountOffset, 1)
    u8.set(encodeMon(garchomp, 236), PT.partyCountOffset + 4)

    // box 16 (last included box, 0-indexed 15) gets a mon in its first slot;
    // box 17 (0-indexed 16, first excluded box) gets a mon in its first slot.
    const box16Slot0 = PT.boxDataOffset + 15 * 30 * 136
    const box17Slot0 = PT.boxDataOffset + 16 * 30 * 136
    u8.set(encodeMon(blissey, 136), box16Slot0)
    u8.set(encodeMon({ ...blissey, species: 'Togepi' }, 136), box17Slot0)

    const writeU32 = (off: number, v: number) => view.setUint32(off, v >>> 0, true)
    writeU32(PT.smallBlockSize - 16, 200)
    writeU32(PT.smallBlockSize + BLOCK2 - 16, 0)
    const bigStart = PT.boxDataOffset - 4
    writeU32(bigStart + PT.bigBlockSize - 16, 200)
    writeU32(bigStart + BLOCK2 + PT.bigBlockSize - 16, 0)

    const mons = gen4Reader.read(buf)
    const names = mons.map(m => GEN4_ENUMS.species[m.speciesId])
    expect(names).toContain('Blissey') // box 16 mon is imported
    expect(names).not.toContain('Togepi') // box 17 mon is excluded
  })

  it('selects the newer save block (block 2) by counter', () => {
    const buf = buildSave({ party: [garchomp], box: [blissey], block2: true })
    const mons = gen4Reader.read(buf)
    const names = mons.map(m => GEN4_ENUMS.species[m.speciesId])
    expect(names).toContain('Garchomp') // party read from block 2
    expect(names).toContain('Blissey')  // box read from block 2
  })

  it('detect() accepts 512KB and 256KB, rejects others', () => {
    expect(gen4Reader.detect(new ArrayBuffer(0x80000))).toBe(true)
    expect(gen4Reader.detect(new ArrayBuffer(0x40000))).toBe(true)
    expect(gen4Reader.detect(new ArrayBuffer(1024))).toBe(false)
  })
})
