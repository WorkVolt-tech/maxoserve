import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

const ROLES = ['admin', 'manager', 'hostess', 'server', 'bartender', 'kitchen', 'staff']

export default function AdminStaff() {
  const { user } = useAuth()
  const [businessId, setBusinessId] = useState(null)
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [profiles, setProfiles] = useState({})

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('server')

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
    await loadMembers(membership.business_id)
    await loadInvites(membership.business_id)
    setLoading(false)
  }

  async function loadMembers(bizId) {
    const { data: membersData, error: membersError } = await supabase
      .from('business_members')
      .select('*')
      .eq('business_id', bizId)
      .order('created_at', { ascending: true })

    if (membersError) {
      setError(membersError.message)
      return
    }

    setMembers(membersData)

    if (membersData.length > 0) {
      const userIds = membersData.map((m) => m.user_id)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .in('id', userIds)

      const map = {}
      for (const p of profilesData || []) map[p.id] = p
      setProfiles(map)
    }
  }

  async function loadInvites(bizId) {
    const { data } = await supabase
      .from('staff_invites')
      .select('*')
      .eq('business_id', bizId)
      .is('accepted_at', null)
      .order('created_at', { ascending: false })

    setInvites(data || [])
  }

  async function handleInvite(e) {
    e.preventDefault()
    setError('')

    const { error: insertError } = await supabase.from('staff_invites').insert({
      business_id: businessId,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invited_by: user.id,
    })

    if (insertError) {
      if (insertError.code === '23505') {
        setError('An invite for this email already exists.')
      } else {
        setError(insertError.message)
      }
      return
    }

    setInviteEmail('')
    setInviteRole('server')
    loadInvites(businessId)
  }

  async function handleCancelInvite(id) {
    await supabase.from('staff_invites').delete().eq('id', id)
    loadInvites(businessId)
  }

  async function handleChangeRole(member, newRole) {
    await supabase.from('business_members').update({ role: newRole }).eq('id', member.id)
    loadMembers(businessId)
  }

  async function handleRemoveMember(member) {
    if (member.role === 'owner') {
      alert("The owner can't be removed.")
      return
    }
    if (!confirm('Remove this staff member from your business?')) return
    await supabase.from('business_members').delete().eq('id', member.id)
    loadMembers(businessId)
  }

  if (loading) return <div><h2>Staff</h2><p>Loading...</p></div>

  return (
    <div>
      <h2>Staff</h2>
      <p style={{ color: '#666' }}>
        Invite staff by email. When they sign up with that email, they'll automatically join your business with the role you set.
      </p>

      <form onSubmit={handleInvite} style={styles.form}>
        <input
          type="email"
          placeholder="staff@email.com"
          value={inviteEmail}
          onChange={(e) => setInviteEmail(e.target.value)}
          required
          style={styles.input}
        />
        <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={styles.select}>
          {ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button type="submit" style={styles.button}>Send Invite</button>
      </form>

      {error && <p style={{ color: '#d33' }}>{error}</p>}

      {invites.length > 0 && (
        <>
          <h3 style={styles.sectionTitle}>Pending Invites</h3>
          <div style={styles.list}>
            {invites.map((inv) => (
              <div key={inv.id} style={styles.card}>
                <div>
                  <strong>{inv.email}</strong>
                  <span style={styles.meta}> · {inv.role}</span>
                  <span style={styles.pendingBadge}>pending</span>
                </div>
                <button onClick={() => handleCancelInvite(inv.id)} style={styles.deleteButton}>
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 style={styles.sectionTitle}>Team</h3>
      <div style={styles.list}>
        {members.map((member) => {
          const profile = profiles[member.user_id]
          return (
            <div key={member.id} style={styles.card}>
              <div>
                <strong>{profile?.full_name || profile?.email || 'Unknown user'}</strong>
                {profile?.email && profile?.full_name && (
                  <span style={styles.meta}> · {profile.email}</span>
                )}
              </div>
              <div style={styles.cardActions}>
                {member.role === 'owner' ? (
                  <span style={styles.ownerBadge}>owner</span>
                ) : (
                  <>
                    <select
                      value={member.role}
                      onChange={(e) => handleChangeRole(member, e.target.value)}
                      style={styles.roleSelect}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <button onClick={() => handleRemoveMember(member)} style={styles.deleteButton}>
                      Remove
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const styles = {
  form: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
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
  sectionTitle: { marginTop: '1.5rem', marginBottom: '0.5rem', fontSize: '1.05rem' },
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
  pendingBadge: {
    marginLeft: '0.6rem',
    fontSize: '0.75rem',
    padding: '0.15rem 0.5rem',
    borderRadius: '999px',
    background: '#fff3e0',
    color: '#e65100',
  },
  ownerBadge: {
    fontSize: '0.75rem',
    padding: '0.25rem 0.6rem',
    borderRadius: '999px',
    background: '#e8f5e9',
    color: '#2e7d32',
    fontWeight: 600,
  },
  cardActions: { display: 'flex', gap: '0.5rem', alignItems: 'center' },
  roleSelect: {
    padding: '0.4rem',
    borderRadius: '6px',
    border: '1px solid #e2e4e9',
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
