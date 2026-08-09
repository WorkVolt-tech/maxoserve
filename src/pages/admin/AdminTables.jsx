import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

const SHAPES = ['round', 'square', 'rectangle', 'booth', 'bar_seat', 'vip_section', 'custom']

export default function AdminTables() {
  const { user } = useAuth()
  const [businessId, setBusinessId] = useState(null)
  const [locations, setLocations] = useState([])
  const [areas, setAreas] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [tables, setTables] = useState([])

  const [name, setName] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [capacity, setCapacity] = useState('')
  const [shape, setShape] = useState('round')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadInitial()
  }, [])

  useEffect(() => {
    if (selectedLocationId) {
      loadAreasForLocation(selectedLocationId)
    } else {
      setAreas([])
      setSelectedAreaId('')
    }
  }, [selectedLocationId])

  useEffect(() => {
    if (selectedAreaId) {
      loadTables(selectedAreaId)
    } else {
      setTables([])
    }
  }, [selectedAreaId])

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

  async function loadAreasForLocation(locationId) {
    const { data, error: areasError } = await supabase
      .from('areas')
      .select('*')
      .eq('location_id', locationId)
      .order('display_order', { ascending: true })

    if (areasError) {
      setError(areasError.message)
      return
    }

    setAreas(data)
    if (data.length > 0) {
      setSelectedAreaId(data[0].id)
    } else {
      setSelectedAreaId('')
    }
  }

  async function loadTables(areaId) {
    const { data, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .eq('area_id', areaId)
      .order('created_at', { ascending: true })

    if (tablesError) {
      setError(tablesError.message)
    } else {
      setTables(data)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')

    if (!selectedAreaId) {
      setError('Select an area first.')
      return
    }

    const { error: insertError } = await supabase.from('tables').insert({
      business_id: businessId,
      location_id: selectedLocationId,
      area_id: selectedAreaId,
      name,
      table_number: tableNumber || null,
      capacity: capacity ? parseInt(capacity) : null,
      shape,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    setName('')
    setTableNumber('')
    setCapacity('')
    setShape('round')
    loadTables(selectedAreaId)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this table? Its QR code will stop working.')) return
    await supabase.from('tables').delete().eq('id', id)
    loadTables(selectedAreaId)
  }

  if (loading) return <div><h2>Tables</h2><p>Loading...</p></div>

  if (locations.length === 0) {
    return (
      <div>
        <h2>Tables</h2>
        <p style={{ color: '#888' }}>Create a location first (Locations tab).</p>
      </div>
    )
  }

  return (
    <div>
      <h2>Tables</h2>
      <p style={{ color: '#666' }}>Add and manage individual tables within an area.</p>

      <div style={styles.pickerRow}>
        <div>
          <label style={styles.label}>Location:</label>
          <select
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
            style={styles.select}
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label style={styles.label}>Area:</label>
          <select
            value={selectedAreaId}
            onChange={(e) => setSelectedAreaId(e.target.value)}
            style={styles.select}
            disabled={areas.length === 0}
          >
            {areas.length === 0 && <option>No areas yet</option>}
            {areas.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      {areas.length === 0 ? (
        <p style={{ color: '#888' }}>Create an area first (Areas tab) before adding tables.</p>
      ) : (
        <>
          <form onSubmit={handleAdd} style={styles.form}>
            <input
              type="text"
              placeholder="Table name (e.g. VIP 12)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={styles.input}
            />
            <input
              type="text"
              placeholder="Table # (optional)"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              style={{ ...styles.input, flex: '0 1 120px' }}
            />
            <input
              type="number"
              placeholder="Capacity"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              style={{ ...styles.input, flex: '0 1 100px' }}
            />
            <select value={shape} onChange={(e) => setShape(e.target.value)} style={styles.select}>
              {SHAPES.map((s) => (
                <option key={s} value={s}>{s.replace('_', ' ')}</option>
              ))}
            </select>
            <button type="submit" style={styles.button}>Add Table</button>
          </form>

          {error && <p style={{ color: '#d33' }}>{error}</p>}

          <div style={styles.list}>
            {tables.length === 0 && <p style={{ color: '#888' }}>No tables yet in this area.</p>}
            {tables.map((t) => (
              <div key={t.id} style={styles.card}>
                <div>
                  <strong>{t.name}</strong>
                  {t.table_number && <span style={styles.meta}> · #{t.table_number}</span>}
                  {t.capacity && <span style={styles.meta}> · seats {t.capacity}</span>}
                  <span style={styles.meta}> · {t.shape.replace('_', ' ')}</span>
                  <span style={styles.statusBadge}>{t.status}</span>
                </div>
                <button onClick={() => handleDelete(t.id)} style={styles.deleteButton}>
                  Delete
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const styles = {
  pickerRow: { display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' },
  label: { display: 'block', fontSize: '0.85rem', color: '#555', marginBottom: '0.25rem' },
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
    alignItems: 'flex-start',
  },
  input: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    fontSize: '0.95rem',
    flex: '1 1 160px',
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
  meta: { color: '#888', fontSize: '0.85rem', marginLeft: '0.4rem' },
  statusBadge: {
    marginLeft: '0.6rem',
    fontSize: '0.75rem',
    padding: '0.15rem 0.5rem',
    borderRadius: '999px',
    background: '#e8f5e9',
    color: '#2e7d32',
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
