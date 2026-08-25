import { useEffect, useState } from 'react'
import { Map, Plus, Trash2, Copy } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrentLocation } from '../../contexts/LocationContext'
import { useCurrentBusiness } from '../../contexts/BusinessContext'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import { useToast } from '../../contexts/ToastContext'
import ConfirmationModal from '../../components/ui/ConfirmationModal'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'

export default function AdminAreas() {
  const { user } = useAuth()
  const { currentLocationId, locations } = useCurrentLocation()
  const { currentBusinessId } = useCurrentBusiness()
  const { t } = useAppLanguage()
  const { showToast } = useToast()
  const businessId = currentBusinessId
  const [areas, setAreas] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [duplicatingAreaId, setDuplicatingAreaId] = useState(null)
  const [duplicateName, setDuplicateName] = useState('')
  const [duplicateTargetLocationId, setDuplicateTargetLocationId] = useState('')
  const [duplicating, setDuplicating] = useState(false)

  useEffect(() => { setLoading(false) }, [currentBusinessId])
  useEffect(() => {
    if (currentLocationId) loadAreas(currentLocationId)
    else setAreas([])
  }, [currentLocationId])

  async function loadAreas(locationId) {
    const { data, error: areasError } = await supabase
      .from('areas').select('*').eq('location_id', locationId).order('display_order', { ascending: true })
    if (areasError) setError(areasError.message)
    else setAreas(data)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!currentLocationId) { setError('Select a location first.'); return }
    const { error: insertError } = await supabase.from('areas').insert({
      business_id: businessId, location_id: currentLocationId, name, display_order: areas.length,
    })
    if (insertError) { setError(insertError.message); return }
    setName('')
    loadAreas(currentLocationId)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const { error: deleteError } = await supabase.from('areas').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    if (deleteError) {
      showToast(`Could not delete: ${deleteError.message}`, 'error')
      return
    }
    showToast('Area deleted')
    loadAreas(currentLocationId)
  }

  function openDuplicateForm(area) {
    setDuplicatingAreaId(area.id)
    setDuplicateName(`${area.name} (Copy)`)
    setDuplicateTargetLocationId(currentLocationId)
    setError('')
  }

  async function handleConfirmDuplicate(sourceArea) {
    setError('')
    if (!duplicateName.trim()) { setError('Enter a name for the duplicated area.'); return }
    setDuplicating(true)

    const { data: sourceTables, error: tablesError } = await supabase.from('tables').select('*').eq('area_id', sourceArea.id)
    if (tablesError) { setError(tablesError.message); setDuplicating(false); return }

    const { data: newArea, error: newAreaError } = await supabase.from('areas').insert({
      business_id: businessId, location_id: duplicateTargetLocationId, name: duplicateName, display_order: 0,
    }).select().single()

    if (newAreaError) { setError(newAreaError.message); setDuplicating(false); return }

    if (sourceTables && sourceTables.length > 0) {
      const newTables = sourceTables.map((t) => ({
        business_id: businessId, location_id: duplicateTargetLocationId, area_id: newArea.id,
        name: t.name, table_number: t.table_number, capacity: t.capacity, shape: t.shape,
        status: 'available', pos_x: t.pos_x, pos_y: t.pos_y, width: t.width, height: t.height, rotation: t.rotation,
      }))
      const { error: copyTablesError } = await supabase.from('tables').insert(newTables)
      if (copyTablesError) { setError(copyTablesError.message); setDuplicating(false); return }
    }

    setDuplicating(false)
    setDuplicatingAreaId(null)
    setDuplicateName('')
    if (duplicateTargetLocationId === currentLocationId) loadAreas(currentLocationId)
  }

  if (loading) return <LoadingState label={t('loading')} />

  if (!currentLocationId) {
    return <EmptyState icon={Map} title={t('createLocationFirstAreas')} description="" />
  }

  return (
    <div>
      <PageHeader title={t('areas')} subtitle={t('subtitleAreas')} />

      <Card style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 200px' }}>
            <Input placeholder={t('phAreaName')} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <Button type="submit" icon={Plus}>{t('add')}</Button>
        </form>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>}
      </Card>

      {areas.length === 0 ? (
        <EmptyState icon={Map} title={t('noAreasHere')} description="" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {areas.map((area) => (
            <Card key={area.id} padding="0">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={styles.iconWrap}><Map size={16} color="var(--color-primary)" /></div>
                  <strong>{area.name}</strong>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button variant="secondary" size="sm" icon={Copy} onClick={() => openDuplicateForm(area)}>{t('duplicate')}</Button>
                  <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleteTarget(area)}>{t('delete')}</Button>
                </div>
              </div>

              {duplicatingAreaId === area.id && (
                <div style={{ padding: '1rem 1.25rem', background: 'var(--color-bg)', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div>
                    <label style={styles.label}>{t('newAreaName')}</label>
                    <Input value={duplicateName} onChange={(e) => setDuplicateName(e.target.value)} />
                  </div>
                  <div>
                    <label style={styles.label}>{t('copyIntoLocation')}</label>
                    <select
                      value={duplicateTargetLocationId}
                      onChange={(e) => setDuplicateTargetLocationId(e.target.value)}
                      style={styles.select}
                    >
                      {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button onClick={() => handleConfirmDuplicate(area)} disabled={duplicating}>
                      {duplicating ? t('duplicating') : t('confirmDuplicate')}
                    </Button>
                    <Button variant="secondary" onClick={() => setDuplicatingAreaId(null)}>{t('cancel')}</Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {deleteTarget && (
        <ConfirmationModal
          title={`Delete "${deleteTarget.name}"?`}
          description="This will also delete its tables. This can't be undone."
          confirmLabel={t('delete')}
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
  label: { fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', display: 'block' },
  select: {
    padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--color-border)', fontSize: '0.9rem', width: '100%',
  },
}
