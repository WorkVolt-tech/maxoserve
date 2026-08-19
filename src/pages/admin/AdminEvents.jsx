import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrentLocation } from '../../contexts/LocationContext'

export default function AdminEvents() {
  const { user } = useAuth()
  const { currentLocationId } = useCurrentLocation()
  const [businessId, setBusinessId] = useState(null)
  const [events, setEvents] = useState([])

  const [name, setName] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')

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

    await loadEvents(membership.business_id)
    setLoading(false)
  }

  async function loadEvents(bizId) {
    const { data, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('business_id', bizId)
      .order('starts_at', { ascending: false })

    if (eventsError) {
      setError(eventsError.message)
    } else {
      setEvents(data)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')

    if (!currentLocationId) {
      setError('Select a location.')
      return
    }

    const { error: insertError } = await supabase.from('events').insert({
      business_id: businessId,
      location_id: currentLocationId,
      name,
      starts_at: startsAt,
      ends_at: endsAt,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    setName('')
    setStartsAt('')
    setEndsAt('')
    loadEvents(businessId)
  }

  async function handleToggleActive(event) {
    await supabase.from('events').update({ is_active: !event.is_active }).eq('id', event.id)
    loadEvents(businessId)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this event? Linked reservations will keep their info but lose the event link.')) return
    await supabase.from('events').delete().eq('id', id)
    loadEvents(businessId)
  }

  function eventStatus(event) {
    const now = new Date()
    const start = new Date(event.starts_at)
    const end = new Date(event.ends_at)
    if (!event.is_active) return { label: 'disabled', color: '#9e9e9e' }
    if (now < start) return { label: 'upcoming', color: '#2196f3' }
    if (now >= start && now <= end) return { label: 'happening now', color: '#4caf50' }
    return { label: 'ended', color: '#9e9e9e' }
  }

  if (loading) return <div><h2>Events</h2><p>Loading...</p></div>

  return (
    <div>
      <h2>Events</h2>
      <p style={{ color: '#666' }}>
        Create temporary events like weddings, birthdays, or private parties. Reservations can be linked to an event.
      </p>

     <form onSubmit={handleCreate} style={styles.form}>
        <input
          type="text"
          placeholder="Event name (e.g. Smith Wedding)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={styles.input}
        />
        <div style={styles.dateGroup}>
          <label style={styles.dateLabel}>Starts</label>
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(e) => setStartsAt(e.target.value)}
            required
            style={styles.input}
          />
        </div>
        <div style={styles.dateGroup}>
          <label style={styles.dateLabel}>Ends</label>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            required
            style={styles.input}
          />
        </div>
        <button type="submit" style={styles.button}>Create Event</button>
      </form>

      {error && <p style={{ color: '#d33' }}>{error}</p>}

     <div style={styles.list}>
        {events.filter((e) => e.location_id === currentLocationId).length === 0 && (
          <p style={{ color: '#888' }}>No events yet.</p>
        )}
        {events.filter((e) => e.location_id === currentLocationId).map((event) => {
          const status = eventStatus(event)
          return (
            <div key={event.id} style={styles.card}>
              <div>
                <strong>{event.name}</strong>
                <p style={styles.dateRange}>
                  {new Date(event.starts_at).toLocaleString()} → {new Date(event.ends_at).toLocaleString()}
                </p>
                <span
                  style={{
                    ...styles.statusBadge,
                    background: status.color + '22',
                    color: status.color,
                  }}
                >
                  {status.label}
                </span>
              </div>
              <div style={styles.cardActions}>
                <button onClick={() => handleToggleActive(event)} style={styles.toggleButton}>
                  {event.is_active ? 'Disable' : 'Enable'}
                </button>
                <button onClick={() => handleDelete(event.id)} style={styles.deleteButton}>
                  Delete
                </button>
              </div>
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
    alignItems: 'flex-end',
  },
  input: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    fontSize: '0.95rem',
    flex: '1 1 180px',
  },
  select: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    fontSize: '0.95rem',
  },
  dateGroup: { display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  dateLabel: { fontSize: '0.75rem', color: '#888' },
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
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    background: '#fff',
    padding: '1rem',
    borderRadius: '10px',
    border: '1px solid #e2e4e9',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  meta: { color: '#888', fontSize: '0.85rem' },
  dateRange: { color: '#666', fontSize: '0.85rem', margin: '0.3rem 0' },
  statusBadge: {
    fontSize: '0.75rem',
    fontWeight: 700,
    padding: '0.2rem 0.6rem',
    borderRadius: '999px',
    textTransform: 'capitalize',
  },
  cardActions: { display: 'flex', gap: '0.5rem' },
  toggleButton: {
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid #e2e4e9',
    background: '#fff',
    color: '#555',
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
}
