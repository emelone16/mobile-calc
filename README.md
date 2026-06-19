# Dynamic Calc Mobile

A mobile-first, offline PWA rebuild of the Renegade Platinum trainer/damage calculator, hosted on GitHub Pages with **no server**. Damage math is the upstream `@smogon/calc` engine fed a custom ROM-hack data layer; `.sav` import is pure client-side binary parsing.

This repo is a **handoff scaffold**: real tooling/config, complete type contracts, and stubbed modules with explicit `TODO`s. It is not yet a working app. The build order, every TODO, and where the source-of-truth lives are in **[HANDOFF.md](./HANDOFF.md)** — read that first.

## Run

```bash
npm install
# drop your generated bundle at public/data/renegade-platinum.json first (see public/data/README.md)
npm run dev
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
