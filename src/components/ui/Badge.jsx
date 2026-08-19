const COLOR_MAP = {
  primary: { bg: 'var(--color-primary-soft)', fg: 'var(--color-primary)' },
  success: { bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  warning: { bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' },
  danger: { bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)' },
  info: { bg: 'var(--color-info-soft)', fg: 'var(--color-info)' },
  neutral: { bg: '#f1f2f5', fg: 'var(--color-text-muted)' },
}

export default function Badge({ color = 'neutral', children, style }) {
  const c = COLOR_MAP[color] || COLOR_MAP.neutral
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        background: c.bg,
        color: c.fg,
        fontSize: '0.75rem',
        fontWeight: 700,
        padding: '0.25rem 0.6rem',
        borderRadius: '999px',
        textTransform: 'capitalize',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {children}
    </span>
  )
}
