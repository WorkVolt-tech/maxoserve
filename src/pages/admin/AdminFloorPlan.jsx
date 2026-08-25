import { useEffect, useState, useRef } from 'react'
import { Stage, Layer, Rect, Circle, Ellipse, Text, Group } from 'react-konva'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrentLocation } from '../../contexts/LocationContext'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import { useToast } from '../../contexts/ToastContext'

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
  const { currentLocationId } = useCurrentLocation()
  const { t } = useAppLanguage()
  const { showToast } = useToast()
  const [areas, setAreas] = useState([])
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [tables, setTables] = useState([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedTableId, setSelectedTableId] = useState(null)

  const containerRef = useRef(null)
  const stageRef = useRef(null)
  const [stageWidth, setStageWidth] = useState(800)
  const [stageScale, setStageScale] = useState(1)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    loadInitial()
  }, [])

  useEffect(() => {
    if (currentLocationId) loadAreasForLocation(currentLocationId)
    else { setAreas([]); setSelectedAreaId('') }
  }, [currentLocationId])

  useEffect(() => {
    if (selectedAreaId) loadTables(selectedAreaId)
    else setTables([])
  }, [selectedAreaId])

  useEffect(() => {
    if (!containerRef.current) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setStageWidth(entry.contentRect.width)
      }
    })
    observer.observe(containerRef.current)

    return () => observer.disconnect()
  }, [tables])

  async function loadInitial() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('business_members')
      .select('business_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) { setLoading(false); return }
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

  function handleWheel(e) {
    e.evt.preventDefault()
    const scaleBy = 1.08
    const stage = stageRef.current
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }

    const direction = e.evt.deltaY > 0 ? -1 : 1
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy
    const clampedScale = Math.max(0.3, Math.min(3, newScale))

    setStageScale(clampedScale)
    setStagePos({
      x: pointer.x - mousePointTo.x * clampedScale,
      y: pointer.y - mousePointTo.y * clampedScale,
    })
  }

  function handleZoomButton(direction) {
    const stage = stageRef.current
    const oldScale = stageScale
    const newScale = direction > 0 ? oldScale * 1.2 : oldScale / 1.2
    const clampedScale = Math.max(0.3, Math.min(3, newScale))

    const centerX = stageWidth / 2
    const centerY = 400
    const mousePointTo = {
      x: (centerX - stagePos.x) / oldScale,
      y: (centerY - stagePos.y) / oldScale,
    }

    setStageScale(clampedScale)
    setStagePos({
      x: centerX - mousePointTo.x * clampedScale,
      y: centerY - mousePointTo.y * clampedScale,
    })
  }

  function handleResetView() {
    setStageScale(1)
    setStagePos({ x: 0, y: 0 })
  }

  async function handleSaveLayout() {
    setSaving(true)
    for (const tbl of tables) {
      await supabase
        .from('tables')
        .update({ pos_x: tbl.pos_x, pos_y: tbl.pos_y, width: tbl.width, height: tbl.height })
        .eq('id', tbl.id)
    }
    setSaving(false)
    setDirty(false)
    showToast('Floor plan saved')
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

  if (loading) return <div><h2>{t('floorPlan')}</h2><p>{t('loading')}</p></div>

  if (!currentLocationId) {
    return <div><h2>{t('floorPlan')}</h2><p style={{ color: '#888' }}>{t('createLocationFirstFloorPlan')}</p></div>
  }

  return (
    <div>
      <h2>{t('floorPlan')}</h2>
      <p style={{ color: '#666' }}>{t('subtitleFloorPlan')}</p>

      <div style={styles.pickerRow}>
        <div>
          <label style={styles.label}>{t('areas')}:</label>
          <select value={selectedAreaId} onChange={(e) => setSelectedAreaId(e.target.value)} style={styles.select} disabled={areas.length === 0}>
            {areas.length === 0 && <option>{t('noAreasOption')}</option>}
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <button
          onClick={handleSaveLayout}
          disabled={!dirty || saving}
          style={{ ...styles.saveButton, opacity: dirty ? 1 : 0.5 }}
        >
          {saving ? t('saving') : t('save')}
        </button>
      </div>

      {areas.length === 0 ? (
        <p style={{ color: '#888' }}>{t('createAreaThenTables')}</p>
      ) : tables.length === 0 ? (
        <p style={{ color: '#888' }}>{t('noTablesInAreaFloorPlan')}</p>
      ) : (
        <div ref={containerRef} style={styles.canvasWrap}>
          <div style={styles.zoomControls}>
            <button onClick={() => handleZoomButton(1)} style={styles.zoomButton} title="Zoom in">
              <ZoomIn size={16} />
            </button>
            <button onClick={() => handleZoomButton(-1)} style={styles.zoomButton} title="Zoom out">
              <ZoomOut size={16} />
            </button>
            <button onClick={handleResetView} style={styles.zoomButton} title="Reset view">
              <Maximize2 size={16} />
            </button>
            <span style={styles.zoomPercent}>{Math.round(stageScale * 100)}%</span>
          </div>
          <Stage
            ref={stageRef}
            width={stageWidth}
            height={800}
            draggable
            x={stagePos.x}
            y={stagePos.y}
            scaleX={stageScale}
            scaleY={stageScale}
            onWheel={handleWheel}
            onDragEnd={(e) => {
              // Only update pan position if the Stage itself was dragged (not a table inside it)
              if (e.target === e.target.getStage()) {
                setStagePos({ x: e.target.x(), y: e.target.y() })
              }
            }}
          >
            <Layer>
              {tables.map((t) => (
                <Group
                  key={t.id}
                  x={t.pos_x}
                  y={t.pos_y}
                  draggable
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
                  ) : t.shape === 'oval' ? (
                    <Ellipse
                      radiusX={(t.width || 120) / 2}
                      radiusY={(t.height || 70) / 2}
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
                    fontSize={12}
                    fontStyle="bold"
                    fill="#1a1d23"
                    width={Math.max(t.width || 80, 60)}
                    offsetX={Math.max(t.width || 80, 60) / 2}
                    offsetY={-((t.height || 80) / 2) - 16}
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
          <span style={styles.meta}>{t('statusLabel')}: {selectedTable.status}</span>
          <span style={styles.meta}>{t('capacityLabel')}: {selectedTable.capacity || '—'}</span>
          <span style={styles.meta}>{Math.round(selectedTable.width)} × {Math.round(selectedTable.height)}</span>
          <button onClick={() => handleFlipOrientation(selectedTable.id)} style={styles.flipButton}>
            {t('flipOrientation')}
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
    position: 'relative',
  },
  zoomControls: {
    position: 'absolute',
    top: '0.75rem',
    right: '0.75rem',
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    gap: '0.3rem',
    background: '#fff',
    border: '1px solid #e2e4e9',
    borderRadius: '8px',
    padding: '0.3rem',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
  },
  zoomButton: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '1px solid #e2e4e9',
    borderRadius: '6px',
    background: '#fff',
    cursor: 'pointer',
    color: '#333',
  },
  zoomPercent: {
    fontSize: '0.75rem',
    color: '#888',
    minWidth: '36px',
    textAlign: 'center',
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
    flexWrap: 'wrap',
  },
  meta: { color: '#666', fontSize: '0.9rem' },
}
