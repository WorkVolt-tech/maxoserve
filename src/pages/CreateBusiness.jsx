import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/maxoserve-logo.png'

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

    const businessId = crypto.randomUUID()

    const { error: businessError } = await supabase
      .from('businesses')
      .insert({ id: businessId, name })

    if (businessError) {
      setError(businessError.message)
      setLoading(false)
      return
    }

    const { error: memberError } = await supabase
      .from('business_members')
      .insert({ business_id: businessId, user_id: user.id, role: 'owner' })

    if (memberError) {
      setError(memberError.message)
      setLoading(false)
      return
    }

    await supabase.from('business_settings').insert({ business_id: businessId })

    await refreshRole()

    navigate('/admin')
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img src={logo} alt="MaxoServe" style={styles.logo} />

        <div style={styles.iconWrap}>
          <Building2 size={22} color="var(--color-primary, #3b6fe0)" />
        </div>

        <h1 style={styles.title}>Welcome to MaxoServe</h1>
        <p style={styles.subtitle}>Let's get your venue ready. What should we call it?</p>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            placeholder="e.g. Club Max"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            style={styles.input}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.submit}>
            {loading ? 'Setting up your venue…' : 'Create Business'}
          </button>
        </form>

        <p style={styles.footnote}>
          You can add locations, tables, and your menu once your business is created.
        </p>
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
    background: 'radial-gradient(circle at top, #1b2440 0%, #0e1220 60%)',
    padding: '1rem',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  card: {
    background: '#ffffff',
    borderRadius: '20px',
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: '400px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
    textAlign: 'center',
  },
  logo: { width: '72px', height: '72px', margin: '0 auto 1rem', display: 'block' },
  iconWrap: {
    width: '48px', height: '48px', borderRadius: '14px',
    background: 'var(--color-primary-soft, #eaf0fd)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 1rem',
  },
  title: { fontSize: '1.4rem', margin: '0 0 0.4rem', letterSpacing: '-0.01em' },
  subtitle: { color: '#6b7280', fontSize: '0.92rem', margin: '0 0 1.75rem' },
  form: { display: 'flex', flexDirection: 'column', gap: '0.85rem', textAlign: 'left' },
  input: {
    padding: '0.8rem 1rem',
    borderRadius: '12px',
    border: '1.5px solid #e5e7eb',
    fontSize: '1rem',
    outline: 'none',
    textAlign: 'center',
    fontWeight: 600,
  },
  submit: {
    marginTop: '0.4rem',
    padding: '0.85rem',
    borderRadius: '12px',
    border: 'none',
    background: '#3b6fe0',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(59,111,224,0.35)',
  },
  error: { color: '#dc2626', fontSize: '0.85rem', margin: 0, textAlign: 'center' },
  footnote: { color: '#9ca3af', fontSize: '0.8rem', marginTop: '1.5rem', marginBottom: 0 },
}
