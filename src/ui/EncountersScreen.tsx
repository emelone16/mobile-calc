import { useMemo, useState } from 'react'
import { useGameStore } from '../state/gameStore'
import { BottomSheet } from './components/BottomSheet'
import { ENCOUNTER_METHODS, type EncounterMethod, type WildEncounter } from '../data/types'

// Sprite icons come from the same source the Box screen uses.
function toSpriteName(species: string): string {
  return species.toLowerCase().replace(/[.''']/g, '').replace(/\s+/g, '-')
}
function iconUrl(species: string) {
  return `https://img.pokemondb.net/sprites/gen4-dp/icon/${toSpriteName(species)}.png`
}

const METHOD_LABELS: Record<EncounterMethod, string> = {
  morning: 'Morning', day: 'Day', night: 'Night',
  pokeradar: 'Poké Radar', honeytree: 'Honey Tree', surf: 'Surf',
  oldrod: 'Old Rod', goodrod: 'Good Rod', superrod: 'Super Rod',
  gift: 'Gift', special: 'Special',
}

function formatLevels([min, max]: [number, number]): string {
  return min === max ? `Lv ${min}` : `Lv ${min}–${max}`
}
function formatRate(rate: number | null): string {
  return rate == null ? '—' : `${rate}%`
}

// Slots the player sees first (higher chance) read best at the top; fixed
// gift/special slots (no rate) sink to the bottom.
function byRate(a: WildEncounter, b: WildEncounter): number {
  return (b.rate ?? -1) - (a.rate ?? -1)
}

type Mode = 'location' | 'pokemon'

/** Where a species appears: one row per location+method it's found in. */
interface Sighting {
  location: string
  method: EncounterMethod
  enc: WildEncounter
}

function Sprite({ species }: { species: string }) {
  return (
    <img
      src={iconUrl(species)}
      alt=""
      style={{ width: 40, height: 40, imageRendering: 'pixelated', flexShrink: 0 }}
      onError={e => { (e.target as HTMLImageElement).style.visibility = 'hidden' }}
    />
  )
}

export function EncountersScreen() {
  const game = useGameStore(s => s.game)
  const [mode, setMode] = useState<Mode>('location')
  const [query, setQuery] = useState('')
  const [openLocation, setOpenLocation] = useState<string | null>(null)
  const [openSpecies, setOpenSpecies] = useState<string | null>(null)

  const locations = game?.encounters ?? []

  // Reverse index: species -> every place it can be encountered.
  const bySpecies = useMemo(() => {
    const map = new Map<string, Sighting[]>()
    for (const loc of locations) {
      for (const method of ENCOUNTER_METHODS) {
        for (const enc of loc.encounters[method] ?? []) {
          const list = map.get(enc.pokemon) ?? []
          list.push({ location: loc.name, method, enc })
          map.set(enc.pokemon, list)
        }
      }
    }
    return map
  }, [locations])

  const speciesNames = useMemo(
    () => [...bySpecies.keys()].sort((a, b) => a.localeCompare(b)),
    [bySpecies],
  )

  if (!game) return null
  if (!game.mechanics.features.encounters || locations.length === 0) {
    return <div style={{ padding: 'var(--sp-4)' }} className="muted">No wild-encounter data for this hack.</div>
  }

  const q = query.trim().toLowerCase()
  const shownLocations = q ? locations.filter(l => l.name.toLowerCase().includes(q)) : locations
  const shownSpecies = q ? speciesNames.filter(n => n.toLowerCase().includes(q)) : speciesNames

  const activeLocation = openLocation ? locations.find(l => l.name === openLocation) : undefined
  const activeSightings = openSpecies ? bySpecies.get(openSpecies) ?? [] : []

  return (
    <div style={{ padding: 'var(--sp-4)' }} className="col">
      <div className="row" role="tablist" style={{ gap: 0, background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', padding: 3 }}>
        {(['location', 'pokemon'] as Mode[]).map(m => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            className={`seg ${mode === m ? 'seg--active' : ''}`}
            style={{ flex: 1 }}
            onClick={() => setMode(m)}
          >
            {m === 'location' ? 'Locations' : 'Pokémon'}
          </button>
        ))}
      </div>

      <input
        type="text"
        placeholder={mode === 'location' ? 'Search routes & areas…' : 'Search Pokémon…'}
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {mode === 'location' ? (
        <div className="col">
          {shownLocations.length === 0 && <div className="muted">No matching locations.</div>}
          {shownLocations.map(loc => {
            const methods = ENCOUNTER_METHODS.filter(m => (loc.encounters[m]?.length ?? 0) > 0)
            const count = methods.reduce((n, m) => n + (loc.encounters[m]?.length ?? 0), 0)
            return (
              <button
                key={loc.name}
                className="card row--between"
                style={{ cursor: 'pointer', textAlign: 'left' }}
                onClick={() => setOpenLocation(loc.name)}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{loc.name}</div>
                  <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                    {methods.map(m => METHOD_LABELS[m]).join(' · ')}
                  </div>
                </div>
                <span className="badge">{count}</span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="col">
          {shownSpecies.length === 0 && <div className="muted">No matching Pokémon.</div>}
          {shownSpecies.map(name => (
            <button
              key={name}
              className="card row--between"
              style={{ cursor: 'pointer', textAlign: 'left' }}
              onClick={() => setOpenSpecies(name)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sprite species={name} />
                <div style={{ fontWeight: 700 }}>{name}</div>
              </div>
              <span className="badge">{bySpecies.get(name)?.length ?? 0} spots</span>
            </button>
          ))}
        </div>
      )}

      {/* Location detail: every method and its slots. */}
      <BottomSheet
        open={!!activeLocation}
        title={activeLocation?.name}
        onClose={() => setOpenLocation(null)}
      >
        <div className="col" style={{ gap: 'var(--sp-4)' }}>
          {activeLocation && ENCOUNTER_METHODS
            .filter(m => (activeLocation.encounters[m]?.length ?? 0) > 0)
            .map(method => (
              <div key={method} className="col">
                <div className="label">{METHOD_LABELS[method]}</div>
                {[...activeLocation.encounters[method]!].sort(byRate).map((enc, i) => (
                  <div key={`${enc.pokemon}-${i}`} className="card row--between">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Sprite species={enc.pokemon} />
                      <div>
                        <div style={{ fontWeight: 700 }}>{enc.pokemon}</div>
                        <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>{formatLevels(enc.levels)}</div>
                      </div>
                    </div>
                    <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-dim)' }}>
                      {formatRate(enc.rate)}
                    </span>
                  </div>
                ))}
              </div>
            ))}
        </div>
      </BottomSheet>

      {/* Species detail: every location + method it's found in. */}
      <BottomSheet
        open={!!openSpecies}
        title={openSpecies ?? undefined}
        onClose={() => setOpenSpecies(null)}
      >
        <div className="col">
          {activeSightings.map((s, i) => (
            <button
              key={`${s.location}-${s.method}-${i}`}
              className="card row--between"
              style={{ cursor: 'pointer', textAlign: 'left' }}
              onClick={() => { setOpenSpecies(null); setOpenLocation(s.location) }}
            >
              <div>
                <div style={{ fontWeight: 700 }}>{s.location}</div>
                <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
                  {METHOD_LABELS[s.method]} · {formatLevels(s.enc.levels)}
                </div>
              </div>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-dim)' }}>
                {formatRate(s.enc.rate)}
              </span>
            </button>
          ))}
        </div>
      </BottomSheet>
    </div>
  )
}
