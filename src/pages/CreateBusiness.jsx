import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

export default function CreateBusiness() {
  const navigate = useNavigate()
  const { user, refreshRole } = useAuth()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!user) {
      setError('You must be logged in.')
      return
    }

    setLoading(true)

    // Generate the business ID ourselves so we don't need to "read it back"
    // from Supabase before the user has a membership row (RLS would block that read).
    const businessId = crypto.randomUUID()

    // Step 1: create the business
    const { error: businessError } = await supabase
      .from('businesses')
      .insert({ id: businessId, name })

    if (businessError) {
      setError(businessError.message)
      setLoading(false)
      return
    }

    // Step 2: make this user the owner of the business
    const { error: memberError } = await supabase
      .from('business_members')
      .insert({
        business_id: businessId,
        user_id: user.id,
        role: 'owner',
      })

    if (memberError) {
      setError(memberError.message)
      setLoading(false)
      return
    }

    // Step 3: create default settings for this business
    await supabase.from('business_settings').insert({
      business_id: businessId,
    })

    // Refresh auth context so /admin immediately knows about the new business,
    // instead of showing a stale "no business" state until manually refreshed
    await refreshRole()

    navigate('/admin')
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Set up your business</h1>
        <p style={styles.subtitle}>
          What's the name of your restaurant, lounge, or venue?
        </p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            placeholder="e.g. Club Max"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={styles.input}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.submit}>
            {loading ? 'Creating...' : 'Create Business'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f6f8',
    fontFamily: 'system-ui, sans-serif',
    padding: '1rem',
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    padding: '2rem',
    width: '100%',
    maxWidth: '360px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  title: { margin: 0, fontSize: '1.4rem' },
  subtitle: { margin: '0.25rem 0 1.5rem', color: '#666', fontSize: '0.9rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  input: {
    padding: '0.65rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    fontSize: '1rem',
  },
  submit: {
    marginTop: '0.5rem',
    padding: '0.75rem',
    borderRadius: '8px',
    border: 'none',
    background: '#4c8dff',
    color: '#fff',
    fontSize: '1rem',
    cursor: 'pointer',
  },
  error: { color: '#d33', fontSize: '0.9rem', margin: 0 },
}
