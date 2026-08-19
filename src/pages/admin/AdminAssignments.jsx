import { useEffect, useState } from 'react'
import { UserRoundCog, Plus, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrentLocation } from '../../contexts/LocationContext'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'

export default function AdminAssignments() {
  const { user } = useAuth()
  const { currentLocationId } = useCurrentLocation()
  const [businessId, setBusinessId] = useState(null)
  const [members, setMembers] = useState([])
  const [profiles, setProfiles] = useState({})
  const [areas, setAreas] = useState([])
  const [tables, setTables] = useState([])
  const [assignments, setAssignments] = useState([])

  const [selectedUserId, setSelectedUserId] = useState('')
  const [scopeType, setScopeType] = useState('table')
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [selectedTableId, setSelectedTableId] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadInitial() }, [])

  async function loadInitial() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
    if (!membership) { setLoading(false); return }
    setBusinessId(membership.business_id)

    const { data: membersData } = await supabase.from('business_members').select('*').eq('business_id', membership.business_id)
    setMembers(membersData || [])
    if (membersData && membersData.length > 0) {
      const userIds = membersData.map((m) => m.user_id)
      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', userIds)
      const map = {}
      for (const p of profilesData || []) map[p.id] = p
      setProfiles(map)
    }

    const { data: areasData } = await supabase.from('areas').select('*').eq('business_id', membership.business_id)
    setAreas(areasData || [])

    const { data: tablesData } = await supabase.from('tables').select('*').eq('business_id', membership.business_id)
    setTables(tablesData || [])

    await loadAssignments(membership.business_id)
    setLoading(false)
  }

  async function loadAssignments(bizId) {
    const { data, error: assignError } = await supabase
      .from('staff_assignments').select('*').eq('business_id', bizId).order('created_at', { ascending: false })
    if (assignError) setError(assignError.message)
    else setAssignments(data)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!selectedUserId) { setError('Select a staff member.'); return }

    const row = { business_id: businessId, user_id: selectedUserId, location_id: null, area_id: null, table_id: null }

    if (scopeType === 'location') {
      if (!currentLocationId) { setError('Select a location.'); return }
      row.location_id = currentLocationId
    } else if (scopeType === 'area') {
      if (!selectedAreaId) { setError('Select an area.'); return }
      row.area_id = selectedAreaId
    } else {
      if (!selectedTableId) { setError('Select a table.'); return }
      row.table_id = selectedTableId
    }

    const { error: insertError } = await supabase.from('staff_assignments').insert(row)
    if (insertError) { setError(insertError.message); return }
    loadAssignments(businessId)
  }

  async function handleRemove(id) {
    await supabase.from('staff_assignments').delete().eq('id', id)
    loadAssignments(businessId)
  }

  function describeAssignment(a) {
    if (a.table_id) return `Table: ${tables.find((tb) => tb.id === a.table_id)?.name || 'Unknown'}`
    if (a.area_id) return `Area: ${areas.find((ar) => ar.id === a.area_id)?.name || 'Unknown'}`
    if (a.location_id) return 'Entire location'
    return 'Unknown scope'
  }

  const areasForSelectedLocation = areas.filter((a) => a.location_id === currentLocationId)
  const tablesForSelectedLocation = tables.filter((t) => t.location_id === currentLocationId)

  if (loading) return <LoadingState label="Loading assignments…" />

  return (
    <div>
      <PageHeader title="Staff Assignments" subtitle="Assign staff to a specific table, a whole area, or an entire location. Remove an assignment to unassign." />

      <Card style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
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
          {scopeType === 'area' && (
            <select value={selectedAreaId} onChange={(e) => setSelectedAreaId(e.target.value)} style={styles.select}>
              <option value="">Select area</option>
              {areasForSelectedLocation.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          {scopeType === 'table' && (
            <select value={selectedTableId} onChange={(e) => setSelectedTableId(e.target.value)} style={styles.select}>
              <option value="">Select table</option>
              {tablesForSelectedLocation.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <Button type="submit" icon={Plus}>Assign</Button>
        </form>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>}
      </Card>

      {assignments.length === 0 ? (
        <EmptyState icon={UserRoundCog} title="No assignments yet" description="Assign staff above to see them here." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {assignments.map((a) => (
            <Card key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{profiles[a.user_id]?.full_name || profiles[a.user_id]?.email || 'Unknown'}</strong>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}> · {describeAssignment(a)}</span>
              </div>
              <Button variant="danger" size="sm" icon={X} onClick={() => handleRemove(a.id)}>Unassign</Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  select: { padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--color-border)', fontSize: '0.9rem' },
}
