import { useEffect, useState } from 'react'
import { Users, UserPlus, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import ConfirmationModal from '../../components/ui/ConfirmationModal'
import { useToast } from '../../contexts/ToastContext'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import { roleLabel } from '../../lib/roleLabels'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'

const ROLES = ['admin', 'manager', 'hostess', 'server', 'bartender', 'kitchen', 'staff']

export default function AdminStaff() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { t } = useAppLanguage()
  const [businessId, setBusinessId] = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null)
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [profiles, setProfiles] = useState({})

  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('server')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadInitial() }, [])

  async function loadInitial() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
    if (!membership) { setLoading(false); return }
    setBusinessId(membership.business_id)
    await loadMembers(membership.business_id)
    await loadInvites(membership.business_id)
    setLoading(false)
  }

  async function loadMembers(bizId) {
    const { data: membersData, error: membersError } = await supabase
      .from('business_members').select('*').eq('business_id', bizId).order('created_at', { ascending: true })
    if (membersError) { setError(membersError.message); return }
    setMembers(membersData)
    if (membersData.length > 0) {
      const userIds = membersData.map((m) => m.user_id)
      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', userIds)
      const map = {}
      for (const p of profilesData || []) map[p.id] = p
      setProfiles(map)
    }
  }

  async function loadInvites(bizId) {
    const { data } = await supabase
      .from('staff_invites').select('*').eq('business_id', bizId).is('accepted_at', null).order('created_at', { ascending: false })
    setInvites(data || [])
  }

  async function handleInvite(e) {
    e.preventDefault()
    setError('')
    const { error: insertError } = await supabase.from('staff_invites').insert({
      business_id: businessId, email: inviteEmail.trim().toLowerCase(), role: inviteRole, invited_by: user.id,
    })
    if (insertError) {
      setError(insertError.code === '23505' ? 'An invite for this email already exists.' : insertError.message)
      return
    }
    showToast(`Invite sent to ${inviteEmail}`)
    setInviteEmail(''); setInviteRole('server')
    loadInvites(businessId)
  }

  async function handleCancelInvite(id) {
    await supabase.from('staff_invites').delete().eq('id', id)
    showToast('Invite cancelled')
    loadInvites(businessId)
  }

  async function handleChangeRole(member, newRole) {
    await supabase.from('business_members').update({ role: newRole }).eq('id', member.id)
    showToast(`Role updated to ${newRole}`)
    loadMembers(businessId)
  }

  async function confirmRemoveMember() {
    if (!removeTarget) return
    if (removeTarget.role === 'owner') {
      showToast("The owner can't be removed.", 'error')
      setRemoveTarget(null)
      return
    }
    await supabase.from('business_members').delete().eq('id', removeTarget.id)
    setRemoveTarget(null)
    showToast('Staff member removed')
    loadMembers(businessId)
  }

  if (loading) return <LoadingState label={t('loading')} />

  return (
    <div>
      <PageHeader title={t('staff')} subtitle={t('subtitleStaff')} />

      <Card style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleInvite} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}>
            <Input type="email" placeholder="staff@email.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
          </div>
          <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} style={styles.select}>
            {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r, t)}</option>)}
          </select>
          <Button type="submit" icon={UserPlus}>{t('add')}</Button>
        </form>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>}
      </Card>

      {invites.length > 0 && (
        <>
          <h3 style={styles.sectionTitle}>{t('pendingInvites')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {invites.map((inv) => (
              <Card key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <strong>{inv.email}</strong>
                  <Badge color="neutral">{roleLabel(inv.role, t)}</Badge>
                  <Badge color="warning">{t('pending')}</Badge>
                </div>
                <Button variant="danger" size="sm" icon={X} onClick={() => handleCancelInvite(inv.id)}>{t('cancel')}</Button>
              </Card>
            ))}
          </div>
        </>
      )}

      <h3 style={styles.sectionTitle}>{t('team')}</h3>
      {members.length === 0 ? (
        <EmptyState icon={Users} title={t('noTeamMembersYet')} description={t('inviteFirstStaff')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {members.map((member) => {
            const profile = profiles[member.user_id]
            return (
              <Card key={member.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={styles.avatar}>
                    {(profile?.full_name || profile?.email || '?')[0].toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{profile?.full_name || profile?.email || t('unknownUser')}</div>
                    {profile?.email && profile?.full_name && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{profile.email}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  {member.role === 'owner' ? (
                    <Badge color="success">{roleLabel('owner', t)}</Badge>
                  ) : (
                    <>
                      <select value={member.role} onChange={(e) => handleChangeRole(member, e.target.value)} style={styles.roleSelect}>
                        {ROLES.map((r) => <option key={r} value={r}>{roleLabel(r, t)}</option>)}
                      </select>
                      <Button variant="danger" size="sm" onClick={() => setRemoveTarget(member)}>{t('remove')}</Button>
                    </>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {removeTarget && (
        <ConfirmationModal
          title={`Remove ${profiles[removeTarget.user_id]?.full_name || profiles[removeTarget.user_id]?.email || 'this staff member'}?`}
          description="They'll lose access to your business immediately."
          confirmLabel="Remove"
          onConfirm={confirmRemoveMember}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  )
}

const styles = {
  select: { padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--color-border)', fontSize: '0.9rem' },
  roleSelect: { padding: '0.4rem', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--color-border)', fontSize: '0.85rem' },
  sectionTitle: { marginTop: '0.5rem', marginBottom: '0.6rem', fontSize: '1rem' },
  avatar: {
    width: '38px', height: '38px', borderRadius: '50%', background: 'var(--color-primary)',
    color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.9rem',
  },
}
