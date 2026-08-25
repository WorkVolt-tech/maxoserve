import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { useTour } from '../contexts/TourContext'
import { useAppLanguage } from '../contexts/AppLanguageContext'

function findVisibleRect(target) {
  const scopes = []
  const mobileDrawer = document.querySelector('.ms-sidebar-mobile')
  if (mobileDrawer) scopes.push(mobileDrawer)
  const desktopSidebar = document.querySelector('.ms-sidebar-desktop')
  if (desktopSidebar) scopes.push(desktopSidebar)
  scopes.push(document)

  for (const scope of scopes) {
    const el = scope.querySelector(`[data-tour="${target}"]`)
    if (!el) continue
    if (el.offsetParent === null) continue

    const r = el.getBoundingClientRect()
    const onScreen =
      r.width > 0 && r.height > 0 &&
      r.right > 0 && r.left < window.innerWidth &&
      r.bottom > 0 && r.top < window.innerHeight
    if (onScreen) return r
  }
  return null
}

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

    let settled = false
    let giveUpTimer = null

    function tryResolve() {
      if (settled) return
      const r = findVisibleRect(step.target)
      if (r) {
        settled = true
        setRect(r)
        const el = document.querySelector(`[data-tour="${step.target}"]`)
        if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        cleanup()
      }
    }

    // React to any DOM change (drawer opening/closing, elements mounting)
    // instead of guessing a fixed delay is long enough.
    const observer = new MutationObserver(() => tryResolve())
    observer.observe(document.body, { childList: true, subtree: true, attributes: true })

    function cleanup() {
      observer.disconnect()
      if (giveUpTimer) clearTimeout(giveUpTimer)
    }

    // Try immediately in case it's already there, then give the observer
    // up to 4 seconds to catch a delayed mount before falling back to a
    // centered tooltip (never leaving a dead, unclickable screen).
    tryResolve()
    giveUpTimer = setTimeout(() => {
      if (!settled) {
        settled = true
        setRect(null)
        cleanup()
      }
    }, 4000)

    return cleanup
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
