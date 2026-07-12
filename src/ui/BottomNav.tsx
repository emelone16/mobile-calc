import { NavLink } from 'react-router-dom'
const tabs: Array<[string, string]> = [['/', 'Calc'], ['/box', 'Box'], ['/field', 'Field'], ['/encounters', 'Wild']]
export function BottomNav() {
  return (
    <nav className="safe-bottom" style={navStyle}>
      {tabs.map(([to, label]) => (
        <NavLink key={to} to={to} end style={({ isActive }) => ({
          flex: 1, textAlign: 'center', padding: 12, textDecoration: 'none',
          minHeight: 'var(--control-h)' as any,
          color: isActive ? 'var(--text)' : 'var(--muted)',
          fontWeight: 600, fontSize: 'var(--fs-sm)' as any,
        })}>{label}</NavLink>
      ))}
    </nav>
  )
}
const navStyle: React.CSSProperties = {
  position: 'sticky', bottom: 0, display: 'flex', background: 'var(--surface)',
  borderTop: '1px solid var(--border)',
}
