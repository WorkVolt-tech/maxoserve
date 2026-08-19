export default function Input({ label, error, helperText, style, ...rest }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
      {label && (
        <label style={{ fontSize: '0.83rem', fontWeight: 600, color: 'var(--color-text)' }}>
          {label}
        </label>
      )}
      <input
        style={{
          padding: '0.65rem 0.85rem',
          borderRadius: 'var(--radius-sm)',
          border: `1.5px solid ${error ? 'var(--color-danger)' : 'var(--color-border)'}`,
          fontSize: '0.92rem',
          outline: 'none',
          background: 'var(--color-surface)',
          color: 'var(--color-text)',
          ...style,
        }}
        {...rest}
      />
      {error && <span style={{ fontSize: '0.78rem', color: 'var(--color-danger)' }}>{error}</span>}
      {!error && helperText && (
        <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{helperText}</span>
      )}
    </div>
  )
}
