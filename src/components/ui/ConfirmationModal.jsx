import { AlertTriangle } from 'lucide-react'
import Button from './Button'

export default function ConfirmationModal({
  title,
  description,
  confirmLabel = 'Delete',
  danger = true,
  onConfirm,
  onCancel,
}) {
  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.iconWrap}>
          <AlertTriangle size={20} color="var(--color-danger)" />
        </div>
        <h3 style={{ margin: '0 0 0.4rem' }}>{title}</h3>
        {description && <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', margin: '0 0 1.25rem' }}>{description}</p>}
        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} style={danger ? { background: 'var(--color-danger)', color: '#fff', border: 'none' } : {}}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1500, padding: '1rem',
  },
  modal: {
    background: '#fff', borderRadius: '16px', padding: '1.5rem',
    maxWidth: '380px', width: '100%',
  },
  iconWrap: {
    width: '42px', height: '42px', borderRadius: '50%',
    background: 'var(--color-danger-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '0.85rem',
  },
}
