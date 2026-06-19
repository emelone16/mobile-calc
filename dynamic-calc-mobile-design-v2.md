# Dynamic Calc Mobile — Design Document (v2)

A ground-up, mobile-first rebuild of the Dynamic Calc ROM-hack damage calculator. Targets Renegade Platinum first; architected for the wider catalog. **Hard constraints this version is built around: `.sav` import is mandatory, hosting is GitHub Pages (static, no server), and it ships as an installable PWA.**

> **The headline:** none of these constraints conflict. `.sav` parsing is pure client-side binary work — the original already does all of it in-browser with zero server involvement. It does not break the PWA, and it does not require hosting infrastructure. You keep the PWA, host on GitHub Pages, and as a bonus drop the last network dependency (npoint.io) by shipping data as static JSON. Everything runs offline.

---

## 1. Goals & non-goals

**Goals**

- Mobile-first UX: single-column, touch-native, thumb-reachable; no hover/hotkey dependencies.
- **First-class `.sav` import** for Renegade Platinum (Gen 4 DPPt save format), reusing the parsing logic that already exists.
- Installable, fully offline PWA hosted on GitHub Pages — **no server, no third-party data host**.
- Reuse the Smogon-derived calc engine; never rewrite damage math.
- Replace the global-mutable-state data model (the real source of the translation headache) with an immutable, typed, functional data layer.

**Non-goals (v1)**

- Native iOS app (ruled out).
- Full 99-hack catalog on day one. Architect for it; ship RP first.
- The 500 MB-RAM mastersheet mode as-is — reframed (Section 9), not ported.
- Save *writing/editing* (the original can write back). Read-only import covers the box-loading flow; defer writeback.

---

## 2. What to keep vs. rebuild

The `calc/` engine and the binary save-parsing logic are the assets worth preserving. Everything in the jQuery UI layer is rebuilt.

| Existing piece | Verdict | Why |
|---|---|---|
| `calc/` (the fork's copy of Smogon's engine: `calculateDPP` etc.) | **Don't extract — depend on upstream** `@smogon/calc` (npm, MIT, TypeScript) | The engine is a maintained npm package with a published `Generations`/`adaptable` interface for custom data layers. No reverse-engineering of compiled ES5 needed. |
| `calc/mechanics/romhacks/*` (profile layer, ~843 LOC) | **Port only if/when needed** | The genuinely fork-specific part. RP doesn't use a profile (vanilla fallback); port these onto upstream for the wider catalog. |
| `js/savereaders/*` (Gen 4/5 DS reader, g3/g6/g7, enums) | **Port the algorithm, drop the jQuery** | The offsets, block selection, decryption, and unshuffle are hard-won and correct. Reimplement as pure typed functions (Section 6). |
| `js/savereaders/enums.js` (`sav_pok_names`, `sav_move_names`, `sav_item_names`, `sav_abilities`, `sav_pok_growths`, `locations`) | **Keep as data tables** | National-dex-ordered ID→name maps + growth-rate + met-location tables. RP uses the vanilla Gen-4 set directly. |
| `js/calc_ui/switch_preview/g4.js` (gen-4 AI `u8` emulation) | **Port faithfully** | Self-contained pure logic for switch-in prediction. |
| `js/moveset_import.js` (clipboard set parse + `move_replacements` autocorrect) | **Extract logic, drop UI** | Parsing rules are valuable. |
| `backups/rp.js` data + JSON schema | **Keep schema, change delivery** | Your RP parser already emits this shape. Ship as static JSON, not executable JS. |
| `initialize.js` global patching, `shared_controls.js`, jQuery, npoint fetch | **Delete, redesign** | Global mutation + load-order coupling + third-party data host are exactly what to leave behind. |

Step one: `npm i @smogon/calc` and build against its **`/adaptable`** entry point, which accepts any data layer implementing the `Generations` interface. Your composed `GameData` (Section 5) implements that interface; the app calls upstream `calculate()` and never forks or vendors the engine. You inherit upstream's types, tests, and bugfixes for free.

---

## 3. Stack

| Concern | Choice | Rationale |
|---|---|---|
| Language | TypeScript everywhere | Engine + save parser + UI in one language. |
| Calc engine | **`@smogon/calc` (npm) via `/adaptable`** | Upstream MIT TypeScript package; feed it a custom `Generations` data layer. No fork to maintain. |
| Framework | React + Vite | Best static-PWA tooling; trivial GitHub Pages deploy. |
| State | Zustand | Minimal boilerplate for a small global calc/box state. |
| Routing | **HashRouter** | GitHub Pages can't do SPA fallback; hash routing sidesteps deep-link 404s and SW scope issues (Section 8). |
| Styling | Tailwind or CSS Modules + a locked token system | Mobile-first tokens, 44px touch targets, safe-area insets. |
| PWA | `vite-plugin-pwa` (Workbox) | SW + manifest + offline precache. |
| Save parsing | Plain `ArrayBuffer` + `DataView`, run in a **Web Worker** | No libraries; keep heavy decrypt off the UI thread. |
| Persistence | IndexedDB (`idb`) for box + large data; `localStorage` for prefs | Box survives reloads; survives storage pressure better if exportable. |
| Testing | Vitest (engine, data, **save parser**), Playwright (smoke) | Port `calc/test/*`; add save-parser fixtures (Section 11). |
| Deploy | GitHub Actions → Pages | `vite build` → publish `dist/`. |

---

## 4. Layered architecture

```
┌──────────────────────────────────────────────────────────┐
│  UI LAYER (React, mobile-first)                          │
│  Calc · Trainers · Box · Field · Save-import sheet        │
└───────────────┬──────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────┐
│  STATE (Zustand): calcStore · gameStore · boxStore · ui    │
└───────────────┬──────────────────────────────────────────┘
                │ pure calls
┌───────────────▼──────────────────────────────────────────┐
│  DOMAIN: calcService · importService · saveService ·       │
│          aiService · learnsetService                      │
└──────┬───────────────────────────────┬────────────────────┘
       │                               │ runs in Web Worker
┌──────▼──────────────┐   ┌────────────▼─────────────────────┐
│ ENGINE (@dcm/engine)│   │ SAVE PARSER (pure, gen-keyed)    │
│ calculate(), types  │   │ ArrayBuffer → RawMon[] → SetState│
└──────┬──────────────┘   └────────────┬─────────────────────┘
       │ both read                     │ maps IDs via
┌──────▼───────────────────────────────▼─────────────────────┐
│  GAME DATA (frozen GameData per hack) + ID→name enums       │
└───────────────┬────────────────────────────────────────────┘
                │ loaded by
┌───────────────▼────────────────────────────────────────────┐
│  DATA LOADER: fetch static JSON → compose → freeze → cache  │
└─────────────────────────────────────────────────────────────┘
```

Engine, save parser, and domain services are all pure and framework-free — unit-testable headless. Data flows down, events flow up.

---

## 5. Data layer (unchanged core idea, npoint removed)

### 5.1 The problem being fixed

`initialize.js` mutates global Smogon tables in place (`pokedex[name].bs = ...`, `SPECIES_BY_ID[gen][id].baseStats = ...`, `gameGen = 4`) and falls back to fetching `api.npoint.io/<id>` at runtime. Global mutation + load-order coupling + a third-party host are all incompatible with a clean component tree and a no-server PWA.

### 5.2 The replacement: composed, frozen `GameData`, shipped as static JSON

```ts
interface MechanicsProfile {
  speciesGen: number;   // movepool/species pool      (RP: 4)
  damageGen: number;    // MECHANICS[] formula         (RP: 4 → calculateDPP)
  typeChartGen: number; // type table                  (RP: 6 → Fairy + modern)
  critGen: number;      // crit mechanics              (RP: 5)
  switchInGen: number;  // AI/switch-in prediction     (RP: 4)
  saveGen: number;      // which SaveReader to use      (RP: 4 → DS DPPt)
  features: { dex: boolean; ai: boolean; encounters: boolean; save: boolean };
}

interface GameData {
  id: string; title: string;
  mechanics: MechanicsProfile;
  species: Record<string, SpeciesData>;     // vanilla genN ⊕ poks overrides
  moves:   Record<string, MoveData>;         // vanilla ⊕ moves overrides
  typeChart: TypeChart;
  trainers: TrainerIndex;                     // pre-built from formatted_sets
  moveReplacements: Record<string, string>;   // PKHex import autocorrect
  saveEnums?: SaveEnums;                       // ID→name override (only if hack reindexes)
  encounters?: EncounterTable;                 // optional; absent in RP bundle
}
```

`MechanicsProfile` is the typed version of the hardcoded `if (title == "Renegade Platinum") { gameGen=4; typeChart=6; ... }` block — now data, not code. RP = `{ speciesGen:4, damageGen:4, typeChartGen:6, critGen:5, switchInGen:4, saveGen:4 }`.

**Delivery:** convert `backups/rp.js` (`backup_data = {…}`) → `public/data/renegade-platinum.json`. The loader fetches it (same-origin, precached by the SW), composes vanilla Gen-4 tables with the hack overlays into a *copy*, freezes it. No globals touched, no npoint, fully offline after first load.

### 5.3 Keep your JSON schema

Your RP parser emits `{ formatted_sets, poks, moves, move_replacements }`. Keep it. Loader maps: `poks` → `SpeciesData`, `moves` → `MoveData` (preserve special cases `Return: 102`, `Magnitude: 70`), `move_replacements` → carried through, Platinum forme synthesis (Rotom/Cherrim/Wormadam/Deoxys/Giratina) → a declarative `platinum-formes.ts` table.

### 5.4 Pre-build the trainer index

Source keys are species-first (`formatted_sets["Hoothoot"]["Lvl 7 Youngster Tristan |Route 202| "]`). Invert once at load into a trainer-centric index for the mobile browser:

```ts
interface TrainerIndex {
  byId: Record<number, Trainer>;        // tr_id → trainer
  byLocation: Record<string, number[]>; // "Route 202" → [tr_id…]
  order: number[];                       // battle progression
}
```

Battle locations come straight off each set (`location` field + `|Route 202|` name token) — there is no separate location DB. Wild-encounter locations depend on an `encounters` section the RP bundle doesn't ship, so that's gated behind `features.encounters`.

---

## 6. Save-file parsing (the new first-class subsystem)

This is the headline addition. It is **pure client-side binary work** — no server, no special hosting — and it converges with clipboard import on a single box model.

### 6.1 Pipeline

```
File (.sav)
  └─ file.arrayBuffer()                         // standard, works on iOS Safari
       └─ [Web Worker] SaveReader[mechanics.saveGen]
            1. Identify format        size (512KB / 256KB) + footer/counters
            2. Choose active block    DS paired blocks @ 0x0 and 0x40000,
                                      pick by save counter (newest valid)
            3. Locate party + boxes   per-game offsets (table below)
            4. Per Pokémon:
                 • read PID + checksum (checksum @ 0x06)
                 • shiftValue = ((PID & 0x3E000) >> 0xD) % 24   // substructure order
                 • LCRNG-decrypt the 128-byte core → 64 u16 words
                 • unshuffle the 4 substructures (Growth/Attacks/EVs/Misc)
                 • extract: species ID, 4 move IDs, IVs, EVs, ability bit,
                            held-item ID, level (via EXP + growth table), nature (PID%25)
                 • skip empty slots / Egg / Bad Egg
            5. Map raw numeric IDs → names (Section 6.3)
       └─ postMessage(RawMon[]) back to main thread
            └─ saveService → SetState[] → merge into boxStore (IndexedDB)
```

The Web Worker keeps decryption of up to ~30 boxes × 30 mons off the UI thread; transfer the `ArrayBuffer` in so there's no copy.

### 6.2 Gen-4 (RP) format constants — encode as data, not code

| Field | Value (Gen 4 DPPt) | Notes |
|---|---|---|
| Save size | 512 KB | paired 0x40000 blocks |
| Active-block select | save counter compare | newest non-`0xFFFFFFFF`/`0x0` |
| `partyCountOffset` | game-specific (e.g. `0x94`) | `partyCount = view[offset]` |
| Party mon size | **236 bytes** | 136 stored + 100 battle stats |
| Box mon size | **136 bytes** | encrypted core only |
| `shiftValue` | `((PID & 0x3E000) >> 0xD) % 24` | one of 24 substructure orders |
| Checksum | `(raw[0x07] << 8) \| raw[0x06]` | seeds the decrypt LCRNG |

Other gens slot in behind the same `SaveReader` interface (Gen 5 BW/BW2 differ in offsets/checksum layout; Gen 3 = 220-byte mons, 4×3.5KB sections with rotation; Gen 6/7 are separate). RP only needs Gen 4 for v1.

```ts
interface SaveReader {
  detect(buf: ArrayBuffer): boolean;
  read(buf: ArrayBuffer, enums: SaveEnums): RawMon[];
}
const READERS: Record<number, SaveReader> = { 4: gen4Reader, /* 5,3,6,7 later */ };
```

### 6.3 ID→name mapping: default vanilla, override only when reindexed

The enum tables (`sav_pok_names` in national-dex order, `sav_move_names`, `sav_item_names`, `sav_abilities`, plus `sav_pok_growths` for level-from-EXP) are the **default Gen-4 set** and work for Renegade Platinum, because RP preserves standard species/move/item indices. Ship them once as `gen4-enums.ts`.

Only expansion-style hacks that renumber their enums need overrides — the original models this with its `readIncludes` flag and a bundle-supplied `includes` block. Mirror that exactly: if `GameData.saveEnums` is present, use it; otherwise fall back to the gen default. RP sets nothing and uses the default.

Output `RawMon` → `SetState` (species name, level, nature, ability, item, 4 moves, IVs/EVs) — **the same `SetState` the clipboard importer produces**, so the box has one unified shape regardless of source. Apply `moveReplacements` here too for consistency.

### 6.4 iOS / file-input reality

- Use a plain `<input type="file">` + `file.arrayBuffer()`. This works on iOS Safari and pulls from Files / iCloud Drive. `.sav` has no registered MIME type, so use `accept="*/*"` (or omit `accept`).
- **Do not** use the File System Access API (`showOpenFilePicker`) — unsupported on iOS Safari.
- **Do not** rely on the File Handling API (manifest `file_handlers`, "Open .sav with…") — Chromium-only; not on iOS. Nice-to-have elsewhere, never a dependency.
- Offer a manual export of the box (JSON) so users can back it up, since iOS can evict PWA storage under pressure.

---

## 7. The calc & domain services

```ts
// calcService.ts — dispatch by data, not a global
function calculate(game, atk, def, move, field): CalcOutcome {
  const gen = Generations.get(game.mechanics.speciesGen);
  const result = engineCalculate(game.mechanics.damageGen, gen,
                   toEnginePokemon(gen, game, atk),
                   toEnginePokemon(gen, game, def),
                   toEngineMove(gen, game, move),
                   toEngineField(field));
  return { rolls: result.damage, koChance: result.kochance(),
           desc: result.desc(), range: result.range() };
}
```

Only change vs. the original dispatcher: `game.mechanics.damageGen` replaces the global `gameGen` index. Same `MECHANICS[]`, same `calculateDPP` for RP.

- `importService` — clipboard set parse + `move_replacements`. Pure.
- `saveService` — orchestrates the Web Worker, maps `RawMon[]` → `SetState[]`, dedupes into the box.
- `aiService` — gen-4 `u8` AI for switch-in/bait-order prediction. Pure.
- `learnsetService` — learnset/TM sheet from `species.learnset_info`.

---

## 8. GitHub Pages hosting (no server)

Static hosting only — no SSR, no API routes. The whole app is client-side, which it already was. Specifics that bite if ignored:

- **Base path.** Set Vite `base: '/<repo>/'` (unless using a custom domain or a `<user>.github.io` root repo). Wrong base = broken asset and service-worker paths.
- **Routing.** GitHub Pages returns its own 404 on deep client routes. Use **HashRouter** — bulletproof on Pages and avoids SW navigation-scope edge cases. (The `404.html`→`index.html` redirect trick is the alternative if you insist on clean URLs; not worth it here.)
- **Service worker scope** must sit under the base path; `vite-plugin-pwa` handles this once `base` is set. Pages is HTTPS by default, which the SW requires.
- **No custom headers.** You cannot set COOP/COEP, so no cross-origin isolation, so no `SharedArrayBuffer` / threaded wasm. **Irrelevant here** — save parsing is light synchronous binary work in a single Web Worker; it needs none of that.
- **All data is static + same-origin.** Drop npoint entirely; `public/data/*.json` ships in the repo and is precached. This is what makes it server-free *and* fully offline.
- **Deploy** via a GitHub Action: build, publish `dist/` to Pages. The data bundles version with the app, so cache and engine never desync.
- **iOS PWA caveats:** installable to home screen, SW caching and IndexedDB work (Safari 16.4+). Storage can be evicted under pressure — hence the box-export safety valve (6.4).

---

## 9. Reframing the mastersheet

The ~500 MB-RAM table is a non-starter on a phone. Replace, don't port: virtualize rows (`@tanstack/react-virtual`), lazy-load sections from IndexedDB, and make **search the primary interaction** rather than scrolling a megatable. For RP (no encounter data yet) the "mastersheet" effectively *is* the Trainers browser; an Encounters tab lights up only when `features.encounters` is true.

---

## 10. Mobile-first UX

Principles: single column; a **persistent sticky result bar** (e.g. "84.2 – 99.4% — 2HKO") that never scrolls away; **bottom nav** (`Calc · Trainers · Box · Field`); **bottom-sheet pickers** replacing every dropdown; **gestures with visible button equivalents** (swipe to flip sides, long-press to load to the other side) replacing the `f/i/c/l` hotkeys; **no hover** (tap-to-expand detail).

- **Calc:** stacked Yours / Enemy cards; move chips recalc on tap; EV/IV collapsed by default; field affordance.
- **Trainers:** location-grouped, searchable list → trainer detail (team scroller) → tap a mon loads it as the enemy (whole team rides along for AI preview).
- **Box:** imported sets (IndexedDB) from **both** clipboard and `.sav`; a prominent "Import save" entry opens the file picker → worker → review sheet → commit.
- **Field:** weather/terrain/screens/status toggles, gated by `mechanics` (don't show Gen-8 weather on a Gen-4 hack).
- **Dex detail:** stats, types, abilities, learnset/TMs.

Lock a token system early (spacing/type scale, one accent, 44px targets, safe-area insets); consult the `frontend-design` guidance so it doesn't read as default Tailwind.

---

## 11. Testing & correctness nets

- **Engine:** port `calc/test/*` to Vitest against `@dcm/engine`. Must stay green.
- **Save parser:** the critical new net. Capture a few known `.sav` files (or PKHex exports of the same saves) and assert the parser yields identical species/level/moves/IVs/EVs/nature/ability/item. Include edge cases: empty slots, Egg/Bad Egg, full boxes, both save-counter blocks. Diff against the original reader's output during the port.
- **Data:** JSON-schema-validate every bundle in CI (fail build on drift) — same data-integrity discipline you apply in the parser, enforced at the boundary.
- **Calc regression:** snapshot a few dozen real calcs from the live site (varied types/items/abilities/crit/weather) as fixtures before deleting anything.

---

## 12. Phased plan

**Phase 0 — Engine integration.** `npm i @smogon/calc`; wire the `/adaptable` entry point to a stub `Generations` data layer; confirm a known calc matches the live site. Add the small RP hybrid overrides (gen-6 type chart, gen-5 crits over gen-4 damage). No fork, no UI.

**Phase 1 — Data layer.** `GameData`/`MechanicsProfile` types + JSON schema. Loader: RP JSON → frozen `GameData` + `TrainerIndex`. Convert `backups/rp.js` → `renegade-platinum.json`. Headless test: known calc matches the live site.

**Phase 2 — Calc MVP.** Calc screen, sticky result bar, bottom-sheet pickers, field sheet, `calcService`. A usable mobile calculator.

**Phase 3 — Trainers + Box.** Trainer browser, load-enemy flow, clipboard import with autocorrect, box persistence in IndexedDB.

**Phase 4 — Save import (priority).** Port the Gen-4 DS reader as a pure `SaveReader` in a Web Worker; `gen4-enums.ts`; `saveService` → box; file-input UI + review sheet; parser fixtures green. This is the must-have feature, so it lands before AI.

**Phase 5 — AI / switch-in.** Port the gen-4 `u8` AI; bait-order preview on the enemy card.

**Phase 6 — PWA + Pages hardening.** `vite-plugin-pwa` precache (shell + engine + RP JSON), HashRouter, base path, GitHub Action deploy, offline test on iOS, box export, virtualized lookup, safe-area polish.

**Phase 7 — Multi-hack.** Generalize loader to any bundle + profile + (optional) `saveEnums`; hack picker. Architecture already supports it.

---

## 13. Key decisions & risks

- **Engine** — no longer a risk. `@smogon/calc` is a maintained MIT npm package with a purpose-built `adaptable`/`Generations` seam for custom data. Only caveat: the romhack profile layer (~843 LOC) isn't in upstream, so port it onto upstream for hacks that need a custom mechanics profile (RP doesn't). Pin the engine version so an upstream change can't silently shift damage numbers.
- **Save-parser correctness** — the new top risk. The decrypt/unshuffle/level-from-EXP path is fiddly; the fixture suite (Section 11) is non-negotiable. Default to vanilla Gen-4 enums for RP; only add `saveEnums` for hacks that reindex.
- **iOS file picker** — plain `<input type="file">` only; no File System Access / File Handling APIs.
- **GitHub Pages base path + HashRouter** — get these right first or routing/SW/asset paths fail confusingly.
- **Static-only, no headers** — fine for this app; just don't design anything that needs cross-origin isolation.
- **Profiles as data** — moving mechanics into `MechanicsProfile` JSON is what makes multi-hack scale. Don't special-case hacks in code again.
- **Frozen data + pure services** — predictable renders, trivial memoization; the opposite of the mutate-globals model, and the reason this rebuild won't reproduce the translation pain.

---

*Bottom line: keep the math and the save-parsing algorithm, throw away the jQuery plumbing and the npoint dependency. A typed immutable `GameData` from static JSON, a pure `calcService` over the repackaged engine, a Web-Worker `.sav` reader feeding one unified box, and a single-column touch-first UI — all shipped as an offline PWA on GitHub Pages with no server anywhere in the picture.*
