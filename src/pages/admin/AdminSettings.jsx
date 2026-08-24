import { useEffect, useState } from 'react'
import { Settings2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import { useToast } from '../../contexts/ToastContext'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import LoadingState from '../../components/ui/LoadingState'

export default function AdminSettings() {
  const { user } = useAuth()
  const { t } = useAppLanguage()
  const { showToast } = useToast()
  const [businessId, setBusinessId] = useState(null)
  const [showServiceTab, setShowServiceTab] = useState(true)
  const [showMenuTab, setShowMenuTab] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadSettings() }, [])

  async function loadSettings() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
    if (!membership) { setLoading(false); return }
    setBusinessId(membership.business_id)

    const { data } = await supabase
      .from('business_settings')
      .select('show_service_tab, show_menu_tab')
      .eq('business_id', membership.business_id)
      .single()

    if (data) {
      setShowServiceTab(data.show_service_tab)
      setShowMenuTab(data.show_menu_tab)
    }
    setLoading(false)
  }

  async function handleToggle(field, currentValue, otherValue) {
    const newValue = !currentValue

    // Prevent disabling both tabs at once
    if (!newValue && !otherValue) {
      showToast(t('atLeastOneTabWarning'), 'error')
      return
    }

    setSaving(true)
    if (field === 'service') setShowServiceTab(newValue)
    else setShowMenuTab(newValue)

    const { error } = await supabase
      .from('business_settings')
      .update({ [field === 'service' ? 'show_service_tab' : 'show_menu_tab']: newValue })
      .eq('business_id', businessId)

    setSaving(false)

    if (error) {
      showToast(`Could not save: ${error.message}`, 'error')
      // revert on failure
      if (field === 'service') setShowServiceTab(currentValue)
      else setShowMenuTab(currentValue)
      return
    }

    showToast(t('settingsSaved'))
  }

  if (loading) return <LoadingState label={t('loading')} />

  return (
    <div>
      <PageHeader title={t('customerPageSettings')} subtitle={t('customerPageSettingsDesc')} />

      <Card>
        <div style={styles.row}>
          <div>
            <div style={styles.rowTitle}>{t('showServiceTab')}</div>
            <div style={styles.rowDesc}>{t('showServiceTabDesc')}</div>
          </div>
          <label style={styles.switch}>
            <input
              type="checkbox"
              checked={showServiceTab}
              disabled={saving}
              onChange={() => handleToggle('service', showServiceTab, showMenuTab)}
              style={{ display: 'none' }}
            />
            <span style={{ ...styles.switchTrack, background: showServiceTab ? 'var(--color-primary)' : '#d1d5db' }}>
              <span style={{ ...styles.switchThumb, transform: showServiceTab ? 'translateX(18px)' : 'translateX(0)' }} />
            </span>
          </label>
        </div>

        <div style={{ ...styles.row, borderBottom: 'none' }}>
          <div>
            <div style={styles.rowTitle}>{t('showMenuTab')}</div>
            <div style={styles.rowDesc}>{t('showMenuTabDesc')}</div>
          </div>
          <label style={styles.switch}>
            <input
              type="checkbox"
              checked={showMenuTab}
              disabled={saving}
              onChange={() => handleToggle('menu', showMenuTab, showServiceTab)}
              style={{ display: 'none' }}
            />
            <span style={{ ...styles.switchTrack, background: showMenuTab ? 'var(--color-primary)' : '#d1d5db' }}>
              <span style={{ ...styles.switchThumb, transform: showMenuTab ? 'translateX(18px)' : 'translateX(0)' }} />
            </span>
          </label>
        </div>
      </Card>
    </div>
  )
}

const styles = {
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    padding: '1rem 0',
    borderBottom: '1px solid var(--color-border)',
  },
  rowTitle: { fontWeight: 600, fontSize: '0.95rem' },
  rowDesc: { color: 'var(--color-text-muted)', fontSize: '0.85rem', marginTop: '0.2rem', maxWidth: '420px' },
  switch: { cursor: 'pointer', flexShrink: 0 },
  switchTrack: {
    display: 'inline-block',
    width: '42px',
    height: '24px',
    borderRadius: '999px',
    position: 'relative',
    transition: 'background 0.15s',
  },
  switchThumb: {
    position: 'absolute',
    top: '3px',
    left: '3px',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#fff',
    transition: 'transform 0.15s',
    boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
  },
}
