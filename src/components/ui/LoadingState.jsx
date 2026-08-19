export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--color-text-muted)', padding: '1rem 0' }}>
      <span
        style={{
          width: '16px',
          height: '16px',
          borderRadius: '50%',
          border: '2px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          animation: 'msSpin 0.7s linear infinite',
        }}
      />
      <style>{`@keyframes msSpin { to { transform: rotate(360deg); } }`}</style>
      {label}
    </div>
  )
}
