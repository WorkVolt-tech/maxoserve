import { useEffect, useState, useRef } from 'react'
import { Stage, Layer, Rect, Circle, Text, Group } from 'react-konva'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

const STATUS_COLORS = {
  available: '#4caf50',
  occupied: '#f44336',
  reserved: '#ff9800',
  needs_service: '#e91e63',
  order_pending: '#9c27b0',
  disabled: '#9e9e9e',
}

export default function AdminFloorPlan() {
  const { user } = useAuth()
  const [locations, setLocations] = useState([])
  const [areas, setAreas] = useState([])
  const [selectedLocationId, setSelectedLocationId] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [tables, setTables] = useState([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedTableId, setSelectedTableId] = useState(null)

  const containerRef = useRef(null)
  const [stageWidth, setStageWidth] = useState(800)

  useEffect(() => {
    loadInitial()
  }, [])

  useEffect(() => {
    if (selectedLocationId) loadAreasForLocation(selectedLocationId)
    else { setAreas([]); setSelectedAreaId('') }
  }, [selectedLocationId])

  useEffect(() => {
    if (selectedAreaId) loadTables(selectedAreaId)
    else setTables([])
  }, [selectedAreaId])

  useEffect(() => {
    function handleResize() {
      if (containerRef.current) {
        setStageWidth(containerRef.current.offsetWidth)
      }
    }
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  async function loadInitial() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('business_members')
      .select('business_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) { setLoading(false); return }

    const { data: locationsData } = await supabase
      .from('locations')
      .select('*')
      .eq('business_id', membership.business_id)
      .order('created_at', { ascending: true })

    setLocations(locationsData || [])
    if (locationsData && locationsData.length > 0) {
      setSelectedLocationId(locationsData[0].id)
    }
    setLoading(false)
  }

  async function loadAreasForLocation(locationId) {
    const { data } = await supabase
      .from('areas')
      .select('*')
      .eq('location_id', locationId)
      .order('display_order', { ascending: true })

    setAreas(data || [])
    if (data && data.length > 0) setSelectedAreaId(data[0].id)
    else setSelectedAreaId('')
  }

  async function loadTables(areaId) {
    const { data } = await supabase
      .from('tables')
      .select('*')
      .eq('area_id', areaId)
      .order('created_at', { ascending: true })

    setTables(data || [])
    setDirty(false)
  }

  function handleDragMove(tableId, newX, newY) {
    setTables((prev) =>
      prev.map((t) => (t.id === tableId ? { ...t, pos_x: newX, pos_y: newY } : t))
    )
    setDirty(true)
  }

  async function handleSaveLayout() {
    setSaving(true)
    for (const t of tables) {
      await supabase
        .from('tables')
        .update({ pos_x: t.pos_x, pos_y: t.pos_y, width: t.width, height: t.height })
        .eq('id', t.id)
    }
    setSaving(false)
    setDirty(false)
  }

  function handleFlipOrientation(tableId) {
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId ? { ...t, width: t.height, height: t.width } : t
      )
    )
    setDirty(true)
  }

  const selectedTable = tables.find((t) => t.id === selectedTableId)

  if (loading) return <div><h2>Floor Plan</h2><p>Loading...</p></div>

  if (locations.length === 0) {
    return <div><h2>Floor Plan</h2><p style={{ color: '#888' }}>Create a location first.</p></div>
  }

  return (
    <div>
      <h2>Floor Plan</h2>
      <p style={{ color: '#666' }}>Drag tables to arrange your floor plan. Click Save when done.</p>

      <div style={styles.pickerRow}>
        <div>
          <label style={styles.label}>Location:</label>
          <select value={selectedLocationId} onChange={(e) => setSelectedLocationId(e.target.value)} style={styles.select}>
            {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
          </select>
        </div>
        <div>
          <label style={styles.label}>Area:</label>
          <select value={selectedAreaId} onChange={(e) => setSelectedAreaId(e.target.value)} style={styles.select} disabled={areas.length === 0}>
            {areas.length === 0 && <option>No areas yet</option>}
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <button
          onClick={handleSaveLayout}
          disabled={!dirty || saving}
          style={{ ...styles.saveButton, opacity: dirty ? 1 : 0.5 }}
        >
          {saving ? 'Saving...' : dirty ? 'Save Layout' : 'Saved'}
        </button>
      </div>

      {areas.length === 0 ? (
        <p style={{ color: '#888' }}>Create an area first, then add tables to it (Tables tab).</p>
      ) : tables.length === 0 ? (
        <p style={{ color: '#888' }}>No tables in this area yet. Add some in the Tables tab.</p>
      ) : (
        <div ref={containerRef} style={styles.canvasWrap}>
          <Stage width={stageWidth} height={800}>
            <Layer>
              {tables.map((t) => (
                <Group
                  key={t.id}
                  x={t.pos_x}
                  y={t.pos_y}
                  draggable
                  dragBoundFunc={(pos) => {
                    const halfW = (t.width || 80) / 2
                    const halfH = (t.height || 80) / 2
                    return {
                      x: Math.max(halfW, Math.min(stageWidth - halfW, pos.x)),
                      y: Math.max(halfH, Math.min(800 - halfH, pos.y)),
                    }
                  }}
                  onDragMove={(e) => handleDragMove(t.id, e.target.x(), e.target.y())}
                  onClick={() => setSelectedTableId(t.id)}
                  onTap={() => setSelectedTableId(t.id)}
                >
                  {t.shape === 'round' || t.shape === 'bar_seat' ? (
                    <Circle
                      radius={(t.width || 80) / 2}
                      fill={STATUS_COLORS[t.status] || '#4caf50'}
                      stroke={selectedTableId === t.id ? '#4c8dff' : '#333'}
                      strokeWidth={selectedTableId === t.id ? 3 : 1}
                    />
                  ) : (
                    <Rect
                      width={t.width || 80}
                      height={t.height || 80}
                      offsetX={(t.width || 80) / 2}
                      offsetY={(t.height || 80) / 2}
                      fill={STATUS_COLORS[t.status] || '#4caf50'}
                      stroke={selectedTableId === t.id ? '#4c8dff' : '#333'}
                      strokeWidth={selectedTableId === t.id ? 3 : 1}
                      cornerRadius={6}
                    />
                  )}
                  <Text
                    text={t.name}
                    fontSize={13}
                    fill="#fff"
                    width={t.width || 80}
                    offsetX={(t.width || 80) / 2}
                    offsetY={-((t.height || 80) / 2) + 8}
                    align="center"
                  />
                </Group>
              ))}
            </Layer>
          </Stage>
        </div>
      )}

      {selectedTable && (
        <div style={styles.infoBar}>
          <strong>{selectedTable.name}</strong>
          <span style={styles.meta}>Status: {selectedTable.status}</span>
          <span style={styles.meta}>Capacity: {selectedTable.capacity || '—'}</span>
          <span style={styles.meta}>{Math.round(selectedTable.width)} × {Math.round(selectedTable.height)}</span>
          <button onClick={() => handleFlipOrientation(selectedTable.id)} style={styles.flipButton}>
            Flip Orientation
          </button>
        </div>
      )}
    </div>
  )
}

const styles = {
  pickerRow: { display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' },
  label: { display: 'block', fontSize: '0.85rem', color: '#555', marginBottom: '0.25rem' },
  select: { padding: '0.5rem', borderRadius: '8px', border: '1px solid #e2e4e9', fontSize: '0.95rem' },
  saveButton: {
    padding: '0.6rem 1.2rem',
    borderRadius: '8px',
    border: 'none',
    background: '#4c8dff',
    color: '#fff',
    cursor: 'pointer',
    fontSize: '0.95rem',
  },
  canvasWrap: {
    background: '#fff',
    border: '1px solid #e2e4e9',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  flipButton: {
    marginLeft: 'auto',
    padding: '0.4rem 0.8rem',
    borderRadius: '6px',
    border: '1px solid #e2e4e9',
    background: '#f5f6f8',
    cursor: 'pointer',
    fontSize: '0.85rem',
  },
  infoBar: {
    marginTop: '1rem',
    padding: '0.75rem 1rem',
    background: '#fff',
    border: '1px solid #e2e4e9',
    borderRadius: '8px',
    display: 'flex',
    gap: '1rem',
    alignItems: 'center',
  },
  meta: { color: '#666', fontSize: '0.9rem' },
}
