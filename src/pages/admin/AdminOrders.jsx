import { useEffect, useState, useRef } from 'react'
import { Bell, Pencil, Plus, X, Check, Truck, CheckCheck } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { logActivity } from '../../lib/activityLog'
import { useAuth } from '../../contexts/AuthContext'
import { isOwnerOrAdmin } from '../../lib/permissions'
import { useCurrentLocation } from '../../contexts/LocationContext'
import { useCurrentBusiness } from '../../contexts/BusinessContext'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import { useToast } from '../../contexts/ToastContext'
import ConfirmationModal from '../../components/ui/ConfirmationModal'

const ORDER_STATUS_FLOW = {
  submitted: { next: 'accepted', color: '#e91e63' },
  accepted: { next: 'preparing', color: '#ff9800' },
  preparing: { next: 'ready', color: '#2196f3' },
  ready: { next: 'delivered', color: '#9c27b0' },
  delivered: { next: null, color: '#4caf50' },
  cancelled: { next: null, color: '#9e9e9e' },
  rejected: { next: null, color: '#9e9e9e' },
}

const ORDER_FLOW_LABEL_KEYS = {
  accepted: 'accept',
  preparing: 'startPreparing',
  ready: 'markReady',
  delivered: 'markDelivered',
}

const REQUEST_STATUS_FLOW = {
  pending: { next: 'accepted', labelKey: 'accept', color: '#e91e63' },
  accepted: { next: 'on_the_way', labelKey: 'onMyWay', color: '#ff9800' },
  on_the_way: { next: 'completed', labelKey: 'complete', color: '#4caf50' },
}

const FILTERS = ['active', 'kitchen', 'bar', 'bottle_service', 'completed', 'all']

const FILTER_LABEL_KEYS = {
  active: 'inProgress',
  kitchen: 'kitchen',
  bar: 'bar',
  bottle_service: 'bottleService',
  completed: 'completed',
  all: 'all',
}

function localizedLabel(item, lang) {
  if (!item) return ''
  return lang === 'fr' && item.label_fr ? item.label_fr : item.label
}

export default function AdminOrders() {
  const { user, role } = useAuth()
  const { currentLocationId } = useCurrentLocation()
  const { currentBusinessId } = useCurrentBusiness()
  const { t, lang } = useAppLanguage()
  const { showToast } = useToast()
  const businessId = currentBusinessId

  const [orders, setOrders] = useState([])
  const [orderItems, setOrderItems] = useState({})
  const [requests, setRequests] = useState([])
  const [requestTypes, setRequestTypes] = useState({})
  const [cancelTarget, setCancelTarget] = useState(null)
  const [tables, setTables] = useState({})
  const [reservations, setReservations] = useState({})
  const [filter, setFilter] = useState('active')
  const [loading, setLoading] = useState(true)
  const [groupByTable, setGroupByTable] = useState(false)
  const [expandedGroups, setExpandedGroups] = useState({})
  const [editingOrder, setEditingOrder] = useState(null)
  const [menuCategories, setMenuCategories] = useState([])
  const [menuItemsByCategory, setMenuItemsByCategory] = useState({})
  const [addQuantities, setAddQuantities] = useState({})
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const knownOrderIds = useRef(new Set())
  const isFirstOrderLoad = useRef(true)
  const knownRequestIds = useRef(new Set())
  const isFirstRequestLoad = useRef(true)
  const [staffMembers, setStaffMembers] = useState([])
  const [profiles, setProfiles] = useState({})

  function toggleGroup(key) {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    if (currentBusinessId) init()
  }, [currentBusinessId])

  useEffect(() => {
    if (!businessId) return
    const channel = supabase
      .channel(`admin-orders-${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `business_id=eq.${businessId}` }, () => loadOrders(businessId))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [businessId])

  useEffect(() => {
    if (!businessId) return
    const channel = supabase
      .channel(`admin-requests-${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests', filter: `business_id=eq.${businessId}` }, () => loadRequests(businessId))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [businessId])

  async function init() {
    setLoading(true)

    const { data: tablesData } = await supabase.from('tables').select('*').eq('business_id', currentBusinessId)
    const tablesMap = {}
    for (const t of tablesData || []) tablesMap[t.id] = t
    setTables(tablesMap)

    const { data: reservationsData } = await supabase.from('reservations').select('*').eq('business_id', currentBusinessId)
    const reservationsMap = {}
    for (const r of reservationsData || []) reservationsMap[r.id] = r
    setReservations(reservationsMap)

    const { data: typesData } = await supabase.from('service_request_types').select('*').eq('business_id', currentBusinessId)
    const typesMap = {}
    for (const t of typesData || []) typesMap[t.id] = t
    setRequestTypes(typesMap)

    const { data: membersData } = await supabase.from('business_members').select('*').eq('business_id', currentBusinessId)
    setStaffMembers(membersData || [])

    if (membersData && membersData.length > 0) {
      const userIds = membersData.map((m) => m.user_id)
      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', userIds)
      const pMap = {}
      for (const p of profilesData || []) pMap[p.id] = p
      setProfiles(pMap)
    }

    const { data: catsData } = await supabase
      .from('menu_categories').select('*').eq('business_id', currentBusinessId).eq('is_active', true).order('display_order', { ascending: true })
    setMenuCategories(catsData || [])

    if (catsData && catsData.length > 0) {
      const catIds = catsData.map((c) => c.id)
      const { data: itemsData } = await supabase.from('menu_items').select('*').in('category_id', catIds).eq('is_available', true)
      const byCategory = {}
      for (const item of itemsData || []) {
        if (!byCategory[item.category_id]) byCategory[item.category_id] = []
        byCategory[item.category_id].push(item)
      }
      setMenuItemsByCategory(byCategory)
    }

    await loadOrders(currentBusinessId)
    await loadRequests(currentBusinessId)
    setLoading(false)
  }

  async function loadOrders(bizId) {
    const { data: ordersData } = await supabase
      .from('orders').select('*').eq('business_id', bizId).neq('status', 'draft').order('created_at', { ascending: false })

    const fresh = ordersData || []

    if (!isFirstOrderLoad.current) {
      const newSubmitted = fresh.filter((o) => o.status === 'submitted' && !knownOrderIds.current.has(o.id))
      for (const o of newSubmitted) notifyNew('order', o)
    }
    knownOrderIds.current = new Set(fresh.map((o) => o.id))
    isFirstOrderLoad.current = false
    setOrders(fresh)

    if (fresh.length === 0) { setOrderItems({}); return }

    const orderIds = fresh.map((o) => o.id)
    const { data: itemsData } = await supabase.from('order_items').select('*, menu_items(*)').in('order_id', orderIds)
    if (!itemsData) return

    const itemIds = itemsData.map((i) => i.id)
    const { data: modsData } = await supabase.from('order_item_modifiers').select('*, modifier_options(*)').in('order_item_id', itemIds)

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

  async function loadRequests(bizId) {
    const { data } = await supabase
      .from('service_requests').select('*').eq('business_id', bizId).order('created_at', { ascending: false })

    const fresh = data || []

    if (!isFirstRequestLoad.current) {
      const newPending = fresh.filter((r) => r.status === 'pending' && !knownRequestIds.current.has(r.id))
      for (const r of newPending) notifyNew('request', r)
    }
    knownRequestIds.current = new Set(fresh.map((r) => r.id))
    isFirstRequestLoad.current = false
    setRequests(fresh)
  }

  function notifyNew(kind, item) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const table = tables[item.table_id]
    if (kind === 'order') {
      new Notification('MaxoServe', { body: `${t('newOrderAlert')} ${table?.name || 'Unassigned'} · $${Number(item.total).toFixed(2)}` })
    } else {
      const type = requestTypes[item.request_type_id]
      new Notification('MaxoServe', { body: `${localizedLabel(type, lang) || 'Request'} — ${table?.name || 'Unknown table'}` })
    }
    if (navigator.vibrate) navigator.vibrate([200, 100, 200])
  }

  function requestNotificationPermission() {
    if (typeof Notification === 'undefined') return
    Notification.requestPermission().then(setNotifPermission)
  }

  async function updateOrderStatus(order, newStatus) {
    const updates = { status: newStatus }
    const now = new Date().toISOString()
    if (newStatus === 'accepted') updates.accepted_at = now
    else if (newStatus === 'ready') updates.ready_at = now
    else if (newStatus === 'delivered') updates.delivered_at = now
    else if (newStatus === 'cancelled') updates.cancelled_at = now

    const { error } = await supabase.from('orders').update(updates).eq('id', order.id)
    if (error) { showToast(`Could not update: ${error.message}`, 'error'); return }
    loadOrders(businessId)
  }

  async function updateRequestStatus(request, newStatus) {
    const updates = { status: newStatus }
    const now = new Date().toISOString()
    if (newStatus === 'accepted') { updates.accepted_at = now; updates.assigned_to = user.id }
    else if (newStatus === 'on_the_way') updates.on_the_way_at = now
    else if (newStatus === 'completed') updates.completed_at = now
    else if (newStatus === 'rejected') updates.cancelled_at = now

    const { error } = await supabase.from('service_requests').update(updates).eq('id', request.id)
    if (error) { showToast(`Could not update: ${error.message}`, 'error'); return }
    logActivity(businessId, user.id, `${newStatus} a service request`)
    loadRequests(businessId)
  }

  async function confirmCancel() {
    if (!cancelTarget) return
    if (cancelTarget.type === 'order') {
      await updateOrderStatus(cancelTarget.data, 'cancelled')
    } else {
      await updateRequestStatus(cancelTarget.data, 'rejected')
    }
    setCancelTarget(null)
    showToast('Cancelled')
  }

  async function handleReassignOrder(order, newUserId) {
    const { error } = await supabase.from('orders').update({ assigned_to: newUserId || null }).eq('id', order.id)
    if (error) { showToast(`Could not reassign: ${error.message}`, 'error'); return }
    logActivity(businessId, user.id, `reassigned an order`)
    showToast(t('reassign'))
    loadOrders(businessId)
  }

  async function handleReassignRequest(request, newUserId) {
    const { error } = await supabase.from('service_requests').update({ assigned_to: newUserId || null }).eq('id', request.id)
    if (error) { showToast(`Could not reassign: ${error.message}`, 'error'); return }
    logActivity(businessId, user.id, `reassigned a service request`)
    showToast(t('reassign'))
    loadRequests(businessId)
  }

  function openEditOrder(order) {
    setEditingOrder(order)
    setAddQuantities({})
  }

  async function handleAddItemToOrder(item, quantity) {
    if (!editingOrder) return
    const qty = parseInt(quantity) || 1
    const { error } = await supabase.from('order_items').insert({
      business_id: businessId, order_id: editingOrder.id, menu_item_id: item.id, quantity: qty, unit_price: item.price,
    })
    if (error) { showToast(`Could not add item: ${error.message}`, 'error'); return }
    logActivity(businessId, user.id, `added ${qty}× "${item.name}" to an order`)
    await recalculateOrderTotal(editingOrder.id)
    await loadOrders(businessId)
    setAddQuantities((prev) => ({ ...prev, [item.id]: '' }))
  }

  async function handleRemoveOrderItem(orderItemId) {
    const removedItem = (orderItems[editingOrder?.id] || []).find((i) => i.id === orderItemId)
    const { error } = await supabase.from('order_items').delete().eq('id', orderItemId)
    if (error) { showToast(`Could not remove item: ${error.message}`, 'error'); return }
    logActivity(businessId, user.id, `removed "${removedItem?.menu_items?.name || 'an item'}" from an order`)
    if (editingOrder) await recalculateOrderTotal(editingOrder.id)
    await loadOrders(businessId)
  }

  async function recalculateOrderTotal(orderId) {
    const { data: items } = await supabase.from('order_items').select('quantity, unit_price').eq('order_id', orderId)
    const subtotal = (items || []).reduce((sum, i) => sum + Number(i.unit_price) * i.quantity, 0)
    const { data: orderRow } = await supabase.from('orders').select('tax, subtotal, total').eq('id', orderId).single()
    const taxRate = orderRow && Number(orderRow.subtotal) > 0 ? Number(orderRow.tax) / Number(orderRow.subtotal) : 0
    const tax = subtotal * taxRate
    const total = subtotal + tax
    await supabase.from('orders').update({ subtotal, tax, total }).eq('id', orderId)
  }

  function closeEditOrder() {
    setEditingOrder(null)
    showToast(t('orderUpdated'))
  }

  function minutesAgo(dateStr) {
    return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000))
  }

  function orderHasPrepLocation(order, location) {
    const items = orderItems[order.id] || []
    return items.some((i) => i.menu_items?.prep_location === location)
  }

  function matchesFilter(feedItem) {
    const { type, data } = feedItem
    if (filter === 'all') return true

    if (filter === 'active') {
      return type === 'order'
        ? !['delivered', 'cancelled', 'rejected'].includes(data.status)
        : !['completed', 'rejected', 'cancelled'].includes(data.status)
    }
    if (filter === 'completed') {
      return type === 'order' ? data.status === 'delivered' : data.status === 'completed'
    }
    if (['kitchen', 'bar', 'bottle_service'].includes(filter)) {
      if (type === 'request') {
        return !['completed', 'rejected', 'cancelled'].includes(data.status)
      }
      return orderHasPrepLocation(data, filter) && !['delivered', 'cancelled', 'rejected'].includes(data.status)
    }
    return true
  }

  const ordersForLocation = orders.filter((o) => {
    if (o.table_id) return tables[o.table_id]?.location_id === currentLocationId
    if (o.reservation_id && reservations[o.reservation_id]) return reservations[o.reservation_id].location_id === currentLocationId
    return false
  })

  const requestsForLocation = requests.filter((r) => tables[r.table_id]?.location_id === currentLocationId)

  const orderFeedItems = ordersForLocation.map((o) => ({ type: 'order', data: o, createdAt: o.created_at }))
  const requestFeedItems = requestsForLocation.map((r) => ({ type: 'request', data: r, createdAt: r.created_at }))
  const allFeedItems = [...orderFeedItems, ...requestFeedItems].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const visibleFeedItems = allFeedItems.filter(matchesFilter)

  const groupedByTable = {}
  for (const item of visibleFeedItems) {
    const key = item.type === 'order'
      ? (item.data.table_id || `reservation-${item.data.reservation_id}`)
      : item.data.table_id
    if (!key) continue
    if (!groupedByTable[key]) groupedByTable[key] = []
    groupedByTable[key].push(item)
  }

  function groupLabel(key) {
    if (key.startsWith('reservation-')) {
      const resId = key.replace('reservation-', '')
      return `${t('reservationPrefix')} ${reservations[resId]?.customer_name || 'Unknown'}`
    }
    return tables[key]?.name || t('unassignedTable')
  }

  function renderAssignedRow(item, onReassign) {
    return (
      <div style={styles.assignedRow}>
        <span style={{ color: '#888', fontSize: '0.82rem' }}>
          {t('assignedTo')}: {item.assigned_to
            ? (profiles[item.assigned_to]?.full_name || profiles[item.assigned_to]?.email || '—')
            : t('unassignedStaff')}
        </span>
        {isOwnerOrAdmin(role) && (
          <select value={item.assigned_to || ''} onChange={(e) => onReassign(item, e.target.value)} style={styles.reassignSelect}>
            <option value="">{t('unassignedStaff')}</option>
            {staffMembers.map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {profiles[m.user_id]?.full_name || profiles[m.user_id]?.email || 'Unknown'}
              </option>
            ))}
          </select>
        )}
      </div>
    )
  }

  function renderOrderCard(order) {
    const items = orderItems[order.id] || []
    const table = tables[order.table_id]
    const flow = ORDER_STATUS_FLOW[order.status] || {}

    return (
      <div key={`order-${order.id}`} style={styles.orderCard}>
        <div style={styles.orderHeader}>
          <div>
            <span style={styles.typeTag}>{t('orders')}</span>
            <strong>
              {table?.name || (order.reservation_id && reservations[order.reservation_id]
                ? `${t('reservationPrefix')} ${reservations[order.reservation_id].customer_name}`
                : t('unassignedTable'))}
            </strong>
            <span style={styles.orderMeta}> · ${Number(order.total).toFixed(2)} · {minutesAgo(order.created_at)}m ago</span>
          </div>
          <span style={{ ...styles.statusBadge, background: (ORDER_STATUS_FLOW[order.status]?.color || '#999') + '22', color: ORDER_STATUS_FLOW[order.status]?.color || '#666' }}>
            {order.status.replace('_', ' ')}
          </span>
        </div>

        {order.allergy_notes && (
          <div style={styles.allergyAlert}><strong>⚠ {t('allergyBadge')}:</strong> {order.allergy_notes}</div>
        )}

        {renderAssignedRow(order, handleReassignOrder)}

        <div style={styles.itemsList}>
          {items.map((item) => (
            <div key={item.id} style={styles.itemRow}>
              <div style={styles.itemLine}>
                <span>{item.quantity}× {item.menu_items?.name || 'Item'}</span>
                <span style={styles.prepTag}>{item.menu_items?.prep_location?.replace('_', ' ')}</span>
              </div>
              {item.modifiers.length > 0 && <div style={styles.modLine}>{item.modifiers.map((m) => m.modifier_options?.name).join(', ')}</div>}
              {item.notes && <div style={styles.notesLine}>"{item.notes}"</div>}
            </div>
          ))}
        </div>

        <div style={styles.actions}>
          {flow.next && (
            <button onClick={() => updateOrderStatus(order, flow.next)} style={{ ...styles.actionButton, background: flow.color }}>
              {t(ORDER_FLOW_LABEL_KEYS[flow.next])}
            </button>
          )}
          {!['delivered', 'cancelled', 'rejected'].includes(order.status) && (
            <button onClick={() => openEditOrder(order)} style={styles.editButton}><Pencil size={14} /> {t('editOrder')}</button>
          )}
          {!['delivered', 'cancelled', 'rejected'].includes(order.status) && (
            <button onClick={() => setCancelTarget({ type: 'order', data: order })} style={styles.cancelButton}>{t('cancel')}</button>
          )}
        </div>
      </div>
    )
  }

  function renderRequestCard(request) {
    const type = requestTypes[request.request_type_id]
    const table = tables[request.table_id]
    const flow = REQUEST_STATUS_FLOW[request.status]

    return (
      <div key={`req-${request.id}`} style={styles.orderCard}>
        <div style={styles.orderHeader}>
          <div>
            <span style={styles.typeTag}>{t('requests')}</span>
            <strong>{localizedLabel(type, lang) || 'Request'}</strong>
            <span style={styles.orderMeta}> · {table?.name || 'Unknown table'} · {minutesAgo(request.created_at)}m ago</span>
          </div>
          <span style={{ ...styles.statusBadge, background: '#4c8dff22', color: '#4c8dff' }}>
            {request.status.replace('_', ' ')}
          </span>
        </div>

        {renderAssignedRow(request, handleReassignRequest)}

        <div style={styles.actions}>
          {flow && (
            <button onClick={() => updateRequestStatus(request, flow.next)} style={{ ...styles.actionButton, background: flow.color }}>
              {t(flow.labelKey)}
            </button>
          )}
          {!['completed', 'cancelled', 'rejected'].includes(request.status) && (
            <button onClick={() => setCancelTarget({ type: 'request', data: request })} style={styles.cancelButton}>{t('decline')}</button>
          )}
        </div>
      </div>
    )
  }

  function renderFeedItem(feedItem) {
    return feedItem.type === 'order' ? renderOrderCard(feedItem.data) : renderRequestCard(feedItem.data)
  }

  if (loading) return <div><h2>{t('requestsOrders')}</h2><p>{t('loading')}</p></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>{t('requestsOrders')}</h2>
          <p style={{ color: '#666', margin: '0.25rem 0 0' }}>{t('subtitleOrders')}</p>
        </div>
        {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
          <button onClick={requestNotificationPermission} style={styles.notifButton}><Bell size={14} /> {t('enableAlerts')}</button>
        )}
        {notifPermission === 'granted' && (
          <span style={styles.notifOnBadge}><Bell size={12} /> {t('alertsOn')}</span>
        )}
      </div>

      <div style={styles.filterRow}>
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ ...styles.filterButton, ...(filter === f ? styles.filterButtonActive : {}) }}>
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
          {Object.entries(groupedByTable).map(([key, feedList]) => {
            const billableOrders = feedList.filter((i) => i.type === 'order' && !['cancelled', 'rejected'].includes(i.data.status))
            const groupTotal = billableOrders.reduce((sum, i) => sum + Number(i.data.total), 0)
            const isExpanded = !!expandedGroups[key]
            return (
              <div key={key} style={styles.groupCard}>
                <button onClick={() => toggleGroup(key)} style={styles.groupCardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ ...styles.chevron, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>›</span>
                    <strong>{groupLabel(key)}</strong>
                  </div>
                  <span style={styles.orderMeta}>
                    {feedList.length} item{feedList.length !== 1 ? 's' : ''} · ${groupTotal.toFixed(2)} total
                  </span>
                </button>
                {isExpanded && <div style={styles.groupCardBody}>{feedList.map((item) => renderFeedItem(item))}</div>}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={styles.list}>
          {visibleFeedItems.length === 0 && <p style={{ color: '#888' }}>{t('noOrdersHere')}</p>}
          {visibleFeedItems.map((item) => renderFeedItem(item))}
        </div>
      )}

      {cancelTarget && (
        <ConfirmationModal
          title={cancelTarget.type === 'order' ? 'Cancel this order?' : 'Decline this request?'}
          description="The customer will be notified."
          confirmLabel={cancelTarget.type === 'order' ? 'Cancel Order' : 'Decline Request'}
          onConfirm={confirmCancel}
          onCancel={() => setCancelTarget(null)}
        />
      )}

      {editingOrder && (
        <div style={styles.editOverlay} onClick={closeEditOrder}>
          <div style={styles.editModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.editHeader}>
              <h3 style={{ margin: 0 }}>{t('editOrder')}</h3>
              <button onClick={closeEditOrder} style={styles.editCloseBtn}><X size={18} /></button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={styles.editSectionTitle}>{t('currentItems')}</div>
              {(orderItems[editingOrder.id] || []).length === 0 && <p style={{ color: '#888', fontSize: '0.85rem' }}>{t('noItemsInOrder')}</p>}
              {(orderItems[editingOrder.id] || []).map((item) => (
                <div key={item.id} style={styles.editItemRow}>
                  <span>{item.quantity}× {item.menu_items?.name || 'Item'}</span>
                  <button onClick={() => handleRemoveOrderItem(item.id)} style={styles.editRemoveBtn}><X size={13} /> {t('removeItem')}</button>
                </div>
              ))}
            </div>

            <div>
              <div style={styles.editSectionTitle}>{t('addItems')}</div>
              {menuCategories.map((cat) => (
                <div key={cat.id} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.3rem' }}>{cat.name}</div>
                  {(menuItemsByCategory[cat.id] || []).map((item) => (
                    <div key={item.id} style={styles.editAddRow}>
                      <span style={{ fontSize: '0.85rem' }}>{item.name} · ${Number(item.price).toFixed(2)}</span>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <input
                          type="number" min="1"
                          value={addQuantities[item.id] ?? 1}
                          onChange={(e) => setAddQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          style={styles.editQtyInput}
                        />
                        <button onClick={() => handleAddItemToOrder(item, addQuantities[item.id] ?? 1)} style={styles.editAddBtn}><Plus size={13} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <button onClick={closeEditOrder} style={styles.editDoneBtn}>{t('saveChanges')}</button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  filterRow: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  filterButton: {
    padding: '0.5rem 1rem', borderRadius: '999px', border: '1px solid #e2e4e9',
    background: '#fff', color: '#555', cursor: 'pointer', fontSize: '0.85rem', textTransform: 'capitalize',
  },
  filterButtonActive: { background: '#4c8dff', borderColor: '#4c8dff', color: '#fff' },
  groupCard: { background: '#fff', borderRadius: '10px', border: '1px solid #e2e4e9', overflow: 'hidden' },
  groupCardHeader: {
    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.9rem 1.1rem', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.95rem', textAlign: 'left',
  },
  chevron: { display: 'inline-block', fontSize: '1.1rem', color: '#888', transition: 'transform 0.15s' },
  groupCardBody: { padding: '0 1.1rem 1.1rem', display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid #f0f0f0' },
  list: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  orderCard: { background: '#fff', borderRadius: '10px', border: '1px solid #e2e4e9', padding: '1rem' },
  orderHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' },
  typeTag: {
    display: 'inline-block', fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af',
    textTransform: 'uppercase', letterSpacing: '0.03em', marginRight: '0.5rem',
  },
  orderMeta: { color: '#888', fontSize: '0.85rem' },
  allergyAlert: {
    background: '#fef3c7', color: '#92400e', padding: '0.5rem 0.75rem',
    borderRadius: '6px', fontSize: '0.83rem', marginBottom: '0.75rem', lineHeight: 1.4,
  },
  assignedRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' },
  reassignSelect: { padding: '0.35rem 0.5rem', borderRadius: '6px', border: '1px solid #e2e4e9', fontSize: '0.8rem' },
  statusBadge: { fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: '999px', textTransform: 'capitalize' },
  itemsList: { marginBottom: '0.75rem' },
  itemRow: { padding: '0.35rem 0', borderBottom: '1px solid #f5f5f5' },
  itemLine: { display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600 },
  prepTag: { color: '#888', fontWeight: 400, fontSize: '0.75rem', textTransform: 'capitalize' },
  modLine: { color: '#666', fontSize: '0.8rem', marginTop: '0.15rem' },
  notesLine: { color: '#aaa', fontSize: '0.78rem', marginTop: '0.15rem', fontStyle: 'italic' },
  actions: { display: 'flex', gap: '0.5rem' },
  actionButton: { flex: 1, padding: '0.6rem', borderRadius: '8px', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: '0.9rem' },
  cancelButton: { padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #e2e4e9', background: '#fff', color: '#d33', cursor: 'pointer', fontSize: '0.9rem' },
  editButton: { display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.6rem 1rem', borderRadius: '8px', border: '1px solid #e2e4e9', background: '#fff', color: '#4c8dff', cursor: 'pointer', fontSize: '0.9rem' },
  editOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, padding: '1rem' },
  editModal: { background: '#fff', borderRadius: '16px', padding: '1.5rem', maxWidth: '480px', width: '100%', maxHeight: '85vh', overflowY: 'auto' },
  editHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  editCloseBtn: { background: '#f1f2f5', border: 'none', borderRadius: '50%', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  editSectionTitle: { fontSize: '0.78rem', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.03em', marginBottom: '0.5rem' },
  editItemRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.88rem' },
  editRemoveBtn: { display: 'flex', alignItems: 'center', gap: '0.25rem', background: 'transparent', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem' },
  editAddRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0' },
  editQtyInput: { width: '44px', padding: '0.25rem', borderRadius: '6px', border: '1px solid #e2e4e9', fontSize: '0.8rem', textAlign: 'center' },
  editAddBtn: { width: '28px', height: '28px', borderRadius: '6px', border: 'none', background: '#4c8dff', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  notifButton: { display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.5rem 0.9rem', borderRadius: '8px', border: 'none', background: '#4c8dff', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 },
  notifOnBadge: { display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.8rem', borderRadius: '999px', background: '#dcfce7', color: '#166534', fontSize: '0.8rem', fontWeight: 600 },
  editDoneBtn: { width: '100%', padding: '0.75rem', borderRadius: '10px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.9rem', marginTop: '1rem' },
}
