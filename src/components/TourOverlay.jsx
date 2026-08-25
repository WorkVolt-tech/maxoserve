import { X } from 'lucide-react'
import { useTour } from '../contexts/TourContext'
import { useAppLanguage } from '../contexts/AppLanguageContext'

export default function TourOverlay() {
  const { isActive, stepIndex, steps, next, back, skip } = useTour()
  const { t } = useAppLanguage()

  if (!isActive) return null
  const step = steps[stepIndex]
  if (!step) return null

  return (
    <>
      <div style={styles.dimOverlay} onClick={skip} />

      <div style={styles.card}>
        <button onClick={skip} style={styles.closeBtn}><X size={15} /></button>
        <h4 style={styles.title}>{t(step.titleKey)}</h4>
        <p style={styles.body}>{t(step.bodyKey)}</p>

        <div style={styles.footer}>
          <span style={styles.stepCount}>{stepIndex + 1} / {steps.length}</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {stepIndex > 0 && (
              <button onClick={back} style={styles.secondaryBtn}>{t('tourBack')}</button>
            )}
            <button onClick={next} style={styles.primaryBtn}>
              {stepIndex === steps.length - 1 ? t('tourFinish') : t('tourNext')}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

const styles = {
  dimOverlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000,
  },
  card: {
    position: 'fixed',
    bottom: '1.5rem',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 2002,
    background: '#fff',
    borderRadius: '14px',
    padding: '1.1rem 1.25rem',
    width: '90%',
    maxWidth: '360px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
  },
  closeBtn: {
    position: 'absolute', top: '0.6rem', right: '0.6rem',
    background: '#f1f2f5', border: 'none', borderRadius: '50%',
    width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  title: { margin: '0 1.5rem 0.4rem 0', fontSize: '1rem' },
  body: { margin: '0 0 1rem', fontSize: '0.87rem', color: '#555', lineHeight: 1.5 },
  footer: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  stepCount: { fontSize: '0.78rem', color: '#9ca3af' },
  primaryBtn: {
    padding: '0.5rem 1rem', borderRadius: '8px', border: 'none',
    background: '#3b6fe0', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '0.5rem 1rem', borderRadius: '8px', border: '1px solid #e5e7eb',
    background: '#fff', color: '#555', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
  },
}
