import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGameStore } from '../state/gameStore'
import { useCalcStore } from '../state/calcStore'
import { BottomSheet } from './components/BottomSheet'
import type { Trainer, TrainerSet } from '../data/types'
import type { SetState } from '../save/types'

function trainerSetToSetState(t: TrainerSet): SetState {
  return {
    species: t.species, level: t.level, nature: t.nature, ability: t.ability,
    item: t.item, moves: t.moves, ivs: t.ivs, evs: t.evs ?? {},
  }
}

export function TrainersScreen() {
  const game = useGameStore(s => s.game)
  const { setDefenderTeam } = useCalcStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [activeTrainer, setActiveTrainer] = useState<Trainer | null>(null)

  if (!game) return null

  const trainersById = game.trainers.byId
  const locations = Object.keys(game.trainers.byLocation).sort()

  const q = query.trim().toLowerCase()

  const filteredLocations = useMemo(() => {
    if (!q) return locations
    return locations.filter(loc => {
      if (loc.toLowerCase().includes(q)) return true
      const ids = game.trainers.byLocation[loc] ?? []
      return ids.some(id => trainersById[id]?.name.toLowerCase().includes(q))
    })
  }, [q, locations, game, trainersById])

  function pickMon(trainer: Trainer, index: number) {
    const team = trainer.team.map(trainerSetToSetState)
    setDefenderTeam(team, index, trainer.name)
    setActiveTrainer(null)
    navigate('/')
  }

  return (
    <div style={{ padding: 'var(--sp-4)' }} className="col">
      <input
        type="text"
        placeholder="Search trainers or locations…"
        value={query}
        onChange={e => setQuery(e.target.value)}
      />

      {filteredLocations.map(loc => {
        const ids = game.trainers.byLocation[loc] ?? []
        const trainersHere = ids
          .map(id => trainersById[id])
          .filter((t): t is Trainer => !!t)
          .filter(t => !q || t.name.toLowerCase().includes(q) || loc.toLowerCase().includes(q))
        if (trainersHere.length === 0) return null
        return (
          <LocationSection key={loc} location={loc} trainers={trainersHere} onSelect={setActiveTrainer} />
        )
      })}

      <BottomSheet
        open={!!activeTrainer}
        title={activeTrainer?.name}
        onClose={() => setActiveTrainer(null)}
      >
        {activeTrainer && (
          <div className="scroll-x">
            {activeTrainer.team.map((set, i) => (
              <button
                key={`${set.species}-${i}`}
                className="card col"
                style={{ minWidth: 160, flexShrink: 0, textAlign: 'left', cursor: 'pointer' }}
                onClick={() => pickMon(activeTrainer, i)}
              >
                <div style={{ fontWeight: 700 }}>{set.species}</div>
                <div className="muted" style={{ fontSize: 12 }}>Lv {set.level}</div>
                <div className="col" style={{ gap: 2, marginTop: 4 }}>
                  {set.moves.map((m, mi) => (
                    <div key={mi} className="muted" style={{ fontSize: 12 }}>{m}</div>
                  ))}
                </div>
              </button>
            ))}
          </div>
        )}
      </BottomSheet>
    </div>
  )
}

function LocationSection({
  location, trainers, onSelect,
}: { location: string; trainers: Trainer[]; onSelect(t: Trainer): void }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <button
        className="section-header"
        style={{ width: '100%', border: 'none', cursor: 'pointer' }}
        onClick={() => setOpen(v => !v)}
      >
        <span style={{ fontWeight: 700 }}>{location}</span>
        <span className="muted">{trainers.length} {open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="col" style={{ padding: 'var(--sp-2)' }}>
          {trainers.map(t => (
            <button
              key={t.trId}
              className="picker-row"
              onClick={() => onSelect(t)}
            >
              {t.name} <span className="muted" style={{ marginLeft: 6 }}>({t.team.length})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
