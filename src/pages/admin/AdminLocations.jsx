import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

export default function AdminLocations() {
  const { user } = useAuth()
  const [businessId, setBusinessId] = useState(null)
  const [locations, setLocations] = useState([])
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)

    // Find which business this user belongs to
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

    const { data: locationsData, error: locationsError } = await supabase
      .from('locations')
      .select('*')
      .eq('business_id', membership.business_id)
      .order('created_at', { ascending: true })

    if (locationsError) {
      setError(locationsError.message)
    } else {
      setLocations(locationsData)
    }

    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')

    const { error: insertError } = await supabase.from('locations').insert({
      business_id: businessId,
      name,
      address,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    setName('')
    setAddress('')
    loadData()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this location? This will also delete its areas and tables.')) return
    await supabase.from('locations').delete().eq('id', id)
    loadData()
  }

  if (loading) return <div><h2>Locations</h2><p>Loading...</p></div>

  return (
    <div>
      <h2>Locations</h2>
      <p style={{ color: '#666' }}>
        A location is a physical address (e.g. "Club Max — Montreal"). Add each address your business operates at.
      </p>

      <form onSubmit={handleAdd} style={styles.form}>
        <input
          type="text"
          placeholder="Location name (e.g. Downtown)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={styles.input}
        />
        <input
          type="text"
          placeholder="Address (optional)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={styles.input}
        />
        <button type="submit" style={styles.button}>Add Location</button>
      </form>

      {error && <p style={{ color: '#d33' }}>{error}</p>}

      <div style={styles.list}>
        {locations.length === 0 && <p style={{ color: '#888' }}>No locations yet.</p>}
        {locations.map((loc) => (
          <div key={loc.id} style={styles.card}>
            <div>
              <strong>{loc.name}</strong>
              {loc.address && <p style={styles.address}>{loc.address}</p>}
            </div>
            <button onClick={() => handleDelete(loc.id)} style={styles.deleteButton}>
              Delete
            </button>
          </div>
        ))}
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
    flex: '1 1 200px',
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
  list: { display: 'flex', flexDirection: 'column', gap: '0.5rem' },
  card: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#fff',
    padding: '1rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
  },
  address: { margin: '0.25rem 0 0', color: '#888', fontSize: '0.85rem' },
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
