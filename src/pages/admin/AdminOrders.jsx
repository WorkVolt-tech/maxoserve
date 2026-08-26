import { useEffect, useState, useRef } from 'react'
import { Bell } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { logActivity } from '../../lib/activityLog'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrentLocation } from '../../contexts/LocationContext'
import { useCurrentBusiness } from '../../contexts/BusinessContext'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import { useToast } from '../../contexts/ToastContext'
import ConfirmationModal from '../../components/ui/ConfirmationModal'
import { Pencil, Plus, X } from 'lucide-react'

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
  const { currentBusinessId } = useCurrentBusiness()
  const { t } = useAppLanguage()
  const { showToast } = useToast()
  const businessId = currentBusinessId
  const [orders, setOrders] = useState([])
  const [cancelTarget, setCancelTarget] = useState(null)
  const [orderItems, setOrderItems] = useState({})
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

  function toggleGroup(key) {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  useEffect(() => {
    if (currentBusinessId) init()
  }, [currentBusinessId])

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

    const { data: tablesData } = await supabase
      .from('tables')
      .select('*')
      .eq('business_id', currentBusinessId)

    const tablesMap = {}
    for (const t of tablesData || []) tablesMap[t.id] = t
    setTables(tablesMap)

    const { data: reservationsData } = await supabase
      .from('reservations')
      .select('*')
      .eq('business_id', currentBusinessId)

    const reservationsMap = {}
    for (const r of reservationsData || []) reservationsMap[r.id] = r
    setReservations(reservationsMap)

    const { data: catsData } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('business_id', currentBusinessId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    setMenuCategories(catsData || [])

    if (catsData && catsData.length > 0) {
      const catIds = catsData.map((c) => c.id)
      const { data: itemsData } = await supabase
        .from('menu_items')
        .select('*')
        .in('category_id', catIds)
        .eq('is_available', true)
      const byCategory = {}
      for (const item of itemsData || []) {
        if (!byCategory[item.category_id]) byCategory[item.category_id] = []
        byCategory[item.category_id].push(item)
      }
      setMenuItemsByCategory(byCategory)
    }

    await loadOrders(currentBusinessId)
    setLoading(false)
  }

  async function loadOrders(bizId) {
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('business_id', bizId)
      .neq('status', 'draft')
      .order('created_at', { ascending: false })

    const fresh = ordersData || []

    if (!isFirstOrderLoad.current) {
      const newSubmitted = fresh.filter((o) => o.status === 'submitted' && !knownOrderIds.current.has(o.id))
      for (const o of newSubmitted) notifyNewOrder(o)
    }

    knownOrderIds.current = new Set(fresh.map((o) => o.id))
    isFirstOrderLoad.current = false

    setOrders(fresh)

    if (fresh.length === 0) {
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

  function notifyNewOrder(order) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
    const table = tables[order.table_id]
    new Notification('MaxoServe', {
      body: `${t('newOrderAlert')} ${table?.name || 'Unassigned'} · $${Number(order.total).toFixed(2)}`,
    })
    if (navigator.vibrate) navigator.vibrate([200, 100, 200])
  }

  function requestNotificationPermission() {
    if (typeof Notification === 'undefined') return
    Notification.requestPermission().then(setNotifPermission)
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

  function openEditOrder(order) {
    setEditingOrder(order)
    setAddQuantities({})
  }

  async function handleAddItemToOrder(item, quantity) {
    if (!editingOrder) return
    const qty = parseInt(quantity) || 1

    const { error } = await supabase.from('order_items').insert({
      business_id: businessId,
      order_id: editingOrder.id,
      menu_item_id: item.id,
      quantity: qty,
      unit_price: item.price,
    })

    if (error) {
      showToast(`Could not add item: ${error.message}`, 'error')
      return
    }

    logActivity(businessId, user.id, `added ${qty}× "${item.name}" to an order`)
    await recalculateOrderTotal(editingOrder.id)
    await loadOrders(businessId)
    setAddQuantities((prev) => ({ ...prev, [item.id]: '' }))
  }

  async function handleRemoveOrderItem(orderItemId) {
    const removedItem = (orderItems[editingOrder?.id] || []).find((i) => i.id === orderItemId)
    const { error } = await supabase.from('order_items').delete().eq('id', orderItemId)
    if (error) {
      showToast(`Could not remove item: ${error.message}`, 'error')
      return
    }
    logActivity(businessId, user.id, `removed "${removedItem?.menu_items?.name || 'an item'}" from an order`)
    if (editingOrder) await recalculateOrderTotal(editingOrder.id)
    await loadOrders(businessId)
  }

  async function recalculateOrderTotal(orderId) {
    const { data: items } = await supabase
      .from('order_items')
      .select('quantity, unit_price')
      .eq('order_id', orderId)

    const subtotal = (items || []).reduce((sum, i) => sum + Number(i.unit_price) * i.quantity, 0)

    const { data: orderRow } = await supabase.from('orders').select('tax, subtotal, total').eq('id', orderId).single()
    // Preserve the existing tax rate proportionally if one was applied originally.
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

        {order.allergy_notes && (
          <div style={styles.allergyAlert}>
            <strong>⚠ {t('allergyBadge')}:</strong> {order.allergy_notes}
          </div>
        )}

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
            <button onClick={() => openEditOrder(order)} style={styles.editButton}>
              <Pencil size={14} /> {t('editOrder')}
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0 }}>{t('orders')}</h2>
          <p style={{ color: '#666', margin: '0.25rem 0 0' }}>{t('subtitleOrders')}</p>
        </div>
        {notifPermission !== 'granted' && notifPermission !== 'unsupported' && (
          <button onClick={requestNotificationPermission} style={styles.notifButton}>
            <Bell size={14} /> {t('enableAlerts')}
          </button>
        )}
        {notifPermission === 'granted' && (
          <span style={styles.notifOnBadge}>
            <Bell size={12} /> {t('alertsOn')}
          </span>
        )}
      </div>

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

      {editingOrder && (
        <div style={styles.editOverlay} onClick={closeEditOrder}>
          <div style={styles.editModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.editHeader}>
              <h3 style={{ margin: 0 }}>{t('editOrder')}</h3>
              <button onClick={closeEditOrder} style={styles.editCloseBtn}><X size={18} /></button>
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={styles.editSectionTitle}>{t('currentItems')}</div>
              {(orderItems[editingOrder.id] || []).length === 0 && (
                <p style={{ color: '#888', fontSize: '0.85rem' }}>{t('noItemsInOrder')}</p>
              )}
              {(orderItems[editingOrder.id] || []).map((item) => (
                <div key={item.id} style={styles.editItemRow}>
                  <span>{item.quantity}× {item.menu_items?.name || 'Item'}</span>
                  <button onClick={() => handleRemoveOrderItem(item.id)} style={styles.editRemoveBtn}>
                    <X size={13} /> {t('removeItem')}
                  </button>
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
                        <button onClick={() => handleAddItemToOrder(item, addQuantities[item.id] ?? 1)} style={styles.editAddBtn}>
                          <Plus size={13} />
                        </button>
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
  allergyAlert: {
    background: '#fef3c7', color: '#92400e', padding: '0.5rem 0.75rem',
    borderRadius: '6px', fontSize: '0.83rem', marginBottom: '0.75rem', lineHeight: 1.4,
  },
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
  editButton: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.6rem 1rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    background: '#fff',
    color: '#4c8dff',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  editOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, padding: '1rem',
  },
  editModal: {
    background: '#fff', borderRadius: '16px', padding: '1.5rem',
    maxWidth: '480px', width: '100%', maxHeight: '85vh', overflowY: 'auto',
  },
  editHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem',
  },
  editCloseBtn: {
    background: '#f1f2f5', border: 'none', borderRadius: '50%',
    width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  editSectionTitle: {
    fontSize: '0.78rem', fontWeight: 700, color: '#888', textTransform: 'uppercase',
    letterSpacing: '0.03em', marginBottom: '0.5rem',
  },
  editItemRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0.5rem 0', borderBottom: '1px solid #f5f5f5', fontSize: '0.88rem',
  },
  editRemoveBtn: {
    display: 'flex', alignItems: 'center', gap: '0.25rem',
    background: 'transparent', border: 'none', color: '#dc2626',
    cursor: 'pointer', fontSize: '0.8rem',
  },
  editAddRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0',
  },
  editQtyInput: {
    width: '44px', padding: '0.25rem', borderRadius: '6px', border: '1px solid #e2e4e9',
    fontSize: '0.8rem', textAlign: 'center',
  },
  editAddBtn: {
    width: '28px', height: '28px', borderRadius: '6px', border: 'none',
    background: '#4c8dff', color: '#fff', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  notifButton: {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.5rem 0.9rem', borderRadius: '8px', border: 'none',
    background: '#4c8dff', color: '#fff', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
  },
  notifOnBadge: {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    padding: '0.45rem 0.8rem', borderRadius: '999px', background: '#dcfce7', color: '#166534',
    fontSize: '0.8rem', fontWeight: 600,
  },
  editDoneBtn: {
    width: '100%', padding: '0.75rem', borderRadius: '10px', border: 'none',
    background: '#16a34a', color: '#fff', fontWeight: 700, cursor: 'pointer',
    fontSize: '0.9rem', marginTop: '1rem',
  },
}
