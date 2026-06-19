import { useMemo } from 'react'
import { useGameStore } from '../state/gameStore'
import { useCalcStore } from '../state/calcStore'
import { runCalc } from '../engine/calcService'

// Sticky persistent result bar — the thing the user stares at.
export function ResultBar() {
  const game = useGameStore(s => s.game)
  const { attacker, defender, selectedMove, field } = useCalcStore()

  const outcome = useMemo(() => {
    if (!game || !attacker || !defender || !selectedMove) return null
    try { return runCalc(game, attacker, defender, selectedMove, field) }
    catch (e) { return { desc: String(e), minPct: 0, maxPct: 0, koText: '', rolls: [] } }
  }, [game, attacker, defender, selectedMove, field])

  return (
    <footer style={barStyle}>
      {outcome
        ? <span>{outcome.minPct}–{outcome.maxPct}% · {outcome.koText || '—'}</span>
        : <span>Select an attacker, defender, and move</span>}
    </footer>
  )
}
const barStyle: React.CSSProperties = {
  position: 'sticky', bottom: 56, padding: '12px 16px',
  background: '#16161d', color: '#fff', font: '600 15px system-ui',
  borderTop: '1px solid #2a2a35',
}
