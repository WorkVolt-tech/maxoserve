export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '3rem 1.5rem',
        border: '1.5px dashed var(--color-border)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-surface)',
      }}
    >
      {Icon && (
        <div
          style={{
            display: 'inline-flex',
            padding: '0.85rem',
            borderRadius: '50%',
            background: 'var(--color-primary-soft)',
            marginBottom: '0.85rem',
          }}
        >
          <Icon size={22} color="var(--color-primary)" />
        </div>
      )}
      <div style={{ fontWeight: 700, fontSize: '0.98rem', marginBottom: '0.3rem' }}>{title}</div>
      {description && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.88rem', maxWidth: '360px', margin: '0 auto 1rem' }}>
          {description}
        </p>
      )}
      {action}
    </div>
  )
}
