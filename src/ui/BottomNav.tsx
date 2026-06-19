import { NavLink } from 'react-router-dom'
const tabs: Array<[string, string]> = [['/', 'Calc'], ['/trainers', 'Trainers'], ['/box', 'Box'], ['/field', 'Field']]
export function BottomNav() {
  return (
    <nav style={navStyle}>
      {tabs.map(([to, label]) => (
        <NavLink key={to} to={to} end style={({ isActive }) => ({
          flex: 1, textAlign: 'center', padding: 12, textDecoration: 'none',
          color: isActive ? '#fff' : '#888', font: '600 13px system-ui',
        })}>{label}</NavLink>
      ))}
    </nav>
  )
}
const navStyle: React.CSSProperties = {
  position: 'sticky', bottom: 0, display: 'flex', background: '#0f0f16',
  borderTop: '1px solid #2a2a35', paddingBottom: 'env(safe-area-inset-bottom)',
}
