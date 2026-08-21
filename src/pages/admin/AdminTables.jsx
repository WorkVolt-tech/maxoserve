import { useEffect, useState } from 'react'
import { LayoutGrid, Plus, Trash2, QrCode } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrentLocation } from '../../contexts/LocationContext'
import QrCodeModal from '../../components/QrCodeModal'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'
import StatusBadge from '../../components/ui/StatusBadge'
import ConfirmationModal from '../../components/ui/ConfirmationModal'
import { useToast } from '../../contexts/ToastContext'

const SHAPES = ['round', 'square', 'rectangle', 'oval', 'booth', 'bar_seat', 'vip_section', 'custom']

function generateToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

export default function AdminTables() {
  const { user } = useAuth()
  const { currentLocationId } = useCurrentLocation()
  const { showToast } = useToast()
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [businessId, setBusinessId] = useState(null)
  const [areas, setAreas] = useState([])
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [tables, setTables] = useState([])
  const [qrTokens, setQrTokens] = useState({})

  const [name, setName] = useState('')
  const [tableNumber, setTableNumber] = useState('')
  const [capacity, setCapacity] = useState('')
  const [shape, setShape] = useState('round')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [qrModalTable, setQrModalTable] = useState(null)
  const [regenerating, setRegenerating] = useState(false)

  useEffect(() => { loadInitial() }, [])
  useEffect(() => {
    if (currentLocationId) loadAreasForLocation(currentLocationId)
    else { setAreas([]); setSelectedAreaId('') }
  }, [currentLocationId])
  useEffect(() => {
    if (selectedAreaId) loadTables(selectedAreaId)
    else setTables([])
  }, [selectedAreaId])

  async function loadInitial() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
    if (!membership) { setLoading(false); return }
    setBusinessId(membership.business_id)
    setLoading(false)
  }

  async function loadAreasForLocation(locationId) {
    const { data, error: areasError } = await supabase
      .from('areas').select('*').eq('location_id', locationId).order('display_order', { ascending: true })
    if (areasError) { setError(areasError.message); return }
    setAreas(data)
    if (data.length > 0) setSelectedAreaId(data[0].id)
    else setSelectedAreaId('')
  }

  async function loadTables(areaId) {
    const { data, error: tablesError } = await supabase
      .from('tables').select('*').eq('area_id', areaId).order('created_at', { ascending: true })
    if (tablesError) { setError(tablesError.message); return }
    setTables(data)
    loadQrTokensForTables(data.map((t) => t.id))
  }

  async function loadQrTokensForTables(tableIds) {
    if (!tableIds || tableIds.length === 0) { setQrTokens({}); return }
    const { data, error: qrError } = await supabase
      .from('table_qr_tokens').select('*').in('table_id', tableIds).eq('is_active', true)
    if (qrError) { setError(qrError.message); return }
    const map = {}
    for (const row of data) map[row.table_id] = row
    setQrTokens(map)
  }

  async function handleAdd(e) {
    e.preventDefault()
    setError('')
    if (!selectedAreaId) { setError('Select an area first.'); return }

    const column = tables.length % 5
    const row = Math.floor(tables.length / 5)
    const startX = 60 + column * 130
    const startY = 60 + row * 130

    const defaultSizes = {
      round: { width: 80, height: 80 }, square: { width: 80, height: 80 },
      rectangle: { width: 130, height: 70 }, booth: { width: 110, height: 70 },
      bar_seat: { width: 36, height: 36 }, vip_section: { width: 150, height: 100 },
      oval: { width: 120, height: 70 }, custom: { width: 80, height: 80 },
    }
    const size = defaultSizes[shape] || { width: 80, height: 80 }

    const { error: insertError } = await supabase.from('tables').insert({
      business_id: businessId, location_id: currentLocationId, area_id: selectedAreaId,
      name, table_number: tableNumber || null, capacity: capacity ? parseInt(capacity) : null,
      shape, pos_x: startX, pos_y: startY, width: size.width, height: size.height,
    })

    if (insertError) { setError(insertError.message); return }
    setName(''); setTableNumber(''); setCapacity(''); setShape('round')
    showToast(`"${name}" added`)
    loadTables(selectedAreaId)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const { error: deleteError } = await supabase.from('tables').delete().eq('id', deleteTarget.id)
    setDeleteTarget(null)
    if (deleteError) {
      showToast(`Could not delete table: ${deleteError.message}`, 'error')
      return
    }
    showToast('Table deleted')
    loadTables(selectedAreaId)
  }

  async function handleGenerateQr(table) {
    setError('')
    const token = generateToken()
    const { data, error: insertError } = await supabase
      .from('table_qr_tokens').insert({ business_id: businessId, table_id: table.id, token }).select().single()
    if (insertError) { setError(insertError.message); return }
    setQrTokens((prev) => ({ ...prev, [table.id]: data }))
    setQrModalTable(table)
  }

  async function handleRegenerate(table) {
    setRegenerating(true)
    setError('')
    const existing = qrTokens[table.id]
    if (existing) {
      await supabase.from('table_qr_tokens').update({ is_active: false, disabled_at: new Date().toISOString() }).eq('id', existing.id)
    }
    const token = generateToken()
    const { data, error: insertError } = await supabase
      .from('table_qr_tokens').insert({ business_id: businessId, table_id: table.id, token }).select().single()
    setRegenerating(false)
    if (insertError) { setError(insertError.message); return }
    setQrTokens((prev) => ({ ...prev, [table.id]: data }))
    showToast('QR code regenerated — old code is now inactive')
  }

  if (loading) return <LoadingState label="Loading tables…" />

  if (!currentLocationId) {
    return <EmptyState icon={LayoutGrid} title="No location selected" description="Create a location first." />
  }

  const activeQrTable = qrModalTable ? qrTokens[qrModalTable.id] : null
  const qrUrl = activeQrTable ? `${window.location.origin}/t/${activeQrTable.token}` : ''

  return (
    <div>
      <PageHeader title="Tables" subtitle="Add and manage individual tables within an area." />

      <Card style={{ marginBottom: '1.5rem' }}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={styles.label}>Area</label>
          <select value={selectedAreaId} onChange={(e) => setSelectedAreaId(e.target.value)} style={styles.select} disabled={areas.length === 0}>
            {areas.length === 0 && <option>No areas yet</option>}
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        {areas.length === 0 ? (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Create an area first (Areas tab) before adding tables.</p>
        ) : (
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 180px' }}>
              <Input placeholder="Table name (e.g. VIP 12)" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div style={{ flex: '0 1 120px' }}>
              <Input placeholder="Table #" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} />
            </div>
            <div style={{ flex: '0 1 100px' }}>
              <Input type="number" placeholder="Capacity" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
            </div>
            <select value={shape} onChange={(e) => setShape(e.target.value)} style={{ ...styles.select, flex: '0 1 140px' }}>
              {SHAPES.map((s) => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
            </select>
            <Button type="submit" icon={Plus}>Add Table</Button>
          </form>
        )}
        {error && <p style={{ color: 'var(--color-danger)', fontSize: '0.85rem', marginTop: '0.75rem' }}>{error}</p>}
      </Card>

      {areas.length > 0 && (
        tables.length === 0 ? (
          <EmptyState icon={LayoutGrid} title="No tables yet" description="Add your first table to this area." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {tables.map((t) => {
              const hasQr = !!qrTokens[t.id]
              return (
                <Card key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <strong>{t.name}</strong>
                      <StatusBadge status={t.status} />
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                      {t.table_number && <>#{t.table_number} · </>}
                      {t.capacity && <>seats {t.capacity} · </>}
                      {t.shape.replace('_', ' ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {hasQr ? (
                      <Button variant="secondary" size="sm" icon={QrCode} onClick={() => setQrModalTable(t)}>View QR</Button>
                    ) : (
                      <Button variant="secondary" size="sm" icon={QrCode} onClick={() => handleGenerateQr(t)}>Generate QR</Button>
                    )}
                    <Button variant="danger" size="sm" icon={Trash2} onClick={() => setDeleteTarget(t)}>Delete</Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )
      )}

      {qrModalTable && activeQrTable && (
        <QrCodeModal
          table={qrModalTable}
          url={qrUrl}
          onClose={() => setQrModalTable(null)}
          onRegenerate={() => handleRegenerate(qrModalTable)}
          regenerating={regenerating}
        />
      )}

      {deleteTarget && (
        <ConfirmationModal
          title={`Delete "${deleteTarget.name}"?`}
          description="Its QR code will stop working immediately. This can't be undone."
          confirmLabel="Delete Table"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}

const styles = {
  label: { fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.3rem', display: 'block' },
  select: {
    padding: '0.6rem', borderRadius: 'var(--radius-sm)', border: '1.5px solid var(--color-border)', fontSize: '0.9rem',
  },
}
