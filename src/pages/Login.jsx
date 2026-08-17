import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import logo from '../assets/maxoserve-logo.png'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'signup') {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      if (data.user) {
        await supabase.from('profiles').insert({ id: data.user.id, full_name: fullName, email })

        const { data: invite } = await supabase
          .from('staff_invites')
          .select('*')
          .eq('email', email.trim().toLowerCase())
          .is('accepted_at', null)
          .limit(1)
          .single()

        if (invite) {
          await supabase.from('business_members').insert({
            business_id: invite.business_id,
            user_id: data.user.id,
            role: invite.role,
          })
          await supabase
            .from('staff_invites')
            .update({ accepted_at: new Date().toISOString() })
            .eq('id', invite.id)

          navigate('/admin')
          setLoading(false)
          return
        }
      }

      navigate('/admin/create-business')
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      navigate('/admin')
    }

    setLoading(false)
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img src={logo} alt="MaxoServe" style={styles.logo} />
        <p style={styles.subtitle}>Scan. Request. Served.</p>

        <div style={styles.toggleRow}>
          <button
            type="button"
            onClick={() => setMode('login')}
            style={mode === 'login' ? styles.toggleActive : styles.toggle}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => setMode('signup')}
            style={mode === 'signup' ? styles.toggleActive : styles.toggle}
          >
            Sign Up
          </button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              style={styles.input}
            />
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={styles.input}
          />

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" disabled={loading} style={styles.submit}>
            {loading ? 'Please wait…' : mode === 'signup' ? 'Create Account' : 'Log In'}
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
    background: 'radial-gradient(circle at top, #1b2440 0%, #0e1220 60%)',
    padding: '1rem',
  },
  card: {
    background: '#ffffff',
    borderRadius: '20px',
    padding: '2.5rem 2rem',
    width: '100%',
    maxWidth: '380px',
    boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
    textAlign: 'center',
  },
  logo: {
    width: '150px',
    height: '150px',
    display: 'block',
    margin: '0 auto 0.25rem',
  },
  subtitle: { margin: '0 0 1.75rem', color: '#6b7280', fontSize: '0.95rem', fontWeight: 500 },
  toggleRow: {
    display: 'flex',
    marginBottom: '1.5rem',
    background: '#f3f4f6',
    borderRadius: '10px',
    padding: '4px',
  },
  toggle: {
    flex: 1,
    padding: '0.55rem',
    border: 'none',
    borderRadius: '8px',
    background: 'transparent',
    color: '#6b7280',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  toggleActive: {
    flex: 1,
    padding: '0.55rem',
    border: 'none',
    borderRadius: '8px',
    background: '#ffffff',
    color: '#14161a',
    fontWeight: 600,
    fontSize: '0.9rem',
    cursor: 'pointer',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '0.85rem', textAlign: 'left' },
  input: {
    padding: '0.75rem 0.9rem',
    borderRadius: '10px',
    border: '1.5px solid #e5e7eb',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'border-color 0.15s',
  },
  submit: {
    marginTop: '0.4rem',
    padding: '0.8rem',
    borderRadius: '10px',
    border: 'none',
    background: '#3b6fe0',
    color: '#fff',
    fontSize: '0.95rem',
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(59,111,224,0.35)',
  },
  error: { color: '#dc2626', fontSize: '0.85rem', margin: 0 },
}
