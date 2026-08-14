import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

export default function AdminAssignments() {
  const { user } = useAuth()
  const [businessId, setBusinessId] = useState(null)
  const [members, setMembers] = useState([])
  const [profiles, setProfiles] = useState({})
  const [locations, setLocations] = useState([])
  const [areas, setAreas] = useState([])
  const [tables, setTables] = useState([])
  const [assignments, setAssignments] = useState([])

  const [selectedUserId, setSelectedUserId] = useState('')
  const [scopeType, setScopeType] = useState('table') // 'location' | 'area' | 'table'
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [selectedTableId, setSelectedTableId] = useState('')

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

    const { data: membersData } = await supabase
      .from('business_members')
      .select('*')
      .eq('business_id', membership.business_id)

    setMembers(membersData || [])

    if (membersData && membersData.length > 0) {
      const userIds = membersData.map((m) => m.user_id)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)

      const map = {}
      for (const p of profilesData || []) map[p.id] = p
      setProfiles(map)
    }

    const { data: locationsData } = await supabase
      .from('locations')
      .select('*')
      .eq('business_id', membership.business_id)
      .order('created_at', { ascending: true })
    setLocations(locationsData || [])
    if (locationsData && locationsData.length > 0) {
      setSelectedLocationId(locationsData[0].id)
    }

    const { data: areasData } = await supabase
      .from('areas')
      .select('*')
      .eq('business_id', membership.business_id)
    setAreas(areasData || [])

    const { data: tablesData } = await supabase
      .from('tables')
      .select('*')
      .eq('business_id', membership.business_id)
    setTables(tablesData || [])

    await loadAssignments(membership.business_id)
    setLoading(false)
  }

  async function loadAssignments(bizId) {
    const { data, error: assignError } = await supabase
      .from('staff_assignments')
      .select('*')
      .eq('business_id', bizId)
      .order('created_at', { ascending: false })

    if (assignError) {
      setError(assignError.message)
    } else {
      setAssignments(data)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')

    if (!selectedUserId) {
      setError('Select a staff member.')
      return
    }

    const row = {
      business_id: businessId,
      user_id: selectedUserId,
      location_id: null,
      area_id: null,
      table_id: null,
    }

    if (scopeType === 'location') {
      if (!selectedLocationId) { setError('Select a location.'); return }
      row.location_id = selectedLocationId
    } else if (scopeType === 'area') {
      if (!selectedAreaId) { setError('Select an area.'); return }
      row.area_id = selectedAreaId
    } else {
      if (!selectedTableId) { setError('Select a table.'); return }
      row.table_id = selectedTableId
    }

    const { error: insertError } = await supabase.from('staff_assignments').insert(row)

    if (insertError) {
      setError(insertError.message)
      return
    }

    loadAssignments(businessId)
  }

  async function handleRemove(id) {
    await supabase.from('staff_assignments').delete().eq('id', id)
    loadAssignments(businessId)
  }

  function describeAssignment(a) {
    if (a.table_id) {
      const t = tables.find((tb) => tb.id === a.table_id)
      return `Table: ${t?.name || 'Unknown'}`
    }
    if (a.area_id) {
      const ar = areas.find((ar) => ar.id === a.area_id)
      return `Area: ${ar?.name || 'Unknown'}`
    }
    if (a.location_id) {
      const l = locations.find((loc) => loc.id === a.location_id)
      return `Location: ${l?.name || 'Unknown'}`
    }
    return 'Unknown scope'
  }

  const areasForSelectedLocation = areas.filter((a) => a.location_id === selectedLocationId)
  const tablesForSelectedLocation = tables.filter((t) => t.location_id === selectedLocationId)

  if (loading) return <div><h2>Assignments</h2><p>Loading...</p></div>

  return (
    <div>
      <h2>Staff Assignments</h2>
      <p style={{ color: '#666' }}>
        Assign staff to a specific table, a whole area, or an entire location. Remove an assignment to unassign.
      </p>

      <form onSubmit={handleAdd} style={styles.form}>
        <select value={selectedUserId} onChange={(e) => setSelectedUserId(e.target.value)} style={styles.select}>
          <option value="">Select staff member</option>
          {members.map((m) => (
            <option key={m.user_id} value={m.user_id}>
              {profiles[m.user_id]?.full_name || profiles[m.user_id]?.email || 'Unknown'} ({m.role})
            </option>
          ))}
        </select>

        <select value={scopeType} onChange={(e) => setScopeType(e.target.value)} style={styles.select}>
          <option value="table">Specific table</option>
          <option value="area">Whole area</option>
          <option value="location">Entire location</option>
        </select>

        <select value={selectedLocationId} onChange={(e) => setSelectedLocationId(e.target.value)} style={styles.select}>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>{loc.name}</option>
          ))}
        </select>

        {scopeType === 'area' && (
          <select value={selectedAreaId} onChange={(e) => setSelectedAreaId(e.target.value)} style={styles.select}>
            <option value="">Select area</option>
            {areasForSelectedLocation.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        )}

        {scopeType === 'table' && (
          <select value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)} style={styles.select}>
            <option value="">Select table</option>
            {tablesForSelectedLocation.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}

        <button type="submit" style={styles.button}>Assign</button>
      </form>

      {error && <p style={{ color: '#d33' }}>{error}</p>}

      <div style={styles.list}>
        {assignments.length === 0 && <p style={{ color: '#888' }}>No assignments yet.</p>}
        {assignments.map((a) => (
          <div key={a.id} style={styles.card}>
            <div>
              <strong>{profiles[a.user_id]?.full_name || profiles[a.user_id]?.email || 'Unknown'}</strong>
              <span style={styles.meta}> · {describeAssignment(a)}</span>
            </div>
            <button onClick={() => handleRemove(a.id)} style={styles.deleteButton}>
              Unassign
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  form: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  select: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    fontSize: '0.95rem',
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
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  meta: { color: '#888', fontSize: '0.85rem' },
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
