import { useRef, useEffect, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { supabase } from '../lib/supabaseClient'
import { useAppLanguage } from '../contexts/AppLanguageContext'

export default function QrCodeModal({ table, url, onClose, onRegenerate, regenerating }) {
  const wrapRef = useRef(null)
  const { t } = useAppLanguage()
  const [business, setBusiness] = useState(null)

  useEffect(() => {
    async function loadBusiness() {
      if (!table?.business_id) return
      const { data } = await supabase
        .from('businesses')
        .select('name, logo_url')
        .eq('id', table.business_id)
        .single()
      setBusiness(data)
    }
    loadBusiness()
  }, [table])

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
    const logoHtml = business?.logo_url
      ? `<img src="${business.logo_url}" style="max-width:140px; max-height:90px; margin-bottom:1rem;" />`
      : ''
    const businessName = business?.name || ''

    const printWindow = window.open('', '_blank')
    printWindow.document.write(`
      <html>
        <head>
          <title>${table.name} - QR Code</title>
          <style>
            @page { size: 4in 6in; margin: 0.3in; }
            body {
              font-family: 'Segoe UI', system-ui, sans-serif;
              text-align: center;
              padding: 1.5rem 1rem;
              margin: 0;
            }
            .card {
              border: 2px solid #14161f;
              border-radius: 16px;
              padding: 1.75rem 1.25rem;
              max-width: 340px;
              margin: 0 auto;
            }
            h1 { font-size: 1.3rem; margin: 0 0 0.15rem; color: #14161f; }
            .table-name {
              display: inline-block;
              background: #3b6fe0;
              color: #fff;
              padding: 0.4rem 1.1rem;
              border-radius: 999px;
              font-weight: 700;
              font-size: 1rem;
              margin: 0.85rem 0 1.25rem;
            }
            .scan-label {
              font-size: 1rem;
              font-weight: 700;
              color: #14161f;
              margin: 1rem 0 0.25rem;
            }
            .footer {
              font-size: 0.7rem;
              color: #9ca3af;
              margin-top: 1.25rem;
            }
            img.qr { width: 220px; height: 220px; }
          </style>
        </head>
        <body>
          <div class="card">
            ${logoHtml}
            <h1>${businessName}</h1>
            <div class="table-name">${table.name}</div>
            <br />
            <img class="qr" src="${dataUrl}" />
            <div class="scan-label">${t('scanToOrder')}</div>
            <div class="footer">${t('poweredByMaxoServe')}</div>
          </div>
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
