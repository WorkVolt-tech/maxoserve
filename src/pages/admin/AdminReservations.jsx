import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

const STATUS_OPTIONS = ['pending', 'confirmed', 'seated', 'completed', 'cancelled', 'no_show']

const STATUS_COLORS = {
  pending: '#ff9800',
  confirmed: '#2196f3',
  seated: '#4caf50',
  completed: '#9e9e9e',
  cancelled: '#d33',
  no_show: '#d33',
}

export default function AdminReservations() {
  const { user } = useAuth()
  const [businessId, setBusinessId] = useState(null)
  const [locations, setLocations] = useState([])
  const [tables, setTables] = useState([])
  const [reservations, setReservations] = useState([])
  const [categories, setCategories] = useState([])
  const [menuItems, setMenuItems] = useState({})
  const [modifierGroups, setModifierGroups] = useState({})
  const [orders, setOrders] = useState({}) // reservation_id -> order with items

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [partySize, setPartySize] = useState(2)
  const [reservationTime, setReservationTime] = useState('')
  const [locationId, setLocationId] = useState('')
  const [notes, setNotes] = useState('')

  const [expandedReservationId, setExpandedReservationId] = useState(null)
  const [preOrderCart, setPreOrderCart] = useState([])
  const [itemQuantities, setItemQuantities] = useState({}) // item_id -> qty being selected

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadInitial()
  }, [])

  async function loadInitial() {
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

    const { data: locationsData } = await supabase
      .from('locations')
      .select('*')
      .eq('business_id', membership.business_id)
    setLocations(locationsData || [])
    if (locationsData && locationsData.length > 0) setLocationId(locationsData[0].id)

    const { data: tablesData } = await supabase
      .from('tables')
      .select('*')
      .eq('business_id', membership.business_id)
    setTables(tablesData || [])

    const { data: catsData } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('business_id', membership.business_id)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    setCategories(catsData || [])

    if (catsData && catsData.length > 0) {
      const catIds = catsData.map((c) => c.id)
      const { data: itemsData } = await supabase
        .from('menu_items')
        .select('*')
        .in('category_id', catIds)
        .eq('is_available', true)

      const itemsByCategory = {}
      for (const item of itemsData || []) {
        if (!itemsByCategory[item.category_id]) itemsByCategory[item.category_id] = []
        itemsByCategory[item.category_id].push(item)
      }
      setMenuItems(itemsByCategory)

      if (itemsData && itemsData.length > 0) {
        const itemIds = itemsData.map((i) => i.id)
        const { data: linksData } = await supabase
          .from('menu_item_modifier_groups')
          .select('*, modifier_groups(*)')
          .in('menu_item_id', itemIds)

        if (linksData && linksData.length > 0) {
          const groupIds = [...new Set(linksData.map((l) => l.modifier_group_id))]
          const { data: optionsData } = await supabase
            .from('modifier_options')
            .select('*')
            .in('modifier_group_id', groupIds)

          const optionsByGroup = {}
          for (const opt of optionsData || []) {
            if (!optionsByGroup[opt.modifier_group_id]) optionsByGroup[opt.modifier_group_id] = []
            optionsByGroup[opt.modifier_group_id].push(opt)
          }

          const groupsByItem = {}
          for (const link of linksData) {
            if (!groupsByItem[link.menu_item_id]) groupsByItem[link.menu_item_id] = []
            groupsByItem[link.menu_item_id].push({
              ...link.modifier_groups,
              options: optionsByGroup[link.modifier_group_id] || [],
            })
          }
          setModifierGroups(groupsByItem)
        }
      }
    }

    await loadReservations(membership.business_id)
    setLoading(false)
  }

  async function loadReservations(bizId) {
    const { data, error: resError } = await supabase
      .from('reservations')
      .select('*')
      .eq('business_id', bizId)
      .order('reservation_time', { ascending: true })

    if (resError) {
      setError(resError.message)
      return
    }
    setReservations(data)

    if (data.length > 0) {
      const resIds = data.map((r) => r.id)
      const { data: ordersData } = await supabase
        .from('orders')
        .select('*')
        .in('reservation_id', resIds)

      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map((o) => o.id)
        const { data: itemsData } = await supabase
          .from('order_items')
          .select('*, menu_items(*)')
          .in('order_id', orderIds)

        const itemsByOrder = {}
        for (const item of itemsData || []) {
          if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
          itemsByOrder[item.order_id].push(item)
        }

        const byReservation = {}
        for (const o of ordersData) {
          byReservation[o.reservation_id] = { ...o, items: itemsByOrder[o.id] || [] }
        }
        setOrders(byReservation)
      }
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')

    if (!locationId) {
      setError('Select a location.')
      return
    }

    const { error: insertError } = await supabase.from('reservations').insert({
      business_id: businessId,
      location_id: locationId,
      customer_name: name,
      customer_phone: phone || null,
      customer_email: email || null,
      party_size: parseInt(partySize) || 1,
      reservation_time: reservationTime,
      notes: notes || null,
      created_by: user.id,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    setName('')
    setPhone('')
    setEmail('')
    setPartySize(2)
    setReservationTime('')
    setNotes('')
    loadReservations(businessId)
  }

  async function handleStatusChange(reservation, newStatus) {
    await supabase.from('reservations').update({ status: newStatus }).eq('id', reservation.id)
    loadReservations(businessId)
  }

  async function handleAssignTable(reservation, tableId) {
    await supabase.from('reservations').update({ table_id: tableId || null }).eq('id', reservation.id)
    loadReservations(businessId)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this reservation?')) return
    await supabase.from('reservations').delete().eq('id', id)
    loadReservations(businessId)
  }

  function addToPreOrderCart(item, quantity) {
    const qty = parseInt(quantity) || 1
    setPreOrderCart((prev) => {
      const existing = prev.find((line) => line.item.id === item.id)
      if (existing) {
        return prev.map((line) =>
          line.item.id === item.id ? { ...line, quantity: line.quantity + qty } : line
        )
      }
      return [...prev, { tempId: `${item.id}-${Date.now()}`, item, quantity: qty, options: [] }]
    })
  }

  function updateCartLineQuantity(tempId, quantity) {
    const qty = Math.max(1, parseInt(quantity) || 1)
    setPreOrderCart((prev) =>
      prev.map((line) => (line.tempId === tempId ? { ...line, quantity: qty } : line))
    )
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

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        business_id: businessId,
        reservation_id: reservation.id,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        subtotal,
        tax: 0,
        total: subtotal,
        created_by: user.id,
      })
      .select()
      .single()

    if (orderError || !order) {
      setError(orderError?.message || 'Could not save pre-order.')
      return
    }

    for (const line of preOrderCart) {
      await supabase.from('order_items').insert({
        business_id: businessId,
        order_id: order.id,
        menu_item_id: line.item.id,
        quantity: line.quantity,
        unit_price: line.item.price,
      })
    }

    setPreOrderCart([])
    setExpandedReservationId(null)
    loadReservations(businessId)
  }

  if (loading) return <div><h2>Reservations</h2><p>Loading...</p></div>

  return (
    <div>
      <h2>Reservations</h2>
      <p style={{ color: '#666' }}>
        Take table and bottle reservations over the phone. Assign a table and build a pre-order for arrival.
      </p>

      <form onSubmit={handleCreate} style={styles.form}>
        <input
          type="text"
          placeholder="Customer name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={styles.input}
        />
        <input
          type="tel"
          placeholder="Phone (optional)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={styles.input}
        />
        <input
          type="email"
          placeholder="Email (optional)"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />
        <input
          type="number"
          min="1"
          placeholder="Party size"
          value={partySize}
          onChange={(e) => setPartySize(e.target.value)}
          style={{ ...styles.input, flex: '0 1 100px' }}
        />
        <input
          type="datetime-local"
          value={reservationTime}
          onChange={(e) => setReservationTime(e.target.value)}
          required
          style={styles.input}
        />
        <select value={locationId} onChange={(e) => setLocationId(e.target.value)} style={styles.select}>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>
        <textarea
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={styles.textarea}
        />
        <button type="submit" style={styles.button}>Create Reservation</button>
      </form>

      {error && <p style={{ color: '#d33' }}>{error}</p>}

      <div style={styles.list}>
        {reservations.length === 0 && <p style={{ color: '#888' }}>No reservations yet.</p>}
        {reservations.map((r) => {
          const isExpanded = expandedReservationId === r.id
          const existingOrder = orders[r.id]
          const tablesForLocation = tables.filter((t) => t.location_id === r.location_id)

          return (
            <div key={r.id} style={styles.card}>
              <div style={styles.cardTop}>
                <div>
                  <strong>{r.customer_name}</strong>
                  <span style={styles.meta}> · party of {r.party_size}</span>
                  <span style={styles.meta}> · {new Date(r.reservation_time).toLocaleString()}</span>
                  {r.customer_phone && <span style={styles.meta}> · {r.customer_phone}</span>}
                  {r.notes && <p style={styles.notes}>{r.notes}</p>}
                  {existingOrder && (
                    <p style={styles.preOrderSummary}>
                      Pre-order: {existingOrder.items.length} item(s) · ${Number(existingOrder.total).toFixed(2)}
                    </p>
                  )}
                </div>
                <span
                  style={{
                    ...styles.statusBadge,
                    background: (STATUS_COLORS[r.status] || '#999') + '22',
                    color: STATUS_COLORS[r.status] || '#666',
                  }}
                >
                  {r.status.replace('_', ' ')}
                </span>
              </div>

              <div style={styles.controlsRow}>
                <select
                  value={r.status}
                  onChange={(e) => handleStatusChange(r, e.target.value)}
                  style={styles.smallSelect}
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>

                <select
                  value={r.table_id || ''}
                  onChange={(e) => handleAssignTable(r, e.target.value)}
                  style={styles.smallSelect}
                >
                  <option value="">No table assigned</option>
                  {tablesForLocation.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>

                <button
                  onClick={() => {
                    setExpandedReservationId(isExpanded ? null : r.id)
                    setPreOrderCart([])
                  }}
                  style={styles.toggleButton}
                >
                  {isExpanded ? 'Close' : existingOrder ? 'Add More' : 'Build Pre-Order'}
                </button>
                <button onClick={() => handleDelete(r.id)} style={styles.deleteButton}>
                  Delete
                </button>
              </div>

              {isExpanded && (
                <div style={styles.preOrderBox}>
                  {categories.map((cat) => (
                    <div key={cat.id} style={styles.categoryBlock}>
                      <div style={styles.categoryTitle}>{cat.name}</div>
                      {(menuItems[cat.id] || []).map((item) => (
                        <div key={item.id} style={styles.menuItemRow}>
                          <span>{item.name} · ${Number(item.price).toFixed(2)}</span>
                          <div style={styles.qtyAddRow}>
                            <input
                              type="number"
                              min="1"
                              value={itemQuantities[item.id] ?? 1}
                              onChange={(e) =>
                                setItemQuantities((prev) => ({ ...prev, [item.id]: e.target.value }))
                              }
                              style={styles.qtyInput}
                            />
                            <button
                              onClick={() => addToPreOrderCart(item, itemQuantities[item.id] ?? 1)}
                              style={styles.addButton}
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}

                  {preOrderCart.length > 0 && (
                    <div style={styles.cartPreview}>
                      <div style={styles.cartTitle}>New items to add:</div>
                     {preOrderCart.map((line) => (
                        <div key={line.tempId} style={styles.cartLine}>
                          <span>{line.item.name}</span>
                          <div style={styles.cartLineControls}>
                            <input
                              type="number"
                              min="1"
                              value={line.quantity}
                              onChange={(e) => updateCartLineQuantity(line.tempId, e.target.value)}
                              style={styles.qtyInput}
                            />
                            <button onClick={() => removeFromPreOrderCart(line.tempId)} style={styles.removeButton}>
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                      <div style={styles.cartTotal}>Total: ${preOrderTotal().toFixed(2)}</div>
                      <button onClick={() => handleSavePreOrder(r)} style={styles.saveButton}>
                        Save Pre-Order
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const styles = {
  form: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
  },
  input: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    fontSize: '0.95rem',
    flex: '1 1 160px',
  },
  select: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    fontSize: '0.95rem',
  },
  textarea: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    fontSize: '0.95rem',
    width: '100%',
    minHeight: '50px',
    fontFamily: 'system-ui, sans-serif',
  },
  button: {
    padding: '0.6rem 1.2rem',
    borderRadius: '8px',
    border: 'none',
    background: '#4c8dff',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.95rem',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  card: {
    background: '#fff',
    padding: '1rem',
    borderRadius: '10px',
    border: '1px solid #e2e4e9',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginBottom: '0.6rem',
  },
  meta: { color: '#888', fontSize: '0.85rem', marginLeft: '0.3rem' },
  notes: { color: '#666', fontSize: '0.85rem', margin: '0.3rem 0 0' },
  preOrderSummary: { color: '#4c8dff', fontSize: '0.85rem', margin: '0.3rem 0 0', fontWeight: 600 },
  statusBadge: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.25rem 0.6rem',
    borderRadius: '999px',
    textTransform: 'capitalize',
  },
  controlsRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  smallSelect: {
    padding: '0.4rem',
    borderRadius: '6px',
    border: '1px solid #e2e4e9',
    fontSize: '0.85rem',
  },
  toggleButton: {
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid #4c8dff',
    background: '#fff',
    color: '#4c8dff',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  deleteButton: {
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid #e2e4e9',
    background: '#fff',
    color: '#d33',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  preOrderBox: {
    marginTop: '0.75rem',
    paddingTop: '0.75rem',
    borderTop: '1px solid #e2e4e9',
  },
  categoryBlock: { marginBottom: '0.75rem' },
  categoryTitle: { fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.3rem' },
  menuItemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.3rem 0',
    fontSize: '0.85rem',
  },
  addButton: {
    padding: '0.25rem 0.6rem',
    borderRadius: '6px',
    border: '1px solid #4c8dff',
    background: '#fff',
    color: '#4c8dff',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  qtyAddRow: { display: 'flex', gap: '0.4rem', alignItems: 'center' },
  qtyInput: {
    width: '44px',
    padding: '0.25rem',
    borderRadius: '6px',
    border: '1px solid #e2e4e9',
    fontSize: '0.8rem',
    textAlign: 'center',
  },
  cartLineControls: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  cartPreview: {
    background: '#f9fafb',
    borderRadius: '8px',
    padding: '0.75rem',
    marginTop: '0.5rem',
  },
  cartTitle: { fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem' },
  cartLine: { display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', padding: '0.15rem 0' },
  removeButton: { border: 'none', background: 'transparent', color: '#d33', cursor: 'pointer', fontSize: '1rem' },
  cartTotal: { fontWeight: 700, fontSize: '0.9rem', marginTop: '0.5rem' },
  saveButton: {
    marginTop: '0.5rem',
    width: '100%',
    padding: '0.6rem',
    borderRadius: '8px',
    border: 'none',
    background: '#4caf50',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
}
