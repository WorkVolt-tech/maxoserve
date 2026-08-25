import { ExternalLink } from 'lucide-react'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import Card from '../../components/ui/Card'
import PageHeader from '../../components/ui/PageHeader'
import chezmaxoLogo from '../../assets/chezmaxo-logo.png'

const APP_VERSION = '1.0.2'

export default function AdminAbout() {
  const { t } = useAppLanguage()

  return (
    <div>
      <PageHeader title={t('aboutTitle')} subtitle="" />

      <Card>
        <div style={styles.wrap}>
          <img src={chezmaxoLogo} alt="ChezMaxo" style={styles.logo} />
          <div style={styles.versionBadge}>{t('aboutVersion')} {APP_VERSION}</div>
          <p style={styles.builtBy}>
            {t('aboutBuiltBy')} <strong>ChezMaxo</strong>
          </p>
          <a href="https://chezmaxo.ca" target="_blank" rel="noopener noreferrer" style={styles.link}>
            {t('aboutVisit')} <ExternalLink size={14} />
          </a>
        </div>
      </Card>
    </div>
  )
}

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '1.5rem 1rem',
  },
  logo: { width: '160px', marginBottom: '1.25rem' },
  versionBadge: {
    background: 'var(--color-primary-soft)',
    color: 'var(--color-primary)',
    fontWeight: 700,
    fontSize: '0.85rem',
    padding: '0.35rem 0.9rem',
    borderRadius: '999px',
    marginBottom: '1rem',
  },
  builtBy: { color: 'var(--color-text-muted)', fontSize: '0.95rem', margin: '0 0 0.75rem' },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.4rem',
    color: 'var(--color-primary)',
    fontWeight: 600,
    fontSize: '0.9rem',
    textDecoration: 'none',
  },
}
