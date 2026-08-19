export default function PageHeader({ title, subtitle, actions }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '1rem',
        marginBottom: '1.75rem',
      }}
    >
      <div>
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{title}</h2>
        {subtitle && (
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.3rem', maxWidth: '560px' }}>
            {subtitle}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: '0.6rem', flexShrink: 0 }}>{actions}</div>}
    </div>
  )
}
