import { useRef } from 'react'
import { QRCodeCanvas } from 'qrcode.react'

export default function QrCodeModal({ table, url, onClose, onRegenerate, regenerating }) {
  const wrapRef = useRef(null)

  function handleDownload() {
    const canvas = wrapRef.current?.querySelector('canvas')
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${table.name.replace(/\s+/g, '-')}-QR.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function handlePrint() {
    const canvas = wrapRef.current?.querySelector('canvas')
    if (!canvas) return
    const dataUrl = canvas.toDataURL('image/png')
    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
        <head><title>${table.name} - QR Code</title></head>
        <body style="text-align:center; font-family: system-ui, sans-serif; padding: 2rem;">
          <h2>${table.name}</h2>
          <p>Scan for Service</p>
          <img src="${dataUrl}" style="width:300px;height:300px;" />
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{table.name}</h3>
        <p style={styles.url}>{url}</p>
        <div ref={wrapRef} style={styles.qrWrap}>
          <QRCodeCanvas value={url} size={220} level="M" includeMargin />
        </div>
        <div style={styles.actions}>
          <button onClick={handleDownload} style={styles.button}>Download PNG</button>
          <button onClick={handlePrint} style={styles.button}>Print</button>
          <button onClick={onRegenerate} disabled={regenerating} style={styles.regenButton}>
            {regenerating ? 'Regenerating...' : 'Regenerate (disables old code)'}
          </button>
        </div>
        <button onClick={onClose} style={styles.closeButton}>Close</button>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '1rem',
  },
  modal: {
    background: '#fff',
    borderRadius: '12px',
    padding: '1.5rem',
    maxWidth: '340px',
    width: '100%',
    textAlign: 'center',
  },
  url: { fontSize: '0.75rem', color: '#888', wordBreak: 'break-all', marginBottom: '1rem' },
  qrWrap: { display: 'flex', justifyContent: 'center', marginBottom: '1rem' },
  actions: { display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' },
  button: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    background: '#4c8dff',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  regenButton: {
    padding: '0.6rem',
    borderRadius: '8px',
    border: '1px solid #e2e4e9',
    background: '#fff',
    color: '#d33',
    cursor: 'pointer',
    fontSize: '0.9rem',
  },
  closeButton: {
    padding: '0.5rem 1rem',
    borderRadius: '8px',
    border: 'none',
    background: 'transparent',
    color: '#666',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
}
