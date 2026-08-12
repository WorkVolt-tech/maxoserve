import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/locations', label: 'Locations' },
  { to: '/admin/areas', label: 'Areas' },
  { to: '/admin/tables', label: 'Tables' },
  { to: '/admin/floor-plan', label: 'Floor Plan' },
  { to: '/admin/menu', label: 'Menu' },
  { to: '/admin/modifiers', label: 'Modifiers' },
  { to: '/admin/staff', label: 'Staff' },
  { to: '/admin/orders', label: 'Orders' },
  { to: '/admin/requests', label: 'Requests' },
  { to: '/admin/request-types', label: 'Request Buttons' },
]

export default function AdminLayout() {
  const { signOut } = useAuth()

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>MaxoServe</div>
        <nav style={styles.nav}>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <a href="/staff" style={styles.staffLink}>
          Live Requests →
        </a>
        <button onClick={signOut} style={styles.signOut}>
          Sign Out
        </button>
      </aside>
      <main style={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}

const styles = {
  shell: { display: 'flex', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' },
  sidebar: {
    width: '220px',
    background: '#12161c',
    color: '#e6e8ec',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  brand: {
    fontWeight: 600,
    fontSize: '1.1rem',
    padding: '1.25rem 1rem',
    borderBottom: '1px solid #232a34',
  },
  nav: { display: 'flex', flexDirection: 'column', padding: '0.75rem 0', flex: 1 },
  navLink: {
    color: '#b7bdc7',
    textDecoration: 'none',
    padding: '0.65rem 1.25rem',
    fontSize: '0.95rem',
  },
  navLinkActive: {
    background: '#232a34',
    color: '#fff',
    borderLeft: '3px solid #4c8dff',
    paddingLeft: 'calc(1.25rem - 3px)',
  },
  staffLink: {
    margin: '1rem 1rem 0',
    padding: '0.6rem',
    background: '#4c8dff',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    textAlign: 'center',
    textDecoration: 'none',
    fontSize: '0.9rem',
    fontWeight: 600,
  },
  signOut: {
    margin: '1rem',
    padding: '0.6rem',
    background: 'transparent',
    color: '#b7bdc7',
    border: '1px solid #333b47',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  content: { flex: 1, padding: '2rem', background: '#f5f6f8' },
}
