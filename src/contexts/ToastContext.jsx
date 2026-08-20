import { createContext, useContext, useState, useCallback } from 'react'
import { CheckCircle2, XCircle, Info } from 'lucide-react'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div style={styles.wrap}>
        {toasts.map((t) => (
          <div key={t.id} style={{ ...styles.toast, ...typeStyle(t.type) }} className="ms-fade-in">
            {t.type === 'success' && <CheckCircle2 size={17} />}
            {t.type === 'error' && <XCircle size={17} />}
            {t.type === 'info' && <Info size={17} />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}

function typeStyle(type) {
  if (type === 'error') return { background: '#dc2626' }
  if (type === 'info') return { background: '#14161f' }
  return { background: '#16a34a' }
}

const styles = {
  wrap: {
    position: 'fixed',
    bottom: '1.5rem',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 2000,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    alignItems: 'center',
  },
  toast: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    color: '#fff',
    padding: '0.7rem 1.1rem',
    borderRadius: '10px',
    fontSize: '0.88rem',
    fontWeight: 600,
    boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
    whiteSpace: 'nowrap',
  },
}
