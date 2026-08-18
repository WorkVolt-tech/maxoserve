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

    if (locationsError) setError(locationsError.message)
    else setLocations(locationsData)

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

  if (loading) return <div><h2 style={s.title}>Locations</h2><p style={s.muted}>Loading…</p></div>

  return (
    <div>
      <h2 style={s.title}>Locations</h2>
      <p style={s.subtitle}>
        A location is a physical address (e.g. "Club Max — Montreal"). Add each address your business operates at.
      </p>

      <form onSubmit={handleAdd} style={s.form}>
        <input
          type="text"
          placeholder="Location name (e.g. Downtown)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          style={s.input}
        />
        <input
          type="text"
          placeholder="Address (optional)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          style={s.input}
        />
        <button type="submit" style={s.primaryButton}>Add Location</button>
      </form>

      {error && <p style={s.error}>{error}</p>}

      <div style={s.list}>
        {locations.length === 0 && <p style={s.empty}>No locations yet.</p>}
        {locations.map((loc) => (
          <div key={loc.id} style={s.card}>
            <div>
              <div style={s.cardTitle}>{loc.name}</div>
              {loc.address && <div style={s.cardMeta}>{loc.address}</div>}
            </div>
            <button onClick={() => handleDelete(loc.id)} style={s.dangerButton}>
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export const s = {
  title: { fontSize: '1.5rem' },
  subtitle: { color: 'var(--color-text-muted)', marginTop: '-0.5rem', marginBottom: '1.5rem', maxWidth: '560px' },
  muted: { color: 'var(--color-text-muted)' },
  empty: { color: 'var(--color-text-faint)' },
  error: { color: 'var(--color-danger)', fontSize: '0.88rem', marginBottom: '0.75rem' },
  form: { display: 'flex', gap: '0.6rem', marginBottom: '1.75rem', flexWrap: 'wrap' },
  input: {
    padding: '0.65rem 0.85rem',
    borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--color-border)',
    fontSize: '0.92rem',
    flex: '1 1 200px',
    outline: 'none',
    background: 'var(--color-surface)',
  },
  select: {
    padding: '0.65rem 0.85rem',
    borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--color-border)',
    fontSize: '0.92rem',
    background: 'var(--color-surface)',
  },
  textarea: {
    padding: '0.65rem 0.85rem',
    borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--color-border)',
    fontSize: '0.92rem',
    width: '100%',
    minHeight: '60px',
    fontFamily: 'inherit',
    background: 'var(--color-surface)',
  },
  primaryButton: {
    padding: '0.65rem 1.3rem',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--color-primary)',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.92rem',
    fontWeight: 600,
  },
  secondaryButton: {
    padding: '0.5rem 0.9rem',
    borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
  dangerButton: {
    padding: '0.5rem 0.9rem',
    borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--color-border)',
    background: 'var(--color-surface)',
    color: 'var(--color-danger)',
    cursor: 'pointer',
    fontSize: '0.85rem',
    fontWeight: 500,
  },
  list: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  card: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--color-surface)',
    padding: '1.1rem 1.25rem',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    boxShadow: 'var(--shadow-sm)',
  },
  cardTitle: { fontWeight: 600, fontSize: '0.95rem' },
  cardMeta: { color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.2rem' },
}
