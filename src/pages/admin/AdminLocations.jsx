import { useEffect, useState } from 'react'
import { MapPin, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrentLocation } from '../../contexts/LocationContext'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'

export default function AdminLocations() {
  const { user } = useAuth()
  const { reloadLocations } = useCurrentLocation()
  const { t } = useAppLanguage()
  const [businessId, setBusinessId] = useState(null)
  const [locations, setLocations] = useState([])
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
    if (!membership) { setLoading(false); return }
    setBusinessId(membership.business_id)

    const { data: locationsData, error: locationsError } = await supabase
      .from('locations').select('*').eq('business_id', membership.business_id).order('created_at', { ascending: true })

    if (locationsError) setError(locationsError.message)
    else setLocations(locationsData)
    setLoading(false)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    const { error: insertError } = await supabase.from('locations').insert({ business_id: businessId, name, address })
    if (insertError) { setError(insertError.message); return }
    setName('')
    setAddress('')
    loadData()
    reloadLocations()
  }

  async function handleDelete(id) {
    if (!confirm('Delete this location? This will also delete its areas and tables.')) return
    await supabase.from('locations').delete().eq('id', id)
    loadData()
    reloadLocations()
  }

  if (loading) return <LoadingState label={t('loading')} />

  return (
    <div>
      <PageHeader title={t('locations')} subtitle={t('subtitleLocations')} />

      <Card style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <Input placeholder={t('phLocationName')} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div style={{ flex: '1 1 200px' }}>
            <Input placeholder={t('phAddress')} value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <Button type="submit" icon={Plus}>{t('add')}</Button>
        </form>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>}
      </Card>

      {locations.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={t('noLocationsYet')}
          description={t('createFirstLocation')}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {locations.map((loc) => (
            <Card key={loc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={styles.iconWrap}><MapPin size={16} color="var(--color-primary)" /></div>
                <div>
                  <div style={{ fontWeight: 600 }}>{loc.name}</div>
                  {loc.address && <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{loc.address}</div>}
                </div>
              </div>
              <Button variant="danger" size="sm" icon={Trash2} onClick={() => handleDelete(loc.id)}>{t('delete')}</Button>
            </Card>
          ))}
        </div>
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
