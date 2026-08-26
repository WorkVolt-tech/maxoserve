import { useState, useEffect } from 'react'
import { NavLink, Outlet, useLocation as useRouterLocation } from 'react-router-dom'
import {
  LayoutDashboard, MapPin, Map, LayoutGrid, PanelsTopLeft,
  UtensilsCrossed, SlidersHorizontal, Users, UserRoundCog,
  CalendarCheck, PartyPopper, ShoppingBag, Bell, ScrollText,
  LogOut, Menu as MenuIcon, X, ChevronDown, Settings2, TrendingUp, HelpCircle, Info,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { LocationProvider, useCurrentLocation } from '../contexts/LocationContext'
import { useAppLanguage } from '../contexts/AppLanguageContext'
import { useTour } from '../contexts/TourContext'
import { useCurrentBusiness } from '../contexts/BusinessContext'
import TourOverlay from '../components/TourOverlay'
import { roleLabel } from '../lib/roleLabels'
import { canAccess } from '../lib/permissions'
import logo from '../assets/maxoserve-logo.png'

const NAV_GROUPS = [
  {
    label: null,
    items: [{ to: '/admin', labelKey: 'dashboard', end: true, section: 'dashboard', icon: LayoutDashboard }],
  },
  {
    labelKey: 'operations',
    items: [
      { to: '/admin/floor-plan', labelKey: 'floorPlan', section: 'floorPlan', icon: PanelsTopLeft },
      { to: '/admin/tables', labelKey: 'tables', section: 'tables', icon: LayoutGrid },
      { to: '/admin/orders', labelKey: 'orders', section: 'orders', icon: ShoppingBag },
    ],
  },
  {
    labelKey: 'menu',
    items: [
      { to: '/admin/menu', labelKey: 'menu', section: 'menu', icon: UtensilsCrossed },
      { to: '/admin/modifiers', labelKey: 'modifiers', section: 'modifiers', icon: SlidersHorizontal },
    ],
  },
  {
    labelKey: 'people',
    items: [
      { to: '/admin/staff', labelKey: 'staff', section: 'staff', icon: Users },
      { to: '/admin/assignments', labelKey: 'assignments', section: 'assignments', icon: UserRoundCog },
    ],
  },
  {
    labelKey: 'venue',
    items: [
      { to: '/admin/locations', labelKey: 'locations', section: 'locations', icon: MapPin },
      { to: '/admin/areas', labelKey: 'areas', section: 'areas', icon: Map },
      { to: '/admin/reservations', labelKey: 'reservations', section: 'reservations', icon: CalendarCheck },
      { to: '/admin/events', labelKey: 'events', section: 'events', icon: PartyPopper },
    ],
  },
  {
    labelKey: 'system',
    items: [
      { to: '/admin/request-types', labelKey: 'requestButtons', section: 'requestTypes', icon: Bell },
      { to: '/admin/activity-log', labelKey: 'activityLog', section: 'activityLogs', icon: ScrollText },
      { to: '/admin/settings', labelKey: 'settings', section: 'settings', icon: Settings2 },
      { to: '/admin/margin-report', labelKey: 'marginReport', section: 'marginReport', icon: TrendingUp },
      { to: '/admin/sales-report', labelKey: 'salesReport', section: 'salesReport', icon: TrendingUp },
      { to: '/admin/help', labelKey: 'help', section: 'help', icon: HelpCircle },
      { to: '/admin/about', labelKey: 'about', section: 'about', icon: Info },
    ],
  },
]

const GROUP_LABEL_KEYS = {
  operations: { en: 'Operations', fr: 'Opérations' },
  menu: { en: 'Menu', fr: 'Menu' },
  people: { en: 'People', fr: 'Personnel' },
  venue: { en: 'Venue', fr: 'Établissement' },
  system: { en: 'System', fr: 'Système' },
}

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function SidebarContent({ visibleGroups, onNavigate }) {
  const { signOut, role } = useAuth()
  const { t, lang } = useAppLanguage()

  return (
    <>
      <div style={styles.brand}>
        <img src={logo} alt="MaxoServe" style={styles.brandLogo} />
        <span style={styles.brandText}>MaxoServe</span>
      </div>
      <nav style={styles.nav}>
        {visibleGroups.map((group, gi) => (
          <div key={gi} style={styles.navGroup}>
            {group.labelKey && (
              <div style={styles.navGroupLabel}>{GROUP_LABEL_KEYS[group.labelKey]?.[lang] || group.labelKey}</div>
            )}
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                data-tour={`nav-${item.section}`}
                style={({ isActive }) => ({
                  ...styles.navLink,
                  ...(isActive ? styles.navLinkActive : {}),
                })}
              >
                <item.icon size={17} strokeWidth={2} />
                {t(item.labelKey)}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div style={styles.footer}>
        {role && <div style={styles.roleBadge}>{roleLabel(role, t)}</div>}
        <a href="/staff" style={styles.staffLink} data-tour="sidebar-live-requests">
          <Bell size={15} /> {t('liveRequests')}
        </a>
        <button onClick={signOut} style={styles.signOut}>
          <LogOut size={15} /> {t('signOut')}
        </button>
        <a href="https://chezmaxo.ca" target="_blank" rel="noopener noreferrer" style={styles.creditLink}>
          v1.0.2 · ChezMaxo
        </a>
      </div>
    </>
  )
}

function TopBar({ onOpenDrawer }) {
  const { user, signOut } = useAuth()
  const { locations, currentLocationId, setCurrentLocationId, locationsLoading } = useCurrentLocation()
  const { businesses, currentBusinessId, setCurrentBusinessId, businessesLoading } = useCurrentBusiness()
  const { lang, setLang, t } = useAppLanguage()
  const [menuOpen, setMenuOpen] = useState(false)
  const routerLocation = useRouterLocation()
  const hideLocationSwitcher = routerLocation.pathname === '/admin/locations' || routerLocation.pathname === '/admin/staff'

  const displayName = user?.user_metadata?.full_name || user?.email || 'Account'

  return (
    <div style={styles.topBar}>
      <button style={styles.hamburger} className="ms-hamburger" onClick={onOpenDrawer} aria-label="Open menu">
        <MenuIcon size={20} />
      </button>

      {!businessesLoading && businesses.length > 1 && (
        <div style={styles.topBarBusiness}>
          <Users size={15} color="var(--color-text-muted)" />
          <select
            value={currentBusinessId || ''}
            onChange={(e) => setCurrentBusinessId(e.target.value)}
            style={styles.topBarSelect}
          >
            {businesses.map((b) => (
              <option key={b.business_id} value={b.business_id}>{b.business_name}</option>
            ))}
          </select>
        </div>
      )}

      {!locationsLoading && locations.length > 0 && !hideLocationSwitcher && (
        <div style={styles.topBarLocation} data-tour="topbar-location">
          <MapPin size={15} color="var(--color-text-muted)" />
          <select
            value={currentLocationId}
            onChange={(e) => setCurrentLocationId(e.target.value)}
            style={styles.topBarSelect}
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>
      )}

      <div style={{ flex: 1 }} />

      <button
        onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
        style={styles.langToggle}
        data-tour="topbar-lang"
      >
        {lang === 'en' ? 'FR' : 'EN'}
      </button>

      <div style={{ position: 'relative' }}>
        <button style={styles.userButton} onClick={() => setMenuOpen((v) => !v)}>
          <span style={styles.avatar}>{initials(displayName)}</span>
          <ChevronDown size={15} color="var(--color-text-muted)" />
        </button>

        {menuOpen && (
          <>
            <div style={styles.menuOverlay} onClick={() => setMenuOpen(false)} />
            <div style={styles.userDropdown}>
              <div style={styles.userDropdownName}>{displayName}</div>
              <button onClick={signOut} style={styles.userDropdownItem}>
                <LogOut size={15} /> {t('signOut')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function AdminLayout() {
  const { role, roleLoading, user } = useAuth()
  const { startTour } = useTour()
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    if (!user) return
    const key = `maxoserve_tour_seen_${user.id}`
    const autoShowDisabled = localStorage.getItem('maxoserve_tour_autoshow_off') === 'true'
    if (!localStorage.getItem(key) && !autoShowDisabled) {
      localStorage.setItem(key, 'true')
      const timer = setTimeout(() => startTour(), 800)
      return () => clearTimeout(timer)
    }
  }, [user])

  if (roleLoading) {
    return (
      <div style={styles.shell}>
        <div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading…</div>
      </div>
    )
  }

  const visibleGroups = NAV_GROUPS
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccess(role, item.section)),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <LocationProvider>
      <div style={styles.shell}>
        <aside style={styles.sidebarDesktop} className="ms-sidebar-desktop">
          <SidebarContent visibleGroups={visibleGroups} />
        </aside>

        {drawerOpen && (
          <div style={styles.drawerOverlay} onClick={() => setDrawerOpen(false)}>
            <aside style={styles.sidebarMobile} className="ms-sidebar-mobile" onClick={(e) => e.stopPropagation()}>
              <button style={styles.drawerClose} onClick={() => setDrawerOpen(false)}>
                <X size={20} />
              </button>
              <SidebarContent visibleGroups={visibleGroups} onNavigate={() => setDrawerOpen(false)} />
            </aside>
          </div>
        )}

        <div style={styles.mainColumn}>
          <TopBar onOpenDrawer={() => setDrawerOpen(true)} />
          <main style={styles.content}>
            <Outlet />
          </main>
        </div>
      </div>
      <TourOverlay />
    </LocationProvider>
  )
}

const styles = {
  shell: { display: 'flex', minHeight: '100vh' },
  sidebarDesktop: {
    width: '250px',
    background: 'var(--color-sidebar-bg)',
    color: 'var(--color-sidebar-text)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
  },
  drawerOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    zIndex: 1000,
  },
  sidebarMobile: {
    width: '270px',
    height: '100%',
    background: 'var(--color-sidebar-bg)',
    color: 'var(--color-sidebar-text)',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  drawerClose: {
    position: 'absolute',
    top: '1rem',
    right: '1rem',
    background: 'transparent',
    border: 'none',
    color: '#fff',
    cursor: 'pointer',
    padding: '0.3rem',
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
    gap: '0.9rem',
    flex: 1,
    overflowY: 'auto',
  },
  navGroup: { display: 'flex', flexDirection: 'column', gap: '2px' },
  navGroupLabel: {
    fontSize: '0.68rem',
    fontWeight: 700,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: '#5c6178',
    padding: '0.4rem 0.75rem 0.25rem',
  },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.65rem',
    color: 'var(--color-sidebar-text)',
    textDecoration: 'none',
    padding: '0.55rem 0.75rem',
    fontSize: '0.87rem',
    fontWeight: 500,
    borderRadius: '8px',
  },
  navLinkActive: {
    background: 'rgba(59,111,224,0.18)',
    color: '#fff',
    borderLeft: '3px solid var(--color-primary)',
    paddingLeft: 'calc(0.75rem - 3px)',
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.6rem',
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    textDecoration: 'none',
    fontSize: '0.85rem',
    fontWeight: 600,
  },
  creditLink: {
    textAlign: 'center',
    fontSize: '0.68rem',
    color: '#5c6178',
    textDecoration: 'none',
    marginTop: '0.2rem',
  },
  signOut: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.4rem',
    padding: '0.6rem',
    background: 'transparent',
    color: 'var(--color-sidebar-text)',
    border: '1px solid var(--color-sidebar-border)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  mainColumn: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    padding: '0.75rem 1.5rem',
    background: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
  },
  hamburger: {
    display: 'none',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '0.3rem',
    color: 'var(--color-text)',
  },
  topBarBusiness: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: 'var(--color-primary-soft)',
    border: '1px solid var(--color-primary)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.3rem 0.6rem',
    marginRight: '0.5rem',
  },
  topBarLocation: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.3rem 0.6rem',
  },
  topBarSelect: {
    border: 'none',
    background: 'transparent',
    fontSize: '0.88rem',
    fontWeight: 600,
    outline: 'none',
    cursor: 'pointer',
  },
  langToggle: {
    padding: '0.4rem 0.7rem',
    borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
    marginRight: '0.75rem',
  },
  userButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '0.2rem',
  },
  avatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    background: 'var(--color-primary)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.78rem',
    fontWeight: 700,
  },
  menuOverlay: { position: 'fixed', inset: 0, zIndex: 100 },
  userDropdown: {
    position: 'absolute',
    right: 0,
    top: 'calc(100% + 0.5rem)',
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-md)',
    width: '190px',
    padding: '0.5rem',
    zIndex: 101,
  },
  userDropdownName: {
    fontSize: '0.85rem',
    fontWeight: 600,
    padding: '0.4rem 0.6rem 0.6rem',
    borderBottom: '1px solid var(--color-border)',
    marginBottom: '0.4rem',
  },
  userDropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    background: 'transparent',
    border: 'none',
    padding: '0.5rem 0.6rem',
    fontSize: '0.85rem',
    color: 'var(--color-danger)',
    cursor: 'pointer',
    borderRadius: '6px',
    textAlign: 'left',
  },
  content: { flex: 1, padding: '2.25rem', background: 'var(--color-bg)', overflowY: 'auto' },
}
