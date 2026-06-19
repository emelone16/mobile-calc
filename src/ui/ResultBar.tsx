import { useMemo } from 'react'
import { useGameStore } from '../state/gameStore'
import { useCalcStore } from '../state/calcStore'
import { runCalc } from '../engine/calcService'

// Sticky persistent result bar — the thing the user stares at.
export function ResultBar() {
  const game = useGameStore(s => s.game)
  const {
    attacker, defender, direction, selectedMove, selectedEnemyMove,
    field, selectMove, selectEnemyMove, setDirection,
  } = useCalcStore()

  // Resolve the active matchup from the direction. In 'defense' the enemy is
  // the one attacking, so we just swap which set feeds runCalc.
  const offense = direction === 'offense'
  const atkSet = offense ? attacker : defender
  const defSet = offense ? defender : attacker
  const activeMove = offense ? selectedMove : selectedEnemyMove
  const pickMove = offense ? selectMove : selectEnemyMove

  const outcome = useMemo(() => {
    if (!game || !atkSet || !defSet || !activeMove) return null
    try { return runCalc(game, atkSet, defSet, activeMove, field) }
    catch (e) { return { desc: String(e), minPct: 0, maxPct: 0, koText: '', rolls: [] } }
  }, [game, atkSet, defSet, activeMove, field])

  const otherMoves = useMemo(() => {
    if (!game || !atkSet || !defSet) return []
    return atkSet.moves
      .filter(m => m !== activeMove)
      .map(m => {
        try {
          const res = runCalc(game, atkSet, defSet, m, field)
          return { move: m, maxPct: res.maxPct }
        } catch {
          return { move: m, maxPct: 0 }
        }
      })
  }, [game, atkSet, defSet, activeMove, field])

  if (!game) return null

  const bothPicked = !!attacker && !!defender
  const noMoves = bothPicked && !activeMove

  return (
    <footer className="safe-bottom" style={barWrapStyle}>
      {bothPicked && (
        <div style={toggleWrapStyle}>
          <button
            className={`seg ${offense ? 'seg--active' : ''}`}
            onClick={() => setDirection('offense')}
          >
            ⚔ Yours → Enemy
          </button>
          <button
            className={`seg ${!offense ? 'seg--active' : ''}`}
            onClick={() => setDirection('defense')}
          >
            🛡 Enemy → Yours
          </button>
        </div>
      )}

      {bothPicked && (
        <div className="muted" style={{ fontSize: 'var(--fs-xs)' }}>
          {atkSet?.species} {activeMove ? `· ${activeMove}` : ''} → {defSet?.species}
        </div>
      )}

      {outcome ? (
        <>
          <div style={mainRowStyle}>
            <span style={{ fontWeight: 700, fontSize: 'var(--fs-lg)' }}>
              {outcome.minPct}–{outcome.maxPct}%
            </span>
            <span className="muted">{outcome.koText || (outcome.desc ?? '—')}</span>
          </div>
          {otherMoves.length > 0 && (
            <div className="row" style={{ flexWrap: 'wrap', marginTop: 6 }}>
              {otherMoves.map(({ move, maxPct }) => (
                <button
                  key={move}
                  className="chip"
                  style={{ minHeight: 32, padding: '4px 10px' }}
                  onClick={() => pickMove(move)}
                >
                  {move} <span className="muted" style={{ marginLeft: 4 }}>{maxPct}%</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <span className="muted">
          {noMoves
            ? `${atkSet?.species ?? 'This Pokémon'} has no moves to calculate`
            : 'Select an attacker, defender, and move'}
        </span>
      )}
    </footer>
  )
}

const barWrapStyle: React.CSSProperties = {
  position: 'sticky', bottom: 56, padding: '12px 16px',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 'var(--fs-base)', fontWeight: 600,
  borderTop: '1px solid var(--border)',
  display: 'flex', flexDirection: 'column', gap: 6,
}
const mainRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
}
const toggleWrapStyle: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4,
  background: 'var(--surface-2)', borderRadius: 'var(--r-sm)', padding: 3,
}
