import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import logo from '../assets/maxoserve-logo.png'

export default function Login() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login') // 'login' or 'signup'
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
        options: {
          data: { full_name: fullName },
        },
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      // Create the matching profile row
      if (data.user) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          full_name: fullName,
          email,
        })
      }

      navigate('/admin/create-business')
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

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
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Log In'}
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
  title: { margin: 0, fontSize: '1.5rem' },
  logo: { width: '96px', height: '96px', marginBottom: '0.5rem' },
  subtitle: { margin: '0.25rem 0 1.5rem', color: '#666' },
  toggleRow: {
    display: 'flex',
    marginBottom: '1.5rem',
    border: '1px solid #e2e4e9',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  toggle: {
    flex: 1,
    padding: '0.5rem',
    border: 'none',
    background: '#fff',
    cursor: 'pointer',
  },
  toggleActive: {
    flex: 1,
    padding: '0.5rem',
    border: 'none',
    background: '#4c8dff',
    color: '#fff',
    cursor: 'pointer',
  },
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
