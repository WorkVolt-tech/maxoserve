import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'

export default function TablePage() {
  const { token } = useParams()
  const [status, setStatus] = useState('loading') // loading | invalid | ready | error
  const [business, setBusiness] = useState(null)
  const [table, setTable] = useState(null)
  const [area, setArea] = useState(null)
  const [session, setSession] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    initSession()
  }, [token])

  async function initSession() {
    setStatus('loading')

    // Step 1: look up the QR token (RLS only allows active ones to be publicly visible)
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

    // Step 2: load the table
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

    // Step 3: load the area (for display, e.g. "VIP Room")
    const { data: areaData } = await supabase
      .from('areas')
      .select('*')
      .eq('id', tableData.area_id)
      .single()
    setArea(areaData)

    // Step 4: load the business (for branding)
    const { data: businessData } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', qrToken.business_id)
      .single()
    setBusiness(businessData)

    // Step 5: reuse an existing local session for this table if we already have one,
    // otherwise create a new anonymous session
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
        // touch last_activity_at
        await supabase
          .from('table_sessions')
          .update({ last_activity_at: new Date().toISOString() })
          .eq('id', existingSession.id)
        setStatus('ready')
        return
      }
    }

    // No valid existing session — create a new one
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

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {business?.logo_url && (
          <img src={business.logo_url} alt={business.name} style={styles.logo} />
        )}
        <h1 style={styles.businessName}>{business?.name || 'Welcome'}</h1>
        {area && <p style={styles.areaName}>{area.name}</p>}
        <div style={styles.tableBadge}>{table?.name}</div>

        <div style={styles.placeholder}>
          <p style={{ color: '#888', margin: 0 }}>
            Service request buttons and menu will appear here next.
          </p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
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
    maxWidth: '420px',
    textAlign: 'center',
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
  placeholder: {
    padding: '1.5rem',
    background: '#f5f6f8',
    borderRadius: '12px',
  },
}
