import { useEffect, useState } from 'react'
import { Bell, Plus, Trash2, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'
import { useAppLanguage } from '../../contexts/AppLanguageContext'

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
  const { t } = useAppLanguage()
  const [businessId, setBusinessId] = useState(null)
  const [types, setTypes] = useState([])
  const [label, setLabel] = useState('')
  const [routesToRole, setRoutesToRole] = useState('server')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadInitial() }, [])

  async function loadInitial() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
    if (!membership) { setLoading(false); return }
    setBusinessId(membership.business_id)
    await loadTypes(membership.business_id)
    setLoading(false)
  }

  async function loadTypes(bizId) {
    const { data, error: typesError } = await supabase
      .from('service_request_types').select('*').eq('business_id', bizId).order('display_order', { ascending: true })
    if (typesError) setError(typesError.message)
    else setTypes(data)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    const { error: insertError } = await supabase.from('service_request_types').insert({
      business_id: businessId, label, routes_to_role: routesToRole, display_order: types.length,
    })
    if (insertError) { setError(insertError.message); return }
    setLabel('')
    loadTypes(businessId)
  }

  async function handleAddPreset(preset) {
    setError('')
    const { error: insertError } = await supabase.from('service_request_types').insert({
      business_id: businessId, label: preset.label, routes_to_role: preset.routes_to_role, display_order: types.length,
    })
    if (insertError) { setError(insertError.message); return }
    loadTypes(businessId)
  }

  async function handleToggleActive(type) {
    await supabase.from('service_request_types').update({ is_active: !type.is_active }).eq('id', type.id)
    loadTypes(businessId)
  }

  async function handleDelete(id) {
    if (!confirm('Delete this request button? Customers will no longer see it.')) return
    await supabase.from('service_request_types').delete().eq('id', id)
    loadTypes(businessId)
  }

  if (loading) return <LoadingState label={t('loading')} />

  const existingLabels = types.map((t) => t.label)
  const availablePresets = PRESETS.filter((p) => !existingLabels.includes(p.label))

  return (
    <div>
      <PageHeader title={t('requestButtons')} subtitle="The buttons customers see on their table page (e.g. Call Server, Request Bill). Each one routes to a staff role." />

      {availablePresets.length > 0 && (
        <Card style={{ marginBottom: '1.25rem' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '0 0 0.6rem' }}>Quick add common buttons:</p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {availablePresets.map((p) => (
              <button key={p.label} onClick={() => handleAddPreset(p)} style={styles.presetButton}>+ {p.label}</button>
            ))}
          </div>
        </Card>
      )}

      <Card style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}>
            <Input placeholder="Custom button label (e.g. Bottle Service)" value={label} onChange={(e) => setLabel(e.target.value)} required />
          </div>
          <select value={routesToRole} onChange={(e) => setRoutesToRole(e.target.value)} style={styles.select}>
            {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <Button type="submit" icon={Plus}>{t('add')}</Button>
        </form>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>}
      </Card>

      {types.length === 0 ? (
        <EmptyState icon={Bell} title="No request buttons yet" description="Add a preset above or create a custom one." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {types.map((rt) => (
            <Card key={rt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <strong>{rt.label}</strong>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}> · routes to {rt.routes_to_role || 'unassigned'}</span>
                {!rt.is_active && <Badge color="neutral" style={{ marginLeft: '0.5rem' }}>hidden from customers</Badge>}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button variant="secondary" size="sm" icon={rt.is_active ? EyeOff : Eye} onClick={() => handleToggleActive(rt)}>
                  {rt.is_active ? t('hide') : t('show')}
                </Button>
                <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDelete(rt.id)}>{t('delete')}</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  select: { padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--color-border)', fontSize: '0.9rem' },
  presetButton: {
    padding: '0.4rem 0.8rem', borderRadius: '999px', border: '1px solid var(--color-primary)',
    background: '#fff', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.85rem',
  },
}
