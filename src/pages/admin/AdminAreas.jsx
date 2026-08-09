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

  // Duplicate flow state
  const [duplicatingAreaId, setDuplicatingAreaId] = useState(null)
  const [duplicateName, setDuplicateName] = useState('')
  const [duplicateTargetLocationId, setDuplicateTargetLocationId] = useState('')
  const [duplicating, setDuplicating] = useState(false)

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

  function openDuplicateForm(area) {
    setDuplicatingAreaId(area.id)
    setDuplicateName(`${area.name} (Copy)`)
    setDuplicateTargetLocationId(selectedLocationId)
    setError('')
  }

  function cancelDuplicate() {
    setDuplicatingAreaId(null)
    setDuplicateName('')
  }

  async function handleConfirmDuplicate(sourceArea) {
    setError('')

    if (!duplicateName.trim()) {
      setError('Enter a name for the duplicated area.')
      return
    }

    setDuplicating(true)

    // Step 1: fetch all tables belonging to the source area
    const { data: sourceTables, error: tablesError } = await supabase
      .from('tables')
      .select('*')
      .eq('area_id', sourceArea.id)

    if (tablesError) {
      setError(tablesError.message)
      setDuplicating(false)
      return
    }

    // Step 2: create the new area
    const { data: newArea, error: newAreaError } = await supabase
      .from('areas')
      .insert({
        business_id: businessId,
        location_id: duplicateTargetLocationId,
        name: duplicateName,
        display_order: 0,
      })
      .select()
      .single()

    if (newAreaError) {
      setError(newAreaError.message)
      setDuplicating(false)
      return
    }

    // Step 3: copy every table into the new area, keeping shape/size/position
    if (sourceTables && sourceTables.length > 0) {
      const newTables = sourceTables.map((t) => ({
        business_id: businessId,
        location_id: duplicateTargetLocationId,
        area_id: newArea.id,
        name: t.name,
        table_number: t.table_number,
        capacity: t.capacity,
        shape: t.shape,
        status: 'available',
        pos_x: t.pos_x,
        pos_y: t.pos_y,
        width: t.width,
        height: t.height,
        rotation: t.rotation,
      }))

      const { error: copyTablesError } = await supabase.from('tables').insert(newTables)

      if (copyTablesError) {
        setError(copyTablesError.message)
        setDuplicating(false)
        return
      }
    }

    setDuplicating(false)
    setDuplicatingAreaId(null)
    setDuplicateName('')

    // Refresh the list if we duplicated into the currently viewed location
    if (duplicateTargetLocationId === selectedLocationId) {
      loadAreas(selectedLocationId)
    }
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
          <div key={area.id} style={styles.cardWrap}>
            <div style={styles.card}>
              <strong>{area.name}</strong>
              <div style={styles.cardActions}>
                <button onClick={() => openDuplicateForm(area)} style={styles.duplicateButton}>
                  Duplicate
                </button>
                <button onClick={() => handleDelete(area.id)} style={styles.deleteButton}>
                  Delete
                </button>
              </div>
            </div>

            {duplicatingAreaId === area.id && (
              <div style={styles.duplicateForm}>
                <div style={styles.duplicateRow}>
                  <label style={styles.label}>New area name:</label>
                  <input
                    type="text"
                    value={duplicateName}
                    onChange={(e) => setDuplicateName(e.target.value)}
                    style={styles.input}
                  />
                </div>
                <div style={styles.duplicateRow}>
                  <label style={styles.label}>Copy into location:</label>
                  <select
                    value={duplicateTargetLocationId}
                    onChange={(e) => setDuplicateTargetLocationId(e.target.value)}
                    style={styles.select}
                  >
                    {locations.map((loc) => (
                      <option key={loc.id} value={loc.id}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={styles.duplicateActions}>
                  <button
                    onClick={() => handleConfirmDuplicate(area)}
                    disabled={duplicating}
                    style={styles.button}
                  >
                    {duplicating ? 'Duplicating...' : 'Confirm Duplicate'}
                  </button>
                  <button onClick={cancelDuplicate} style={styles.cancelButton}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
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
  cardWrap: {
    background: '#fff',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    overflow: 'hidden',
  },
  card: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem',
  },
  cardActions: { display: 'flex', gap: '0.5rem' },
  duplicateButton: {
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid #4c8dff',
    background: '#fff',
    color: '#4c8dff',
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
  duplicateForm: {
    padding: '1rem',
    background: '#f9fafb',
    borderTop: '1px solid #e2e4e9',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  duplicateRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  duplicateActions: { display: 'flex', gap: '0.5rem' },
  cancelButton: {
    padding: '0.6rem 1.2rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    background: '#fff',
    color: '#555',
    cursor: 'pointer',
    fontSize: '0.95rem',
  },
}
