import { useMemo } from 'react'
import { useGameStore } from '../state/gameStore'
import { useCalcStore } from '../state/calcStore'
import { runCalc } from '../engine/calcService'

// Sticky persistent result bar — the thing the user stares at.
export function ResultBar() {
  const game = useGameStore(s => s.game)
  const { attacker, defender, selectedMove, field, selectMove } = useCalcStore()

  const outcome = useMemo(() => {
    if (!game || !attacker || !defender || !selectedMove) return null
    try { return runCalc(game, attacker, defender, selectedMove, field) }
    catch (e) { return { desc: String(e), minPct: 0, maxPct: 0, koText: '', rolls: [] } }
  }, [game, attacker, defender, selectedMove, field])

  const otherMoves = useMemo(() => {
    if (!game || !attacker || !defender) return []
    return attacker.moves
      .filter(m => m !== selectedMove)
      .map(m => {
        try {
          const res = runCalc(game, attacker, defender, m, field)
          return { move: m, maxPct: res.maxPct }
        } catch {
          return { move: m, maxPct: 0 }
        }
      })
  }, [game, attacker, defender, selectedMove, field])

  if (!game) return null

  return (
    <footer className="safe-bottom" style={barWrapStyle}>
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
                  onClick={() => selectMove(move)}
                >
                  {move} <span className="muted" style={{ marginLeft: 4 }}>{maxPct}%</span>
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <span className="muted">Select an attacker, defender, and move</span>
      )}
    </footer>
  )
}

const barWrapStyle: React.CSSProperties = {
  position: 'sticky', bottom: 56, padding: '12px 16px',
  background: 'var(--surface)', color: 'var(--text)', fontSize: 'var(--fs-base)', fontWeight: 600,
  borderTop: '1px solid var(--border)',
}
const mainRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap',
}
