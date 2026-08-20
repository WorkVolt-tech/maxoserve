import { useEffect, useState } from 'react'
import { SlidersHorizontal, Plus, Trash2, Upload, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import ModifierImportModal from '../../components/ModifierImportModal'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'

export default function AdminModifiers() {
  const { user } = useAuth()
  const [businessId, setBusinessId] = useState(null)
  const [groups, setGroups] = useState([])
  const [options, setOptions] = useState({})

  const [groupName, setGroupName] = useState('')
  const [selectionType, setSelectionType] = useState('single')
  const [isRequired, setIsRequired] = useState(false)

  const [optionForms, setOptionForms] = useState({})
  const [showImport, setShowImport] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadInitial() }, [])

  async function loadInitial() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
    if (!membership) { setLoading(false); return }
    setBusinessId(membership.business_id)
    await loadGroups(membership.business_id)
    setLoading(false)
  }

  async function loadGroups(bizId) {
    const { data: groupsData, error: groupsError } = await supabase
      .from('modifier_groups').select('*').eq('business_id', bizId).order('display_order', { ascending: true })
    if (groupsError) { setError(groupsError.message); return }
    setGroups(groupsData)

    if (groupsData.length > 0) {
      const groupIds = groupsData.map((g) => g.id)
      const { data: optionsData } = await supabase
        .from('modifier_options').select('*').in('modifier_group_id', groupIds).order('display_order', { ascending: true })
      const map = {}
      for (const opt of optionsData || []) {
        if (!map[opt.modifier_group_id]) map[opt.modifier_group_id] = []
        map[opt.modifier_group_id].push(opt)
      }
      setOptions(map)
    }
  }

  async function handleAddGroup(e) {
    e.preventDefault()
    setError('')
    const { error: insertError } = await supabase.from('modifier_groups').insert({
      business_id: businessId, name: groupName, selection_type: selectionType, is_required: isRequired, display_order: groups.length,
    })
    if (insertError) { setError(insertError.message); return }
    setGroupName(''); setSelectionType('single'); setIsRequired(false)
    loadGroups(businessId)
  }

  async function handleDeleteGroup(id) {
    if (!confirm('Delete this modifier group and all its options?')) return
    const { error: deleteError } = await supabase.from('modifier_groups').delete().eq('id', id)
    if (deleteError) { setError(`Could not delete group: ${deleteError.message}`); return }
    loadGroups(businessId)
  }

  function updateOptionForm(groupId, field, value) {
    setOptionForms((prev) => ({ ...prev, [groupId]: { ...prev[groupId], [field]: value } }))
  }

  async function handleAddOption(groupId) {
    setError('')
    const form = optionForms[groupId] || {}
    if (!form.name) { setError('Enter an option name.'); return }
    const currentCount = (options[groupId] || []).length
    const { error: insertError } = await supabase.from('modifier_options').insert({
      business_id: businessId, modifier_group_id: groupId, name: form.name,
      price_delta: parseFloat(form.priceDelta) || 0, display_order: currentCount,
    })
    if (insertError) { setError(insertError.message); return }
    setOptionForms((prev) => ({ ...prev, [groupId]: { name: '', priceDelta: '' } }))
    loadGroups(businessId)
  }

  async function handleToggleOptionAvailable(option) {
    await supabase.from('modifier_options').update({ is_available: !option.is_available }).eq('id', option.id)
    loadGroups(businessId)
  }

  async function handleDeleteOption(id) {
    const { error: deleteError } = await supabase.from('modifier_options').delete().eq('id', id)
    if (deleteError) {
      if (deleteError.code === '23503') {
        setError('This option has been ordered before, so it can\'t be deleted. It\'s been hidden from customers instead.')
        await supabase.from('modifier_options').update({ is_available: false }).eq('id', id)
        loadGroups(businessId)
      } else {
        setError(`Could not delete option: ${deleteError.message}`)
      }
      return
    }
    loadGroups(businessId)
  }

  if (loading) return <LoadingState label="Loading modifiers…" />

  return (
    <div>
      <PageHeader
        title="Modifiers"
        subtitle='Reusable customizations (e.g. "Choose Mixer", "Add-ons") you can attach to menu items.'
        actions={<Button variant="secondary" icon={Upload} onClick={() => setShowImport(true)}>Import from File</Button>}
      />

      {showImport && (
        <ModifierImportModal businessId={businessId} onClose={() => setShowImport(false)} onImported={() => loadGroups(businessId)} />
      )}

      <Card style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleAddGroup} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 200px' }}>
            <Input placeholder="Group name (e.g. Choose Mixer)" value={groupName} onChange={(e) => setGroupName(e.target.value)} required />
          </div>
          <select value={selectionType} onChange={(e) => setSelectionType(e.target.value)} style={styles.select}>
            <option value="single">Single choice</option>
            <option value="multiple">Multiple choices</option>
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
            <input type="checkbox" checked={isRequired} onChange={(e) => setIsRequired(e.target.checked)} />
            Required
          </label>
          <Button type="submit" icon={Plus}>Add Group</Button>
        </form>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>}
      </Card>

      {groups.length === 0 ? (
        <EmptyState icon={SlidersHorizontal} title="No modifier groups yet" description="Create your first group above to start adding customizations." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {groups.map((group) => (
            <Card key={group.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div>
                  <strong>{group.name}</strong>
                  <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    {' '}· {group.selection_type === 'single' ? 'pick one' : 'pick multiple'}{group.is_required ? ' · required' : ''}
                  </span>
                </div>
                <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDeleteGroup(group.id)}>Delete Group</Button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.75rem' }}>
                {(options[group.id] || []).map((opt) => (
                  <div key={opt.id} style={styles.optionRow}>
                    <span>
                      {opt.name}
                      {opt.price_delta > 0 && <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}> +${Number(opt.price_delta).toFixed(2)}</span>}
                      {!opt.is_available && <Badge color="danger" style={{ marginLeft: '0.5rem' }}>hidden</Badge>}
                    </span>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button onClick={() => handleToggleOptionAvailable(opt)} style={styles.smallToggleButton}>
                        {opt.is_available ? 'Hide' : 'Show'}
                      </button>
                      <button onClick={() => handleDeleteOption(opt.id)} style={styles.smallDeleteButton}><X size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text" placeholder="Option (e.g. Coke)"
                  value={optionForms[group.id]?.name || ''}
                  onChange={(e) => updateOptionForm(group.id, 'name', e.target.value)}
                  style={{ ...styles.optionInput, flex: 1 }}
                />
                <input
                  type="number" step="0.01" placeholder="+$ (optional)"
                  value={optionForms[group.id]?.priceDelta || ''}
                  onChange={(e) => updateOptionForm(group.id, 'priceDelta', e.target.value)}
                  style={{ ...styles.optionInput, flex: '0 1 100px' }}
                />
                <Button variant="secondary" size="sm" onClick={() => handleAddOption(group.id)}>Add</Button>
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
  optionRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: 'var(--color-bg)', padding: '0.4rem 0.6rem', borderRadius: '6px', fontSize: '0.9rem',
  },
  smallDeleteButton: { border: 'none', background: 'transparent', color: 'var(--color-danger)', cursor: 'pointer', padding: '0 0.3rem', display: 'flex', alignItems: 'center' },
  smallToggleButton: { border: '1px solid var(--color-border)', background: '#fff', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '4px' },
  optionInput: { padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--color-border)', fontSize: '0.85rem' },
}
