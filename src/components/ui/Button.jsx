const VARIANTS = {
  primary: {
    background: 'var(--color-primary)',
    color: '#fff',
    border: 'none',
  },
  secondary: {
    background: 'var(--color-surface)',
    color: 'var(--color-text)',
    border: '1.5px solid var(--color-border)',
  },
  danger: {
    background: 'var(--color-surface)',
    color: 'var(--color-danger)',
    border: '1.5px solid var(--color-border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--color-text-muted)',
    border: 'none',
  },
}

export default function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  icon: Icon,
  children,
  style,
  ...rest
}) {
  const variantStyle = VARIANTS[variant] || VARIANTS.primary
  const padding = size === 'sm' ? '0.45rem 0.85rem' : size === 'lg' ? '0.85rem 1.5rem' : '0.65rem 1.2rem'
  const fontSize = size === 'sm' ? '0.82rem' : size === 'lg' ? '1rem' : '0.9rem'

  return (
    <button
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        padding,
        fontSize,
        fontWeight: 600,
        borderRadius: 'var(--radius-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'filter 0.12s, transform 0.05s',
        ...variantStyle,
        ...style,
      }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.98)' }}
      onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)' }}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 15 : 17} />}
      {children}
    </button>
  )
}
