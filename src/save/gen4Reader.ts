// ---------------------------------------------------------------------------
// Gen 4 (DPPt) DS save reader. PURE — runs in a Web Worker.
// Faithfully ported from the original js/savereaders/savereader.js (parsePKM +
// the DS paired-block selection). Constants verified against that source:
//   * 512KB save with paired blocks @ 0x00000 and 0x40000, pick by save counter
//   * party mon = 236 bytes (136 stored core + 100 battle stats); box mon = 136
//   * each stored mon: 8-byte header (PID @0x00, checksum @0x06) + 128-byte body
//   * body = four 32-byte (16-word) substructures, order = BLOCK_ORDERS[PID-shift]
//   * body decrypted with a checksum-seeded LCRNG
//   * EVs live in the Growth (logical 0) block; IVs/moves in the Attacks (1) block
//   * level derived from EXP via the species growth-rate table (EXP_TABLES)
// ---------------------------------------------------------------------------
import type { RawMon, SaveReader } from './types'
import type { StatsTable } from '../data/types'
import { GEN4_ENUMS, EXP_TABLES, BLOCK_ORDERS } from './gen4Enums'
import { TM_HM_ITEM_ID_MIN, TM_HM_ITEM_ID_MAX } from './renegadePlatinumTms'

const PARTY_MON_SIZE = 236
const BOX_MON_SIZE = 136
const BLOCK2 = 0x40000

// Renegade Platinum is built on Platinum (Pt). Offsets from the original reader.
interface GameOffsets {
  partyCountOffset: number
  smallBlockSize: number
  boxDataOffset: number
  bigBlockSize: number
  boxSlotCount: number
}
const BOX_SLOTS_PER_BOX = 30
const TOTAL_BOX_COUNT = 18
const DPPT_OFFSETS: GameOffsets = {
  partyCountOffset: 0x9c,
  smallBlockSize: 0xcf2c,
  boxDataOffset: 0xcf30,
  bigBlockSize: 0x121e4,
  // Boxes 17-18 are excluded from import, so only read boxes 1-16.
  boxSlotCount: (TOTAL_BOX_COUNT - 2) * BOX_SLOTS_PER_BOX,
}

const MASK32 = 0xffffffff
const lcrngNext = (s: number) => (Math.imul(s, 0x41c64e6d) + 0x6073) >>> 0
const isInvalidCounter = (c: number) => c === MASK32 || c === 0

export const gen4Reader: SaveReader = {
  detect(buf) {
    return buf.byteLength === 0x80000 || buf.byteLength === 0x40000
  },

  read(buf) {
    const view = new DataView(buf)
    const paired = buf.byteLength >= 0x80000
    const off = DPPT_OFFSETS
    const out: RawMon[] = []

    // --- choose active blocks (small block holds party, big block holds boxes) ---
    const partyBase = selectGeneralBase(view, paired)
    let boxBase = off.boxDataOffset
    if (paired) {
      const bigBlockStart = off.boxDataOffset - 4
      const small1 = readU32(view, off.smallBlockSize - 16)
      const small2 = readU32(view, off.smallBlockSize + BLOCK2 - 16)
      const selectedSmall = partyBase === BLOCK2 ? small2 : small1

      const big1 = readU32(view, bigBlockStart + off.bigBlockSize - 16)
      const big2 = readU32(view, bigBlockStart + BLOCK2 + off.bigBlockSize - 16)
      boxBase = off.boxDataOffset + chooseDsPairedBlockOffset(selectedSmall, big1, big2)
    }

    // --- party ---
    const count = view.getUint8(partyBase + off.partyCountOffset)
    let p = partyBase + off.partyCountOffset + 4
    for (let i = 0; i < count; i++) {
      const mon = parseMon(buf, p, PARTY_MON_SIZE)
      if (mon) out.push(mon)
      p += PARTY_MON_SIZE
    }

    // --- boxes ---
    let b = boxBase
    for (let i = 0; i < off.boxSlotCount; i++) {
      const mon = parseMon(buf, b, BOX_MON_SIZE)
      if (mon) out.push(mon)
      b += BOX_MON_SIZE
    }

    return out
  },

  // The TM Case pocket lives in the general (small) block. It is a fixed-size
  // array of {u16 itemId, u16 count} slots, front-compacted (a zero id ends the
  // list). Gen-4 TM/HM item ids are 328..427. Offset & capacity were confirmed
  // against a real Renegade Platinum save.
  readBag(buf) {
    const view = new DataView(buf)
    const paired = buf.byteLength >= 0x80000
    const base = selectGeneralBase(view, paired) + TM_POCKET_OFFSET
    const owned: number[] = []
    for (let i = 0; i < TM_POCKET_CAPACITY; i++) {
      const o = base + i * 4
      if (o + 4 > view.byteLength) break
      const id = view.getUint16(o, true)
      if (id === 0) break // front-compacted: first empty slot ends the pocket
      const count = view.getUint16(o + 2, true)
      if (id >= TM_HM_ITEM_ID_MIN && id <= TM_HM_ITEM_ID_MAX && count > 0) {
        owned.push(id)
      }
    }
    return owned
  },
}

// TM Case pocket, relative to the general-block base (0 or 0x40000).
const TM_POCKET_OFFSET = 0x98c
const TM_POCKET_CAPACITY = 100 // 92 TMs + 8 HMs

/** Pick the active general/small block base (0 or 0x40000) by save counter. */
function selectGeneralBase(view: DataView, paired: boolean): number {
  if (!paired) return 0
  const small1 = readU32(view, DPPT_OFFSETS.smallBlockSize - 16)
  const small2 = readU32(view, DPPT_OFFSETS.smallBlockSize + BLOCK2 - 16)
  if (isInvalidCounter(small1) || (!isInvalidCounter(small2) && small2 > small1)) {
    return BLOCK2
  }
  return 0
}

function readU32(view: DataView, off: number): number {
  if (off + 4 > view.byteLength) return MASK32
  return view.getUint32(off, true)
}

/** Port of chooseDsPairedBlockOffset from the original reader. */
function chooseDsPairedBlockOffset(preferred: number, block1: number, block2: number): number {
  const b1 = isInvalidCounter(block1)
  const b2 = isInvalidCounter(block2)
  if (!b1 && block1 === preferred) return 0
  if (!b2 && block2 === preferred) return BLOCK2
  if (b1 && !b2) return BLOCK2
  if (!b1 && b2) return 0
  if (!b1 && !b2 && block2 > block1) return BLOCK2
  return 0
}

/** Decrypt + unshuffle + extract one stored Pokemon. Returns null for empty slots. */
function parseMon(buf: ArrayBuffer, offset: number, size: number): RawMon | null {
  const bytes = new Uint8Array(buf, offset, Math.min(size, buf.byteLength - offset))
  if (bytes.length < BOX_MON_SIZE || isChunkEmpty(bytes)) return null

  const v = new DataView(buf, offset)
  const pid = v.getUint32(0x00, true)
  const checksum = v.getUint16(0x06, true)
  const shiftValue = ((pid & 0x3e000) >> 0xd) % 24

  // Decrypt the 128-byte (64 u16) body with the checksum-seeded LCRNG.
  const dd = new Uint16Array(64)
  let seed = checksum
  for (let i = 0; i < 64; i++) {
    seed = lcrngNext(seed)
    dd[i] = v.getUint16(0x08 + i * 2, true) ^ (seed >>> 16)
  }

  // Word offset of each logical substructure (16 words = 32 bytes each).
  const order = BLOCK_ORDERS[shiftValue] ?? [0, 1, 2, 3]
  const M = order.indexOf(0) * 16 // Growth: species, item, exp, ability, EVs
  const A = order.indexOf(1) * 16 // Attacks: moves, IVs, forme/nature/egg flags

  const speciesId = dd[M] ?? 0
  if (speciesId <= 0) return null

  const itemId = dd[M + 1] ?? 0
  const exp = ((dd[M + 5] ?? 0) << 16) | ((dd[M + 4] ?? 0) & 0xffff)
  const abilityId = ((dd[M + 6] ?? 0) >> 8) & 0xff
  const evs = readEVs(dd, M)

  const moveIds = [dd[A + 0] ?? 0, dd[A + 1] ?? 0, dd[A + 2] ?? 0, dd[A + 3] ?? 0]
  const ivValue = (((dd[A + 9] ?? 0) << 16) | ((dd[A + 8] ?? 0) & 0xffff)) >>> 0
  const ivs = readIVs(ivValue)
  const isEgg = ((ivValue >>> 30) & 1) === 1

  return {
    speciesId,
    itemId,
    moveIds,
    abilityId,
    evs,
    ivs,
    natureId: pid % 25,
    level: levelFromExp(speciesId, exp),
    isEgg,
  }
}

function isChunkEmpty(bytes: Uint8Array): boolean {
  for (let i = 0; i < bytes.length; i++) if (bytes[i] !== 0) return false
  return true
}

// EVs live in the Growth block: word M+8 = {hp, atk}, M+9 = {def, spe}, M+10 = {spa, spd}.
function readEVs(dd: Uint16Array, M: number): StatsTable {
  const w8 = dd[M + 8] ?? 0, w9 = dd[M + 9] ?? 0, w10 = dd[M + 10] ?? 0
  return {
    hp: w8 & 0xff, at: (w8 >> 8) & 0xff,
    df: w9 & 0xff, sp: (w9 >> 8) & 0xff,
    sa: w10 & 0xff, sd: (w10 >> 8) & 0xff,
  }
}

function readIVs(iv: number): StatsTable {
  return {
    hp: iv & 0x1f, at: (iv >> 5) & 0x1f, df: (iv >> 10) & 0x1f,
    sp: (iv >> 15) & 0x1f, sa: (iv >> 20) & 0x1f, sd: (iv >> 25) & 0x1f,
  }
}

// EXP -> level via the species' growth-rate table. Binary search: the level is
// the index of the first threshold strictly greater than exp (table[L-1] <= exp).
function levelFromExp(speciesId: number, exp: number): number {
  const rate = GEN4_ENUMS.growths[speciesId]
  const table = rate !== undefined ? EXP_TABLES[rate] : undefined
  if (!table) return 1
  if (exp >= (table[99] ?? Infinity)) return 100
  let lo = 0, hi = table.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if ((table[mid] ?? 0) <= exp) lo = mid + 1
    else hi = mid - 1
  }
  return lo > 0 ? lo : 1
}
