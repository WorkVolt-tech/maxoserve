import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

export default function AdminActivityLog() {
  const { user } = useAuth()
  const [logs, setLogs] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)

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

    const { data: logsData } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('business_id', membership.business_id)
      .order('created_at', { ascending: false })
      .limit(100)

    setLogs(logsData || [])

    if (logsData && logsData.length > 0) {
      const userIds = [...new Set(logsData.map((l) => l.user_id).filter(Boolean))]
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)

      const map = {}
      for (const p of profilesData || []) map[p.id] = p
      setProfiles(map)
    }

    setLoading(false)
  }

  function describeAction(log) {
    const who = profiles[log.user_id]?.full_name || profiles[log.user_id]?.email || 'Someone'
    return `${who} — ${log.action}`
  }

  if (loading) return <div><h2>Activity Log</h2><p>Loading...</p></div>

  return (
    <div>
      <h2>Activity Log</h2>
      <p style={{ color: '#666' }}>The last 100 actions taken across your business.</p>

      <div style={styles.list}>
        {logs.length === 0 && <p style={{ color: '#888' }}>No activity recorded yet.</p>}
        {logs.map((log) => (
          <div key={log.id} style={styles.row}>
            <div>
              <span style={styles.action}>{describeAction(log)}</span>
              {log.details && (
                <div style={styles.details}>{JSON.stringify(log.details)}</div>
              )}
            </div>
            <span style={styles.time}>{new Date(log.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  list: { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    background: '#fff',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  action: { fontSize: '0.9rem', fontWeight: 500 },
  details: { fontSize: '0.78rem', color: '#888', marginTop: '0.2rem' },
  time: { fontSize: '0.8rem', color: '#999', whiteSpace: 'nowrap' },
}
