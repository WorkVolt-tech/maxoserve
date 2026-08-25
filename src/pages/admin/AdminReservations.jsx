import { useEffect, useState } from 'react'
import { CalendarCheck, Plus, Trash2, ShoppingBag } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrentLocation } from '../../contexts/LocationContext'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import { useToast } from '../../contexts/ToastContext'
import ConfirmationModal from '../../components/ui/ConfirmationModal'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'
import StatusBadge from '../../components/ui/StatusBadge'

const STATUS_OPTIONS = ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show']

const STATUS_OPTION_KEYS = {
  pending: 'resStatusPending',
  confirmed: 'resStatusConfirmed',
  seated: 'resStatusSeated',
  completed: 'resStatusCompleted',
  cancelled: 'resStatusCancelled',
  no_show: 'resStatusNoShow',
}

export default function AdminReservations() {
  const { user } = useAuth()
  const { currentLocationId } = useCurrentLocation()
  const { t } = useAppLanguage()
  const { showToast } = useToast()
  const [businessId, setBusinessId] = useState(null)
  const [tables, setTables] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [reservations, setReservations] = useState([])
  const [categories, setCategories] = useState([])
  const [menuItems, setMenuItems] = useState({})
  const [orders, setOrders] = useState({})

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [reservationTime, setReservationTime] = useState('')
  const [notes, setNotes] = useState('')
  const [eventId, setEventId] = useState('')
  const [events, setEvents] = useState([])

  const [expandedReservationId, setExpandedReservationId] = useState(null)
  const [preOrderCart, setPreOrderCart] = useState([])
  const [itemQuantities, setItemQuantities] = useState({})

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadInitial() }, [])

  useEffect(() => {
    if (!businessId) return
    const channel = supabase
      .channel(`reservation-orders-${businessId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `business_id=eq.${businessId}` }, () => loadReservations(businessId))
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [businessId])

  async function loadInitial() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
    if (!membership) { setLoading(false); return }
    setBusinessId(membership.business_id)

    const { data: tablesData } = await supabase.from('tables').select('*').eq('business_id', membership.business_id)
    setTables(tablesData || [])

    const { data: eventsData } = await supabase
      .from('events').select('*').eq('business_id', membership.business_id).eq('is_active', true).order('starts_at', { ascending: false })
    setEvents(eventsData || [])

    const { data: catsData } = await supabase
      .from('menu_categories').select('*').eq('business_id', membership.business_id).eq('is_active', true).order('display_order', { ascending: true })
    setCategories(catsData || [])

    if (catsData && catsData.length > 0) {
      const catIds = catsData.map((c) => c.id)
      const { data: itemsData } = await supabase.from('menu_items').select('*').in('category_id', catIds).eq('is_available', true)
      const itemsByCategory = {}
      for (const item of itemsData || []) {
        if (!itemsByCategory[item.category_id]) itemsByCategory[item.category_id] = []
        itemsByCategory[item.category_id].push(item)
      }
      setMenuItems(itemsByCategory)
    }

    await loadReservations(membership.business_id)
    setLoading(false)
  }

  async function loadReservations(bizId) {
    const { data, error: resError } = await supabase
      .from('reservations').select('*').eq('business_id', bizId).order('reservation_time', { ascending: true })
    if (resError) { setError(resError.message); return }
    setReservations(data)

    if (data.length > 0) {
      const resIds = data.map((r) => r.id)
      const { data: ordersData } = await supabase.from('orders').select('*').in('reservation_id', resIds)
      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map((o) => o.id)
        const { data: itemsData } = await supabase.from('order_items').select('*, menu_items(*)').in('order_id', orderIds)
        const itemsByOrder = {}
        for (const item of itemsData || []) {
          if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
          itemsByOrder[item.order_id].push(item)
        }
        const byReservation = {}
        for (const o of ordersData) byReservation[o.reservation_id] = { ...o, items: itemsByOrder[o.id] || [] }
        setOrders(byReservation)
      } else {
        setOrders({})
      }
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    if (!currentLocationId) { setError('Select a location.'); return }

    const { error: insertError } = await supabase.from('reservations').insert({
      business_id: businessId, location_id: currentLocationId, event_id: eventId || null,
      customer_name: name, customer_phone: phone || null, customer_email: email || null,
      party_size: parseInt(partySize) || 1, reservation_time: reservationTime, notes: notes || null, created_by: user.id,
    })

    if (insertError) { setError(insertError.message); return }
    setName(''); setPhone(''); setEmail(''); setPartySize(2); setReservationTime(''); setNotes(''); setEventId('')
    loadReservations(businessId)
  }

  async function handleStatusChange(reservation, newStatus) {
    const { error: resError } = await supabase.from('reservations').update({ status: newStatus }).eq('id', reservation.id)
    if (resError) { setError(`Failed to update reservation status: ${resError.message}`); return }

    if (reservation.table_id) {
      let tableUpdateError = null
      if (newStatus === 'seated') {
        const { error } = await supabase.from('tables').update({ status: 'occupied' }).eq('id', reservation.table_id)
        tableUpdateError = error
      } else if (['completed', 'cancelled', 'no_show'].includes(newStatus)) {
        const { error } = await supabase.from('tables').update({ status: 'available' }).eq('id', reservation.table_id)
        tableUpdateError = error
      }
      if (tableUpdateError) setError(`Reservation updated, but failed to update table status: ${tableUpdateError.message}`)
    }
    loadReservations(businessId)
  }

  async function handleAssignTable(reservation, tableId) {
    await supabase.from('reservations').update({ table_id: tableId || null }).eq('id', reservation.id)
    loadReservations(businessId)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const { error: deleteError } = await supabase.from('reservations').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    if (deleteError) {
      showToast(`Could not delete: ${deleteError.message}`, 'error')
      return
    }
    showToast('Reservation deleted')
    loadReservations(businessId)
  }

  function addToPreOrderCart(item, quantity) {
    const qty = parseInt(quantity) || 1
    setPreOrderCart((prev) => {
      const existing = prev.find((line) => line.item.id === item.id)
      if (existing) return prev.map((line) => (line.item.id === item.id ? { ...line, quantity: line.quantity + qty } : line))
      return [...prev, { tempId: `${item.id}-${Date.now()}`, item, quantity: qty, options: [] }]
    })
  }

  function updateCartLineQuantity(tempId, quantity) {
    const qty = Math.max(1, parseInt(quantity) || 1)
    setPreOrderCart((prev) => prev.map((line) => (line.tempId === tempId ? { ...line, quantity: qty } : line)))
  }

  function removeFromPreOrderCart(tempId) {
    setPreOrderCart((prev) => prev.filter((c) => c.tempId !== tempId))
  }

  function preOrderTotal() {
    return preOrderCart.reduce((sum, line) => {
      const optionsTotal = line.options.reduce((s, o) => s + Number(o.price_delta), 0)
      return sum + (Number(line.item.price) + optionsTotal) * line.quantity
    }, 0)
  }

  async function handleSavePreOrder(reservation) {
    if (preOrderCart.length === 0) return
    const subtotal = preOrderTotal()

    const { data: order, error: orderError } = await supabase.from('orders').insert({
      business_id: businessId, reservation_id: reservation.id, status: 'submitted',
      submitted_at: new Date().toISOString(), subtotal, tax: 0, total: subtotal, created_by: user.id,
    }).select().single()

    if (orderError || !order) { setError(orderError?.message || 'Could not save pre-order.'); return }

    for (const line of preOrderCart) {
      const { error: lineError } = await supabase.from('order_items').insert({
        business_id: businessId, order_id: order.id, menu_item_id: line.item.id, quantity: line.quantity, unit_price: line.item.price,
      })
      if (lineError) setError(`Failed to save "${line.item.name}": ${lineError.message}`)
    }

    setPreOrderCart([])
    setExpandedReservationId(null)
    loadReservations(businessId)
  }

  if (loading) return <LoadingState label={t('loading')} />

  const visibleReservations = reservations.filter((r) => r.location_id === currentLocationId)

  return (
    <div>
      <PageHeader title={t('reservations')} subtitle={t('subtitleReservations')} />

      <Card style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 160px' }}>
            <Input placeholder={t('phCustomerName')} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div style={{ flex: '1 1 140px' }}>
            <Input type="tel" placeholder={t('phPhone')} value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 160px' }}>
            <Input type="email" placeholder={t('phEmail')} value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div style={{ flex: '0 1 100px' }}>
            <Input type="number" min="1" placeholder={t('phPartySize')} value={partySize} onChange={(e) => setPartySize(e.target.value)} />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <Input type="datetime-local" value={reservationTime} onChange={(e) => setReservationTime(e.target.value)} required />
          </div>
          <select value={eventId} onChange={(e) => setEventId(e.target.value)} style={styles.select}>
            <option value="">{t('noEventRegular')}</option>
            {events.map((ev) => <option key={ev.id} value={ev.id}>{ev.name}</option>)}
          </select>
          <textarea placeholder={t('notesOptional')} value={notes} onChange={(e) => setNotes(e.target.value)} style={styles.textarea} />
          <Button type="submit" icon={Plus}>{t('add')}</Button>
        </form>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>}
      </Card>

      {visibleReservations.length === 0 ? (
        <EmptyState icon={CalendarCheck} title={t('noReservationsHere')} description="" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {visibleReservations.map((r) => {
            const isExpanded = expandedReservationId === r.id
            const existingOrder = orders[r.id]
            const tablesForLocation = tables.filter((t) => t.location_id === r.location_id)

            return (
              <Card key={r.id} padding="1.1rem">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                  <div>
                    <strong>{r.customer_name}</strong>
                    <span style={styles.meta}> · {t('partyOf')} {r.party_size}</span>
                    <span style={styles.meta}> · {new Date(r.reservation_time).toLocaleString()}</span>
                    {r.customer_phone && <span style={styles.meta}> · {r.customer_phone}</span>}
                    {r.notes && <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0.3rem 0 0' }}>{r.notes}</p>}
                    {existingOrder && (
                      <p style={{ color: 'var(--color-primary)', fontSize: '0.85rem', margin: '0.3rem 0 0', fontWeight: 600 }}>
                        {t('preOrderLabel')} {existingOrder.items.reduce((sum, i) => sum + i.quantity, 0)} {t('items')} · ${Number(existingOrder.total).toFixed(2)}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={r.status} />
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select value={r.status} onChange={(e) => handleStatusChange(r, e.target.value)} style={styles.smallSelect}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{t(STATUS_OPTION_KEYS[s])}</option>)}
                  </select>
                  <select value={r.table_id || ''} onChange={(e) => handleAssignTable(r, e.target.value)} style={styles.smallSelect}>
                    <option value="">{t('noTableAssigned')}</option>
                    {tablesForLocation.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  <Button
                    variant="secondary" size="sm" icon={ShoppingBag}
                    onClick={() => { setExpandedReservationId(isExpanded ? null : r.id); setPreOrderCart([]) }}
                  >
                    {isExpanded ? t('cancel') : existingOrder ? t('addMore') : t('buildPreOrder')}
                  </Button>
                  <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleteTarget(r)}>{t('delete')}</Button>
                </div>

                {isExpanded && (
                  <div style={{ marginTop: '0.9rem', paddingTop: '0.9rem', borderTop: '1px solid var(--color-border)' }}>
                    {categories.map((cat) => (
                      <div key={cat.id} style={{ marginBottom: '0.75rem' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.3rem' }}>{cat.name}</div>
                        {(menuItems[cat.id] || []).map((item) => (
                          <div key={item.id} style={styles.menuItemRow}>
                            <span>{item.name} · ${Number(item.price).toFixed(2)}</span>
                            <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                              <input
                                type="number" min="1" value={itemQuantities[item.id] ?? 1}
                                onChange={(e) => setItemQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                style={styles.qtyInput}
                              />
                              <Button variant="secondary" size="sm" onClick={() => addToPreOrderCart(item, itemQuantities[item.id] ?? 1)}>+ {t('add')}</Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}

                    {preOrderCart.length > 0 && (
                      <div style={styles.cartPreview}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' }}>{t('newItemsToAdd')}</div>
                        {preOrderCart.map((line) => (
                          <div key={line.tempId} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.15rem 0' }}>
                            <span>{line.item.name}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <input type="number" min="1" value={line.quantity} onChange={(e) => updateCartLineQuantity(line.tempId, e.target.value)} style={styles.qtyInput} />
                              <button onClick={() => removeFromPreOrderCart(line.tempId)} style={styles.removeBtn}>×</button>
                            </div>
                          </div>
                        ))}
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', marginTop: '0.5rem' }}>{t('totalLabel')} ${preOrderTotal().toFixed(2)}</div>
                        <Button onClick={() => handleSavePreOrder(r)} style={{ marginTop: '0.5rem', width: '100%' }}>{t('save')}</Button>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {deleteTarget && (
        <ConfirmationModal
          title={`Delete reservation for "${deleteTarget.customer_name}"?`}
          description="This can't be undone."
          confirmLabel={t('delete')}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

const styles = {
  select: { padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--color-border)', fontSize: '0.9rem' },
  smallSelect: { padding: '0.45rem', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--color-border)', fontSize: '0.85rem' },
  textarea: { padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--color-border)', fontSize: '0.9rem', width: '100%', minHeight: '45px', fontFamily: 'inherit' },
  meta: { color: 'var(--color-text-muted)', fontSize: '0.85rem' },
  menuItemRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.3rem 0', fontSize: '0.85rem' },
  qtyInput: { width: '44px', padding: '0.25rem', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '0.8rem', textAlign: 'center' },
  cartPreview: { background: 'var(--color-bg)', borderRadius: 'var(--radius-sm)', padding: '0.75rem', marginTop: '0.5rem' },
  removeBtn: { border: 'none', background: 'transparent', color: 'var(--color-danger)', fontSize: '1rem', cursor: 'pointer' },
}
