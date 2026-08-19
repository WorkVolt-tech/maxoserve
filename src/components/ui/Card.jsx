export default function Card({ children, style, padding = '1.25rem', ...rest }) {
  return (
    <div
      style={{
        background: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-sm)',
        padding,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}
