# Dynamic Calc Mobile

A mobile-first, offline PWA rebuild of the Renegade Platinum trainer/damage calculator, hosted on GitHub Pages with **no server**. Damage math is the upstream `@smogon/calc` engine fed a custom ROM-hack data layer; `.sav` import is pure client-side binary parsing.

The original handoff scaffold has been **implemented**: the engine adapter, frozen data layer, gen-4 `.sav` reader, clipboard import, gen-4 AI preview, and the mobile UI are all in place, with the bundled RP data shipped at `public/data/renegade-platinum.json`. Design rationale lives in the design doc; the original milestone list is in **[HANDOFF.md](./HANDOFF.md)**.

Status by milestone:

- **M1 Engine integration** — `@smogon/calc` Generations adapter overlays RP species/move data over vanilla, gen-6 type chart over gen-4 damage; memoized id→name maps.
- **M2 Data layer** — RP bundle → frozen `GameData` + `TrainerIndex`; platinum-formes merge.
- **M3 Calc parity** — 19 independent-oracle parity fixtures + smoke/immunity assertions, green.
- **M4 Calc UI** — bottom-sheet pickers, EV/IV editor, sticky result bar with secondary move rolls.
- **M5 Trainers + Box** — location-grouped trainer browser, clipboard import, box persistence/export.
- **M6 Save import** — gen-4 DPPt reader in a Web Worker, review sheet, round-trip test net.
- **M7 AI preview** — gen-4 damage-score switch-in/threat ranking.
- **M8 PWA + Pages** — base path, icons, `vite-plugin-pwa` precache, GitHub Action deploy.
- **M9 Design pass** — token system replacing placeholder styles.
- **M10 Multi-hack** — generalized `loadHack`/`HACKS` registry (RP ships first).

## Run

```bash
npm install
npm run dev      # data bundle already present at public/data/renegade-platinum.json
npm test         # engine parity + save-reader + parser + AI nets
npm run build    # tsc --noEmit && vite build (DCM_BASE defaults to /mobile-calc/)
```

## Architecture (one screen)

```
UI (React, mobile-first)         src/ui/*, src/App.tsx
  ↕ state (Zustand)              src/state/{game,calc,box}Store.ts
domain services (pure)           src/engine/calcService.ts, src/save/saveService.ts, src/import/*
  ↓ uses
@smogon/calc (npm)  ◄──  Generations adapter   src/engine/generationsAdapter.ts   ← CRUX
  reads
GameData (frozen, composed)      src/data/{types,loader,composeGameData}.ts
  loaded from
static JSON  /public/data/*.json  (precached by the service worker — fully offline)

.sav  ──►  Web Worker  ──►  gen4Reader  ──►  RawMon[]  ──►  SetState[]  ──►  Box (IndexedDB)
           src/save/saveWorker.ts   src/save/gen4Reader.ts   ← CRUX #2
```

## The two hard parts

1. **`src/engine/generationsAdapter.ts`** — proxies `@smogon/calc`'s own `Generations` data layer so species/move lookups return ROM-hack values (fallback to vanilla), and type effectiveness comes from `typeChartGen` (gen 6) while damage uses `damageGen` (gen 4). This replaces the original's global-table mutation.
2. **`src/save/gen4Reader.ts`** — DPPt save decrypt/unshuffle/extract. Logic is laid out; the data tables (offsets, 24 block-orders, enums, EXP→level) are transcription tasks from the original repo.

Everything else is plumbing around these two.
