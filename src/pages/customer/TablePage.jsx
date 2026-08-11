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

  useEffect(() => {
    initSession()
  }, [token])

  // Once we have a session, load buttons + this session's requests, and subscribe to updates
  useEffect(() => {
    if (!session) return

    loadRequestTypes(session.business_id)
    loadMyRequests(session.id)

    const channel = supabase
      .channel(`session-requests-${session.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_requests',
          filter: `session_id=eq.${session.id}`,
        },
        () => {
          loadMyRequests(session.id)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
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
      .insert({
        business_id: qrToken.business_id,
        table_id: tableData.id,
        qr_token_id: qrToken.id,
      })
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
          <p style={{ color: '#666' }}>
            Please ask a staff member for a new code, or check with the venue.
          </p>
         
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

  const activeRequests = myRequests.filter((r) =>
    ['pending', 'accepted', 'on_the_way'].includes(r.status)
  )

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {business?.logo_url && (
          <img src={business.logo_url} alt={business.name} style={styles.logo} />
        )}
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

        {requestError && <p style={styles.requestError}>{requestError}</p>}

        <div style={styles.buttonGrid}>
          {requestTypes.length === 0 && (
            <p style={{ color: '#888', gridColumn: '1 / -1' }}>
              No service buttons have been set up yet.
            </p>
          )}
          {requestTypes.map((type) => {
            const isActive = !!activeRequestForType(type.id)
            return (
              <button
                key={type.id}
                onClick={() => handleRequest(type)}
                disabled={isActive || sendingTypeId === type.id}
                style={{
                  ...styles.requestButton,
                  ...(isActive ? styles.requestButtonActive : {}),
                }}
              >
                {sendingTypeId === type.id ? '...' : type.label}
              </button>
            )
          })}
        </div>
      </div>
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
    marginBottom: '1rem',
    textAlign: 'left',
  },
  activeRequestRow: {
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
  requestError: { color: '#d33', fontSize: '0.85rem', marginBottom: '0.75rem' },
  buttonGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
  },
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
  requestButtonActive: {
    background: '#e8f5e9',
    borderColor: '#4caf50',
    color: '#2e7d32',
    cursor: 'default',
  },
}
