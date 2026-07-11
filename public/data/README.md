# Data bundles

Drop your generated bundle here as `renegade-platinum.json`.

It is the SAME shape your existing Python parser already emits:
  { "title", "formatted_sets", "poks", "moves", "move_replacements" }

Convert the old executable bundle once:
  node -e "global.backup_data=null; eval(require('fs').readFileSync('rp.js','utf8')); \
    require('fs').writeFileSync('renegade-platinum.json', JSON.stringify(backup_data))"

## Evolutions (companion file)

`renegade-platinum-evolutions.json` is an OPTIONAL overlay the loader merges on
top of the bundle (the bundle's `poks` entries carry no evolution data). Shape:

  { "<Species>": [ { "into": "<Species>", "method": "<human-readable>" }, ... ] }

Keyed by species display name; only species that actually evolve are listed. The
loader synthesizes the reverse (`preEvolutions`) links and skips any entry whose
species isn't in the bundle, so the two files can drift safely.

Source: the base Gen-4 evolution graph from `@pkmn/dex` (the Smogon data package
underpinning `@smogon/calc`) with Renegade Platinum's documented overrides
applied — trade evolutions become held-item methods, adjusted levels, and
happiness/eeveelution method changes. Derived from professorxavi/renplatdex's
`gen-evolutions.mjs`.
