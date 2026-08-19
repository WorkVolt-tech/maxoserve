import { useState } from 'react'
import * as XLSX from 'xlsx'
import { X, Upload, Download, Check, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import Button from './ui/Button'

export default function ModifierImportModal({ businessId, onClose, onImported }) {
  const [groupedRows, setGroupedRows] = useState([])
  const [errors, setErrors] = useState([])
  const [fileName, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [step, setStep] = useState('upload')

  function downloadTemplate() {
    const template = [
      ['Group Name', 'Selection Type', 'Required', 'Option Name', 'Price Add-on'],
      ['Choose Mixer', 'single', 'no', 'Coke', '0'],
      ['Choose Mixer', 'single', 'no', 'Sprite', '0'],
      ['Choose Mixer', 'single', 'no', 'Cranberry', '0'],
      ['Add-ons', 'multiple', 'no', 'Cheese', '1.50'],
      ['Add-ons', 'multiple', 'no', 'Bacon', '2.00'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(template)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Modifiers')
    XLSX.writeFile(wb, 'maxoserve-modifiers-template.xlsx')
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
    const parseErrors = []
    const groups = {}

    data.forEach((row, i) => {
      const groupName = String(row['Group Name'] || '').trim()
      let selectionType = String(row['Selection Type'] || 'single').trim().toLowerCase()
      const required = String(row['Required'] || 'no').trim().toLowerCase() === 'yes'
      const optionName = String(row['Option Name'] || '').trim()
      const priceDelta = parseFloat(row['Price Add-on']) || 0

      const rowNum = i + 2

      if (!groupName) { parseErrors.push(`Row ${rowNum}: missing Group Name`); return }
      if (!optionName) { parseErrors.push(`Row ${rowNum}: missing Option Name`); return }
      if (!['single', 'multiple'].includes(selectionType)) {
        parseErrors.push(`Row ${rowNum}: unknown Selection Type "${row['Selection Type']}", defaulting to single`)
        selectionType = 'single'
      }

      if (!groups[groupName]) {
        groups[groupName] = { name: groupName, selectionType, required, options: [] }
      }
      groups[groupName].options.push({ name: optionName, priceDelta })
    })

    setGroupedRows(Object.values(groups))
    setErrors(parseErrors)
    setStep('preview')
  }

  async function handleImport() {
    setImporting(true)
    const failedRows = []
    let groupsCreated = 0

    for (const group of groupedRows) {
      const { data: newGroup, error: groupError } = await supabase
        .from('modifier_groups')
        .insert({
          business_id: businessId,
          name: group.name,
          selection_type: group.selectionType,
          is_required: group.required,
          display_order: 0,
        })
        .select()
        .single()

      if (groupError || !newGroup) {
        failedRows.push(`Group "${group.name}": ${groupError?.message || 'failed to create'}`)
        continue
      }

      groupsCreated++

      for (const opt of group.options) {
        const { error: optError } = await supabase.from('modifier_options').insert({
          business_id: businessId,
          modifier_group_id: newGroup.id,
          name: opt.name,
          price_delta: opt.priceDelta,
          display_order: 0,
        })
        if (optError) {
          failedRows.push(`"${group.name} → ${opt.name}": ${optError.message}`)
        }
      }
    }

    setImporting(false)
    setStep('done')
    setErrors(failedRows)
    onImported(groupsCreated)
  }

  const totalOptions = groupedRows.reduce((sum, g) => sum + g.options.length, 0)

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h3 style={{ margin: 0 }}>Import Modifiers</h3>
          <button onClick={onClose} style={styles.closeIcon}><X size={18} /></button>
        </div>

        {step === 'upload' && (
          <>
            <p style={styles.helpText}>
              Download the template, fill it in, then upload it here. Rows with the same
              Group Name are combined into one group automatically.
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
              <strong>{fileName}</strong> — found {groupedRows.length} group(s) with {totalOptions} total option(s).
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
              {groupedRows.map((g, i) => (
                <div key={i} style={styles.previewGroup}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>
                    {g.name} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>
                      ({g.selectionType === 'single' ? 'pick one' : 'pick multiple'}{g.required ? ', required' : ''})
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    {g.options.map((o) => o.name).join(', ')}
                  </div>
                </div>
              ))}
            </div>

            <div style={styles.actions}>
              <Button variant="secondary" onClick={() => setStep('upload')}>Back</Button>
              <Button variant="primary" onClick={handleImport} disabled={importing || groupedRows.length === 0}>
                {importing ? 'Importing…' : `Import ${groupedRows.length} Groups`}
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
  previewList: { display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' },
  previewGroup: { padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)' },
  actions: { display: 'flex', gap: '0.6rem', justifyContent: 'flex-end' },
  successBox: {
    display: 'flex', alignItems: 'center', gap: '0.5rem',
    background: 'var(--color-success-soft)', borderRadius: 'var(--radius-sm)',
    padding: '0.75rem', fontWeight: 600, color: 'var(--color-success)',
  },
}
