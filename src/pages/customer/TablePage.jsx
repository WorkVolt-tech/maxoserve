import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

const STATUS_LABELS = {
  pending: 'Request sent',
  accepted: 'Accepted',
  on_the_way: 'On the way',
  completed: 'Completed',
  rejected: 'Unable to assist',
  cancelled: 'Cancelled',
}

const ORDER_STATUS_LABELS = {
  draft: 'Draft',
  submitted: 'Order sent',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'On the way',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
}

export default function TablePage() {
  const { token } = useParams()
  const [status, setStatus] = useState('loading')
  const [business, setBusiness] = useState(null)
  const [table, setTable] = useState(null)
  const [area, setArea] = useState(null)
  const [session, setSession] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [taxRate, setTaxRate] = useState(0)

  const [requestTypes, setRequestTypes] = useState([])
  const [myRequests, setMyRequests] = useState([])
  const [sendingTypeId, setSendingTypeId] = useState(null)
  const [requestError, setRequestError] = useState('')

  const [activeTab, setActiveTab] = useState('service') // 'service' | 'menu'
  const [categories, setCategories] = useState([])
  const [menuItems, setMenuItems] = useState({})
  const [modifierGroups, setModifierGroups] = useState({})
  const [expandedItemId, setExpandedItemId] = useState(null)
  const [selectedOptions, setSelectedOptions] = useState({}) // group_id -> [option_id]
  const [expandedQty, setExpandedQty] = useState(1)
  const [expandedNotes, setExpandedNotes] = useState('')

  const [cart, setCart] = useState([]) // [{ tempId, item, quantity, options: [optionObj], notes }]
  const [cartOpen, setCartOpen] = useState(false)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [orderError, setOrderError] = useState('')

  const [myOrders, setMyOrders] = useState([])

  useEffect(() => {
    initSession()
  }, [token])

  useEffect(() => {
    if (!session) return

    loadRequestTypes(session.business_id)
    loadMyRequests(session.id)
    loadMenu(session.business_id)
    loadTaxRate(session.business_id)
    loadMyOrders(session.id)

    const requestsChannel = supabase
      .channel(`session-requests-${session.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `session_id=eq.${session.id}` },
        () => loadMyRequests(session.id)
      )
      .subscribe()

    const ordersChannel = supabase
      .channel(`session-orders-${session.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `session_id=eq.${session.id}` },
        () => loadMyOrders(session.id)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(requestsChannel)
      supabase.removeChannel(ordersChannel)
    }
  }, [session])

  async function initSession() {
    setStatus('loading')

    const { data: qrToken, error: qrError } = await supabase
      .from('table_qr_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single()

    if (qrError || !qrToken) {
      setStatus('invalid')
      return
    }

    const { data: tableData, error: tableError } = await supabase
      .from('tables')
      .select('*')
      .eq('id', qrToken.table_id)
      .single()

    if (tableError || !tableData) {
      setStatus('invalid')
      return
    }
    setTable(tableData)

    const { data: areaData } = await supabase
      .from('areas')
      .select('*')
      .eq('id', tableData.area_id)
      .single()
    setArea(areaData)

    const { data: businessData } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', qrToken.business_id)
      .single()
    setBusiness(businessData)

    const storageKey = `maxoserve_session_${tableData.id}`
    const existingSessionId = localStorage.getItem(storageKey)

    if (existingSessionId) {
      const { data: existingSession } = await supabase
        .from('table_sessions')
        .select('*')
        .eq('id', existingSessionId)
        .eq('status', 'active')
        .single()

      if (existingSession) {
        setSession(existingSession)
        await supabase
          .from('table_sessions')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', existingSession.id)
        setStatus('ready')
        return
      }
    }

    const { data: newSession, error: sessionError } = await supabase
      .from('table_sessions')
      .insert({ business_id: qrToken.business_id, table_id: tableData.id, qr_token_id: qrToken.id })
      .select()
      .single()

    if (sessionError || !newSession) {
      setStatus('error')
      setErrorMessage(sessionError?.message || 'Could not start a session.')
      return
    }

    localStorage.setItem(storageKey, newSession.id)
    setSession(newSession)
    setStatus('ready')
  }

  async function loadRequestTypes(businessId) {
    const { data } = await supabase
      .from('service_request_types')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    setRequestTypes(data || [])
  }

  async function loadMyRequests(sessionId) {
    const { data } = await supabase
      .from('service_requests')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })
    setMyRequests(data || [])
  }

  async function loadTaxRate(businessId) {
    const { data } = await supabase
      .from('business_settings')
      .select('tax_rate')
      .eq('business_id', businessId)
      .single()
    setTaxRate(data?.tax_rate ? Number(data.tax_rate) : 0)
  }

  async function loadMyOrders(sessionId) {
    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('session_id', sessionId)
      .neq('status', 'draft')
      .order('created_at', { ascending: false })

    if (!ordersData || ordersData.length === 0) {
      setMyOrders([])
      return
    }

    const orderIds = ordersData.map((o) => o.id)
    const { data: itemsData } = await supabase
      .from('order_items')
      .select('*')
      .in('order_id', orderIds)

    const itemsByOrder = {}
    for (const item of itemsData || []) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
      itemsByOrder[item.order_id].push(item)
    }

    setMyOrders(ordersData.map((o) => ({ ...o, items: itemsByOrder[o.id] || [] })))
  }

  async function loadMenu(businessId) {
    const { data: catsData } = await supabase
      .from('menu_categories')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('display_order', { ascending: true })

    setCategories(catsData || [])
    if (!catsData || catsData.length === 0) return

    const catIds = catsData.map((c) => c.id)
    const { data: itemsData } = await supabase
      .from('menu_items')
      .select('*')
      .in('category_id', catIds)
      .eq('is_available', true)
      .order('display_order', { ascending: true })

    const itemsByCategory = {}
    for (const item of itemsData || []) {
      if (!itemsByCategory[item.category_id]) itemsByCategory[item.category_id] = []
      itemsByCategory[item.category_id].push(item)
    }
    setMenuItems(itemsByCategory)
    if (!itemsData || itemsData.length === 0) return

    const itemIds = itemsData.map((i) => i.id)
    const { data: linksData } = await supabase
      .from('menu_item_modifier_groups')
      .select('*, modifier_groups(*)')
      .in('menu_item_id', itemIds)

    if (!linksData || linksData.length === 0) return

    const groupIds = [...new Set(linksData.map((l) => l.modifier_group_id))]
    const { data: optionsData } = await supabase
      .from('modifier_options')
      .select('*')
      .in('modifier_group_id', groupIds)
      .eq('is_available', true)
      .order('display_order', { ascending: true })

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

  function activeRequestForType(typeId) {
    return myRequests.find(
      (r) => r.request_type_id === typeId && ['pending', 'accepted', 'on_the_way'].includes(r.status)
    )
  }

  async function handleRequest(type) {
    setRequestError('')
    const existing = activeRequestForType(type.id)
    if (existing) {
      setRequestError('You already have an active request for this.')
      return
    }
    setSendingTypeId(type.id)
    const { error: insertError } = await supabase.from('service_requests').insert({
      business_id: session.business_id,
      table_id: session.table_id,
      session_id: session.id,
      request_type_id: type.id,
    })
    setSendingTypeId(null)
    if (insertError) {
      setRequestError('You already have an active request for this.')
      return
    }
    loadMyRequests(session.id)
  }

  function openItemConfig(item) {
    setExpandedItemId(item.id)
    setSelectedOptions({})
    setExpandedQty(1)
    setExpandedNotes('')
  }

  function toggleOption(group, option) {
    setSelectedOptions((prev) => {
      const current = prev[group.id] || []
      if (group.selection_type === 'single') {
        return { ...prev, [group.id]: [option.id] }
      }
      const exists = current.includes(option.id)
      return {
        ...prev,
        [group.id]: exists ? current.filter((id) => id !== option.id) : [...current, option.id],
      }
    })
  }

  function expandedLineTotal(item) {
    const groups = modifierGroups[item.id] || []
    let optionsTotal = 0
    for (const group of groups) {
      const chosenIds = selectedOptions[group.id] || []
      for (const opt of group.options) {
        if (chosenIds.includes(opt.id)) optionsTotal += Number(opt.price_delta)
      }
    }
    return (Number(item.price) + optionsTotal) * expandedQty
  }

  function handleAddToCart(item) {
    const groups = modifierGroups[item.id] || []
    for (const group of groups) {
      if (group.is_required && (!selectedOptions[group.id] || selectedOptions[group.id].length === 0)) {
        setOrderError(`Please select an option for "${group.name}".`)
        return
      }
    }
    setOrderError('')

    const chosenOptions = []
    for (const group of groups) {
      const chosenIds = selectedOptions[group.id] || []
      for (const opt of group.options) {
        if (chosenIds.includes(opt.id)) chosenOptions.push(opt)
      }
    }

    setCart((prev) => [
      ...prev,
      {
        tempId: `${item.id}-${Date.now()}`,
        item,
        quantity: expandedQty,
        options: chosenOptions,
        notes: expandedNotes,
      },
    ])

    setExpandedItemId(null)
    setCartOpen(true)
  }

  function removeFromCart(tempId) {
    setCart((prev) => prev.filter((c) => c.tempId !== tempId))
  }

  function cartLineTotal(line) {
    const optionsTotal = line.options.reduce((sum, o) => sum + Number(o.price_delta), 0)
    return (Number(line.item.price) + optionsTotal) * line.quantity
  }

  const cartSubtotal = cart.reduce((sum, line) => sum + cartLineTotal(line), 0)
  const cartTax = cartSubtotal * (taxRate || 0)
  const cartTotal = cartSubtotal + cartTax

  async function handlePlaceOrder() {
    setOrderError('')

    if (cart.length === 0) return

    if (cartTotal >= 100) {
      const confirmed = window.confirm(
        `Your order total is $${cartTotal.toFixed(2)}. Confirm order?`
      )
      if (!confirmed) return
    }

    setPlacingOrder(true)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        business_id: session.business_id,
        table_id: session.table_id,
        session_id: session.id,
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        subtotal: cartSubtotal,
        tax: cartTax,
        total: cartTotal,
      })
      .select()
      .single()

    if (orderError || !order) {
      setOrderError(orderError?.message || 'Could not place order.')
      setPlacingOrder(false)
      return
    }

    for (const line of cart) {
      const { data: orderItem, error: itemError } = await supabase
        .from('order_items')
        .insert({
          business_id: session.business_id,
          order_id: order.id,
          menu_item_id: line.item.id,
          quantity: line.quantity,
          unit_price: line.item.price,
          notes: line.notes || null,
        })
        .select()
        .single()

      if (itemError || !orderItem) continue

      for (const opt of line.options) {
        await supabase.from('order_item_modifiers').insert({
          business_id: session.business_id,
          order_item_id: orderItem.id,
          modifier_option_id: opt.id,
          price_delta: opt.price_delta,
        })
      }
    }

    setCart([])
    setCartOpen(false)
    setPlacingOrder(false)
    loadMyOrders(session.id)
  }

  if (status === 'loading') {
    return (
      <div style={styles.page}>
        <p style={styles.loadingText}>Loading...</p>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2>This QR code is no longer active</h2>
          <p style={{ color: '#666' }}>Please ask a staff member for a new code, or check with the venue.</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2>Something went wrong</h2>
          <p style={{ color: '#666' }}>{errorMessage}</p>
        </div>
      </div>
    )
  }

  const activeRequests = myRequests.filter((r) => ['pending', 'accepted', 'on_the_way'].includes(r.status))

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {business?.logo_url && <img src={business.logo_url} alt={business.name} style={styles.logo} />}
        <h1 style={styles.businessName}>{business?.name || 'Welcome'}</h1>
        {area && <p style={styles.areaName}>{area.name}</p>}
        <div style={styles.tableBadge}>{table?.name}</div>

        {activeRequests.length > 0 && (
          <div style={styles.activeRequestsBox}>
            {activeRequests.map((r) => {
              const type = requestTypes.find((t) => t.id === r.request_type_id)
              return (
                <div key={r.id} style={styles.activeRequestRow}>
                  <span>{type?.label || 'Request'}</span>
                  <span style={styles.statusPill}>{STATUS_LABELS[r.status]}</span>
                </div>
              )
            })}
          </div>
        )}

        {myOrders.length > 0 && (
          <div style={styles.myOrdersBox}>
            {myOrders.map((o) => (
              <div key={o.id} style={styles.myOrderRow}>
                <span>Order · {o.items.length} item{o.items.length !== 1 ? 's' : ''} · ${Number(o.total).toFixed(2)}</span>
                <span style={styles.statusPill}>{ORDER_STATUS_LABELS[o.status]}</span>
              </div>
            ))}
          </div>
        )}

        <div style={styles.tabRow}>
          <button
            onClick={() => setActiveTab('service')}
            style={{ ...styles.tabButton, ...(activeTab === 'service' ? styles.tabButtonActive : {}) }}
          >
            Service
          </button>
          <button
            onClick={() => setActiveTab('menu')}
            style={{ ...styles.tabButton, ...(activeTab === 'menu' ? styles.tabButtonActive : {}) }}
          >
            Menu {cart.length > 0 && `(${cart.length})`}
          </button>
        </div>

        {activeTab === 'service' && (
          <>
            {requestError && <p style={styles.requestError}>{requestError}</p>}
            <div style={styles.buttonGrid}>
              {requestTypes.length === 0 && (
                <p style={{ color: '#888', gridColumn: '1 / -1' }}>No service buttons have been set up yet.</p>
              )}
              {requestTypes.map((type) => {
                const isActive = !!activeRequestForType(type.id)
                return (
                  <button
                    key={type.id}
                    onClick={() => handleRequest(type)}
                    disabled={isActive || sendingTypeId === type.id}
                    style={{ ...styles.requestButton, ...(isActive ? styles.requestButtonActive : {}) }}
                  >
                    {sendingTypeId === type.id ? '...' : type.label}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {activeTab === 'menu' && (
          <div style={styles.menuWrap}>
            {orderError && <p style={styles.requestError}>{orderError}</p>}
            {categories.length === 0 && <p style={{ color: '#888' }}>The menu isn't available yet.</p>}
            {categories.map((cat) => (
              <div key={cat.id} style={styles.categoryBlock}>
                <h3 style={styles.categoryTitle}>{cat.name}</h3>
                {(menuItems[cat.id] || []).length === 0 && (
                  <p style={{ color: '#aaa', fontSize: '0.85rem' }}>No items available.</p>
                )}
                {(menuItems[cat.id] || []).map((item) => {
                  const isExpanded = expandedItemId === item.id
                  const groups = modifierGroups[item.id] || []
                  return (
                    <div key={item.id} style={styles.menuItemRow}>
                      <div
                        style={styles.menuItemHeader}
                        onClick={() => (isExpanded ? setExpandedItemId(null) : openItemConfig(item))}
                      >
                        <div style={{ textAlign: 'left' }}>
                          <div style={styles.menuItemName}>{item.name}</div>
                          {item.description && <div style={styles.menuItemDesc}>{item.description}</div>}
                        </div>
                        <div style={styles.menuItemPrice}>${Number(item.price).toFixed(2)}</div>
                      </div>

                      {isExpanded && (
                        <div style={styles.configBox}>
                          {groups.map((group) => (
                            <div key={group.id} style={styles.modifierGroupPreview}>
                              <div style={styles.modifierGroupName}>
                                {group.name}
                                {group.is_required && <span style={styles.requiredTag}> (required)</span>}
                              </div>
                              <div style={styles.optionChoices}>
                                {group.options.map((opt) => {
                                  const chosen = (selectedOptions[group.id] || []).includes(opt.id)
                                  return (
                                    <button
                                      key={opt.id}
                                      onClick={() => toggleOption(group, opt)}
                                      style={{
                                        ...styles.optionChoice,
                                        ...(chosen ? styles.optionChoiceActive : {}),
                                      }}
                                    >
                                      {opt.name}
                                      {opt.price_delta > 0 && ` +$${Number(opt.price_delta).toFixed(2)}`}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}

                          <textarea
                            placeholder="Special instructions (optional)"
                            value={expandedNotes}
                            onChange={(e) => setExpandedNotes(e.target.value)}
                            style={styles.notesInput}
                          />

                          <div style={styles.qtyRow}>
                            <button
                              onClick={() => setExpandedQty((q) => Math.max(1, q - 1))}
                              style={styles.qtyButton}
                            >
                              −
                            </button>
                            <span style={styles.qtyValue}>{expandedQty}</span>
                            <button onClick={() => setExpandedQty((q) => q + 1)} style={styles.qtyButton}>
                              +
                            </button>
                            <button onClick={() => handleAddToCart(item)} style={styles.addToCartButton}>
                              Add · ${expandedLineTotal(item).toFixed(2)}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {cart.length > 0 && !cartOpen && (
        <button onClick={() => setCartOpen(true)} style={styles.floatingCartButton}>
          View Cart · {cart.length} item{cart.length !== 1 ? 's' : ''} · ${cartTotal.toFixed(2)}
        </button>
      )}

      {cartOpen && (
        <div style={styles.cartOverlay} onClick={() => setCartOpen(false)}>
          <div style={styles.cartDrawer} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Your Order</h3>

            {cart.length === 0 ? (
              <p style={{ color: '#888' }}>Your cart is empty.</p>
            ) : (
              <>
                <div style={styles.cartList}>
                  {cart.map((line) => (
                    <div key={line.tempId} style={styles.cartLine}>
                      <div>
                        <div style={styles.cartLineName}>
                          {line.quantity}× {line.item.name}
                        </div>
                        {line.options.length > 0 && (
                          <div style={styles.cartLineOptions}>
                            {line.options.map((o) => o.name).join(', ')}
                          </div>
                        )}
                        {line.notes && <div style={styles.cartLineNotes}>"{line.notes}"</div>}
                      </div>
                      <div style={styles.cartLineRight}>
                        <span>${cartLineTotal(line).toFixed(2)}</span>
                        <button onClick={() => removeFromCart(line.tempId)} style={styles.removeButton}>
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={styles.cartTotals}>
                  <div style={styles.cartTotalRow}>
                    <span>Subtotal</span>
                    <span>${cartSubtotal.toFixed(2)}</span>
                  </div>
                  <div style={styles.cartTotalRow}>
                    <span>Tax</span>
                    <span>${cartTax.toFixed(2)}</span>
                  </div>
                  <div style={{ ...styles.cartTotalRow, fontWeight: 700 }}>
                    <span>Total</span>
                    <span>${cartTotal.toFixed(2)}</span>
                  </div>
                </div>

                {orderError && <p style={styles.requestError}>{orderError}</p>}

                <button onClick={handlePlaceOrder} disabled={placingOrder} style={styles.placeOrderButton}>
                  {placingOrder ? 'Placing Order...' : 'Place Order'}
                </button>
              </>
            )}

            <button onClick={() => setCartOpen(false)} style={styles.closeCartButton}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: '#12161c',
    fontFamily: 'system-ui, sans-serif',
    padding: '1rem',
  },
  loadingText: { color: '#fff' },
  card: {
    background: '#fff',
    borderRadius: '16px',
    padding: '2rem',
    width: '100%',
    maxWidth: '460px',
    textAlign: 'center',
    marginTop: '2rem',
    marginBottom: '5rem',
  },
  logo: { maxWidth: '120px', maxHeight: '80px', marginBottom: '1rem' },
  businessName: { margin: '0 0 0.25rem', fontSize: '1.6rem' },
  areaName: { margin: '0 0 1rem', color: '#888', fontSize: '0.95rem' },
  tableBadge: {
    display: 'inline-block',
    background: '#4c8dff',
    color: '#fff',
    padding: '0.5rem 1.25rem',
    borderRadius: '999px',
    fontWeight: 600,
    fontSize: '1.1rem',
    marginBottom: '1.5rem',
  },
  activeRequestsBox: {
    background: '#eef4ff',
    border: '1px solid #cfe0ff',
    borderRadius: '10px',
    padding: '0.75rem 1rem',
    marginBottom: '0.75rem',
    textAlign: 'left',
  },
  activeRequestRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.35rem 0',
    fontSize: '0.9rem',
  },
  myOrdersBox: {
    background: '#fff8ee',
    border: '1px solid #ffe0b2',
    borderRadius: '10px',
    padding: '0.75rem 1rem',
    marginBottom: '1rem',
    textAlign: 'left',
  },
  myOrderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.35rem 0',
    fontSize: '0.9rem',
  },
  statusPill: {
    background: '#4c8dff',
    color: '#fff',
    padding: '0.15rem 0.6rem',
    borderRadius: '999px',
    fontSize: '0.75rem',
    fontWeight: 600,
  },
  tabRow: {
    display: 'flex',
    border: '1px solid #e2e4e9',
    borderRadius: '10px',
    overflow: 'hidden',
    marginBottom: '1.25rem',
  },
  tabButton: {
    flex: 1,
    padding: '0.6rem',
    border: 'none',
    background: '#fff',
    color: '#555',
    cursor: 'pointer',
    fontSize: '0.95rem',
    fontWeight: 600,
  },
  tabButtonActive: { background: '#4c8dff', color: '#fff' },
  requestError: { color: '#d33', fontSize: '0.85rem', marginBottom: '0.75rem' },
  buttonGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' },
  requestButton: {
    padding: '1rem 0.5rem',
    borderRadius: '12px',
    border: '2px solid #4c8dff',
    background: '#fff',
    color: '#4c8dff',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  requestButtonActive: { background: '#e8f5e9', borderColor: '#4caf50', color: '#2e7d32', cursor: 'default' },
  menuWrap: { textAlign: 'left' },
  categoryBlock: { marginBottom: '1.5rem' },
  categoryTitle: { fontSize: '1.05rem', borderBottom: '2px solid #f0f0f0', paddingBottom: '0.4rem', marginBottom: '0.5rem' },
  menuItemRow: { borderBottom: '1px solid #f5f5f5', padding: '0.6rem 0' },
  menuItemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', cursor: 'pointer', gap: '0.75rem' },
  menuItemName: { fontWeight: 600, fontSize: '0.95rem' },
  menuItemDesc: { color: '#888', fontSize: '0.8rem', marginTop: '0.15rem' },
  menuItemPrice: { color: '#4c8dff', fontWeight: 700, whiteSpace: 'nowrap' },
  configBox: { marginTop: '0.6rem', background: '#f9fafb', borderRadius: '8px', padding: '0.75rem' },
  modifierGroupPreview: { marginBottom: '0.6rem' },
  modifierGroupName: { fontSize: '0.8rem', fontWeight: 600, color: '#555', marginBottom: '0.35rem' },
  requiredTag: { color: '#d33', fontWeight: 400 },
  optionChoices: { display: 'flex', flexWrap: 'wrap', gap: '0.4rem' },
  optionChoice: {
    background: '#fff',
    border: '1px solid #e2e4e9',
    borderRadius: '999px',
    padding: '0.35rem 0.7rem',
    fontSize: '0.8rem',
    color: '#555',
    cursor: 'pointer',
  },
  optionChoiceActive: { background: '#4c8dff', borderColor: '#4c8dff', color: '#fff' },
  notesInput: {
    width: '100%',
    marginTop: '0.5rem',
    padding: '0.5rem',
    borderRadius: '6px',
    border: '1px solid #e2e4e9',
    fontSize: '0.85rem',
    fontFamily: 'system-ui, sans-serif',
    minHeight: '40px',
  },
  qtyRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.6rem' },
  qtyButton: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '1.1rem',
  },
  qtyValue: { minWidth: '20px', textAlign: 'center', fontWeight: 600 },
  addToCartButton: {
    marginLeft: 'auto',
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    border: 'none',
    background: '#4c8dff',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  floatingCartButton: {
    position: 'fixed',
    bottom: '1rem',
    left: '1rem',
    right: '1rem',
    maxWidth: '420px',
    margin: '0 auto',
    padding: '1rem',
    borderRadius: '12px',
    border: 'none',
    background: '#4c8dff',
    color: '#fff',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
  },
  cartOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
    zIndex: 1000,
  },
  cartDrawer: {
    background: '#fff',
    borderRadius: '16px 16px 0 0',
    padding: '1.5rem',
    width: '100%',
    maxWidth: '460px',
    maxHeight: '80vh',
    overflowY: 'auto',
    textAlign: 'left',
  },
  cartList: { display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' },
  cartLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f5f5f5', paddingBottom: '0.6rem' },
  cartLineName: { fontWeight: 600, fontSize: '0.9rem' },
  cartLineOptions: { color: '#888', fontSize: '0.8rem', marginTop: '0.15rem' },
  cartLineNotes: { color: '#aaa', fontSize: '0.78rem', marginTop: '0.15rem', fontStyle: 'italic' },
  cartLineRight: { display: 'flex', alignItems: 'center', gap: '0.5rem', whiteSpace: 'nowrap' },
  removeButton: { border: 'none', background: 'transparent', color: '#d33', fontSize: '1.1rem', cursor: 'pointer' },
  cartTotals: { borderTop: '1px solid #e2e4e9', paddingTop: '0.75rem', marginBottom: '1rem' },
  cartTotalRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '0.2rem 0' },
  placeOrderButton: {
    width: '100%',
    padding: '0.9rem',
    borderRadius: '10px',
    border: 'none',
    background: '#4caf50',
    color: '#fff',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
  },
  closeCartButton: {
    width: '100%',
    padding: '0.6rem',
    marginTop: '0.5rem',
    borderRadius: '10px',
    border: 'none',
    background: 'transparent',
    color: '#888',
    cursor: 'pointer',
  },
}
