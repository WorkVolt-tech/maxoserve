import { useAuth } from '../contexts/AuthContext'
import { canAccess } from '../lib/permissions'

export default function RequireRole({ section, children }) {
  const { role, roleLoading } = useAuth()

  if (roleLoading) {
    return <div style={{ color: '#666' }}>Loading...</div>
  }

  if (!canAccess(role, section)) {
    return (
      <div style={styles.wrap}>
        <h2>Not authorized</h2>
        <p style={{ color: '#666' }}>
          Your role ({role || 'unknown'}) doesn't have access to this section.
        </p>
      </div>
    )
  }

  return children
}

const styles = {
  wrap: {
    background: '#fff',
    border: '1px solid #e2e4e9',
    borderRadius: '8px',
    padding: '2rem',
    textAlign: 'center',
  },
}
