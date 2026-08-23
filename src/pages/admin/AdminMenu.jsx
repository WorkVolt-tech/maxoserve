import { useEffect, useState } from 'react'
import { UtensilsCrossed, Plus, Trash2, Upload, ChevronRight, EyeOff, Eye } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import ConfirmationModal from '../../components/ui/ConfirmationModal'
import { useToast } from '../../contexts/ToastContext'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import MenuImportModal from '../../components/MenuImportModal'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'

export default function AdminMenu() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { t } = useAppLanguage()
  const [businessId, setBusinessId] = useState(null)
  const [categories, setCategories] = useState([])
  const [name, setName] = useState('')
  const [nameFr, setNameFr] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showImport, setShowImport] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  useEffect(() => { loadInitial() }, [])

  async function loadInitial() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
    if (!membership) { setLoading(false); return }
    setBusinessId(membership.business_id)
    await loadCategories(membership.business_id)
    setLoading(false)
  }

  async function loadCategories(bizId) {
    const { data, error: catError } = await supabase
      .from('menu_categories').select('*').eq('business_id', bizId).order('display_order', { ascending: true })
    if (catError) setError(catError.message)
    else setCategories(data)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    const { error: insertError } = await supabase.from('menu_categories').insert({
      business_id: businessId, name, name_fr: nameFr || null, display_order: categories.length,
    })
    if (insertError) { setError(insertError.message); return }
    setName('')
    setNameFr('')
    showToast(`"${name}" category added`)
    loadCategories(businessId)
  }

  async function handleToggleActive(category) {
    await supabase.from('menu_categories').update({ is_active: !category.is_active }).eq('id', category.id)
    showToast(category.is_active ? `"${category.name}" hidden` : `"${category.name}" now visible`)
    loadCategories(businessId)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const { error: deleteError } = await supabase.from('menu_categories').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    if (deleteError) {
      showToast(`Could not delete category: ${deleteError.message}`, 'error')
      return
    }
    showToast('Category deleted')
    loadCategories(businessId)
  }

  if (loading) return <LoadingState label={t('loading')} />

  return (
    <div>
      <PageHeader
        title={t('menu')}
        subtitle="Categories organize your menu (e.g. Appetizers, Cocktails, Bottles). Click a category to manage its items."
        actions={<Button variant="secondary" icon={Upload} onClick={() => setShowImport(true)}>Import from File</Button>}
      />

      {showImport && (
        <MenuImportModal
          businessId={businessId}
          existingCategories={categories}
          onClose={() => setShowImport(false)}
          onImported={() => loadCategories(businessId)}
        />
      )}

      <Card style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 220px' }}>
            <Input placeholder="Name (English)" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div style={{ flex: '1 1 220px' }}>
            <Input placeholder="Name (French, optional)" value={nameFr} onChange={(e) => setNameFr(e.target.value)} />
          </div>
          <Button type="submit" icon={Plus}>{t('add')}</Button>
        </form>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>}
      </Card>

      {categories.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="No menu categories yet" description="Create your first category to start building your menu." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {categories.map((cat) => (
            <Card key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <a href={`/admin/menu/${cat.id}`} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit', flex: 1 }}>
                <div style={styles.iconWrap}><UtensilsCrossed size={16} color="var(--color-primary)" /></div>
                <div>
                  <strong>{cat.name}</strong>
                  {cat.name_fr && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}> / {cat.name_fr}</span>}
                  {!cat.is_active && <Badge color="neutral" style={{ marginLeft: '0.5rem' }}>hidden</Badge>}
                </div>
                <ChevronRight size={16} color="var(--color-text-faint)" style={{ marginLeft: 'auto' }} />
              </a>
              <div style={{ display: 'flex', gap: '0.5rem', marginLeft: '0.75rem' }}>
                <Button variant="secondary" size="sm" icon={cat.is_active ? EyeOff : Eye} onClick={() => handleToggleActive(cat)}>
                  {cat.is_active ? t('hide') : t('show')}
                </Button>
                <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleteTarget(cat)}>{t('delete')}</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmationModal
          title={`Delete "${deleteTarget.name}"?`}
          description="All items inside this category will also be deleted. This can't be undone."
          confirmLabel="Delete Category"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

const styles = {
  iconWrap: {
    width: '34px', height: '34px', borderRadius: '9px',
    background: 'var(--color-primary-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
}
