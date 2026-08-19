import { useState } from 'react'
import * as XLSX from 'xlsx'
import { X, Upload, Download, Check, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import Button from './ui/Button'

const PREP_LOCATIONS = ['kitchen', 'bar', 'bottle_service']

export default function MenuImportModal({ businessId, existingCategories, onClose, onImported }) {
  const [rows, setRows] = useState([])
  const [errors, setErrors] = useState([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [step, setStep] = useState('upload') // upload | preview | done

  function downloadTemplate() {
    const template = [
      ['Category', 'Item Name', 'Description', 'Price', 'Prep Location', 'Available'],
      ['Appetizers', 'Loaded Nachos', 'Cheese, jalapeños, sour cream', '12.99', 'kitchen', 'yes'],
      ['Cocktails', 'Old Fashioned', 'Bourbon, bitters, orange peel', '14.00', 'bar', 'yes'],
      ['Bottles', 'Hennessy VS', '750ml', '210.00', 'bottle_service', 'yes'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Menu')
    XLSX.writeFile(wb, 'maxoserve-menu-template.xlsx')
  }

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' })
      const sheet = wb.Sheets[wb.SheetNames[0]]
      const data = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      parseRows(data)
    }
    reader.readAsBinaryString(file)
  }

  function parseRows(data) {
    const parsed = []
    const parseErrors = []

    data.forEach((row, i) => {
      const category = String(row['Category'] || '').trim()
      const name = String(row['Item Name'] || '').trim()
      const description = String(row['Description'] || '').trim()
      const price = parseFloat(row['Price'])
      let prepLocation = String(row['Prep Location'] || 'kitchen').trim().toLowerCase()
      const available = String(row['Available'] || 'yes').trim().toLowerCase() !== 'no'

      const rowNum = i + 2 // +2 accounts for header row + 1-indexing

      if (!category) { parseErrors.push(`Row ${rowNum}: missing Category`); return }
      if (!name) { parseErrors.push(`Row ${rowNum}: missing Item Name`); return }
      if (isNaN(price)) { parseErrors.push(`Row ${rowNum}: invalid Price "${row['Price']}"`); return }
      if (!PREP_LOCATIONS.includes(prepLocation)) {
        parseErrors.push(`Row ${rowNum}: unknown Prep Location "${row['Prep Location']}", defaulting to kitchen`)
        prepLocation = 'kitchen'
      }

      parsed.push({ category, name, description, price, prepLocation, available })
    })

    setRows(parsed)
    setErrors(parseErrors)
    setStep('preview')
  }

  async function handleImport() {
    setImporting(true)

    const categoryCache = {}
    for (const cat of existingCategories) categoryCache[cat.name.toLowerCase()] = cat.id

    let created = 0
    const failedRows = []

    for (const row of rows) {
      let categoryId = categoryCache[row.category.toLowerCase()]

      if (!categoryId) {
        const { data: newCat, error: catError } = await supabase
          .from('menu_categories')
          .insert({ business_id: businessId, name: row.category, display_order: 0 })
          .select()
          .single()

        if (catError || !newCat) {
          failedRows.push(`"${row.name}": could not create category "${row.category}"`)
          continue
        }
        categoryId = newCat.id
        categoryCache[row.category.toLowerCase()] = categoryId
      }

      const { error: itemError } = await supabase.from('menu_items').insert({
        business_id: businessId,
        category_id: categoryId,
        name: row.name,
        description: row.description || null,
        price: row.price,
        prep_location: row.prepLocation,
        is_available: row.available,
      })

      if (itemError) {
        failedRows.push(`"${row.name}": ${itemError.message}`)
      } else {
        created++
      }
    }

    setImporting(false)
    setStep('done')
    setErrors(failedRows)
    onImported(created)
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={{ margin: 0 }}>Import Menu</h3>
          <button onClick={onClose} style={styles.closeIcon}><X size={18} /></button>
        </div>

        {step === 'upload' && (
          <>
            <p style={styles.helpText}>
              Download the template, fill it in with your menu, then upload it here.
              Works with .xlsx or .csv — including files exported from Google Sheets.
            </p>
            <Button variant="secondary" icon={Download} onClick={downloadTemplate} style={{ marginBottom: '1rem' }}>
              Download Template
            </Button>
            <label style={styles.uploadBox}>
              <Upload size={22} color="var(--color-text-muted)" />
              <span style={{ fontWeight: 600, fontSize: '0.9rem', marginTop: '0.5rem' }}>
                Click to upload your file
              </span>
              <span style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>.xlsx or .csv</span>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} style={{ display: 'none' }} />
            </label>
          </>
        )}

        {step === 'preview' && (
          <>
            <p style={styles.helpText}>
              <strong>{fileName}</strong> — found {rows.length} item(s) across{' '}
              {new Set(rows.map((r) => r.category)).size} categor{new Set(rows.map((r) => r.category)).size === 1 ? 'y' : 'ies'}.
            </p>

            {errors.length > 0 && (
              <div style={styles.warningBox}>
                <AlertTriangle size={15} color="var(--color-warning)" />
                <div>
                  {errors.map((e, i) => <div key={i} style={{ fontSize: '0.8rem' }}>{e}</div>)}
                </div>
              </div>
            )}

            <div style={styles.previewList}>
              {rows.slice(0, 8).map((r, i) => (
                <div key={i} style={styles.previewRow}>
                  <span>{r.category} — {r.name}</span>
                  <span style={{ color: 'var(--color-text-muted)' }}>${r.price.toFixed(2)}</span>
                </div>
              ))}
              {rows.length > 8 && (
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', padding: '0.4rem 0' }}>
                  + {rows.length - 8} more
                </div>
              )}
            </div>

            <div style={styles.actions}>
              <Button variant="secondary" onClick={() => setStep('upload')}>Back</Button>
              <Button variant="primary" onClick={handleImport} disabled={importing || rows.length === 0}>
                {importing ? 'Importing…' : `Import ${rows.length} Items`}
              </Button>
            </div>
          </>
        )}

        {step === 'done' && (
          <>
            <div style={styles.successBox}>
              <Check size={20} color="var(--color-success)" />
              <span>Import complete.</span>
            </div>
            {errors.length > 0 && (
              <div style={styles.warningBox}>
                <AlertTriangle size={15} color="var(--color-warning)" />
                <div>
                  {errors.map((e, i) => <div key={i} style={{ fontSize: '0.8rem' }}>{e}</div>)}
                </div>
              </div>
            )}
            <Button variant="primary" onClick={onClose} style={{ marginTop: '1rem', width: '100%' }}>
              Done
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
  },
  modal: {
    background: 'var(--color-surface)', borderRadius: 'var(--radius-lg)', padding: '1.5rem',
    maxWidth: '480px', width: '100%', maxHeight: '85vh', overflowY: 'auto',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' },
  closeIcon: { background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' },
  helpText: { color: 'var(--color-text-muted)', fontSize: '0.88rem', marginBottom: '1rem' },
  uploadBox: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    border: '2px dashed var(--color-border)', borderRadius: 'var(--radius-md)',
    padding: '2rem 1rem', cursor: 'pointer', textAlign: 'center',
  },
  warningBox: {
    display: 'flex', gap: '0.5rem', background: 'var(--color-warning-soft)',
    borderRadius: 'var(--radius-sm)', padding: '0.75rem', marginBottom: '1rem',
  },
  previewList: { display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '1.25rem' },
  previewRow: {
    display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem',
    padding: '0.4rem 0', borderBottom: '1px solid var(--color-border)',
  },
  actions: { display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' },
  successBox: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'var(--color-success-soft)', borderRadius: 'var(--radius-sm)',
    padding: '0.75rem', fontWeight: 600, color: 'var(--color-success)',
  },
}
