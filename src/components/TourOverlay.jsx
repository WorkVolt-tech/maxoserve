import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useTour } from '../contexts/TourContext'
import { useAppLanguage } from '../contexts/AppLanguageContext'

export default function TourOverlay() {
  const { isActive, stepIndex, steps, next, back, skip } = useTour()
  const { t } = useAppLanguage()
  const [rect, setRect] = useState(null)

  const step = steps[stepIndex]

  useEffect(() => {
    if (!isActive || !step) return

    if (!step.target) {
      setRect(null)
      return
    }

    // There can be two elements sharing this data-tour attribute (one in the
    // desktop sidebar, one in the mobile drawer) — only one is ever actually
    // visible at a time. Find whichever one is currently on-screen.
    const candidates = document.querySelectorAll(`[data-tour="${step.target}"]`)
    let el = null
    for (const candidate of candidates) {
      if (candidate.offsetParent !== null) { el = candidate; break }
    }

    if (!el) {
      // Nothing visible to point at — fall back to a centered tooltip
      // rather than leaving a dimmed screen with nothing to interact with.
      setRect(null)
      return
    }

    el.scrollIntoView({ block: 'center', behavior: 'smooth' })

    let cancelled = false
    let attempts = 0

    function measure() {
      if (cancelled) return
      attempts += 1

      const freshCandidates = document.querySelectorAll(`[data-tour="${step.target}"]`)
      let freshEl = null
      for (const candidate of freshCandidates) {
        if (candidate.offsetParent !== null) { freshEl = candidate; break }
      }

      if (freshEl) {
        const r = freshEl.getBoundingClientRect()
        if (r.width > 0 || r.height > 0) {
          setRect(r)
          return
        }
      }

      // Not ready yet — keep retrying for up to ~2.5s (drawer open animation,
      // first paint, etc. can all take longer than a single fixed delay).
      if (attempts < 12) {
        setTimeout(measure, 200)
      } else {
        setRect(null)
      }
    }

    const initialTimer = setTimeout(measure, 150)

    return () => {
      cancelled = true
      clearTimeout(initialTimer)
    }
  }, [isActive, stepIndex, step])

  if (!isActive || !step) return null

  const TOOLTIP_HEIGHT = 190
  const TOOLTIP_WIDTH = 320

  let tooltipStyle
  if (rect) {
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const placeBelow = spaceBelow >= TOOLTIP_HEIGHT + 20 || spaceBelow >= spaceAbove

    tooltipStyle = {
      position: 'fixed',
      top: placeBelow
        ? Math.min(rect.bottom + 14, window.innerHeight - TOOLTIP_HEIGHT - 12)
        : Math.max(rect.top - TOOLTIP_HEIGHT - 14, 12),
      left: Math.min(Math.max(rect.left, 16), window.innerWidth - TOOLTIP_WIDTH - 16),
    }
  } else {
    tooltipStyle = {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
    }
  }

  return (
    <>
      <div style={styles.dimOverlay} />

      {rect && (
        <div
          style={{
            position: 'fixed',
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            border: '3px solid #3b6fe0',
            borderRadius: '10px',
            boxShadow: '0 0 0 4000px rgba(0,0,0,0.55)',
            zIndex: 2001,
            pointerEvents: 'none',
            transition: 'all 0.2s ease',
          }}
        />
      )}

      <div style={{ ...styles.tooltip, ...tooltipStyle }}>
        <button onClick={skip} style={styles.closeBtn}><X size={15} /></button>
        <h4 style={styles.tooltipTitle}>{t(step.titleKey)}</h4>
        <p style={styles.tooltipBody}>{t(step.bodyKey)}</p>

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
  tooltip: {
    zIndex: 2002,
    background: '#fff',
    borderRadius: '14px',
    padding: '1.1rem 1.25rem',
    width: '320px',
    boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
  },
  closeBtn: {
    position: 'absolute', top: '0.6rem', right: '0.6rem',
    background: '#f1f2f5', border: 'none', borderRadius: '50%',
    width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  tooltipTitle: { margin: '0 1.5rem 0.4rem 0', fontSize: '1rem' },
  tooltipBody: { margin: '0 0 1rem', fontSize: '0.87rem', color: '#555', lineHeight: 1.5 },
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
