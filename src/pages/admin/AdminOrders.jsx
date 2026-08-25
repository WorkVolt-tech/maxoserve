import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrentLocation } from '../../contexts/LocationContext'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import { useToast } from '../../contexts/ToastContext'
import ConfirmationModal from '../../components/ui/ConfirmationModal'

const STATUS_FLOW = {
  submitted: { next: 'accepted', color: '#e91e63' },
  accepted: { next: 'preparing', color: '#ff9800' },
  preparing: { next: 'ready', color: '#2196f3' },
  ready: { next: 'delivered', color: '#9c27b0' },
  delivered: { next: null, color: '#4caf50' },
  cancelled: { next: null, color: '#9e9e9e' },
  rejected: { next: null, color: '#9e9e9e' },
}

const FILTERS = ['active', 'all', 'kitchen', 'bar', 'bottle_service', 'delivered']

const FILTER_LABEL_KEYS = {
  active: 'inProgress',
  all: 'all',
  kitchen: 'kitchen',
  bar: 'bar',
  bottle_service: 'bottleService',
  delivered: 'statusDelivered',
}

const FLOW_LABEL_KEYS = {
  accepted: 'accept',
  preparing: 'startPreparing',
  ready: 'markReady',
  delivered: 'markDelivered',
}

export default function AdminOrders() {
  const { user } = useAuth()
  const { currentLocationId } = useCurrentLocation()
  const { t } = useAppLanguage()
  const { showToast } = useToast()
  const [businessId, setBusinessId] = useState(null)
  const [orders, setOrders] = useState([])
  const [cancelTarget, setCancelTarget] = useState(null)
  const [orderItems, setOrderItems] = useState({})
  const [tables, setTables] = useState({})
  const [reservations, setReservations] = useState({})
  const [filter, setFilter] = useState('active')
  const [loading, setLoading] = useState(true)
  const [groupByTable, setGroupByTable] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState({})

  function toggleGroup(key) {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    init()
  }, [])

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

  async function init() {
    setLoading(true)

    const { data: membership } = await supabase
      .from('business_members')
      .select('business_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) {
      setLoading(false)
      return
    }

    setBusinessId(membership.business_id)

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

    await loadOrders(membership.business_id)
    setLoading(false)
  }

  async function loadOrders(bizId) {
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('business_id', bizId)
      .neq('status', 'draft')
      .order('created_at', { ascending: false })

    setOrders(ordersData || [])

    if (!ordersData || ordersData.length === 0) {
      setOrderItems({})
      return
    }

    const orderIds = ordersData.map((o) => o.id)
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*, menu_items(*)')
      .in('order_id', orderIds)

    if (!itemsData) return

    const itemIds = itemsData.map((i) => i.id)
    const { data: modsData } = await supabase
      .from('order_item_modifiers')
      .select('*, modifier_options(*)')
      .in('order_item_id', itemIds)

    const modsByItem = {}
    for (const mod of modsData || []) {
      if (!modsByItem[mod.order_item_id]) modsByItem[mod.order_item_id] = []
      modsByItem[mod.order_item_id].push(mod)
    }

    const itemsByOrder = {}
    for (const item of itemsData) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
      itemsByOrder[item.order_id].push({ ...item, modifiers: modsByItem[item.id] || [] })
    }
    setOrderItems(itemsByOrder)
  }

  async function updateStatus(order, newStatus) {
    const updates = { status: newStatus }
    const now = new Date().toISOString()
    if (newStatus === 'accepted') updates.accepted_at = now
    else if (newStatus === 'ready') updates.ready_at = now
    else if (newStatus === 'delivered') updates.delivered_at = now
    else if (newStatus === 'cancelled') updates.cancelled_at = now

    const { error } = await supabase.from('orders').update(updates).eq('id', order.id)
    if (error) {
      showToast(`Could not update: ${error.message}`, 'error')
      return
    }
    loadOrders(businessId)
  }

  async function confirmCancel() {
    if (!cancelTarget) return
    await updateStatus(cancelTarget, 'cancelled')
    setCancelTarget(null)
    showToast('Order cancelled')
  }

  function minutesAgo(dateStr) {
    const diffMs = Date.now() - new Date(dateStr).getTime()
    return Math.max(0, Math.floor(diffMs / 60000))
  }

  function orderHasPrepLocation(order, location) {
    const items = orderItems[order.id] || []
    return items.some((i) => i.menu_items?.prep_location === location)
  }

  function matchesFilter(order) {
    if (filter === 'all') return true
    if (filter === 'active') return !['delivered', 'cancelled', 'rejected'].includes(order.status)
    if (filter === 'delivered') return order.status === 'delivered'
    if (['kitchen', 'bar', 'bottle_service'].includes(filter)) {
      return orderHasPrepLocation(order, filter) && !['delivered', 'cancelled', 'rejected'].includes(order.status)
    }
    return true
  }

  const ordersForLocation = orders.filter((o) => {
    if (o.table_id) {
      return tables[o.table_id]?.location_id === currentLocationId
    }
    if (o.reservation_id && reservations[o.reservation_id]) {
      return reservations[o.reservation_id].location_id === currentLocationId
    }
    return false
  })
  const visibleOrders = ordersForLocation.filter(matchesFilter)

  const groupedByTable = {}
  for (const o of visibleOrders) {
    const key = o.table_id || `reservation-${o.reservation_id}`
    if (!groupedByTable[key]) groupedByTable[key] = []
    groupedByTable[key].push(o)
  }

  function groupLabel(key) {
    if (key.startsWith('reservation-')) {
      const resId = key.replace('reservation-', '')
      return `${t('reservationPrefix')} ${reservations[resId]?.customer_name || 'Unknown'}`
    }
    return tables[key]?.name || t('unassignedTable')
  }

  function renderOrderCard(order) {
    const items = orderItems[order.id] || []
    const table = tables[order.table_id]
    const flow = STATUS_FLOW[order.status] || {}

    return (
      <div key={order.id} style={styles.orderCard}>
        <div style={styles.orderHeader}>
          <div>
            <strong>
              {table?.name || (order.reservation_id && reservations[order.reservation_id]
                ? `${t('reservationPrefix')} ${reservations[order.reservation_id].customer_name}`
                : t('unassignedTable'))}
            </strong>
            <span style={styles.orderMeta}> · ${Number(order.total).toFixed(2)} · {minutesAgo(order.created_at)}m ago</span>
          </div>
          <span style={{ ...styles.statusBadge, background: (STATUS_FLOW[order.status]?.color || '#999') + '22', color: STATUS_FLOW[order.status]?.color || '#666' }}>
            {order.status.replace('_', ' ')}
          </span>
        </div>

        <div style={styles.itemsList}>
          {items.map((item) => (
            <div key={item.id} style={styles.itemRow}>
              <div style={styles.itemLine}>
                <span>{item.quantity}× {item.menu_items?.name || 'Item'}</span>
                <span style={styles.prepTag}>{item.menu_items?.prep_location?.replace('_', ' ')}</span>
              </div>
              {item.modifiers.length > 0 && (
                <div style={styles.modLine}>{item.modifiers.map((m) => m.modifier_options?.name).join(', ')}</div>
              )}
              {item.notes && <div style={styles.notesLine}>"{item.notes}"</div>}
            </div>
          ))}
        </div>

        <div style={styles.actions}>
          {flow.next && (
            <button onClick={() => updateStatus(order, flow.next)} style={{ ...styles.actionButton, background: flow.color }}>
              {t(FLOW_LABEL_KEYS[flow.next])}
            </button>
          )}
          {!['delivered', 'cancelled', 'rejected'].includes(order.status) && (
            <button onClick={() => setCancelTarget(order)} style={styles.cancelButton}>{t('cancel')}</button>
          )}
        </div>
      </div>
    )
  }

  if (loading) return <div><h2>{t('orders')}</h2><p>{t('loading')}</p></div>

  return (
    <div>
      <h2>{t('orders')}</h2>
      <p style={{ color: '#666' }}>{t('subtitleOrders')}</p>

      <div style={styles.filterRow}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ ...styles.filterButton, ...(filter === f ? styles.filterButtonActive : {}) }}
          >
            {t(FILTER_LABEL_KEYS[f])}
          </button>
        ))}
        <button
          onClick={() => setGroupByTable((v) => !v)}
          style={{ ...styles.filterButton, ...(groupByTable ? styles.filterButtonActive : {}), marginLeft: 'auto' }}
        >
          {groupByTable ? '✓ ' : ''}{t('groupByTable')}
        </button>
      </div>

      {groupByTable ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {Object.keys(groupedByTable).length === 0 && <p style={{ color: '#888' }}>{t('noOrdersHere')}</p>}
          {Object.entries(groupedByTable).map(([key, orderList]) => {
            const billableOrders = orderList.filter((o) => !['cancelled', 'rejected'].includes(o.status))
            const groupTotal = billableOrders.reduce((sum, o) => sum + Number(o.total), 0)
            const isExpanded = !!expandedGroups[key]
            return (
              <div key={key} style={styles.groupCard}>
                <button onClick={() => toggleGroup(key)} style={styles.groupCardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ ...styles.chevron, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
                    <strong>{groupLabel(key)}</strong>
                  </div>
                  <span style={styles.orderMeta}>
                    {orderList.length} order{orderList.length !== 1 ? 's' : ''} · ${groupTotal.toFixed(2)} total
                  </span>
                </button>
                {isExpanded && (
                  <div style={styles.groupCardBody}>
                    {orderList.map((order) => renderOrderCard(order))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={styles.list}>
          {visibleOrders.length === 0 && <p style={{ color: '#888' }}>{t('noOrdersHere')}</p>}
          {visibleOrders.map((order) => renderOrderCard(order))}
        </div>
      )}

      {cancelTarget && (
        <ConfirmationModal
          title="Cancel this order?"
          description="The customer and kitchen/bar will be notified this order was cancelled."
          confirmLabel="Cancel Order"
          onConfirm={confirmCancel}
          onCancel={() => setCancelTarget(null)}
        />
      )}
    </div>
  )
}

const styles = {
  filterRow: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  filterButton: {
    padding: '0.5rem 1rem',
    borderRadius: '999px',
    border: '1px solid #e2e4e9',
    background: '#fff',
    color: '#555',
    cursor: 'pointer',
    fontSize: '0.85rem',
    textTransform: 'capitalize',
  },
  filterButtonActive: { background: '#4c8dff', borderColor: '#4c8dff', color: '#fff' },
  groupCard: {
    background: '#fff',
    borderRadius: '10px',
    border: '1px solid #e2e4e9',
    overflow: 'hidden',
  },
  groupCardHeader: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.9rem 1.1rem',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: '0.95rem',
    textAlign: 'left',
  },
  chevron: {
    display: 'inline-block',
    fontSize: '1.1rem',
    color: '#888',
    transition: 'transform 0.15s',
  },
  groupCardBody: {
    padding: '0 1.1rem 1.1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    borderTop: '1px solid #f0f0f0',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  orderCard: {
    background: '#fff',
    borderRadius: '10px',
    border: '1px solid #e2e4e9',
    padding: '1rem',
  },
  orderHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  orderMeta: { color: '#888', fontSize: '0.85rem' },
  statusBadge: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.25rem 0.6rem',
    borderRadius: '999px',
    textTransform: 'capitalize',
  },
  itemsList: { marginBottom: '0.75rem' },
  itemRow: { padding: '0.35rem 0', borderBottom: '1px solid #f5f5f5' },
  itemLine: { display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600 },
  prepTag: { color: '#888', fontWeight: 400, fontSize: '0.75rem', textTransform: 'capitalize' },
  modLine: { color: '#666', fontSize: '0.8rem', marginTop: '0.15rem' },
  notesLine: { color: '#aaa', fontSize: '0.78rem', marginTop: '0.15rem', fontStyle: 'italic' },
  actions: { display: 'flex', gap: '0.5rem' },
  actionButton: {
    flex: 1,
    padding: '0.6rem',
    borderRadius: '8px',
    border: 'none',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  cancelButton: {
    padding: '0.6rem 1rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    background: '#fff',
    color: '#d33',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
}
