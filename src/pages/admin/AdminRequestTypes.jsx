import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

const ROLES = ['owner', 'admin', 'manager', 'hostess', 'server', 'bartender', 'kitchen', 'staff']

const PRESETS = [
  { label: 'Call Server', routes_to_role: 'server' },
  { label: 'Call Hostess', routes_to_role: 'hostess' },
  { label: 'Request Bill', routes_to_role: 'server' },
  { label: 'Request Water', routes_to_role: 'server' },
  { label: 'Request Ice', routes_to_role: 'bartender' },
  { label: 'Request Cups', routes_to_role: 'bartender' },
  { label: 'Request Napkins', routes_to_role: 'server' },
  { label: 'Report a Problem', routes_to_role: 'manager' },
]

export default function AdminRequestTypes() {
  const { user } = useAuth()
  const [businessId, setBusinessId] = useState(null)
  const [types, setTypes] = useState([])
  const [label, setLabel] = useState('')
  const [routesToRole, setRoutesToRole] = useState('server')
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
    await loadTypes(membership.business_id)
    setLoading(false)
  }

  async function loadTypes(bizId) {
    const { data, error: typesError } = await supabase
      .from('service_request_types')
      .select('*')
      .eq('business_id', bizId)
      .order('display_order', { ascending: true })

    if (typesError) {
      setError(typesError.message)
    } else {
      setTypes(data)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')

    const { error: insertError } = await supabase.from('service_request_types').insert({
      business_id: businessId,
      label,
      routes_to_role: routesToRole,
      display_order: types.length,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    setLabel('')
    loadTypes(businessId)
  }

  async function handleAddPreset(preset) {
    setError('')
    const { error: insertError } = await supabase.from('service_request_types').insert({
      business_id: businessId,
      label: preset.label,
      routes_to_role: preset.routes_to_role,
      display_order: types.length,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    loadTypes(businessId)
  }

  async function handleToggleActive(type) {
    await supabase
      .from('service_request_types')
      .update({ is_active: !type.is_active })
      .eq('id', type.id)
    loadTypes(businessId)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this request button? Customers will no longer see it.')) return
    await supabase.from('service_request_types').delete().eq('id', id)
    loadTypes(businessId)
  }

  if (loading) return <div><h2>Request Types</h2><p>Loading...</p></div>

  const existingLabels = types.map((t) => t.label)
  const availablePresets = PRESETS.filter((p) => !existingLabels.includes(p.label))

  return (
    <div>
      <h2>Request Buttons</h2>
      <p style={{ color: '#666' }}>
        These are the buttons customers see on their table page (e.g. "Call Server", "Request Bill").
        Each one routes to a staff role.
      </p>

      {availablePresets.length > 0 && (
        <div style={styles.presetsBox}>
          <p style={styles.presetsLabel}>Quick add common buttons:</p>
          <div style={styles.presetsRow}>
            {availablePresets.map((p) => (
              <button key={p.label} onClick={() => handleAddPreset(p)} style={styles.presetButton}>
                + {p.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleAdd} style={styles.form}>
        <input
          type="text"
          placeholder="Custom button label (e.g. Bottle Service)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
          style={styles.input}
        />
        <select value={routesToRole} onChange={(e) => setRoutesToRole(e.target.value)} style={styles.select}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button type="submit" style={styles.button}>Add Button</button>
      </form>

      {error && <p style={{ color: '#d33' }}>{error}</p>}

      <div style={styles.list}>
        {types.length === 0 && <p style={{ color: '#888' }}>No request buttons yet.</p>}
        {types.map((t) => (
          <div key={t.id} style={styles.card}>
            <div>
              <strong>{t.label}</strong>
              <span style={styles.meta}> · routes to {t.routes_to_role || 'unassigned'}</span>
              {!t.is_active && <span style={styles.inactiveBadge}>hidden from customers</span>}
            </div>
            <div style={styles.cardActions}>
              <button onClick={() => handleToggleActive(t)} style={styles.toggleButton}>
                {t.is_active ? 'Hide' : 'Show'}
              </button>
              <button onClick={() => handleDelete(t.id)} style={styles.deleteButton}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  presetsBox: {
    background: '#f5f6f8',
    border: '1px solid #e2e4e9',
    borderRadius: '8px',
    padding: '1rem',
    marginBottom: '1.5rem',
  },
  presetsLabel: { margin: '0 0 0.5rem', fontSize: '0.85rem', color: '#555' },
  presetsRow: { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  presetButton: {
    padding: '0.4rem 0.8rem',
    borderRadius: '999px',
    border: '1px solid #4c8dff',
    background: '#fff',
    color: '#4c8dff',
    cursor: 'pointer',
    fontSize: '0.85rem',
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
    flex: '1 1 220px',
  },
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
  meta: { color: '#888', fontSize: '0.85rem', marginLeft: '0.4rem' },
  inactiveBadge: {
    marginLeft: '0.6rem',
    fontSize: '0.75rem',
    padding: '0.15rem 0.5rem',
    borderRadius: '999px',
    background: '#fce4ec',
    color: '#c2185b',
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
