import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

export default function AdminAreas() {
  const { user } = useAuth()
  const [businessId, setBusinessId] = useState(null)
  const [locations, setLocations] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [areas, setAreas] = useState([])
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadInitial()
  }, [])

  useEffect(() => {
    if (selectedLocationId) {
      loadAreas(selectedLocationId)
    } else {
      setAreas([])
    }
  }, [selectedLocationId])

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

    const { data: locationsData, error: locationsError } = await supabase
      .from('locations')
      .select('*')
      .eq('business_id', membership.business_id)
      .order('created_at', { ascending: true })

    if (locationsError) {
      setError(locationsError.message)
    } else {
      setLocations(locationsData)
      if (locationsData.length > 0) {
        setSelectedLocationId(locationsData[0].id)
      }
    }

    setLoading(false)
  }

  async function loadAreas(locationId) {
    const { data, error: areasError } = await supabase
      .from('areas')
      .select('*')
      .eq('location_id', locationId)
      .order('display_order', { ascending: true })

    if (areasError) {
      setError(areasError.message)
    } else {
      setAreas(data)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')

    if (!selectedLocationId) {
      setError('Select a location first.')
      return
    }

    const { error: insertError } = await supabase.from('areas').insert({
      business_id: businessId,
      location_id: selectedLocationId,
      name,
      display_order: areas.length,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    setName('')
    loadAreas(selectedLocationId)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this area? This will also delete its tables.')) return
    await supabase.from('areas').delete().eq('id', id)
    loadAreas(selectedLocationId)
  }

  if (loading) return <div><h2>Areas</h2><p>Loading...</p></div>

  if (locations.length === 0) {
    return (
      <div>
        <h2>Areas</h2>
        <p style={{ color: '#888' }}>
          You need to create a location first before adding areas.
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2>Areas</h2>
      <p style={{ color: '#666' }}>
        Areas are rooms or sections within a location (e.g. "Main Floor", "VIP", "Patio").
      </p>

      <div style={styles.locationPicker}>
        <label style={styles.label}>Location:</label>
        <select
          value={selectedLocationId}
          onChange={(e) => setSelectedLocationId(e.target.value)}
          style={styles.select}
        >
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
      </div>

      <form onSubmit={handleAdd} style={styles.form}>
        <input
          type="text"
          placeholder="Area name (e.g. VIP)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={styles.input}
        />
        <button type="submit" style={styles.button}>Add Area</button>
      </form>

      {error && <p style={{ color: '#d33' }}>{error}</p>}

      <div style={styles.list}>
        {areas.length === 0 && <p style={{ color: '#888' }}>No areas yet for this location.</p>}
        {areas.map((area) => (
          <div key={area.id} style={styles.card}>
            <strong>{area.name}</strong>
            <button onClick={() => handleDelete(area.id)} style={styles.deleteButton}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  locationPicker: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  label: { fontSize: '0.9rem', color: '#555' },
  select: {
    padding: '0.5rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    fontSize: '0.95rem',
  },
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
