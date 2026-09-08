import { useEffect, useState, useRef } from 'react'
import { LogOut, Bell, MapPin, Check, X, Truck, CheckCheck, ShoppingBag, ChefHat, LayoutDashboard } from 'lucide-react'
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

const STATION_BY_ROLE = {
  kitchen: ['kitchen'],
  bartender: ['bar', 'bottle_service'],
}

const ORDER_STATUS_FLOW = {
  submitted: { next: 'accepted', labelKey: 'accept', color: 'var(--color-primary)' },
  accepted: { next: 'preparing', labelKey: 'startPreparing', color: 'var(--color-warning)' },
  preparing: { next: 'ready', labelKey: 'markReady', color: 'var(--color-info)' },
  ready: { next: 'delivered', labelKey: 'markDelivered', color: 'var(--color-success)' },
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

function localizedLabel(item, lang) {
  if (!item) return ''
  return lang === 'fr' && item.label_fr ? item.label_fr : item.label
}

function requestStage(status) {
  if (status === 'pending') return 'new'
  if (['accepted', 'on_the_way'].includes(status)) return 'in_progress'
  if (status === 'completed') return 'completed'
  return 'other' // rejected / cancelled
}

function orderStage(status) {
  if (status === 'submitted') return 'new'
  if (['accepted', 'preparing', 'ready'].includes(status)) return 'in_progress'
  if (status === 'delivered') return 'completed'
  return 'other' // cancelled / rejected
}

export default function StaffDashboard() {
  const { user, signOut, role } = useAuth()
  const { t, lang, setLang } = useAppLanguage()
  const [businessId, setBusinessId] = useState(null)

  const [requests, setRequests] = useState([])
  const [requestTypes, setRequestTypes] = useState({})
  const [tables, setTables] = useState({})
  const [reservations, setReservations] = useState({})
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

  const [orders, setOrders] = useState([])
  const [orderItems, setOrderItems] = useState({})
  const [showAllOrders, setShowAllOrders] = useState(true)
  const knownOrderIds = useRef(new Set())
  const isFirstOrderLoad = useRef(true)

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (role && STATION_BY_ROLE[role]) setShowAllOrders(false)
  }, [role])

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

  useEffect(() => {
    if (!businessId) return
    const channel = supabase
      .channel(`staff-orders-${businessId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `business_id=eq.${businessId}` },
        () => loadOrders(businessId)
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [businessId])

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

    const { data: reservationsData } = await supabase
      .from('reservations')
      .select('*')
      .eq('business_id', membership.business_id)
    const reservationsMap = {}
    for (const r of reservationsData || []) reservationsMap[r.id] = r
    setReservations(reservationsMap)

    await loadRequests(membership.business_id)
    await loadOrders(membership.business_id)
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

  async function loadOrders(bizId) {
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('business_id', bizId)
      .neq('status', 'draft')
      .order('created_at', { ascending: false })

    const fresh = data || []

    if (!isFirstOrderLoad.current) {
      const newSubmitted = fresh.filter((o) => o.status === 'submitted' && !knownOrderIds.current.has(o.id))
      for (const o of newSubmitted) notifyNewOrder(o)
    }
    knownOrderIds.current = new Set(fresh.map((o) => o.id))
    isFirstOrderLoad.current = false
    setOrders(fresh)

    if (fresh.length === 0) { setOrderItems({}); return }

    const orderIds = fresh.map((o) => o.id)
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*, menu_items(name, prep_location)')
      .in('order_id', orderIds)

    const byOrder = {}
    for (const item of itemsData || []) {
      if (!byOrder[item.order_id]) byOrder[item.order_id] = []
      byOrder[item.order_id].push(item)
    }
    setOrderItems(byOrder)
  }

  function notifyNewRequest(request) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const type = requestTypes[request.request_type_id]
    const table = tables[request.table_id]
    new Notification('New request', {
      body: `${localizedLabel(type, lang) || 'Request'} — ${table?.name || 'Unknown table'}`,
    })
    if (navigator.vibrate) navigator.vibrate([200, 100, 200])
  }

  function notifyNewOrder(order) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const table = tables[order.table_id]
    new Notification('New order', {
      body: `${table?.name || 'Table'} · $${Number(order.total).toFixed(2)}`,
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

  async function updateOrderStatus(order, newStatus) {
    const updates = { status: newStatus }
    const now = new Date().toISOString()
    if (newStatus === 'accepted') { updates.accepted_at = now; updates.assigned_to = user.id }
    else if (newStatus === 'ready') updates.ready_at = now
    else if (newStatus === 'delivered') updates.delivered_at = now
    await supabase.from('orders').update(updates).eq('id', order.id)
    loadOrders(businessId)
  }

  function minutesWaiting(createdAt) {
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000))
  }

  function orderMatchesStation(order) {
    if (showAllOrders) return true
    const stations = STATION_BY_ROLE[role]
    if (!stations) return true
    const items = orderItems[order.id] || []
    return items.some((i) => stations.includes(i.menu_items?.prep_location))
  }

  const requestsForLocation = selectedLocationId === 'all'
    ? requests
    : requests.filter((r) => tables[r.table_id]?.location_id === selectedLocationId)

  const ordersForLocation = selectedLocationId === 'all'
    ? orders
    : orders.filter((o) => tables[o.table_id]?.location_id === selectedLocationId)

  const requestFeedItems = requestsForLocation
    .filter((r) => requestStage(r.status) !== 'other')
    .map((r) => ({ type: 'request', data: r, stage: requestStage(r.status), createdAt: r.created_at, assignedTo: r.assigned_to }))

  const orderFeedItems = ordersForLocation
    .filter((o) => orderStage(o.status) !== 'other')
    .filter(orderMatchesStation)
    .map((o) => ({ type: 'order', data: o, stage: orderStage(o.status), createdAt: o.created_at, assignedTo: o.assigned_to }))

  const allFeedItems = [...requestFeedItems, ...orderFeedItems].sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  )

  const counts = {
    new: allFeedItems.filter((i) => i.stage === 'new').length,
    assigned_to_me: allFeedItems.filter((i) => i.assignedTo === user.id && i.stage !== 'completed').length,
    in_progress: allFeedItems.filter((i) => i.stage === 'in_progress').length,
    completed: allFeedItems.filter((i) => i.stage === 'completed').length,
    all: allFeedItems.length,
  }

  const visibleFeedItems =
    filter === 'all' ? allFeedItems :
    filter === 'assigned_to_me' ? allFeedItems.filter((i) => i.assignedTo === user.id && i.stage !== 'completed') :
    allFeedItems.filter((i) => i.stage === filter)

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={{ color: '#fff', padding: '2rem' }}>{t('loading')}</p>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>{t('liveFeed')}</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <a href="/admin" style={styles.dashboardLink}>
            <LayoutDashboard size={14} /> {t('dashboard')}
          </a>
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
        {STATION_BY_ROLE[role] && (
          <button
            onClick={() => setShowAllOrders((v) => !v)}
            style={{ ...styles.filterButton, ...(showAllOrders ? styles.filterButtonActive : {}), marginLeft: 'auto' }}
          >
            {showAllOrders ? t('showAllOrders') : t('myStationOnly')}
          </button>
        )}
      </div>

      <div style={styles.list}>
        {visibleFeedItems.length === 0 && (
          <EmptyState
            icon={Bell}
            title={t('noRequestsHere')}
            description={t('allCaughtUp')}
          />
        )}

        {visibleFeedItems.map((feedItem) => (
          feedItem.type === 'request'
            ? renderRequestCard(feedItem.data)
            : renderOrderCard(feedItem.data)
        ))}
      </div>
    </div>
  )

  function renderRequestCard(r) {
    const type = requestTypes[r.request_type_id]
    const table = tables[r.table_id]
    const isNew = r.status === 'pending'
    const level = urgency(r.created_at)
    const urgencyStyle = URGENCY_STYLES[level]

    return (
      <div
        key={`req-${r.id}`}
        style={{
          ...styles.requestCard,
          borderColor: isNew ? urgencyStyle.border : 'var(--color-border)',
          borderWidth: isNew && level !== 'normal' ? '2px' : '1px',
        }}
      >
        {isNew && <div style={{ ...styles.newTag, background: urgencyStyle.accent }}>NEW</div>}
        <div style={styles.typeTag}><Bell size={11} /> {t('requests')}</div>

        <div style={styles.requestTop}>
          <div>
            <div style={styles.requestType}>{localizedLabel(type, lang) || 'Request'}</div>
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
  }

  function renderOrderCard(order) {
    const items = orderItems[order.id] || []
    const table = tables[order.table_id]
    const reservation = order.reservation_id ? reservations[order.reservation_id] : null
    const flow = ORDER_STATUS_FLOW[order.status]
    const isNew = order.status === 'submitted'
    const level = urgency(order.created_at)
    const urgencyStyle = URGENCY_STYLES[level]

    return (
      <div
        key={`order-${order.id}`}
        style={{
          ...styles.requestCard,
          borderColor: isNew ? urgencyStyle.border : 'var(--color-border)',
          borderWidth: isNew && level !== 'normal' ? '2px' : '1px',
        }}
      >
        {isNew && <div style={{ ...styles.newTag, background: urgencyStyle.accent }}>NEW</div>}
        <div style={styles.typeTag}><ShoppingBag size={11} /> {t('orders')}</div>

        <div style={styles.requestTop}>
          <div>
            <div style={styles.requestType}>
              {table?.name || (reservation ? `${t('reservationPrefix')} ${reservation.customer_name}` : t('unassignedTable'))}
            </div>
            {!table && reservation?.table_id && tables[reservation.table_id] && (
              <div style={styles.requestTable}>
                <MapPin size={12} /> {tables[reservation.table_id].name}
              </div>
            )}
            <div style={styles.requestTable}>${Number(order.total).toFixed(2)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <StatusBadge status={order.status} />
            <div style={{ ...styles.waitTime, color: isNew ? urgencyStyle.accent : 'var(--color-text-faint)' }}>
              {minutesWaiting(order.created_at)}m
            </div>
          </div>
        </div>

        {order.allergy_notes && (
          <div style={styles.allergyAlert}>
            <strong>⚠ {t('allergyBadge')}:</strong> {order.allergy_notes}
          </div>
        )}

        <div style={styles.orderItemsList}>
          {items.map((item) => (
            <div key={item.id} style={styles.orderItemRow}>
              <span>{item.quantity}× {item.menu_items?.name || 'Item'}</span>
              <span style={styles.prepTag}>
                {item.menu_items?.prep_location === 'kitchen' && t('kitchen')}
                {item.menu_items?.prep_location === 'bar' && t('bar')}
                {item.menu_items?.prep_location === 'bottle_service' && t('bottleService')}
              </span>
            </div>
          ))}
        </div>

        <div style={styles.actions}>
          {flow && (
            <button
              onClick={() => updateOrderStatus(order, flow.next)}
              style={{ ...styles.acceptButton, background: flow.color }}
            >
              <ChefHat size={16} /> {t(flow.labelKey)}
            </button>
          )}
        </div>
      </div>
    )
  }
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
    flexWrap: 'wrap',
    gap: '0.6rem',
  },
  headerTitle: { color: '#fff', margin: 0, fontSize: '1.3rem' },
  dashboardLink: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.45rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid var(--color-sidebar-border)',
    background: 'transparent',
    color: '#fff',
    textDecoration: 'none',
    fontSize: '0.8rem',
    fontWeight: 700,
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
    padding: '1rem 1.25rem',
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
  typeTag: {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    color: 'var(--color-text-faint)', fontSize: '0.7rem', fontWeight: 700,
    textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.6rem',
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
  allergyAlert: {
    background: '#fef3c7', color: '#92400e', padding: '0.5rem 0.75rem',
    borderRadius: '6px', fontSize: '0.83rem', marginBottom: '0.75rem', lineHeight: 1.4,
  },
  orderItemsList: { marginBottom: '0.75rem' },
  orderItemRow: {
    display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem',
    padding: '0.3rem 0', borderBottom: '1px solid var(--color-border)',
  },
  prepTag: { color: 'var(--color-text-muted)', fontSize: '0.75rem', textTransform: 'capitalize' },
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
