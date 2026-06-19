// MVP vertical slice: stacked attacker/defender cards + move chips.
// TODO: replace inline pickers with BottomSheet selectors; collapse EV/IV.
import { useCalcStore } from '../state/calcStore'

export function CalcScreen() {
  const { attacker, defender, selectedMove, selectMove } = useCalcStore()
  return (
    <div style={{ padding: 16 }}>
      <MonCard label="Yours" name={attacker?.species} />
      <div style={{ height: 12 }} />
      <MonCard label="Enemy" name={defender?.species} />
      {attacker && (
        <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          {attacker.moves.map(m => (
            <button key={m} onClick={() => selectMove(m)}
              style={chip(selectedMove === m)}>{m}</button>
          ))}
        </div>
      )}
    </div>
  )
}
function MonCard({ label, name }: { label: string; name?: string }) {
  return (
    <div style={{ background: '#16161d', borderRadius: 14, padding: 16 }}>
      <div style={{ color: '#888', font: '600 12px system-ui' }}>{label}</div>
      <div style={{ color: '#fff', font: '700 20px system-ui' }}>{name ?? 'Tap to choose'}</div>
    </div>
  )
}
const chip = (active: boolean): React.CSSProperties => ({
  padding: '8px 12px', borderRadius: 999, border: 'none',
  background: active ? '#3b82f6' : '#23232e', color: '#fff', font: '600 13px system-ui',
})
