import { useEffect, useState } from 'react'
import { PartyPopper, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrentLocation } from '../../contexts/LocationContext'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import { useToast } from '../../contexts/ToastContext'
import ConfirmationModal from '../../components/ui/ConfirmationModal'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import Badge from '../../components/ui/Badge'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'

export default function AdminEvents() {
  const { user } = useAuth()
  const { currentLocationId } = useCurrentLocation()
  const { t } = useAppLanguage()
  const { showToast } = useToast()
  const [businessId, setBusinessId] = useState(null)
  const [events, setEvents] = useState([])
  const [deleteTarget, setDeleteTarget] = useState(null)

  const [name, setName] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { loadInitial() }, [])

  async function loadInitial() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
    if (!membership) { setLoading(false); return }
    setBusinessId(membership.business_id)
    await loadEvents(membership.business_id)
    setLoading(false)
  }

  async function loadEvents(bizId) {
    const { data, error: eventsError } = await supabase
      .from('events').select('*').eq('business_id', bizId).order('starts_at', { ascending: false })
    if (eventsError) setError(eventsError.message)
    else setEvents(data)
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    if (!currentLocationId) { setError('Select a location.'); return }
    const { error: insertError } = await supabase.from('events').insert({
      business_id: businessId, location_id: currentLocationId, name, starts_at: startsAt, ends_at: endsAt,
    })
    if (insertError) { setError(insertError.message); return }
    setName(''); setStartsAt(''); setEndsAt('')
    loadEvents(businessId)
  }

  async function handleToggleActive(event) {
    await supabase.from('events').update({ is_active: !event.is_active }).eq('id', event.id)
    loadEvents(businessId)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const { error: deleteError } = await supabase.from('events').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    if (deleteError) {
      showToast(`Could not delete: ${deleteError.message}`, 'error')
      return
    }
    showToast('Event deleted')
    loadEvents(businessId)
  }

  function eventStatus(event) {
    const now = new Date()
    const start = new Date(event.starts_at)
    const end = new Date(event.ends_at)
    if (!event.is_active) return { label: 'disabled', color: 'neutral' }
    if (now < start) return { label: 'upcoming', color: 'info' }
    if (now >= start && now <= end) return { label: 'happening now', color: 'success' }
    return { label: 'ended', color: 'neutral' }
  }

  if (loading) return <LoadingState label={t('loading')} />

  const visibleEvents = events.filter((e) => e.location_id === currentLocationId)

  return (
    <div>
      <PageHeader title={t('events')} subtitle={t('subtitleEvents')} />

      <Card style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: '1 1 200px' }}>
            <Input placeholder={t('phEventName')} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label style={styles.dateLabel}>{t('startsLabel')}</label>
            <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} required />
          </div>
          <div>
            <label style={styles.dateLabel}>{t('endsLabel')}</label>
            <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} required />
          </div>
          <Button type="submit" icon={Plus}>{t('add')}</Button>
        </form>
        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>}
      </Card>

      {visibleEvents.length === 0 ? (
        <EmptyState icon={PartyPopper} title={t('noEventsYet')} description={t('createFirstEvent')} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
          {visibleEvents.map((event) => {
            const status = eventStatus(event)
            return (
              <Card key={event.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <strong>{event.name}</strong>
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0.3rem 0' }}>
                    {new Date(event.starts_at).toLocaleString()} → {new Date(event.ends_at).toLocaleString()}
                  </p>
                  <Badge color={status.color}>{status.label}</Badge>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <Button variant="secondary" size="sm" onClick={() => handleToggleActive(event)}>
                    {event.is_active ? t('disable') : t('enable')}
                  </Button>
                  <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleteTarget(event)}>{t('delete')}</Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {deleteTarget && (
        <ConfirmationModal
          title={`Delete "${deleteTarget.name}"?`}
          description="Linked reservations will keep their info but lose the event link."
          confirmLabel={t('delete')}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

const styles = {
  dateLabel: { fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem', display: 'block' },
}
