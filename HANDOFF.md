# HANDOFF — implementation guide for the next agent

You are picking up a **scaffold**, not a working app. Tooling, config, type contracts, store shapes, the engine-adapter strategy, and the save-reader algorithm are in place as typed stubs with `TODO`s. Your job is to execute the milestones below in order, filling the stubs, until the app runs offline on GitHub Pages with correct calcs and working `.sav` import.

The design rationale lives in the companion design doc (`dynamic-calc-mobile-design-v2.md`). This file is the executable task list.

## Source-of-truth repo

Several tasks are **transcriptions** from the original project. Clone it for reference:

```
git clone --branch decomp https://github.com/hzla/Dynamic-Calc-Decomps
```

| You need… | Find it in the original at… |
|---|---|
| RP data bundle to convert → `public/data/renegade-platinum.json` | `backups/rp.js` (assigns `backup_data = {…}`) |
| Gen-4 ID→name enums (`sav_pok_names`, `sav_move_names`, `sav_item_names`, `sav_abilities`, `sav_pok_growths`) | `js/savereaders/enums.js` |
| Per-game save offsets, block selection, decrypt/unshuffle | `js/savereaders/savereader.js` |
| Gen-4 trainer AI (`u8` scoring) for switch-in prediction | `js/calc_ui/switch_preview/g4.js` |
| Clipboard set parser (Showdown/PKHex text) | `js/moveset_import.js` |
| Live calc results to snapshot for the parity test | `https://hzla.github.io/Dynamic-Calc-Decomps/?data=renegadeplatinum` |

**Ground rule:** never re-derive damage formulas or save-decryption math from scratch. Transcribe the constants and lean on `@smogon/calc` for the math.

## Engine import caveat (resolve in Milestone 1)

`src/engine/calcService.ts` and `generationsAdapter.ts` import from `@smogon/calc`. Confirm whether v0.11.x exposes `Generations` from the package root or whether you need the `@smogon/calc/adaptable` entry point (and/or its bundled data layer for the base `Generations`). Adjust the two import lines accordingly; everything downstream is unaffected.

---

## Milestones (in order)

### M1 — Engine integration (Phase 0)
- `npm install`; resolve the import caveat above.
- In `generationsAdapter.ts`: memoize the `id → display-name` maps (the current `idToName` scan is a placeholder) per `GameData`.
- Verify `runCalc` executes against a hand-built `GameData` with two mons.
- **Done when:** a scripted calc returns a sane `desc` + min/max %.

### M2 — Data layer (Phase 1)
- Convert `backups/rp.js` → `public/data/renegade-platinum.json` (see `public/data/README.md`).
- Validate the bundle matches `SourceBundle` in `src/data/types.ts`; fix the parser or the type if they disagree. Add a JSON-schema check to CI.
- Implement the `platinum-formes` merge TODO in `composeGameData.ts` (Rotom appliances, Cherrim-Sunshine, Wormadam/Deoxys/Giratina) — declarative table, transcribed from the original `initPlatinum()`.
- **Done when:** `loadRenegadePlatinum()` returns a frozen `GameData`; species/move counts match the bundle (≈507 / ≈470).

### M3 — Calc parity net (testing)
- Capture 20–30 varied calcs from the live site into `test/fixtures/rp-calcs.json` (vary type, item, ability, crit, weather).
- Unskip `test/engine.test.ts`; make every fixture's min/max % match.
- **Done when:** the parity suite is green. This is the gate that proves the adapter is correct — do not proceed past a red parity suite.

### M4 — Calc MVP UI (Phase 2)
- Build the `BottomSheet` selector (`src/ui/components/BottomSheet.tsx` — create it) and wire species/move/item/ability/nature pickers into `CalcScreen`.
- Collapse EV/IV behind an expander.
- Make the result bar reflect the selected move and show the other moves' results as a secondary row.
- **Done when:** you can assemble both mons by tapping and read a live result.

### M5 — Trainers + Box (Phase 3)
- `TrainersScreen`: location-grouped, searchable list from `game.trainers.byLocation`/`order` → trainer detail (team scroller) → tap a mon loads it as the defender and carries the whole team for later AI use.
- Port the clipboard parser into `src/import/moveReplacements.ts`'s `parseSet()` TODO; wire "import from clipboard" in `BoxScreen`.
- `BoxScreen`: list `boxStore.sets`, tap to load as attacker, add export-JSON button.
- **Done when:** load enemy-from-trainer and load-self-from-box both drive the calc.

### M6 — Save import (Phase 4, the priority feature)
Fill `src/save/gen4Reader.ts` and `src/save/gen4Enums.ts` — all data transcriptions:
- `GEN4_ENUMS`: paste the five tables from `enums.js`.
- `DPPT_OFFSETS` (+ any HGSS/DP variants): real `partyCountOffset`, box offsets, big-block size.
- `BLOCK_ORDERS`: the 24 substructure permutations.
- `chooseActiveBlock`/`readCounter`: real footer offsets so block selection works.
- `levelFromExp`: drop in the 6 growth-rate EXP tables; index via `sav_pok_growths[speciesId]`.
- Resolve the ability bit in `parseMon` (Misc substructure) to a dex ability index.
- Build the file-input UI (`<input type="file">`, no File System Access API) + a review sheet before committing to the box.
- Unskip `test/saveReader.test.ts`; pass all edge cases (empty/Egg/Bad Egg/full boxes/block-2).
- **Done when:** importing a real RP save yields a correct box, verified against PKHex.

### M7 — AI / switch-in (Phase 5)
- Port `g4.js` (`gen4AiU8`, `gen4AiDivide`, `gen4AiApplyEffectiveness`) verbatim as a pure `aiService.predictSwitchIn(...)`.
- Show predicted enemy order on the defender card.
- **Done when:** bait-order preview matches the original for a couple of known trainers.

### M8 — PWA + Pages hardening (Phase 6)
- Set `DCM_BASE` / `vite.config.ts` `base` to the real repo subpath; confirm SW scope + asset paths.
- Add real PWA icons (`public/icon-192.png`, `icon-512.png`, `favicon.svg`).
- Verify offline: airplane-mode reload still calculates; box persists.
- Add the box-export reminder (iOS can evict PWA storage).
- Ship via the included GitHub Action.
- **Done when:** installed-to-home-screen, offline, deployed.

### M9 — Design pass (cross-cutting, do alongside M4+)
- Read the `frontend-design` guidance; replace the inline placeholder styles with a real token system (spacing/type scale, one accent, 44px touch targets, safe-area insets). The current inline styles exist only to make the slice runnable.

### M10 — Multi-hack (Phase 7, optional)
- Generalize `loader.ts` to any `{bundle, MechanicsProfile, saveEnums?}`; add a hack picker.
- Port the romhack mechanics-profile layer (`calc/mechanics/romhacks/`, ~843 LOC) onto upstream for hacks that need a custom profile. RP doesn't.

---

## TODO inventory (grep `TODO` in src; summarized)

| File | TODO | Milestone |
|---|---|---|
| `engine/generationsAdapter.ts` | memoize id→name map | M1 |
| `engine/calcService.ts` | map screens/tailwind/status onto `Side` | M4 |
| `data/composeGameData.ts` | merge platinum-formes table | M2 |
| `save/gen4Reader.ts` | offsets, BLOCK_ORDERS, counters, EXP→level, ability bit, box loop | M6 |
| `save/gen4Enums.ts` | paste 5 enum tables | M6 |
| `import/moveReplacements.ts` | port `parseSet()` clipboard parser | M5 |
| `ui/*` | real pickers, screens, design tokens | M4–M5, M9 |

## Open decisions (flag back to the owner)
1. **Engine entry point** — root vs `/adaptable`; pin the exact `@smogon/calc` version so damage numbers can't shift under an upstream release.
2. **Compose at build vs runtime** — currently runtime (simpler, smaller assets). Revisit if first-load time on mobile is poor.
3. **Box dedupe policy** — re-importing a save currently appends. Decide on identity (PID-based?) before M6 ships.

## Definition of done (v1)
Offline-installable PWA on GitHub Pages where: RP calcs match the live site (M3 green), trainers/box drive the calc, and a real `.sav` imports correctly (M6 green, verified vs PKHex). AI preview (M7) and multi-hack (M10) are post-v1.
