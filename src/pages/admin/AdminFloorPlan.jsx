import { useEffect, useState, useRef } from 'react'
import { Stage, Layer, Rect, Circle, Ellipse, Text, Group, Transformer } from 'react-konva'
import { ZoomIn, ZoomOut, Maximize2, Plus, Trash2, ChevronDown } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrentLocation } from '../../contexts/LocationContext'
import { useCurrentBusiness } from '../../contexts/BusinessContext'
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

const SHAPE_PRESETS = [
  { key: 'bar', labelKey: 'shapeBar', shape_type: 'rectangle', width: 180, height: 50, color: '#78716c' },
  { key: 'stage', labelKey: 'shapeStage', shape_type: 'rectangle', width: 200, height: 120, color: '#7c3aed' },
  { key: 'dj', labelKey: 'shapeDjBooth', shape_type: 'rectangle', width: 100, height: 70, color: '#0ea5e9' },
  { key: 'wall', labelKey: 'shapeWall', shape_type: 'rectangle', width: 200, height: 15, color: '#64748b' },
  { key: 'custom', labelKey: 'shapeCustomLabel', shape_type: 'rectangle', width: 100, height: 100, color: '#94a3b8' },
]

export default function AdminFloorPlan() {
  const { user } = useAuth()
  const { currentLocationId } = useCurrentLocation()
  const { currentBusinessId } = useCurrentBusiness()
  const { t } = useAppLanguage()
  const { showToast } = useToast()
  const [areas, setAreas] = useState([])
  const [selectedAreaId, setSelectedAreaId] = useState('')
  const [tables, setTables] = useState([])
  const [shapes, setShapes] = useState([])
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedTableId, setSelectedTableId] = useState(null)
  const [selectedShapeId, setSelectedShapeId] = useState(null)
  const [showShapeMenu, setShowShapeMenu] = useState(false)

  const containerRef = useRef(null)
  const stageRef = useRef(null)
  const transformerRef = useRef(null)
  const shapeNodeRefs = useRef({})
  const [stageWidth, setStageWidth] = useState(800)
  const [stageScale, setStageScale] = useState(1)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    loadInitial()
  }, [currentBusinessId])

  useEffect(() => {
    if (currentLocationId) loadAreasForLocation(currentLocationId)
    else { setAreas([]); setSelectedAreaId('') }
  }, [currentLocationId])

  useEffect(() => {
    if (selectedAreaId) {
      loadTables(selectedAreaId)
      loadShapes(selectedAreaId)
    } else {
      setTables([])
      setShapes([])
    }
  }, [selectedAreaId])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setStageWidth(entry.contentRect.width)
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [tables])

  useEffect(() => {
    if (!transformerRef.current) return
    if (selectedShapeId && shapeNodeRefs.current[selectedShapeId]) {
      transformerRef.current.nodes([shapeNodeRefs.current[selectedShapeId]])
    } else {
      transformerRef.current.nodes([])
    }
    transformerRef.current.getLayer()?.batchDraw()
  }, [selectedShapeId, shapes])

  async function loadInitial() {
    setLoading(false)
  }

  async function loadAreasForLocation(locationId) {
    const { data } = await supabase.from('areas').select('*').eq('location_id', locationId).order('display_order', { ascending: true })
    setAreas(data || [])
    if (data && data.length > 0) setSelectedAreaId(data[0].id)
    else setSelectedAreaId('')
  }

  async function loadTables(areaId) {
    const { data } = await supabase.from('tables').select('*').eq('area_id', areaId).order('created_at', { ascending: true })
    setTables(data || [])
    setDirty(false)
  }

  async function loadShapes(areaId) {
    const { data } = await supabase.from('floor_plan_shapes').select('*').eq('area_id', areaId)
    setShapes(data || [])
  }

  function handleDragMove(tableId, newX, newY) {
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, pos_x: newX, pos_y: newY } : t)))
    setDirty(true)
  }

  function handleShapeDragMove(shapeId, newX, newY) {
    setShapes((prev) => prev.map((s) => (s.id === shapeId ? { ...s, pos_x: newX, pos_y: newY } : s)))
    setDirty(true)
  }

  function handleShapeTransformEnd(shapeId, node) {
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    const newWidth = Math.max(20, node.width() * scaleX)
    const newHeight = Math.max(20, node.height() * scaleY)
    node.scaleX(1)
    node.scaleY(1)

    setShapes((prev) => prev.map((s) => (
      s.id === shapeId
        ? { ...s, pos_x: node.x(), pos_y: node.y(), width: newWidth, height: newHeight, rotation: node.rotation() }
        : s
    )))
    setDirty(true)
  }

  function handleWheel(e) {
    e.evt.preventDefault()
    const scaleBy = 1.08
    const stage = stageRef.current
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    const mousePointTo = { x: (pointer.x - stage.x()) / oldScale, y: (pointer.y - stage.y()) / oldScale }
    const direction = e.evt.deltaY > 0 ? -1 : 1
    const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy
    const clampedScale = Math.max(0.3, Math.min(3, newScale))
    setStageScale(clampedScale)
    setStagePos({ x: pointer.x - mousePointTo.x * clampedScale, y: pointer.y - mousePointTo.y * clampedScale })
  }

  function handleZoomButton(direction) {
    const oldScale = stageScale
    const newScale = direction > 0 ? oldScale * 1.2 : oldScale / 1.2
    const clampedScale = Math.max(0.3, Math.min(3, newScale))
    const centerX = stageWidth / 2
    const centerY = 400
    const mousePointTo = { x: (centerX - stagePos.x) / oldScale, y: (centerY - stagePos.y) / oldScale }
    setStageScale(clampedScale)
    setStagePos({ x: centerX - mousePointTo.x * clampedScale, y: centerY - mousePointTo.y * clampedScale })
  }

  function handleResetView() {
    setStageScale(1)
    setStagePos({ x: 0, y: 0 })
  }

  async function handleSaveLayout() {
    setSaving(true)
    for (const tbl of tables) {
      await supabase.from('tables').update({ pos_x: tbl.pos_x, pos_y: tbl.pos_y, width: tbl.width, height: tbl.height }).eq('id', tbl.id)
    }
    for (const shape of shapes) {
      await supabase.from('floor_plan_shapes')
        .update({ pos_x: shape.pos_x, pos_y: shape.pos_y, width: shape.width, height: shape.height, rotation: shape.rotation })
        .eq('id', shape.id)
    }
    setSaving(false)
    setDirty(false)
    showToast('Floor plan saved')
  }

  function handleFlipOrientation(tableId) {
    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, width: t.height, height: t.width } : t)))
    setDirty(true)
  }

  async function handleAddShape(preset) {
    const newShape = {
      business_id: currentBusinessId,
      location_id: currentLocationId,
      area_id: selectedAreaId,
      label: t(preset.labelKey),
      shape_type: preset.shape_type,
      pos_x: 150 + shapes.length * 20,
      pos_y: 150 + shapes.length * 20,
      width: preset.width,
      height: preset.height,
      rotation: 0,
      color: preset.color,
    }
    const { data, error } = await supabase.from('floor_plan_shapes').insert(newShape).select().single()
    if (error) { showToast(`Could not add shape: ${error.message}`, 'error'); return }
    setShapes((prev) => [...prev, data])
    setSelectedShapeId(data.id)
    setSelectedTableId(null)
    setShowShapeMenu(false)
  }

  async function handleUpdateShapeLabel(shapeId, newLabel) {
    setShapes((prev) => prev.map((s) => (s.id === shapeId ? { ...s, label: newLabel } : s)))
    await supabase.from('floor_plan_shapes').update({ label: newLabel }).eq('id', shapeId)
  }

  async function handleUpdateShapeType(shapeId, newType) {
    setShapes((prev) => prev.map((s) => (s.id === shapeId ? { ...s, shape_type: newType } : s)))
    await supabase.from('floor_plan_shapes').update({ shape_type: newType }).eq('id', shapeId)
  }

  async function handleDeleteShape(shapeId) {
    if (!confirm('Delete this shape?')) return
    await supabase.from('floor_plan_shapes').delete().eq('id', shapeId)
    setShapes((prev) => prev.filter((s) => s.id !== shapeId))
    setSelectedShapeId(null)
  }

  const selectedTable = tables.find((t) => t.id === selectedTableId)
  const selectedShape = shapes.find((s) => s.id === selectedShapeId)

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

        {selectedAreaId && (
          <div style={{ position: 'relative' }}>
            <button onClick={() => setShowShapeMenu((v) => !v)} style={styles.addShapeButton}>
              <Plus size={15} /> {t('addShape')} <ChevronDown size={13} />
            </button>
            {showShapeMenu && (
              <>
                <div style={styles.menuOverlay} onClick={() => setShowShapeMenu(false)} />
                <div style={styles.shapeMenu}>
                  {SHAPE_PRESETS.map((preset) => (
                    <button key={preset.key} onClick={() => handleAddShape(preset)} style={styles.shapeMenuItem}>
                      <span style={{ ...styles.shapeSwatch, background: preset.color }} />
                      {t(preset.labelKey)}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <button onClick={handleSaveLayout} disabled={!dirty || saving} style={{ ...styles.saveButton, opacity: dirty ? 1 : 0.5, marginLeft: 'auto' }}>
          {saving ? t('saving') : t('save')}
        </button>
      </div>

      {areas.length === 0 ? (
        <p style={{ color: '#888' }}>{t('createAreaThenTables')}</p>
      ) : (
        <div ref={containerRef} style={styles.canvasWrap}>
          <div style={styles.zoomControls}>
            <button onClick={() => handleZoomButton(1)} style={styles.zoomButton} title="Zoom in"><ZoomIn size={16} /></button>
            <button onClick={() => handleZoomButton(-1)} style={styles.zoomButton} title="Zoom out"><ZoomOut size={16} /></button>
            <button onClick={handleResetView} style={styles.zoomButton} title="Reset view"><Maximize2 size={16} /></button>
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
            onClick={(e) => {
              if (e.target === e.target.getStage()) {
                setSelectedTableId(null)
                setSelectedShapeId(null)
              }
            }}
            onDragEnd={(e) => {
              if (e.target === e.target.getStage()) {
                setStagePos({ x: e.target.x(), y: e.target.y() })
              }
            }}
          >
            <Layer>
              {shapes.map((s) => (
                <Group
                  key={s.id}
                  x={s.pos_x}
                  y={s.pos_y}
                  rotation={s.rotation || 0}
                  draggable
                  ref={(node) => { if (node) shapeNodeRefs.current[s.id] = node }}
                  onDragMove={(e) => handleShapeDragMove(s.id, e.target.x(), e.target.y())}
                  onTransformEnd={(e) => handleShapeTransformEnd(s.id, e.target)}
                  onClick={() => { setSelectedShapeId(s.id); setSelectedTableId(null) }}
                  onTap={() => { setSelectedShapeId(s.id); setSelectedTableId(null) }}
                  width={s.width}
                  height={s.height}
                >
                  {s.shape_type === 'oval' ? (
                    <Ellipse
                      radiusX={s.width / 2}
                      radiusY={s.height / 2}
                      x={s.width / 2}
                      y={s.height / 2}
                      fill={s.color || '#94a3b8'}
                      opacity={0.85}
                      stroke={selectedShapeId === s.id ? '#4c8dff' : '#555'}
                      strokeWidth={selectedShapeId === s.id ? 2 : 1}
                    />
                  ) : (
                    <Rect
                      width={s.width}
                      height={s.height}
                      fill={s.color || '#94a3b8'}
                      opacity={0.85}
                      stroke={selectedShapeId === s.id ? '#4c8dff' : '#555'}
                      strokeWidth={selectedShapeId === s.id ? 2 : 1}
                      cornerRadius={4}
                    />
                  )}
                  <Text
                    text={s.label}
                    fontSize={12}
                    fontStyle="bold"
                    fill="#fff"
                    width={s.width}
                    height={s.height}
                    align="center"
                    verticalAlign="middle"
                  />
                </Group>
              ))}

              {selectedShapeId && (
                <Transformer
                  ref={transformerRef}
                  rotateEnabled={true}
                  boundBoxFunc={(oldBox, newBox) => {
                    if (newBox.width < 20 || newBox.height < 20) return oldBox
                    return newBox
                  }}
                />
              )}

              {tables.map((t) => (
                <Group
                  key={t.id}
                  x={t.pos_x}
                  y={t.pos_y}
                  draggable
                  onDragMove={(e) => handleDragMove(t.id, e.target.x(), e.target.y())}
                  onClick={() => { setSelectedTableId(t.id); setSelectedShapeId(null) }}
                  onTap={() => { setSelectedTableId(t.id); setSelectedShapeId(null) }}
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
          <button onClick={() => handleFlipOrientation(selectedTable.id)} style={styles.flipButton}>{t('flipOrientation')}</button>
        </div>
      )}

      {selectedShape && (
        <div style={styles.infoBar}>
          <input
            type="text"
            value={selectedShape.label}
