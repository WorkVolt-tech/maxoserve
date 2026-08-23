import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Bell, Wine, IceCreamCone, GlassWater, Receipt, Users,
  AlertTriangle, UtensilsCrossed, ShoppingBag, Check, Clock,
  Plus, Minus, X, ChevronRight, Languages,
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { LanguageProvider, useLanguage } from '../../contexts/LanguageContext'

const ORDER_STEPS = ['submitted', 'accepted', 'preparing', 'ready', 'delivered']

function iconForLabel(label = '') {
  const l = label.toLowerCase()
  if (l.includes('bottle')) return Wine
  if (l.includes('ice')) return IceCreamCone
  if (l.includes('water') || l.includes('cup')) return GlassWater
  if (l.includes('bill')) return Receipt
  if (l.includes('hostess')) return Users
  if (l.includes('problem')) return AlertTriangle
  return Bell
}

function statusKey(status) {
  const map = {
    pending: 'requestSent',
    accepted: 'accepted',
    on_the_way: 'onTheWay',
    completed: 'completed',
    rejected: 'unableToAssist',
    cancelled: 'cancelled',
  }
  return map[status] || status
}

function greetingKey() {
  const h = new Date().getHours()
  if (h < 12) return 'goodMorning'
  if (h < 18) return 'goodAfternoon'
  return 'goodEvening'
}

function localizedLabel(item, lang) {
  if (!item) return ''
  return lang === 'fr' && item.label_fr ? item.label_fr : item.label
}

export default function TablePage() {
  return (
    <LanguageProvider defaultLang="en">
      <TablePageInner />
    </LanguageProvider>
  )
}

function TablePageInner() {
  const { token } = useParams()
  const { t, lang, setLang } = useLanguage()
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

  const [activeTab, setActiveTab] = useState('service')

  const [categories, setCategories] = useState([])
  const [menuItems, setMenuItems] = useState({})
  const [modifierGroups, setModifierGroups] = useState({})
  const [activeCategoryId, setActiveCategoryId] = useState(null)

  const [configItem, setConfigItem] = useState(null)
  const [selectedOptions, setSelectedOptions] = useState({})
  const [configQty, setConfigQty] = useState(1)
  const [configNotes, setConfigNotes] = useState('')

  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [placingOrder, setPlacingOrder] = useState(false)
  const [orderError, setOrderError] = useState('')

  const [myOrders, setMyOrders] = useState([])

  useEffect(() => { initSession() }, [token])

  useEffect(() => {
    if (!session) return
    loadRequestTypes(session.business_id)
    loadMyRequests(session.id)
    loadMenu(session.business_id)
    loadTaxRate(session.business_id)
    loadMyOrders(session.id)

    const requestsChannel = supabase
      .channel(`session-requests-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests', filter: `session_id=eq.${session.id}` }, () => loadMyRequests(session.id))
      .subscribe()

    const ordersChannel = supabase
      .channel(`session-orders-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `session_id=eq.${session.id}` }, () => loadMyOrders(session.id))
      .subscribe()

    return () => {
      supabase.removeChannel(requestsChannel)
      supabase.removeChannel(ordersChannel)
    }
  }, [session])

  async function initSession() {
    setStatus('loading')
    const { data: qrToken, error: qrError } = await supabase
      .from('table_qr_tokens').select('*').eq('token', token).eq('is_active', true).single()
    if (qrError || !qrToken) { setStatus('invalid'); return }

    const { data: tableData, error: tableError } = await supabase.from('tables').select('*').eq('id', qrToken.table_id).single()
    if (tableError || !tableData) { setStatus('invalid'); return }
    setTable(tableData)

    const { data: areaData } = await supabase.from('areas').select('*').eq('id', tableData.area_id).single()
    setArea(areaData)

    const { data: businessData } = await supabase.from('businesses').select('*').eq('id', qrToken.business_id).single()
    setBusiness(businessData)

    const storageKey = `maxoserve_session_${tableData.id}`
    const existingSessionId = localStorage.getItem(storageKey)

    if (existingSessionId) {
      const { data: existingSession } = await supabase
        .from('table_sessions').select('*').eq('id', existingSessionId).eq('status', 'active').single()
      if (existingSession) {
        setSession(existingSession)
        await supabase.from('table_sessions').update({ last_activity_at: new Date().toISOString() }).eq('id', existingSession.id)
        setStatus('ready')
        return
      }
    }

    const { data: newSession, error: sessionError } = await supabase
      .from('table_sessions')
      .insert({ business_id: qrToken.business_id, table_id: tableData.id, qr_token_id: qrToken.id })
      .select().single()

    if (sessionError || !newSession) { setStatus('error'); setErrorMessage(sessionError?.message || 'Could not start a session.'); return }

    localStorage.setItem(storageKey, newSession.id)
    setSession(newSession)
    setStatus('ready')
  }

  async function loadRequestTypes(businessId) {
    const { data } = await supabase.from('service_request_types').select('*').eq('business_id', businessId).eq('is_active', true).order('display_order', { ascending: true })
    setRequestTypes(data || [])
  }

  async function loadMyRequests(sessionId) {
    const { data } = await supabase.from('service_requests').select('*').eq('session_id', sessionId).order('created_at', { ascending: false })
    setMyRequests(data || [])
  }

  async function loadTaxRate(businessId) {
    const { data } = await supabase.from('business_settings').select('tax_rate').eq('business_id', businessId).single()
    setTaxRate(data?.tax_rate ? Number(data.tax_rate) : 0)
  }

  async function loadMyOrders(sessionId) {
    const { data: ordersData } = await supabase.from('orders').select('*').eq('session_id', sessionId).neq('status', 'draft').order('created_at', { ascending: false })
    if (!ordersData || ordersData.length === 0) { setMyOrders([]); return }
    const orderIds = ordersData.map((o) => o.id)
    const { data: itemsData } = await supabase.from('order_items').select('*, menu_items(*)').in('order_id', orderIds)
    const itemsByOrder = {}
    for (const item of itemsData || []) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = []
      itemsByOrder[item.order_id].push(item)
    }
    setMyOrders(ordersData.map((o) => ({ ...o, items: itemsByOrder[o.id] || [] })))
  }

  async function loadMenu(businessId) {
    const { data: catsData } = await supabase.from('menu_categories').select('*').eq('business_id', businessId).eq('is_active', true).order('display_order', { ascending: true })
    setCategories(catsData || [])
    if (catsData && catsData.length > 0) setActiveCategoryId(catsData[0].id)
    if (!catsData || catsData.length === 0) return

    const catIds = catsData.map((c) => c.id)
    const { data: itemsData } = await supabase.from('menu_items').select('*').in('category_id', catIds).eq('is_available', true).order('display_order', { ascending: true })
    const itemsByCategory = {}
    for (const item of itemsData || []) {
      if (!itemsByCategory[item.category_id]) itemsByCategory[item.category_id] = []
      itemsByCategory[item.category_id].push(item)
    }
    setMenuItems(itemsByCategory)
    if (!itemsData || itemsData.length === 0) return

    const itemIds = itemsData.map((i) => i.id)
    const { data: linksData } = await supabase.from('menu_item_modifier_groups').select('*, modifier_groups(*)').in('menu_item_id', itemIds)
    if (!linksData || linksData.length === 0) return

    const groupIds = [...new Set(linksData.map((l) => l.modifier_group_id))]
    const { data: optionsData } = await supabase.from('modifier_options').select('*').in('modifier_group_id', groupIds).eq('is_available', true).order('display_order', { ascending: true })
    const optionsByGroup = {}
    for (const opt of optionsData || []) {
      if (!optionsByGroup[opt.modifier_group_id]) optionsByGroup[opt.modifier_group_id] = []
      optionsByGroup[opt.modifier_group_id].push(opt)
    }
    const groupsByItem = {}
    for (const link of linksData) {
      if (!groupsByItem[link.menu_item_id]) groupsByItem[link.menu_item_id] = []
      groupsByItem[link.menu_item_id].push({ ...link.modifier_groups, options: optionsByGroup[link.modifier_group_id] || [] })
    }
    setModifierGroups(groupsByItem)
  }

  function activeRequestForType(typeId) {
    return myRequests.find((r) => r.request_type_id === typeId && ['pending', 'accepted', 'on_the_way'].includes(r.status))
  }

  async function handleRequest(type) {
    setRequestError('')
    if (activeRequestForType(type.id)) { setRequestError(t('alreadyActiveRequest')); return }
    setSendingTypeId(type.id)
    const { error: insertError } = await supabase.from('service_requests').insert({
      business_id: session.business_id, table_id: session.table_id, session_id: session.id, request_type_id: type.id,
    })
    setSendingTypeId(null)
    if (insertError) { setRequestError(t('alreadyActiveRequest')); return }
    loadMyRequests(session.id)
  }

  function openItemConfig(item) {
    setConfigItem(item)
    setSelectedOptions({})
    setConfigQty(1)
    setConfigNotes('')
  }

  function toggleOption(group, option) {
    setSelectedOptions((prev) => {
      const current = prev[group.id] || []
      if (group.selection_type === 'single') {
        const isSelected = current.includes(option.id)
        return { ...prev, [group.id]: isSelected ? [] : [option.id] }
      }
      const exists = current.includes(option.id)
      return { ...prev, [group.id]: exists ? current.filter((id) => id !== option.id) : [...current, option.id] }
    })
  }

  function configLineTotal() {
    if (!configItem) return 0
    const groups = modifierGroups[configItem.id] || []
    let optionsTotal = 0
    for (const group of groups) {
      const chosenIds = selectedOptions[group.id] || []
      for (const opt of group.options) {
        if (chosenIds.includes(opt.id)) optionsTotal += Number(opt.price_delta)
      }
    }
    return (Number(configItem.price) + optionsTotal) * configQty
  }

  function handleAddToCart() {
    const groups = modifierGroups[configItem.id] || []
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

    setCart((prev) => [...prev, { tempId: `${configItem.id}-${Date.now()}`, item: configItem, quantity: configQty, options: chosenOptions, notes: configNotes }])
    setConfigItem(null)
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
      const confirmed = window.confirm(`${t('confirmOrderPrefix')} $${cartTotal.toFixed(2)}${t('confirmOrderSuffix')}`)
      if (!confirmed) return
    }

    setPlacingOrder(true)
    const { data: order, error: orderErr } = await supabase.from('orders').insert({
      business_id: session.business_id, table_id: session.table_id, session_id: session.id,
      status: 'submitted', submitted_at: new Date().toISOString(),
      subtotal: cartSubtotal, tax: cartTax, total: cartTotal,
    }).select().single()

    if (orderErr || !order) { setOrderError(orderErr?.message || 'Could not place order.'); setPlacingOrder(false); return }

    for (const line of cart) {
      const { data: orderItem } = await supabase.from('order_items').insert({
        business_id: session.business_id, order_id: order.id, menu_item_id: line.item.id,
        quantity: line.quantity, unit_price: line.item.price, notes: line.notes || null,
      }).select().single()

      if (orderItem) {
        for (const opt of line.options) {
          await supabase.from('order_item_modifiers').insert({
            business_id: session.business_id, order_item_id: orderItem.id, modifier_option_id: opt.id, price_delta: opt.price_delta,
          })
        }
      }
    }

    setCart([])
    setCartOpen(false)
    setPlacingOrder(false)
    setActiveTab('orders')
    loadMyOrders(session.id)
  }

  if (status === 'loading') {
    return <div style={styles.page}><div style={styles.loadingWrap}><span style={styles.spinner} /></div></div>
  }

  if (status === 'invalid') {
    return (
      <div style={styles.page}>
        <div style={styles.messageCard}>
          <AlertTriangle size={28} color="var(--color-warning)" />
          <h2 style={{ margin: '0.75rem 0 0.3rem' }}>{t('qrInactiveTitle')}</h2>
          <p style={{ color: '#666', margin: 0 }}>{t('qrInactiveBody')}</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={styles.page}>
        <div style={styles.messageCard}>
          <h2 style={{ margin: '0 0 0.3rem' }}>{t('somethingWrong')}</h2>
          <p style={{ color: '#666', margin: 0 }}>{errorMessage}</p>
        </div>
      </div>
    )
  }

  const activeRequests = myRequests.filter((r) => ['pending', 'accepted', 'on_the_way'].includes(r.status))
  const configGroups = configItem ? (modifierGroups[configItem.id] || []) : []

  return (
    <div style={styles.page}>
      <div style={styles.venueHeader}>
        <button onClick={() => setLang(lang === 'en' ? 'fr' : 'en')} style={styles.langSwitcher}>
          <Languages size={13} /> {lang === 'en' ? 'FR' : 'EN'}
        </button>
        {business?.logo_url && <img src={business.logo_url} alt={business.name} style={styles.logo} />}
        <h1 style={styles.venueName}>{business?.name || t('welcome')}</h1>
        <div style={styles.tableInfoRow}>
          {area && <span>{area.name}</span>}
          {area && <span style={styles.dot}>•</span>}
          <span style={styles.tableBadge}>{table?.name}</span>
        </div>
        <p style={styles.greetingText}>{t(greetingKey())} 👋 {t('howCanWeHelp')}</p>
      </div>

      <div style={styles.content}>
        {activeTab === 'service' && (
          <>
            {activeRequests.length > 0 && (
              <div style={styles.activeSection}>
                {activeRequests.map((r) => {
                  const type = requestTypes.find((rt) => rt.id === r.request_type_id)
                  const Icon = iconForLabel(type?.label)
                  return (
                    <div key={r.id} style={styles.activeCard}>
                      <div style={styles.activeCardLeft}>
                        <Icon size={17} color="var(--color-primary)" />
                        <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{localizedLabel(type, lang) || 'Request'}</span>
                      </div>
                      <span style={styles.activePill}><Clock size={12} /> {t(statusKey(r.status))}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {requestError && <p style={styles.errorText}>{requestError}</p>}

            <div style={styles.serviceGrid}>
              {requestTypes.length === 0 && <p style={{ color: '#888', gridColumn: '1 / -1', textAlign: 'center' }}>{t('noServiceButtons')}</p>}
              {requestTypes.map((type) => {
                const isActive = !!activeRequestForType(type.id)
                const Icon = iconForLabel(type.label)
                const isSending = sendingTypeId === type.id
                return (
                  <button
                    key={type.id}
                    onClick={() => handleRequest(type)}
                    disabled={isActive || isSending}
                    style={{ ...styles.serviceCard, ...(isActive ? styles.serviceCardActive : {}) }}
                  >
                    {isActive ? <Check size={24} color="var(--color-success)" /> : <Icon size={24} color="var(--color-primary)" />}
                    <span style={styles.serviceCardLabel}>{isSending ? '…' : localizedLabel(type, lang)}</span>
                    {isActive && <span style={styles.serviceCardStatus}>{t(statusKey(activeRequestForType(type.id).status))}</span>}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {activeTab === 'menu' && (
          <div>
            {categories.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center' }}>{t('menuNotAvailable')}</p>
            ) : (
              <>
                <div style={styles.categoryTabs}>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategoryId(cat.id)}
                      style={{ ...styles.categoryTab, ...(activeCategoryId === cat.id ? styles.categoryTabActive : {}) }}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>

                <div style={styles.menuItemList}>
                  {(menuItems[activeCategoryId] || []).length === 0 && (
                    <p style={{ color: '#aaa', textAlign: 'center', fontSize: '0.9rem' }}>{t('noItemsInCategory')}</p>
                  )}
                  {(menuItems[activeCategoryId] || []).map((item) => (
                    <button key={item.id} onClick={() => openItemConfig(item)} style={styles.menuItemCard}>
                      <div style={{ textAlign: 'left' }}>
                        <div style={styles.menuItemName}>{item.name}</div>
                        {item.description && <div style={styles.menuItemDesc}>{item.description}</div>}
                      </div>
                      <div style={styles.menuItemRight}>
                        <span style={styles.menuItemPrice}>${Number(item.price).toFixed(2)}</span>
                        <ChevronRight size={16} color="#c1c5cc" />
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'orders' && (
          <div>
            {myOrders.length === 0 ? (
              <p style={{ color: '#888', textAlign: 'center', padding: '2rem 0' }}>{t('noOrdersYet')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {myOrders.map((o) => (
                  <div key={o.id} style={styles.orderCard}>
                    <div style={styles.orderCardHeader}>
                      <span style={{ fontWeight: 700 }}>Order · ${Number(o.total).toFixed(2)}</span>
                      <span style={{ fontSize: '0.8rem', color: '#888' }}>{o.items.length} {t('items')}</span>
                    </div>

                    {['cancelled', 'rejected'].includes(o.status) ? (
                      <div style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: '0.88rem', marginTop: '0.5rem' }}>
                        {o.status === 'cancelled' ? t('cancelled') : t('rejected')}
                      </div>
                    ) : (
                      <div style={styles.stepper}>
                        {ORDER_STEPS.map((step, i) => {
                          const currentIndex = ORDER_STEPS.indexOf(o.status)
                          const isDone = i < currentIndex
                          const isCurrent = i === currentIndex
                          return (
                            <div key={step} style={styles.stepperItem}>
                              <div style={{
                                ...styles.stepperDot,
                                background: isDone || isCurrent ? 'var(--color-primary)' : '#e5e7eb',
                                ...(isCurrent ? styles.stepperDotCurrent : {}),
                              }}>
                                {isDone && <Check size={11} color="#fff" />}
                              </div>
                              <span style={{ ...styles.stepperLabel, color: isDone || isCurrent ? '#14161a' : '#aaa' }}>
                                {t(step)}
                              </span>
                              {i < ORDER_STEPS.length - 1 && (
                                <div style={{ ...styles.stepperLine, background: isDone ? 'var(--color-primary)' : '#e5e7eb' }} />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {cart.length > 0 && !cartOpen && activeTab === 'menu' && (
        <button onClick={() => setCartOpen(true)} style={styles.floatingCartButton}>
          <ShoppingBag size={16} /> {t('viewCart')} · {cart.length} · ${cartTotal.toFixed(2)}
        </button>
      )}

      {configItem && (
        <div style={styles.sheetOverlay} onClick={() => setConfigItem(null)}>
          <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.sheetHandle} />
            <div style={styles.sheetHeader}>
              <h3 style={{ margin: 0 }}>{configItem.name}</h3>
              <button onClick={() => setConfigItem(null)} style={styles.sheetClose}><X size={18} /></button>
            </div>
            {configItem.description && <p style={{ color: '#888', fontSize: '0.85rem', marginTop: '-0.5rem' }}>{configItem.description}</p>}

            {configGroups.map((group) => (
              <div key={group.id} style={{ marginBottom: '1rem' }}>
                <div style={styles.groupLabel}>
                  {group.name}{group.is_required && <span style={{ color: '#dc2626' }}> ({t('required')})</span>}
                </div>
                <div style={styles.optionChoices}>
                  {group.options.map((opt) => {
                    const chosen = (selectedOptions[group.id] || []).includes(opt.id)
                    return (
                      <button
                        key={opt.id}
                        onClick={() => toggleOption(group, opt)}
                        style={{ ...styles.optionChoice, ...(chosen ? styles.optionChoiceActive : {}) }}
                      >
                        {opt.name}{opt.price_delta > 0 && ` +$${Number(opt.price_delta).toFixed(2)}`}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}

            <textarea
              placeholder={t('specialInstructions')}
              value={configNotes}
              onChange={(e) => setConfigNotes(e.target.value)}
              style={styles.notesInput}
            />

            {orderError && <p style={styles.errorText}>{orderError}</p>}

            <div style={styles.qtyRow}>
              <button onClick={() => setConfigQty((q) => Math.max(1, q - 1))} style={styles.qtyButton}><Minus size={15} /></button>
              <span style={styles.qtyValue}>{configQty}</span>
              <button onClick={() => setConfigQty((q) => q + 1)} style={styles.qtyButton}><Plus size={15} /></button>
              <button onClick={handleAddToCart} style={styles.addToCartButton}>
                {t('addToOrder')} · ${configLineTotal().toFixed(2)}
              </button>
            </div>
          </div>
        </div>
      )}

      {cartOpen && (
        <div style={styles.sheetOverlay} onClick={() => setCartOpen(false)}>
          <div style={styles.sheet} onClick={(e) => e.stopPropagation()}>
            <div style={styles.sheetHandle} />
            <div style={styles.sheetHeader}>
              <h3 style={{ margin: 0 }}>{t('yourOrder')}</h3>
              <button onClick={() => setCartOpen(false)} style={styles.sheetClose}><X size={18} /></button>
            </div>

            {cart.length === 0 ? (
              <p style={{ color: '#888' }}>{t('cartEmpty')}</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                  {cart.map((line) => (
                    <div key={line.tempId} style={styles.cartLine}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{line.quantity}× {line.item.name}</div>
                        {line.options.length > 0 && <div style={{ color: '#888', fontSize: '0.8rem' }}>{line.options.map((o) => o.name).join(', ')}</div>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>${cartLineTotal(line).toFixed(2)}</span>
                        <button onClick={() => removeFromCart(line.tempId)} style={styles.removeButton}><X size={15} /></button>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={styles.cartTotals}>
                  <div style={styles.cartTotalRow}><span>{t('subtotal')}</span><span>${cartSubtotal.toFixed(2)}</span></div>
                  <div style={styles.cartTotalRow}><span>{t('tax')}</span><span>${cartTax.toFixed(2)}</span></div>
                  <div style={{ ...styles.cartTotalRow, fontWeight: 700 }}><span>{t('total')}</span><span>${cartTotal.toFixed(2)}</span></div>
                </div>

                {orderError && <p style={styles.errorText}>{orderError}</p>}

                <button onClick={handlePlaceOrder} disabled={placingOrder} style={styles.placeOrderButton}>
                  {placingOrder ? t('placingOrder') : t('placeOrder')}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div style={styles.bottomNav}>
        <button onClick={() => setActiveTab('service')} style={{ ...styles.navItem, ...(activeTab === 'service' ? styles.navItemActive : {}) }}>
          <Bell size={20} /><span>{t('service')}</span>
        </button>
        <button onClick={() => setActiveTab('menu')} style={{ ...styles.navItem, ...(activeTab === 'menu' ? styles.navItemActive : {}) }}>
          <UtensilsCrossed size={20} /><span>{t('menu')}</span>
        </button>
        <button onClick={() => setActiveTab('orders')} style={{ ...styles.navItem, ...(activeTab === 'orders' ? styles.navItemActive : {}) }}>
          <ShoppingBag size={20} /><span>{t('orders')}</span>
        </button>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#f6f7f9', fontFamily: "'Inter', system-ui, sans-serif", paddingBottom: '5.5rem', maxWidth: '520px', margin: '0 auto' },
  loadingWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' },
  spinner: { width: '28px', height: '28px', borderRadius: '50%', border: '3px solid #e5e7eb', borderTopColor: '#3b6fe0', animation: 'msSpin 0.7s linear infinite', display: 'inline-block' },
  messageCard: { margin: '4rem 1.25rem', background: '#fff', borderRadius: '16px', padding: '2rem 1.5rem', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' },
  venueHeader: { position: 'relative', background: 'linear-gradient(180deg, #14161f 0%, #1b2440 100%)', color: '#fff', padding: '2rem 1.5rem 2.5rem', textAlign: 'center', borderRadius: '0 0 28px 28px' },
  langSwitcher: { position: 'absolute', top: '1rem', right: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '999px', padding: '0.35rem 0.7rem', color: '#fff', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' },
  logo: { width: '64px', height: '64px', marginBottom: '0.5rem', borderRadius: '12px' },
  venueName: { fontSize: '1.4rem', margin: '0 0 0.4rem', letterSpacing: '-0.01em' },
  tableInfoRow: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.75rem' },
  dot: { opacity: 0.5 },
  tableBadge: { background: 'rgba(59,111,224,0.25)', color: '#8fb3ff', padding: '0.2rem 0.7rem', borderRadius: '999px', fontWeight: 700, fontSize: '0.8rem' },
  greetingText: { fontSize: '0.92rem', color: 'rgba(255,255,255,0.85)', margin: 0 },
  content: { padding: '1.5rem 1.25rem' },
  activeSection: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' },
  activeCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '0.75rem 1rem' },
  activeCardLeft: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  activePill: { display: 'flex', alignItems: 'center', gap: '0.3rem', background: '#eaf0fd', color: '#3b6fe0', fontSize: '0.75rem', fontWeight: 700, padding: '0.25rem 0.6rem', borderRadius: '999px' },
  errorText: { color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.75rem', textAlign: 'center' },
  serviceGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' },
  serviceCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '16px', padding: '1.4rem 0.75rem', cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  serviceCardActive: { background: '#f0fbf4', borderColor: '#16a34a' },
  serviceCardLabel: { fontWeight: 700, fontSize: '0.88rem', textAlign: 'center', color: '#14161a' },
  serviceCardStatus: { fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 },
  categoryTabs: { display: 'flex', gap: '0.5rem', overflowX: 'auto', marginBottom: '1.25rem', paddingBottom: '0.25rem' },
  categoryTab: { flexShrink: 0, padding: '0.5rem 1rem', borderRadius: '999px', border: '1.5px solid #e5e7eb', background: '#fff', color: '#666', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' },
  categoryTabActive: { background: '#14161a', borderColor: '#14161a', color: '#fff' },
  menuItemList: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  menuItemCard: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '1rem', cursor: 'pointer', textAlign: 'left' },
  menuItemName: { fontWeight: 700, fontSize: '0.95rem' },
  menuItemDesc: { color: '#888', fontSize: '0.8rem', marginTop: '0.2rem', maxWidth: '260px' },
  menuItemRight: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  menuItemPrice: { fontWeight: 700, color: '#3b6fe0', fontSize: '0.92rem' },
  floatingCartButton: { position: 'fixed', bottom: '5.5rem', left: '1.25rem', right: '1.25rem', maxWidth: '470px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.9rem', borderRadius: '14px', border: 'none', background: '#3b6fe0', color: '#fff', fontWeight: 700, cursor: 'pointer', boxShadow: '0 8px 20px rgba(59,111,224,0.4)' },
  sheetOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 },
  sheet: { background: '#fff', borderRadius: '20px 20px 0 0', padding: '0.75rem 1.5rem 1.5rem', width: '100%', maxWidth: '520px', maxHeight: '85vh', overflowY: 'auto' },
  sheetHandle: { width: '36px', height: '4px', background: '#e5e7eb', borderRadius: '999px', margin: '0 auto 1rem' },
  sheetHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' },
  sheetClose: { background: '#f1f2f5', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  groupLabel: { fontWeight: 700, fontSize: '0.88rem', marginBottom: '0.5rem' },
  optionChoices: { display: 'flex', flexWrap: 'wrap', gap: '0.5rem' },
  optionChoice: { padding: '0.5rem 0.9rem', borderRadius: '999px', border: '1.5px solid #e5e7eb', background: '#fff', color: '#555', fontSize: '0.85rem', cursor: 'pointer' },
  optionChoiceActive: { background: '#3b6fe0', borderColor: '#3b6fe0', color: '#fff' },
  notesInput: { width: '100%', marginTop: '0.5rem', padding: '0.65rem', borderRadius: '10px', border: '1.5px solid #e5e7eb', fontSize: '0.88rem', fontFamily: 'inherit', minHeight: '50px', marginBottom: '1rem' },
  qtyRow: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  qtyButton: { width: '36px', height: '36px', borderRadius: '10px', border: '1.5px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qtyValue: { minWidth: '20px', textAlign: 'center', fontWeight: 700 },
  addToCartButton: { marginLeft: 'auto', flex: 1, padding: '0.8rem', borderRadius: '12px', border: 'none', background: '#3b6fe0', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.92rem' },
  cartLine: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid #f5f5f5', paddingBottom: '0.6rem' },
  removeButton: { border: 'none', background: '#f1f2f5', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#dc2626' },
  cartTotals: { borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem', marginBottom: '1rem' },
  cartTotalRow: { display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', padding: '0.25rem 0' },
  placeOrderButton: { width: '100%', padding: '0.9rem', borderRadius: '12px', border: 'none', background: '#16a34a', color: '#fff', fontWeight: 700, fontSize: '0.98rem', cursor: 'pointer' },
  bottomNav: { position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: '520px', margin: '0 auto', background: '#fff', borderTop: '1px solid #e5e7eb', display: 'flex', padding: '0.5rem 0.5rem calc(0.5rem + env(safe-area-inset-bottom))', boxShadow: '0 -2px 12px rgba(0,0,0,0.05)' },
  navItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem', padding: '0.5rem 0', background: 'transparent', border: 'none', cursor: 'pointer', color: '#9ca3af', fontSize: '0.72rem', fontWeight: 600 },
  navItemActive: { color: '#3b6fe0' },
  orderCard: { background: '#fff', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '1rem' },
  orderCardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  stepper: { display: 'flex', alignItems: 'flex-start', marginTop: '1rem' },
  stepperItem: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' },
  stepperDot: { width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  stepperDotCurrent: { boxShadow: '0 0 0 4px rgba(59,111,224,0.2)' },
  stepperLabel: { fontSize: '0.68rem', marginTop: '0.35rem', fontWeight: 600, textAlign: 'center' },
  stepperLine: { position: 'absolute', top: '10px', left: '50%', width: '100%', height: '2px', zIndex: 0 },
}
