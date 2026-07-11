// ---------------------------------------------------------------------------
// Renegade Platinum TM/HM -> move mapping.
//
// Numbering is the vanilla Gen-4 (DPPt) TM/HM order. RP repurposes six TMs in
// place — same TM number, different move:
//   TM55 Brine       -> Scald
//   TM57 Charge Beam -> Wild Charge
//   TM62 Silver Wind -> Bug Buzz
//   TM83 Natural Gift-> Hyper Voice
//   TM85 Dream Eater -> Dazzling Gleam
//   TM88 Pluck       -> Hurricane
//
// Correctness: the full set of moves below is exactly the union of every
// species' `tms` list in the bundle (100 distinct moves = 92 TMs + 8 HMs).
// That equality is asserted in test/save.tm.test.ts, so a wrong or stale entry
// fails CI rather than silently mis-gating a move.
// ---------------------------------------------------------------------------

/** TM01..TM92, indexed 0-based (index 0 = TM01). */
export const TM_MOVES: readonly string[] = [
  'Focus Punch', 'Dragon Claw', 'Water Pulse', 'Calm Mind', 'Roar', 'Toxic',
  'Hail', 'Bulk Up', 'Bullet Seed', 'Hidden Power', 'Sunny Day', 'Taunt',
  'Ice Beam', 'Blizzard', 'Hyper Beam', 'Light Screen', 'Protect', 'Rain Dance',
  'Giga Drain', 'Safeguard', 'Frustration', 'Solar Beam', 'Iron Tail',
  'Thunderbolt', 'Thunder', 'Earthquake', 'Return', 'Dig', 'Psychic',
  'Shadow Ball', 'Brick Break', 'Double Team', 'Reflect', 'Shock Wave',
  'Flamethrower', 'Sludge Bomb', 'Sandstorm', 'Fire Blast', 'Rock Tomb',
  'Aerial Ace', 'Torment', 'Facade', 'Secret Power', 'Rest', 'Attract', 'Thief',
  'Steel Wing', 'Skill Swap', 'Snatch', 'Overheat', 'Roost', 'Focus Blast',
  'Energy Ball', 'False Swipe', 'Scald', 'Fling', 'Wild Charge', 'Endure',
  'Dragon Pulse', 'Drain Punch', 'Will-O-Wisp', 'Bug Buzz', 'Embargo',
  'Explosion', 'Shadow Claw', 'Payback', 'Recycle', 'Giga Impact', 'Rock Polish',
  'Flash', 'Stone Edge', 'Avalanche', 'Thunder Wave', 'Gyro Ball', 'Swords Dance',
  'Stealth Rock', 'Psych Up', 'Captivate', 'Dark Pulse', 'Rock Slide',
  'X-Scissor', 'Sleep Talk', 'Hyper Voice', 'Poison Jab', 'Dazzling Gleam',
  'Grass Knot', 'Swagger', 'Hurricane', 'U-turn', 'Substitute', 'Flash Cannon',
  'Trick Room',
]

/** HM01..HM08, indexed 0-based (index 0 = HM01). */
export const HM_MOVES: readonly string[] = [
  'Cut', 'Fly', 'Surf', 'Strength', 'Defog', 'Rock Smash', 'Waterfall',
  'Rock Climb',
]

// Gen-4 item ids: TM01..TM92 occupy 328..419; HM01..HM08 occupy 420..427.
const TM01_ITEM_ID = 328
const HM01_ITEM_ID = 420
export const TM_HM_ITEM_ID_MIN = TM01_ITEM_ID
export const TM_HM_ITEM_ID_MAX = HM01_ITEM_ID + HM_MOVES.length - 1 // 427

/** The move a TM/HM bag item teaches, or undefined if `id` isn't a TM/HM. */
export function moveForTmItemId(id: number): string | undefined {
  if (id >= TM01_ITEM_ID && id < TM01_ITEM_ID + TM_MOVES.length) {
    return TM_MOVES[id - TM01_ITEM_ID]
  }
  if (id >= HM01_ITEM_ID && id < HM01_ITEM_ID + HM_MOVES.length) {
    return HM_MOVES[id - HM01_ITEM_ID]
  }
  return undefined
}

/** Map a bag's owned TM/HM item ids to the distinct moves they teach. */
export function tmMovesFromItemIds(itemIds: Iterable<number>): string[] {
  const moves = new Set<string>()
  for (const id of itemIds) {
    const m = moveForTmItemId(id)
    if (m) moves.add(m)
  }
  return [...moves]
}
