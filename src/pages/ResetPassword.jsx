import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import logo from '../assets/maxoserve-logo.png'

export default function ResetPassword() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [validLink, setValidLink] = useState(false)

  useEffect(() => {
    // Supabase automatically exchanges the recovery token in the URL for a
    // temporary session when this page loads (detectSessionInUrl is on by
    // default). We just need to confirm a session actually exists.
    supabase.auth.getSession().then(({ data }) => {
      setValidLink(!!data.session)
      setCheckingSession(false)
    })
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError("Passwords don't match.")
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setSuccess(true)
    setTimeout(() => navigate('/admin'), 1800)
  }

  if (checkingSession) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <p style={{ color: '#6b7280' }}>Loading…</p>
        </div>
      </div>
    )
  }

  if (!validLink) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <img src={logo} alt="MaxoServe" style={styles.logo} />
          <h2 style={styles.title}>Link expired or invalid</h2>
          <p style={styles.body}>
            This password reset link is no longer valid. Please request a new one from the login page.
          </p>
          <button onClick={() => navigate('/login')} style={styles.submit}>Back to Log In</button>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <img src={logo} alt="MaxoServe" style={styles.logo} />
          <h2 style={styles.title}>Password updated</h2>
          <p style={styles.body}>Taking you to your dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <img src={logo} alt="MaxoServe" style={styles.logo} />
        <h2 style={styles.title}>Set a new password</h2>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={styles.input}
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            style={styles.input}
          />
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" disabled={loading} style={styles.submit}>
            {loading ? 'Updating…' : 'Update Password'}
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
  logo: { width: '110px', height: '110px', display: 'block', margin: '0 auto 1rem' },
  title: { fontSize: '1.25rem', margin: '0 0 0.5rem' },
  body: { color: '#6b7280', fontSize: '0.9rem', margin: '0 0 1.5rem', lineHeight: 1.5 },
  form: { display: 'flex', flexDirection: 'column', gap: '0.85rem', textAlign: 'left' },
  input: {
    padding: '0.75rem 0.9rem',
    borderRadius: '10px',
    border: '1.5px solid #e5e7eb',
    fontSize: '0.95rem',
    outline: 'none',
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
