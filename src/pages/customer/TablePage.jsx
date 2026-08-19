import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Bell, Wine, IceCreamCone, GlassWater, Receipt, Users,
  AlertTriangle, UtensilsCrossed, ShoppingBag, Check, Clock,
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'

const STATUS_LABELS = {
  pending: 'Request sent',
  accepted: 'Accepted',
  on_the_way: 'On the way',
  completed: 'Completed',
  rejected: 'Unable to assist',
  cancelled: 'Cancelled',
}

const ICON_MAP = {
  server: Bell,
  hostess: Users,
  bottle: Wine,
  ice: IceCreamCone,
  water: GlassWater,
  bill: Receipt,
  problem: AlertTriangle,
}

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

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function TablePage() {
  const { token } = useParams()
  const [status, setStatus] = useState('loading')
  const [business, setBusiness] = useState(null)
  const [table, setTable] = useState(null)
  const [area, setArea] = useState(null)
  const [session, setSession] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  const [requestTypes, setRequestTypes] = useState([])
  const [myRequests, setMyRequests] = useState([])
  const [sendingTypeId, setSendingTypeId] = useState(null)
  const [requestError, setRequestError] = useState('')

  const [activeTab, setActiveTab] = useState('service')

  useEffect(() => {
    initSession()
  }, [token])

  useEffect(() => {
    if (!session) return

    loadRequestTypes(session.business_id)
    loadMyRequests(session.id)

    const channel = supabase
      .channel(`session-requests-${session.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `session_id=eq.${session.id}` },
        () => loadMyRequests(session.id)
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [session])

  async function initSession() {
    setStatus('loading')

    const { data: qrToken, error: qrError } = await supabase
      .from('table_qr_tokens')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .single()

    if (qrError || !qrToken) { setStatus('invalid'); return }

    const { data: tableData, error: tableError } = await supabase
      .from('tables')
      .select('*')
      .eq('id', qrToken.table_id)
      .single()

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
        .from('table_sessions')
        .select('*')
        .eq('id', existingSessionId)
        .eq('status', 'active')
        .single()

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

  function activeRequestForType(typeId) {
    return myRequests.find((r) => r.request_type_id === typeId && ['pending', 'accepted', 'on_the_way'].includes(r.status))
  }

  async function handleRequest(type) {
    setRequestError('')
    if (activeRequestForType(type.id)) {
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

  if (status === 'loading') {
    return (
      <div style={styles.page}>
        <div style={styles.loadingWrap}>
          <span style={styles.spinner} />
        </div>
      </div>
    )
  }

  if (status === 'invalid') {
    return (
      <div style={styles.page}>
        <div style={styles.messageCard}>
          <AlertTriangle size={28} color="var(--color-warning)" />
          <h2 style={{ margin: '0.75rem 0 0.3rem' }}>This QR code is no longer active</h2>
          <p style={{ color: '#666', margin: 0 }}>Please ask a staff member for a new code, or check with the venue.</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={styles.page}>
        <div style={styles.messageCard}>
          <h2 style={{ margin: '0 0 0.3rem' }}>Something went wrong</h2>
          <p style={{ color: '#666', margin: 0 }}>{errorMessage}</p>
        </div>
      </div>
    )
  }

  const activeRequests = myRequests.filter((r) => ['pending', 'accepted', 'on_the_way'].includes(r.status))

  return (
    <div style={styles.page}>
      <div style={styles.venueHeader}>
        {business?.logo_url && <img src={business.logo_url} alt={business.name} style={styles.logo} />}
        <h1 style={styles.venueName}>{business?.name || 'Welcome'}</h1>
        <div style={styles.tableInfoRow}>
          {area && <span>{area.name}</span>}
          {area && <span style={styles.dot}>•</span>}
          <span style={styles.tableBadge}>{table?.name}</span>
        </div>
        <p style={styles.greetingText}>{greeting()} 👋 How can we help?</p>
      </div>

      <div style={styles.content}>
        {activeTab === 'service' && (
          <>
            {activeRequests.length > 0 && (
              <div style={styles.activeSection}>
                {activeRequests.map((r) => {
                  const type = requestTypes.find((t) => t.id === r.request_type_id)
                  const Icon = iconForLabel(type?.label)
                  return (
                    <div key={r.id} style={styles.activeCard}>
                      <div style={styles.activeCardLeft}>
                        <Icon size={17} color="var(--color-primary)" />
                        <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>{type?.label || 'Request'}</span>
                      </div>
                      <span style={styles.activePill}>
                        <Clock size={12} /> {STATUS_LABELS[r.status]}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {requestError && <p style={styles.errorText}>{requestError}</p>}

            <div style={styles.serviceGrid}>
              {requestTypes.length === 0 && (
                <p style={{ color: '#888', gridColumn: '1 / -1', textAlign: 'center' }}>
                  No service buttons have been set up yet.
                </p>
              )}
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
                    {isActive ? (
                      <Check size={24} color="var(--color-success)" />
                    ) : (
                      <Icon size={24} color="var(--color-primary)" />
                    )}
                    <span style={styles.serviceCardLabel}>{isSending ? '…' : type.label}</span>
                    {isActive && (
                      <span style={styles.serviceCardStatus}>
                        {STATUS_LABELS[activeRequestForType(type.id).status]}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </>
        )}

        {activeTab === 'menu' && (
          <div style={{ textAlign: 'center', color: '#888', padding: '2rem 0' }}>
            Menu browsing coming right up in the next step.
          </div>
        )}

        {activeTab === 'orders' && (
          <div style={{ textAlign: 'center', color: '#888', padding: '2rem 0' }}>
            Order tracking coming right up in the next step.
          </div>
        )}
      </div>

      <div style={styles.bottomNav}>
        <button
          onClick={() => setActiveTab('service')}
          style={{ ...styles.navItem, ...(activeTab === 'service' ? styles.navItemActive : {}) }}
        >
          <Bell size={20} />
          <span>Service</span>
        </button>
        <button
          onClick={() => setActiveTab('menu')}
          style={{ ...styles.navItem, ...(activeTab === 'menu' ? styles.navItemActive : {}) }}
        >
          <UtensilsCrossed size={20} />
          <span>Menu</span>
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          style={{ ...styles.navItem, ...(activeTab === 'orders' ? styles.navItemActive : {}) }}
        >
          <ShoppingBag size={20} />
          <span>Orders</span>
        </button>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'var(--color-bg, #f6f7f9)',
    fontFamily: "'Inter', system-ui, sans-serif",
    paddingBottom: '5.5rem',
    maxWidth: '520px',
    margin: '0 auto',
  },
  loadingWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' },
  spinner: {
    width: '28px', height: '28px', borderRadius: '50%',
    border: '3px solid #e5e7eb', borderTopColor: 'var(--color-primary, #3b6fe0)',
    animation: 'msSpin 0.7s linear infinite', display: 'inline-block',
  },
  messageCard: {
    margin: '4rem 1.25rem', background: '#fff', borderRadius: '16px',
    padding: '2rem 1.5rem', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
  },
  venueHeader: {
    background: 'linear-gradient(180deg, #14161f 0%, #1b2440 100%)',
    color: '#fff',
    padding: '2rem 1.5rem 2.5rem',
    textAlign: 'center',
    borderRadius: '0 0 28px 28px',
  },
  logo: { width: '64px', height: '64px', marginBottom: '0.5rem', borderRadius: '12px' },
  venueName: { fontSize: '1.4rem', margin: '0 0 0.4rem', letterSpacing: '-0.01em' },
  tableInfoRow: {
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
    fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.75rem',
  },
  dot: { opacity: 0.5 },
  tableBadge: {
    background: 'rgba(59,111,224,0.25)', color: '#8fb3ff',
    padding: '0.2rem 0.7rem', borderRadius: '999px', fontWeight: 700, fontSize: '0.8rem',
  },
  greetingText: { fontSize: '0.92rem', color: 'rgba(255,255,255,0.85)', margin: 0 },
  content: { padding: '1.5rem 1.25rem' },
  activeSection: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.25rem' },
  activeCard: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '0.75rem 1rem',
  },
  activeCardLeft: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  activePill: {
    display: 'flex', alignItems: 'center', gap: '0.3rem',
    background: '#eaf0fd', color: '#3b6fe0', fontSize: '0.75rem', fontWeight: 700,
    padding: '0.25rem 0.6rem', borderRadius: '999px',
  },
  errorText: { color: '#dc2626', fontSize: '0.85rem', marginBottom: '0.75rem', textAlign: 'center' },
  serviceGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' },
  serviceCard: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
    background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '16px',
    padding: '1.4rem 0.75rem', cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    transition: 'transform 0.1s',
  },
  serviceCardActive: { background: '#f0fbf4', borderColor: '#16a34a' },
  serviceCardLabel: { fontWeight: 700, fontSize: '0.88rem', textAlign: 'center', color: '#14161a' },
  serviceCardStatus: { fontSize: '0.72rem', color: '#16a34a', fontWeight: 600 },
  bottomNav: {
    position: 'fixed', bottom: 0, left: 0, right: 0,
    maxWidth: '520px', margin: '0 auto',
    background: '#fff', borderTop: '1px solid #e5e7eb',
    display: 'flex', padding: '0.5rem 0.5rem calc(0.5rem + env(safe-area-inset-bottom))',
    boxShadow: '0 -2px 12px rgba(0,0,0,0.05)',
  },
  navItem: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
    padding: '0.5rem 0', background: 'transparent', border: 'none', cursor: 'pointer',
    color: '#9ca3af', fontSize: '0.72rem', fontWeight: 600,
  },
  navItemActive: { color: '#3b6fe0' },
}
