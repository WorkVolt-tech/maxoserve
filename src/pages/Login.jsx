import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'
import logo from '../assets/maxoserve-logo.png'

async function tryAcceptInvite(email, userId) {
  const { data: invite } = await supabase
    .from('staff_invites')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .is('accepted_at', null)
    .limit(1)
    .single()

  if (!invite) return 'none'

  const { error: memberError } = await supabase.from('business_members').insert({
    business_id: invite.business_id,
    user_id: userId,
    role: invite.role,
    expires_at: invite.expires_at || null,
  })

  if (memberError) {
    console.error('Failed to join business from invite:', memberError)
    return 'error'
  }

  await supabase
    .from('staff_invites')
    .update({ accepted_at: new Date().toISOString() })
    .eq('id', invite.id)

  return 'joined'
}

export default function Login() {
  const navigate = useNavigate()
  const { refreshRole } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'signup' | 'forgot'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [confirmEmailSent, setConfirmEmailSent] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'signup') {
      if (password !== confirmPassword) {
        setError("Passwords don't match.")
        setLoading(false)
        return
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })

      if (signUpError) {
        setError(signUpError.message)
        setLoading(false)
        return
      }

      // With email confirmation required, signUp does NOT return a live
      // session — the person must click the emailed link first.
      if (!signUpData.session) {
        setConfirmEmailSent(true)
        setLoading(false)
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 600))

      const { data: membership } = await supabase
        .from('business_members')
        .select('business_id')
        .limit(1)
        .single()

      navigate(membership ? '/admin' : '/admin/create-business')
    } else {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        setError(signInError.message)
        setLoading(false)
        return
      }

      if (signInData.user) {
        const result = await tryAcceptInvite(email, signInData.user.id)
        if (result === 'joined') {
          await refreshRole()
        }
      }

      navigate('/admin')
    }

    setLoading(false)
  }

  if (confirmEmailSent) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <img src={logo} alt="MaxoServe" style={styles.logo} />
          <h2 style={styles.forgotTitle}>Confirm your email</h2>
          <p style={styles.forgotBody}>
            We've sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then come back here to log in.
          </p>
          <button
            type="button"
            onClick={() => { setMode('login'); setConfirmEmailSent(false) }}
            style={styles.submit}
          >
            Back to Log In
          </button>
        </div>
      </div>
    )
  }

  async function handleForgotPassword(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (resetError) {
      setError(resetError.message)
      return
    }

    setForgotSent(true)
  }

  if (mode === 'forgot') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <img src={logo} alt="MaxoServe" style={styles.logo} />

          {forgotSent ? (
            <>
              <h2 style={styles.forgotTitle}>Check your email</h2>
              <p style={styles.forgotBody}>
                If an account exists for <strong>{email}</strong>, we've sent a link to reset your password.
              </p>
              <button
                type="button"
                onClick={() => { setMode('login'); setForgotSent(false) }}
                style={styles.submit}
              >
                Back to Log In
              </button>
            </>
          ) : (
            <>
              <h2 style={styles.forgotTitle}>Reset your password</h2>
              <p style={styles.forgotBody}>Enter your email and we'll send you a link to reset it.</p>
              <form onSubmit={handleForgotPassword} style={styles.form}>
                <input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={styles.input}
                />
                {error && <p style={styles.error}>{error}</p>}
                <button type="submit" disabled={loading} style={styles.submit}>
                  {loading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </form>
              <button
                type="button"
                onClick={() => setMode('login')}
                style={styles.linkButton}
              >
                Back to Log In
              </button>
            </>
          )}
        </div>
      </div>
    )
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
          {mode === 'signup' && (
            <input
              type="password"
              placeholder="Confirm password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={6}
              style={styles.input}
            />
          )}

          {mode === 'login' && (
            <button
              type="button"
              onClick={() => { setMode('forgot'); setError('') }}
              style={styles.forgotLink}
            >
              Forgot password?
            </button>
          )}

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
  forgotLink: {
    background: 'transparent',
    border: 'none',
    color: '#3b6fe0',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
    textAlign: 'right',
    padding: 0,
    marginTop: '-0.4rem',
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
  forgotTitle: { fontSize: '1.25rem', margin: '0.5rem 0 0.4rem' },
  forgotBody: { color: '#6b7280', fontSize: '0.9rem', margin: '0 0 1.5rem', lineHeight: 1.5 },
  linkButton: {
    background: 'transparent',
    border: 'none',
    color: '#6b7280',
    fontSize: '0.85rem',
    cursor: 'pointer',
    marginTop: '1rem',
    textDecoration: 'underline',
  },
}
