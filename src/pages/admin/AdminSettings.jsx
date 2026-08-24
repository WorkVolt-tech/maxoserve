import { useEffect, useState } from 'react'
import { Settings2, Image } from 'lucide-react'
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
  const [logoUrl, setLogoUrl] = useState('')
  const [logoInput, setLogoInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingLogo, setSavingLogo] = useState(false)
  const [autoShowTour, setAutoShowTour] = useState(
    localStorage.getItem('maxoserve_tour_autoshow_off') !== 'true'
  )

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

    const { data: businessData } = await supabase
      .from('businesses')
      .select('logo_url')
      .eq('id', membership.business_id)
      .single()

    if (businessData?.logo_url) {
      setLogoUrl(businessData.logo_url)
      setLogoInput(businessData.logo_url)
    }

    setLoading(false)
  }

  async function handleSaveLogo(e) {
    e.preventDefault()
    setSavingLogo(true)
    const { error } = await supabase
      .from('businesses')
      .update({ logo_url: logoInput.trim() || null })
      .eq('id', businessId)
    setSavingLogo(false)

    if (error) {
      showToast(`Could not save logo: ${error.message}`, 'error')
      return
    }

    setLogoUrl(logoInput.trim())
    showToast(t('settingsSaved'))
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

  function handleToggleAutoTour() {
    const newValue = !autoShowTour
    setAutoShowTour(newValue)
    localStorage.setItem('maxoserve_tour_autoshow_off', newValue ? 'false' : 'true')
    showToast(t('settingsSaved'))
  }

  if (loading) return <LoadingState label={t('loading')} />

  return (
    <div>
      <PageHeader title={t('businessLogo')} subtitle={t('businessLogoDesc')} />

      <Card style={{ marginBottom: '1.5rem' }}>
        <form onSubmit={handleSaveLogo} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 280px' }}>
            <input
              type="url"
              placeholder={t('logoUrlPlaceholder')}
              value={logoInput}
              onChange={(e) => setLogoInput(e.target.value)}
              style={styles.logoInput}
            />
          </div>
          <button type="submit" disabled={savingLogo} style={styles.saveLogoButton}>
            {savingLogo ? '...' : t('save')}
          </button>
        </form>

        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>{t('logoPreview')}</div>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Business logo"
              style={styles.logoPreviewImg}
              onError={(e) => { e.target.style.display = 'none' }}
            />
          ) : (
            <div style={{ color: 'var(--color-text-faint)', fontSize: '0.85rem' }}>
              <Image size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem' }} />
              {t('noLogoSet')}
            </div>
          )}
        </div>
      </Card>

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

        <div style={styles.row}>
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

        <div style={{ ...styles.row, borderBottom: 'none' }}>
          <div>
            <div style={styles.rowTitle}>{t('autoShowTour')}</div>
            <div style={styles.rowDesc}>{t('autoShowTourDesc')}</div>
          </div>
          <label style={styles.switch}>
            <input
              type="checkbox"
              checked={autoShowTour}
              onChange={handleToggleAutoTour}
              style={{ display: 'none' }}
            />
            <span style={{ ...styles.switchTrack, background: autoShowTour ? 'var(--color-primary)' : '#d1d5db' }}>
              <span style={{ ...styles.switchThumb, transform: autoShowTour ? 'translateX(18px)' : 'translateX(0)' }} />
            </span>
          </label>
        </div>
      </Card>
    </div>
  )
}

const styles = {
  logoInput: {
    width: '100%',
    padding: '0.65rem 0.85rem',
    borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--color-border)',
    fontSize: '0.9rem',
  },
  saveLogoButton: {
    padding: '0.65rem 1.2rem',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--color-primary)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
    fontSize: '0.9rem',
  },
  logoPreviewImg: {
    maxWidth: '160px',
    maxHeight: '100px',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
    padding: '0.5rem',
    background: '#fff',
  },
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
