import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { logActivity } from '../../lib/activityLog'

const STATUS_COLORS = {
  pending: '#e91e63',
  accepted: '#ff9800',
  on_the_way: '#2196f3',
  completed: '#4caf50',
  rejected: '#9e9e9e',
  cancelled: '#9e9e9e',
}

const FILTERS = ['all', 'new', 'assigned_to_me', 'in_progress', 'completed']

export default function StaffDashboard() {
  const { user, signOut } = useAuth()
  const [businessId, setBusinessId] = useState(null)
  const [requests, setRequests] = useState([])
  const [requestTypes, setRequestTypes] = useState({})
  const [tables, setTables] = useState({})
  const [filter, setFilter] = useState('new')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (!businessId) return

    const channel = supabase
      .channel(`staff-requests-${businessId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_requests',
          filter: `business_id=eq.${businessId}`,
        },
        () => {
          loadRequests(businessId)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [businessId])

  async function init() {
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

    const { data: typesData } = await supabase
      .from('service_request_types')
      .select('*')
      .eq('business_id', membership.business_id)

    const typesMap = {}
    for (const t of typesData || []) typesMap[t.id] = t
    setRequestTypes(typesMap)

    const { data: tablesData } = await supabase
      .from('tables')
      .select('*')
      .eq('business_id', membership.business_id)

    const tablesMap = {}
    for (const t of tablesData || []) tablesMap[t.id] = t
    setTables(tablesMap)

    await loadRequests(membership.business_id)
    setLoading(false)
  }

  async function loadRequests(bizId) {
    const { data } = await supabase
      .from('service_requests')
      .select('*')
      .eq('business_id', bizId)
      .order('created_at', { ascending: false })

    setRequests(data || [])
  }

  async function updateStatus(request, newStatus) {
    const updates = { status: newStatus }
    const now = new Date().toISOString()

    if (newStatus === 'accepted') {
      updates.accepted_at = now
      updates.assigned_to = user.id
    } else if (newStatus === 'on_the_way') {
      updates.on_the_way_at = now
    } else if (newStatus === 'completed') {
      updates.completed_at = now
    } else if (newStatus === 'rejected') {
      updates.cancelled_at = now
    }

    await supabase.from('service_requests').update(updates).eq('id', request.id)
    logActivity(businessId, user.id, `${newStatus} a service request`)
    loadRequests(businessId)
  }

  function minutesWaiting(createdAt) {
    const diffMs = Date.now() - new Date(createdAt).getTime()
    return Math.max(0, Math.floor(diffMs / 60000))
  }

  function matchesFilter(r) {
    if (filter === 'all') return true
    if (filter === 'new') return r.status === 'pending'
    if (filter === 'assigned_to_me') return r.assigned_to === user.id
    if (filter === 'in_progress') return ['accepted', 'on_the_way'].includes(r.status)
    if (filter === 'completed') return r.status === 'completed'
    return true
  }

  const visibleRequests = requests.filter(matchesFilter)
  const newCount = requests.filter((r) => r.status === 'pending').length

  if (loading) {
    return (
      <div style={styles.page}>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.headerTitle}>Requests</h1>
        <button onClick={signOut} style={styles.signOutButton}>Sign Out</button>
      </div>

      <div style={styles.filterRow}>
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              ...styles.filterButton,
              ...(filter === f ? styles.filterButtonActive : {}),
            }}
          >
            {f.replace('_', ' ')}
            {f === 'new' && newCount > 0 && <span style={styles.filterBadge}>{newCount}</span>}
          </button>
        ))}
      </div>

      <div style={styles.list}>
        {visibleRequests.length === 0 && (
          <p style={{ color: '#888', textAlign: 'center', marginTop: '2rem' }}>
            No requests here.
          </p>
        )}

        {visibleRequests.map((r) => {
          const type = requestTypes[r.request_type_id]
          const table = tables[r.table_id]
          const isNew = r.status === 'pending'

          return (
            <div
              key={r.id}
              style={{
                ...styles.requestCard,
                ...(isNew ? styles.requestCardNew : {}),
              }}
            >
              <div style={styles.requestTop}>
                <div>
                  <div style={styles.requestType}>{type?.label || 'Request'}</div>
                  <div style={styles.requestTable}>{table?.name || 'Unknown table'}</div>
                </div>
                <div style={styles.requestMeta}>
                  <span
                    style={{
                      ...styles.statusDot,
                      backgroundColor: STATUS_COLORS[r.status] || '#999',
                    }}
                  />
                  <span style={styles.statusText}>{r.status.replace('_', ' ')}</span>
                  <span style={styles.waitTime}>{minutesWaiting(r.created_at)}m ago</span>
                </div>
              </div>

              <div style={styles.actions}>
                {r.status === 'pending' && (
                  <>
                    <button onClick={() => updateStatus(r, 'accepted')} style={styles.acceptButton}>
                      Accept
                    </button>
                    <button onClick={() => updateStatus(r, 'rejected')} style={styles.rejectButton}>
                      Reject
                    </button>
                  </>
                )}
                {r.status === 'accepted' && (
                  <button onClick={() => updateStatus(r, 'on_the_way')} style={styles.acceptButton}>
                    On My Way
                  </button>
                )}
                {r.status === 'on_the_way' && (
                  <button onClick={() => updateStatus(r, 'completed')} style={styles.completeButton}>
                    Complete
                  </button>
                )}
                {r.status === 'completed' && (
                  <span style={styles.doneText}>✓ Completed</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#f5f6f8',
    fontFamily: 'system-ui, sans-serif',
    paddingBottom: '2rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 1.25rem',
    background: '#12161c',
  },
  headerTitle: { color: '#fff', margin: 0, fontSize: '1.3rem' },
  signOutButton: {
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid #333b47',
    background: 'transparent',
    color: '#b7bdc7',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  filterRow: {
    display: 'flex',
    gap: '0.5rem',
    padding: '1rem 1.25rem',
    overflowX: 'auto',
  },
  filterButton: {
    padding: '0.5rem 1rem',
    borderRadius: '999px',
    border: '1px solid #e2e4e9',
    background: '#fff',
    color: '#555',
    cursor: 'pointer',
    fontSize: '0.85rem',
    whiteSpace: 'nowrap',
    textTransform: 'capitalize',
    flexShrink: 0,
  },
  filterButtonActive: {
    background: '#4c8dff',
    borderColor: '#4c8dff',
    color: '#fff',
  },
  filterBadge: {
    marginLeft: '0.4rem',
    background: '#fff',
    color: '#e91e63',
    borderRadius: '999px',
    padding: '0.05rem 0.4rem',
    fontSize: '0.75rem',
    fontWeight: 700,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    padding: '0 1.25rem',
  },
  requestCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '1rem',
    border: '1px solid #e2e4e9',
  },
  requestCardNew: {
    borderColor: '#e91e63',
    borderWidth: '2px',
    boxShadow: '0 0 0 3px rgba(233,30,99,0.1)',
  },
  requestTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: '0.75rem',
  },
  requestType: { fontSize: '1.1rem', fontWeight: 700 },
  requestTable: { color: '#666', fontSize: '0.9rem', marginTop: '0.1rem' },
  requestMeta: { display: 'flex', alignItems: 'center', gap: '0.4rem' },
  statusDot: { width: '10px', height: '10px', borderRadius: '50%', display: 'inline-block' },
  statusText: { fontSize: '0.8rem', color: '#555', textTransform: 'capitalize' },
  waitTime: { fontSize: '0.8rem', color: '#999', marginLeft: '0.5rem' },
  actions: { display: 'flex', gap: '0.5rem' },
  acceptButton: {
    flex: 1,
    padding: '0.7rem',
    borderRadius: '8px',
    border: 'none',
    background: '#4c8dff',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.95rem',
  },
  rejectButton: {
    padding: '0.7rem 1rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    background: '#fff',
    color: '#d33',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.95rem',
  },
  completeButton: {
    flex: 1,
    padding: '0.7rem',
    borderRadius: '8px',
    border: 'none',
    background: '#4caf50',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
    fontSize: '0.95rem',
  },
  doneText: { color: '#2e7d32', fontWeight: 600, fontSize: '0.9rem' },
}
