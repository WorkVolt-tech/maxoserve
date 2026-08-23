import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, SlidersHorizontal, EyeOff, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'

const PREP_LOCATIONS = ['kitchen', 'bar', 'bottle_service']

export default function AdminMenuItems() {
  const { categoryId } = useParams()
  const { user } = useAuth()
  const { t } = useAppLanguage()
  const [businessId, setBusinessId] = useState(null)
  const [category, setCategory] = useState(null)
  const [items, setItems] = useState([])
  const [allModifierGroups, setAllModifierGroups] = useState([])
  const [itemModifierLinks, setItemModifierLinks] = useState({})
  const [expandedItemId, setExpandedItemId] = useState(null)

  const [name, setName] = useState('')
  const [nameFr, setNameFr] = useState('')
  const [description, setDescription] = useState('')
  const [descriptionFr, setDescriptionFr] = useState('')
  const [price, setPrice] = useState('')
  const [prepLocation, setPrepLocation] = useState('kitchen')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadInitial() }, [categoryId])

  async function loadInitial() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
    if (!membership) { setLoading(false); return }
    setBusinessId(membership.business_id)

    const { data: catData } = await supabase.from('menu_categories').select('*').eq('id', categoryId).single()
    setCategory(catData)

    const { data: groupsData } = await supabase
      .from('modifier_groups').select('*').eq('business_id', membership.business_id).order('display_order', { ascending: true })
    setAllModifierGroups(groupsData || [])

    await loadItems()
    setLoading(false)
  }

  async function loadItems() {
    const { data, error: itemsError } = await supabase
      .from('menu_items').select('*').eq('category_id', categoryId).order('display_order', { ascending: true })
    if (itemsError) { setError(itemsError.message); return }
    setItems(data)

    if (data.length > 0) {
      const itemIds = data.map((i) => i.id)
      const { data: linksData } = await supabase.from('menu_item_modifier_groups').select('*').in('menu_item_id', itemIds)
      const map = {}
      for (const link of linksData || []) {
        if (!map[link.menu_item_id]) map[link.menu_item_id] = []
        map[link.menu_item_id].push(link.modifier_group_id)
      }
      setItemModifierLinks(map)
    }
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    const { error: insertError } = await supabase.from('menu_items').insert({
      business_id: businessId, category_id: categoryId, name, name_fr: nameFr || null,
      description: description || null, description_fr: descriptionFr || null,
      price: parseFloat(price) || 0, prep_location: prepLocation, display_order: items.length,
    })
    if (insertError) { setError(insertError.message); return }
    setName(''); setNameFr(''); setDescription(''); setDescriptionFr(''); setPrice(''); setPrepLocation('kitchen')
    loadItems()
  }

  async function handleToggleAvailable(item) {
    await supabase.from('menu_items').update({ is_available: !item.is_available }).eq('id', item.id)
    loadItems()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this item?')) return
    const { error: deleteError } = await supabase.from('menu_items').delete().eq('id', id)
    if (deleteError) {
      if (deleteError.code === '23503') {
        setError('This item has been ordered before, so it can\'t be deleted. Use "Mark Unavailable" instead to hide it from customers.')
      } else {
        setError(`Could not delete item: ${deleteError.message}`)
      }
      return
    }
    loadItems()
  }

  async function handleToggleModifierGroup(itemId, groupId) {
    const currentLinks = itemModifierLinks[itemId] || []
    const isLinked = currentLinks.includes(groupId)
    if (isLinked) {
      await supabase.from('menu_item_modifier_groups').delete().eq('menu_item_id', itemId).eq('modifier_group_id', groupId)
    } else {
      await supabase.from('menu_item_modifier_groups').insert({ business_id: businessId, menu_item_id: itemId, modifier_group_id: groupId })
    }
    loadItems()
  }

  if (loading) return <LoadingState label={t('loading')} />

  return (
    <div>
      <a href="/admin/menu" style={styles.backLink}><ArrowLeft size={14} /> {t('backToCategories')}</a>
      <h2 style={{ marginTop: '0.75rem' }}>{category?.name || 'Items'}</h2>
      <p style={{ color: 'var(--color-text-muted)' }}>{t('subtitleMenuItems')}</p>

      <Card style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <Input placeholder={t('phCategoryNameEn')} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <Input placeholder={t('phCategoryNameFr')} value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
          </div>
          <div style={{ flex: '0 1 120px' }}>
            <Input type="number" step="0.01" placeholder={t('phItemPrice')} value={price} onChange={(e) => setPrice(e.target.value)} required />
          </div>
          <select value={prepLocation} onChange={(e) => setPrepLocation(e.target.value)} style={styles.select}>
            {PREP_LOCATIONS.map((p) => <option key={p} value={p}>{p.replace('_', ' ')}</option>)}
          </select>
          <textarea placeholder={t('phDescriptionEn')} value={description} onChange={(e) => setDescription(e.target.value)} style={styles.textarea} />
          <textarea placeholder={t('phDescriptionFr')} value={descriptionFr} onChange={(e) => setDescriptionFr(e.target.value)} style={styles.textarea} />
          <Button type="submit" icon={Plus}>{t('add')}</Button>
        </form>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>}
      </Card>

      {items.length === 0 ? (
        <EmptyState title={t('noItemsYetTitle')} description={t('addFirstItem')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {items.map((item) => {
            const linkedGroupIds = itemModifierLinks[item.id] || []
            const isExpanded = expandedItemId === item.id
            return (
              <Card key={item.id} padding="0">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', padding: '1rem 1.25rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <strong>{item.name}</strong>
                      {item.name_fr && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}> / {item.name_fr}</span>}
                      <span style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: '0.9rem' }}>${Number(item.price).toFixed(2)}</span>
                      {!item.is_available && <Badge color="danger">unavailable</Badge>}
                    </div>
                    {item.description && <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>{item.description}</p>}
                    {item.description_fr && <p style={{ color: 'var(--color-text-faint)', fontSize: '0.8rem', margin: '0.15rem 0 0', fontStyle: 'italic' }}>{item.description_fr}</p>}
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-faint)', marginTop: '0.25rem' }}>
                      {item.prep_location.replace('_', ' ')}
                      {linkedGroupIds.length > 0 && <> · {linkedGroupIds.length} modifier group(s)</>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <Button variant="secondary" size="sm" icon={SlidersHorizontal} onClick={() => setExpandedItemId(isExpanded ? null : item.id)}>
                      {isExpanded ? t('cancel') : t('modifiers')}
                    </Button>
                    <Button variant="secondary" size="sm" icon={item.is_available ? EyeOff : Eye} onClick={() => handleToggleAvailable(item)}>
                      {item.is_available ? t('hide') : t('show')}
                    </Button>
                    <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDelete(item.id)}>{t('delete')}</Button>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{ padding: '0 1.25rem 1rem', borderTop: '1px solid var(--color-border)', paddingTop: '0.75rem' }}>
                    {allModifierGroups.length === 0 ? (
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: 0 }}>
                        {t('noModifierGroupsExist')}
                      </p>
                    ) : (
                      <>
                        <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: '0 0 0.5rem' }}>{t('attachModifierGroups')}</p>
                        {allModifierGroups.map((group) => (
                          <label key={group.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem', padding: '0.2rem 0' }}>
                            <input
                              type="checkbox"
                              checked={linkedGroupIds.includes(group.id)}
                              onChange={() => handleToggleModifierGroup(item.id, group.id)}
                            />
                            {group.name}
                          </label>
                        ))}
                      </>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

const styles = {
  backLink: { display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--color-primary)', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 600 },
  select: { padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--color-border)', fontSize: '0.9rem' },
  textarea: { padding: '0.65rem', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--color-border)', fontSize: '0.9rem', width: '100%', minHeight: '55px', fontFamily: 'inherit' },
}
