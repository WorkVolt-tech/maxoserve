import { useEffect, useState, useRef } from 'react'
import { LogOut, Bell, MapPin, Check, X, Truck, CheckCheck } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { logActivity } from '../../lib/activityLog'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import { useAppLanguage } from '../../contexts/AppLanguageContext'

const FILTERS = ['new', 'assigned_to_me', 'in_progress', 'completed', 'all']

const FILTER_LABEL_KEYS = {
  new: 'new',
  assigned_to_me: 'assignedToMe',
  in_progress: 'inProgress',
  completed: 'completed',
  all: 'all',
}

function urgency(createdAt) {
  const minutes = (Date.now() - new Date(createdAt).getTime()) / 60000
  if (minutes >= 5) return 'urgent'
  if (minutes >= 3) return 'warning'
  return 'normal'
}

const URGENCY_STYLES = {
  normal: { border: 'var(--color-border)', accent: 'var(--color-primary)' },
  warning: { border: 'var(--color-warning)', accent: 'var(--color-warning)' },
  urgent: { border: 'var(--color-danger)', accent: 'var(--color-danger)' },
}

export default function StaffDashboard() {
  const { user, signOut } = useAuth()
  const { t, lang, setLang } = useAppLanguage()
  const [businessId, setBusinessId] = useState(null)
  const [requests, setRequests] = useState([])
  const [requestTypes, setRequestTypes] = useState({})
  const [tables, setTables] = useState({})
  const [filter, setFilter] = useState('new')
  const [loading, setLoading] = useState(true)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const knownRequestIds = useRef(new Set())
  const isFirstLoad = useRef(true)
  const [, forceTick] = useState(0)
  const [locations, setLocations] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState('all')

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (!businessId) return
    const channel = supabase
      .channel(`staff-requests-${businessId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `business_id=eq.${businessId}` },
        () => loadRequests(businessId)
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [businessId])

  // Re-render every 20s so wait times / urgency stay fresh without needing a data refetch
  useEffect(() => {
    const t = setInterval(() => forceTick((v) => v + 1), 20000)
    return () => clearInterval(t)
  }, [])

  async function init() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('business_members')
      .select('business_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) { setLoading(false); return }
    setBusinessId(membership.business_id)

    const { data: locationsData } = await supabase
      .from('locations')
      .select('*')
      .eq('business_id', membership.business_id)
      .order('created_at', { ascending: true })
    setLocations(locationsData || [])

    const { data: typesData } = await supabase
      .from('service_request_types')
      .select('*')
      .eq('business_id', membership.business_id)
    const typesMap = {}
    for (const t of typesData || []) typesMap[t.id] = t
    setRequestTypes(typesMap)

    const { data: tablesData } = await supabase
      .from('tables')
      .select('*')
      .eq('business_id', membership.business_id)
    const tablesMap = {}
    for (const t of tablesData || []) tablesMap[t.id] = t
    setTables(tablesMap)

    await loadRequests(membership.business_id)
    setLoading(false)
  }

  async function loadRequests(bizId) {
    const { data } = await supabase
      .from('service_requests')
      .select('*')
      .eq('business_id', bizId)
      .order('created_at', { ascending: false })

    const fresh = data || []

    if (!isFirstLoad.current) {
      const newPending = fresh.filter((r) => r.status === 'pending' && !knownRequestIds.current.has(r.id))
      for (const r of newPending) notifyNewRequest(r)
    }

    knownRequestIds.current = new Set(fresh.map((r) => r.id))
    isFirstLoad.current = false
    setRequests(fresh)
  }

  function notifyNewRequest(request) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const type = requestTypes[request.request_type_id]
    const table = tables[request.table_id]
    new Notification('New request', {
      body: `${type?.label || 'Request'} — ${table?.name || 'Unknown table'}`,
    })
    if (navigator.vibrate) navigator.vibrate([200, 100, 200])
  }

  function requestNotificationPermission() {
    if (typeof Notification === 'undefined') return
    Notification.requestPermission().then(setNotifPermission)
  }

  async function updateStatus(request, newStatus) {
    const updates = { status: newStatus }
    const now = new Date().toISOString()
    if (newStatus === 'accepted') { updates.accepted_at = now; updates.assigned_to = user.id }
    else if (newStatus === 'on_the_way') updates.on_the_way_at = now
    else if (newStatus === 'completed') updates.completed_at = now
    else if (newStatus === 'rejected') updates.cancelled_at = now

    await supabase.from('service_requests').update(updates).eq('id', request.id)
    logActivity(businessId, user.id, `${newStatus} a service request`)
    loadRequests(businessId)
  }

  function minutesWaiting(createdAt) {
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
  }

  function matchesFilter(r) {
    if (filter === 'all') return true
    if (filter === 'new') return r.status === 'pending'
    if (filter === 'assigned_to_me') return r.assigned_to === user.id
    if (filter === 'in_progress') return ['accepted', 'on_the_way'].includes(r.status)
    if (filter === 'completed') return r.status === 'completed'
    return true
  }

  const requestsForLocation = selectedLocationId === 'all'
    ? requests
    : requests.filter((r) => tables[r.table_id]?.location_id === selectedLocationId)

  const visibleRequests = requestsForLocation.filter(matchesFilter)
  const counts = {
    new: requestsForLocation.filter((r) => r.status === 'pending').length,
    assigned_to_me: requestsForLocation.filter((r) => r.assigned_to === user.id).length,
    in_progress: requestsForLocation.filter((r) => ['accepted', 'on_the_way'].includes(r.status)).length,
    completed: requestsForLocation.filter((r) => r.status === 'completed').length,
    all: requestsForLocation.length,
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={{ color: '#fff', padding: '2rem' }}>Loading…</p>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>{t('requests')}</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} style={styles.langToggle}>
            {lang === 'en' ? 'FR' : 'EN'}
          </button>
          {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
            <button onClick={requestNotificationPermission} style={styles.notifButton}>
              <Bell size={14} /> {t('enableAlerts')}
            </button>
          )}
          {notifPermission === 'granted' && (
            <span style={styles.notifOnBadge} title="To turn off, manage notification permissions in your browser's site settings">
              <Bell size={12} /> {t('alertsOn')}
            </span>
          )}
          <button onClick={signOut} style={styles.signOutButton}>
            <LogOut size={14} /> {t('signOut')}
          </button>
        </div>
      </div>

      {locations.length > 1 && (
        <div style={styles.locationBar}>
          <MapPin size={14} color="#fff" />
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            style={styles.locationSelect}
          >
            <option value="all" style={styles.locationOption}>All Locations</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id} style={styles.locationOption}>{loc.name}</option>
            ))}
          </select>
        </div>
      )}

      <div style={styles.filterRow}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...styles.filterButton, ...(filter === f ? styles.filterButtonActive : {}) }}
          >
            {t(FILTER_LABEL_KEYS[f])}
            {counts[f] > 0 && (
              <span style={{ ...styles.filterCount, ...(filter === f ? styles.filterCountActive : {}) }}>
                {counts[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div style={styles.list}>
        {visibleRequests.length === 0 && (
          <EmptyState
            icon={Bell}
            title={t('noRequestsHere')}
            description={t('allCaughtUp')}
          />
        )}

        {visibleRequests.map((r) => {
          const type = requestTypes[r.request_type_id]
          const table = tables[r.table_id]
          const isNew = r.status === 'pending'
          const level = urgency(r.created_at)
          const urgencyStyle = URGENCY_STYLES[level]

          return (
            <div
              key={r.id}
              style={{
                ...styles.requestCard,
                borderColor: isNew ? urgencyStyle.border : 'var(--color-border)',
                borderWidth: isNew && level !== 'normal' ? '2px' : '1px',
              }}
            >
              {isNew && <div style={{ ...styles.newTag, background: urgencyStyle.accent }}>NEW</div>}

              <div style={styles.requestTop}>
                <div>
                  <div style={styles.requestType}>{type?.label || 'Request'}</div>
                  <div style={styles.requestTable}>
                    <MapPin size={12} /> {table?.name || 'Unknown table'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <StatusBadge status={r.status} />
                  <div style={{ ...styles.waitTime, color: isNew ? urgencyStyle.accent : 'var(--color-text-faint)' }}>
                    {t('waiting')} {minutesWaiting(r.created_at)}m
                  </div>
                </div>
              </div>

              <div style={styles.actions}>
                {r.status === 'pending' && (
                  <>
                    <button onClick={() => updateStatus(r, 'accepted')} style={styles.acceptButton}>
                      <Check size={16} /> {t('accept')}
                    </button>
                    <button onClick={() => updateStatus(r, 'rejected')} style={styles.rejectButton}>
                      <X size={16} /> {t('decline')}
                    </button>
                  </>
                )}
                {r.status === 'accepted' && (
                  <button onClick={() => updateStatus(r, 'on_the_way')} style={styles.acceptButton}>
                    <Truck size={16} /> {t('onMyWay')}
                  </button>
                )}
                {r.status === 'on_the_way' && (
                  <button onClick={() => updateStatus(r, 'completed')} style={styles.completeButton}>
                    <CheckCheck size={16} /> {t('complete')}
                  </button>
                )}
                {r.status === 'completed' && (
                  <span style={styles.doneText}>
                    <CheckCheck size={15} /> {t('completed')}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--color-bg)',
    fontFamily: "'Inter', system-ui, sans-serif",
    paddingBottom: '2rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    background: 'var(--color-sidebar-bg)',
  },
  headerTitle: { color: '#fff', margin: 0, fontSize: '1.3rem' },
  signOutButton: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.45rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid var(--color-sidebar-border)',
    background: 'transparent',
    color: 'var(--color-sidebar-text)',
    cursor: 'pointer',
    fontSize: '0.82rem',
  },
  langToggle: {
    padding: '0.45rem 0.7rem',
    borderRadius: '6px',
    border: '1px solid var(--color-sidebar-border)',
    background: 'transparent',
    color: '#fff',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  notifButton: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.45rem 0.8rem',
    borderRadius: '6px',
    border: 'none',
    background: 'var(--color-primary)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.82rem',
    fontWeight: 600,
  },
  notifOnBadge: {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.4rem 0.7rem',
    borderRadius: '999px',
    background: 'rgba(22,163,74,0.15)',
    color: '#4ade80',
    fontSize: '0.78rem',
    fontWeight: 600,
    cursor: 'help',
  },
  locationBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.4rem',
    padding: '0.6rem 1.25rem',
    background: 'var(--color-sidebar-bg)',
    borderTop: '1px solid var(--color-sidebar-border)',
  },
  locationSelect: {
    background: 'transparent',
    border: 'none',
    color: '#fff',
    fontSize: '0.85rem',
    fontWeight: 600,
    outline: 'none',
    cursor: 'pointer',
  },
  locationOption: {
    background: '#14161f',
    color: '#fff',
  },
  filterRow: {
    display: 'flex',
    gap: '0.5rem',
    padding: '1rem 1.25rem',
    overflowX: 'auto',
  },
  filterButton: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.5rem 1rem',
    borderRadius: '999px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text-muted)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  filterButtonActive: {
    background: 'var(--color-primary)',
    borderColor: 'var(--color-primary)',
    color: '#fff',
  },
  filterCount: {
    background: 'var(--color-bg)',
    color: 'var(--color-text-muted)',
    borderRadius: '999px',
    padding: '0.05rem 0.45rem',
    fontSize: '0.72rem',
    fontWeight: 700,
  },
  filterCountActive: {
    background: 'rgba(255,255,255,0.25)',
    color: '#fff',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    padding: '0 1.25rem',
  },
  requestCard: {
    position: 'relative',
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    padding: '1rem',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)',
  },
  newTag: {
    position: 'absolute',
    top: '-9px',
    left: '14px',
    color: '#fff',
    fontSize: '0.68rem',
    fontWeight: 800,
    letterSpacing: '0.04em',
    padding: '0.15rem 0.55rem',
    borderRadius: '999px',
  },
  requestTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.85rem',
  },
  requestType: { fontSize: '1.05rem', fontWeight: 700 },
  requestTable: {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.2rem',
  },
  waitTime: { fontSize: '0.75rem', marginTop: '0.35rem', fontWeight: 600 },
  actions: { display: 'flex', gap: '0.5rem' },
  acceptButton: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
    padding: '0.7rem',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--color-primary)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '0.92rem',
  },
  rejectButton: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.7rem 1rem',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-danger)',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '0.92rem',
  },
  completeButton: {
    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
    padding: '0.7rem',
    borderRadius: '8px',
    border: 'none',
    background: 'var(--color-success)',
    color: '#fff',
    fontWeight: 700,
    cursor: 'pointer',
    fontSize: '0.92rem',
  },
  doneText: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    color: 'var(--color-success)', fontWeight: 700, fontSize: '0.9rem',
  },
}
