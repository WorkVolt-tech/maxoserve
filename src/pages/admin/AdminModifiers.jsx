import { useEffect, useState } from 'react'
import { Upload } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import ModifierImportModal from '../../components/ModifierImportModal'
import Button from '../../components/ui/Button'

export default function AdminModifiers() {
  const { user } = useAuth()
  const [businessId, setBusinessId] = useState(null)
  const [groups, setGroups] = useState([])
  const [options, setOptions] = useState({}) // group_id -> [options]

  const [groupName, setGroupName] = useState('')
  const [selectionType, setSelectionType] = useState('single')
  const [isRequired, setIsRequired] = useState(false)

  const [optionForms, setOptionForms] = useState({}) // group_id -> { name, priceDelta }

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false)

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
    await loadGroups(membership.business_id)
    setLoading(false)
  }

  async function loadGroups(bizId) {
    const { data: groupsData, error: groupsError } = await supabase
      .from('modifier_groups')
      .select('*')
      .eq('business_id', bizId)
      .order('display_order', { ascending: true })

    if (groupsError) {
      setError(groupsError.message)
      return
    }

    setGroups(groupsData)

    if (groupsData.length > 0) {
      const groupIds = groupsData.map((g) => g.id)
      const { data: optionsData } = await supabase
        .from('modifier_options')
        .select('*')
        .in('modifier_group_id', groupIds)
        .order('display_order', { ascending: true })

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
      business_id: businessId,
      name: groupName,
      selection_type: selectionType,
      is_required: isRequired,
      display_order: groups.length,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    setGroupName('')
    setSelectionType('single')
    setIsRequired(false)
    loadGroups(businessId)
  }

  async function handleDeleteGroup(id) {
    if (!confirm('Delete this modifier group and all its options?')) return
    const { error: deleteError } = await supabase.from('modifier_groups').delete().eq('id', id)
    if (deleteError) {
      setError(`Could not delete group: ${deleteError.message}`)
      return
    }
    loadGroups(businessId)
  }

  function updateOptionForm(groupId, field, value) {
    setOptionForms((prev) => ({
      ...prev,
      [groupId]: { ...prev[groupId], [field]: value },
    }))
  }

  async function handleAddOption(groupId) {
    setError('')
    const form = optionForms[groupId] || {}

    if (!form.name) {
      setError('Enter an option name.')
      return
    }

    const currentCount = (options[groupId] || []).length

    const { error: insertError } = await supabase.from('modifier_options').insert({
      business_id: businessId,
      modifier_group_id: groupId,
      name: form.name,
      price_delta: parseFloat(form.priceDelta) || 0,
      display_order: currentCount,
    })

    if (insertError) {
      setError(insertError.message)
      return
    }

    setOptionForms((prev) => ({ ...prev, [groupId]: { name: '', priceDelta: '' } }))
    loadGroups(businessId)
  }

  async function handleToggleOptionAvailable(option) {
    await supabase
      .from('modifier_options')
      .update({ is_available: !option.is_available })
      .eq('id', option.id)
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

  if (loading) return <div><h2>Modifiers</h2><p>Loading...</p></div>

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2>Modifiers</h2>
          <p style={{ color: '#666' }}>
            Modifier groups are reusable customizations (e.g. "Choose Mixer", "Add-ons") you can attach to menu items.
          </p>
        </div>
        <Button variant="secondary" icon={Upload} onClick={() => setShowImport(true)}>
          Import from File
        </Button>
      </div>

      {showImport && (
        <ModifierImportModal
          businessId={businessId}
          onClose={() => setShowImport(false)}
          onImported={(count) => {
            loadGroups(businessId)
          }}
        />
      )}

      <form onSubmit={handleAddGroup} style={styles.form}>
        <input
          type="text"
          placeholder="Group name (e.g. Choose Mixer)"
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          required
          style={styles.input}
        />
        <select value={selectionType} onChange={(e) => setSelectionType(e.target.value)} style={styles.select}>
          <option value="single">Single choice</option>
          <option value="multiple">Multiple choices</option>
        </select>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
          />
          Required
        </label>
        <button type="submit" style={styles.button}>Add Group</button>
      </form>

      {error && <p style={{ color: '#d33' }}>{error}</p>}

      <div style={styles.list}>
        {groups.length === 0 && <p style={{ color: '#888' }}>No modifier groups yet.</p>}
        {groups.map((group) => (
          <div key={group.id} style={styles.groupCard}>
            <div style={styles.groupHeader}>
              <div>
                <strong>{group.name}</strong>
                <span style={styles.meta}>
                  {' '}· {group.selection_type === 'single' ? 'pick one' : 'pick multiple'}
                  {group.is_required ? ' · required' : ''}
                </span>
              </div>
              <button onClick={() => handleDeleteGroup(group.id)} style={styles.deleteButton}>
                Delete Group
              </button>
            </div>

            <div style={styles.optionsList}>
              {(options[group.id] || []).map((opt) => (
                <div key={opt.id} style={styles.optionRow}>
                  <span>
                    {opt.name}
                    {opt.price_delta > 0 && <span style={styles.priceDelta}> +${Number(opt.price_delta).toFixed(2)}</span>}
                    {!opt.is_available && <span style={styles.hiddenTag}> (hidden)</span>}
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button onClick={() => handleToggleOptionAvailable(opt)} style={styles.smallToggleButton}>
                      {opt.is_available ? 'Hide' : 'Show'}
                    </button>
                    <button onClick={() => handleDeleteOption(opt.id)} style={styles.smallDeleteButton}>
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.addOptionForm}>
              <input
                type="text"
                placeholder="Option (e.g. Coke)"
                value={optionForms[group.id]?.name || ''}
                onChange={(e) => updateOptionForm(group.id, 'name', e.target.value)}
                style={styles.optionInput}
              />
              <input
                type="number"
                step="0.01"
                placeholder="+$ (optional)"
                value={optionForms[group.id]?.priceDelta || ''}
                onChange={(e) => updateOptionForm(group.id, 'priceDelta', e.target.value)}
                style={{ ...styles.optionInput, flex: '0 1 100px' }}
              />
              <button onClick={() => handleAddOption(group.id)} style={styles.addOptionButton}>
                Add
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  form: {
    display: 'flex',
    gap: '0.5rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  input: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    fontSize: '0.95rem',
    flex: '1 1 200px',
  },
  select: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    fontSize: '0.95rem',
  },
  checkboxLabel: { display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.9rem', color: '#555' },
  button: {
    padding: '0.6rem 1.2rem',
    borderRadius: '8px',
    border: 'none',
    background: '#4c8dff',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.95rem',
  },
  list: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  groupCard: {
    background: '#fff',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    padding: '1rem',
  },
  groupHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.75rem',
  },
  meta: { color: '#888', fontSize: '0.85rem' },
  deleteButton: {
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid #e2e4e9',
    background: '#fff',
    color: '#d33',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  optionsList: { display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '0.75rem' },
  optionRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: '#f9fafb',
    padding: '0.4rem 0.6rem',
    borderRadius: '6px',
    fontSize: '0.9rem',
  },
  priceDelta: { color: '#4c8dff', fontWeight: 600 },
  smallDeleteButton: {
    border: 'none',
    background: 'transparent',
    color: '#d33',
    cursor: 'pointer',
    fontSize: '1rem',
    padding: '0 0.3rem',
  },
  smallToggleButton: {
    border: '1px solid #e2e4e9',
    background: '#fff',
    color: '#555',
    cursor: 'pointer',
    fontSize: '0.75rem',
    padding: '0.15rem 0.5rem',
    borderRadius: '4px',
  },
  hiddenTag: { color: '#c2185b', fontSize: '0.78rem' },
  addOptionForm: { display: 'flex', gap: '0.5rem' },
  optionInput: {
    padding: '0.45rem',
    borderRadius: '6px',
    border: '1px solid #e2e4e9',
    fontSize: '0.85rem',
    flex: 1,
  },
  addOptionButton: {
    padding: '0.45rem 0.9rem',
    borderRadius: '6px',
    border: '1px solid #4c8dff',
    background: '#fff',
    color: '#4c8dff',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
}
