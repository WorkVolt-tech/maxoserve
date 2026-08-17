import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { canAccess } from '../lib/permissions'
import logo from '../assets/maxoserve-logo.png'

const navItems = [
  { to: '/admin', label: 'Dashboard', end: true, section: 'dashboard' },
  { to: '/admin/locations', label: 'Locations', section: 'locations' },
  { to: '/admin/areas', label: 'Areas', section: 'areas' },
  { to: '/admin/tables', label: 'Tables', section: 'tables' },
  { to: '/admin/floor-plan', label: 'Floor Plan', section: 'floorPlan' },
  { to: '/admin/menu', label: 'Menu', section: 'menu' },
  { to: '/admin/modifiers', label: 'Modifiers', section: 'modifiers' },
  { to: '/admin/staff', label: 'Staff', section: 'staff' },
  { to: '/admin/assignments', label: 'Assignments', section: 'assignments' },
  { to: '/admin/reservations', label: 'Reservations', section: 'reservations' },
  { to: '/admin/events', label: 'Events', section: 'events' },
  { to: '/admin/activity-log', label: 'Activity Log', section: 'activityLogs' },
  { to: '/admin/orders', label: 'Orders', section: 'orders' },
  { to: '/admin/request-types', label: 'Request Buttons', section: 'requestTypes' },
]

export default function AdminLayout() {
  const { signOut, role, roleLoading } = useAuth()

  if (roleLoading) {
    return (
      <div style={styles.shell}>
        <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading…</div>
      </div>
    )
  }

  const visibleItems = navItems.filter((item) => canAccess(role, item.section))

  return (
    <div style={styles.shell}>
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <img src={logo} alt="MaxoServe" style={styles.brandLogo} />
          <span style={styles.brandText}>MaxoServe</span>
        </div>
        <nav style={styles.nav}>
          {visibleItems.map((item) => (
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
        <div style={styles.footer}>
          {role && <div style={styles.roleBadge}>{role}</div>}
          <a href="/staff" style={styles.staffLink}>
            Live Requests
          </a>
          <button onClick={signOut} style={styles.signOut}>
            Sign Out
          </button>
        </div>
      </aside>
      <main style={styles.content}>
        <Outlet />
      </main>
    </div>
  )
}

const styles = {
  shell: { display: 'flex', minHeight: '100vh' },
  sidebar: {
    width: '236px',
    background: 'var(--color-sidebar-bg)',
    color: 'var(--color-sidebar-text)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    padding: '1.25rem 1.25rem',
    borderBottom: '1px solid var(--color-sidebar-border)',
  },
  brandLogo: { width: '30px', height: '30px', flexShrink: 0 },
  brandText: { fontWeight: 700, fontSize: '1.02rem', color: '#fff', letterSpacing: '-0.01em' },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    padding: '0.75rem 0.75rem',
    gap: '2px',
    flex: 1,
    overflowY: 'auto',
  },
  navLink: {
    color: 'var(--color-sidebar-text)',
    textDecoration: 'none',
    padding: '0.55rem 0.75rem',
    fontSize: '0.88rem',
    fontWeight: 500,
    borderRadius: '8px',
  },
  navLinkActive: {
    background: 'rgba(59,111,224,0.18)',
    color: '#fff',
  },
  footer: {
    padding: '0.9rem',
    borderTop: '1px solid var(--color-sidebar-border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  roleBadge: {
    fontSize: '0.7rem',
    color: 'var(--color-sidebar-text)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '0 0.15rem',
    fontWeight: 600,
  },
  staffLink: {
    padding: '0.6rem',
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    textAlign: 'center',
    textDecoration: 'none',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  signOut: {
    padding: '0.6rem',
    background:
