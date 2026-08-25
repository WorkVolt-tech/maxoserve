import { useEffect, useState } from 'react'
import {
  LayoutGrid, Bell, ShoppingBag, Clock, ChefHat, Users, ArrowRight,
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrentLocation } from '../../contexts/LocationContext'
import { useCurrentBusiness } from '../../contexts/BusinessContext'
import { useToast } from '../../contexts/ToastContext'
import ConfirmationModal from '../../components/ui/ConfirmationModal'
import { RotateCcw } from 'lucide-react'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import Card from '../../components/ui/Card'
import LoadingState from '../../components/ui/LoadingState'
import EmptyState from '../../components/ui/EmptyState'
import StatusBadge from '../../components/ui/StatusBadge'

function translateAction(action, t) {
  const match = action.match(/^(accepted|completed|on_the_way|rejected|cancelled|pending)\s+a service request$/)
  if (match) {
    const verbKeyMap = {
      accepted: 'statusAccepted',
      completed: 'statusCompleted',
      on_the_way: 'statusOnTheWay',
      rejected: 'statusRejected',
      cancelled: 'statusCancelled',
      pending: 'statusPending',
    }
    const verb = t(verbKeyMap[match[1]])
    return `${verb} — ${t('serviceRequestNoun')}`
  }
  return action
}

function localizedLabel(item, lang) {
  if (!item) return ''
  return lang === 'fr' && item.label_fr ? item.label_fr : item.label
}

function greetingKey() {
  const hour = new Date().getHours()
  if (hour < 12) return 'goodMorning'
  if (hour < 18) return 'goodAfternoon'
  return 'goodEvening'
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const { locations, currentLocationId } = useCurrentLocation()
  const { businesses, currentBusinessId } = useCurrentBusiness()
  const { t, lang } = useAppLanguage()
  const { showToast } = useToast()
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recentRequests, setRecentRequests] = useState([])
  const [recentActivity, setRecentActivity] = useState([])
  const [profiles, setProfiles] = useState({})
  const [tablesMap, setTablesMap] = useState({})
  const [requestTypesMap, setRequestTypesMap] = useState({})

  useEffect(() => {
    if (!currentBusinessId) return
    loadStats()
    loadSidePanels()
  }, [currentBusinessId])

  async function loadStats() {
    setLoading(true)

    const businessId = currentBusinessId
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [
      tablesRes,
      requestsOpenRes,
      requestsCompletedTodayRes,
      ordersTodayRes,
      ordersPreparingRes,
      staffActiveRes,
    ] = await Promise.all([
      supabase.from('tables').select('status').eq('business_id', businessId),
      supabase.from('service_requests').select('id').eq('business_id', businessId).in('status', ['pending', 'accepted', 'on_the_way']),
      supabase.from('service_requests').select('created_at, accepted_at').eq('business_id', businessId).eq('status', 'completed').gte('created_at', todayStart.toISOString()),
      supabase.from('orders').select('id').eq('business_id', businessId).neq('status', 'draft').gte('created_at', todayStart.toISOString()),
      supabase.from('orders').select('id').eq('business_id', businessId).in('status', ['accepted', 'preparing']),
      supabase.from('business_members').select('id').eq('business_id', businessId),
    ])

    const tables = tablesRes.data || []
    const occupied = tables.filter((t) => ['occupied', 'needs_service', 'order_pending'].includes(t.status)).length

    const completedToday = requestsCompletedTodayRes.data || []
    let avgResponseMinutes = null
    const responseTimes = completedToday
      .filter((r) => r.accepted_at)
      .map((r) => (new Date(r.accepted_at) - new Date(r.created_at)) / 60000)
    if (responseTimes.length > 0) {
      avgResponseMinutes = (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(1)
    }

    setStats({
      tablesTotal: tables.length,
      tablesOccupied: occupied,
      openRequests: (requestsOpenRes.data || []).length,
      completedRequestsToday: completedToday.length,
      avgResponseMinutes,
      ordersToday: (ordersTodayRes.data || []).length,
      ordersPreparing: (ordersPreparingRes.data || []).length,
      staffCount: (staffActiveRes.data || []).length,
    })

    setLoading(false)
  }

  async function loadSidePanels() {
    const businessId = currentBusinessId

    const { data: requestsData } = await supabase
      .from('service_requests')
      .select('*')
      .eq('business_id', businessId)
      .in('status', ['pending', 'accepted', 'on_the_way'])
      .order('created_at', { ascending: false })
      .limit(5)

    setRecentRequests(requestsData || [])

    if (requestsData && requestsData.length > 0) {
      const tableIds = [...new Set(requestsData.map((r) => r.table_id))]
      const { data: tablesData } = await supabase.from('tables').select('*').in('id', tableIds)
      const tMap = {}
      for (const t of tablesData || []) tMap[t.id] = t
      setTablesMap(tMap)

      const typeIds = [...new Set(requestsData.map((r) => r.request_type_id))]
      const { data: typesData } = await supabase.from('service_request_types').select('*').in('id', typeIds)
      const tyMap = {}
      for (const ty of typesData || []) tyMap[ty.id] = ty
      setRequestTypesMap(tyMap)
    }

    const { data: activityData } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('business_id', businessId)
      .order('created_at', { ascending: false })
      .limit(6)

    setRecentActivity(activityData || [])

    if (activityData && activityData.length > 0) {
      const userIds = [...new Set(activityData.map((a) => a.user_id).filter(Boolean))]
      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', userIds)
      const pMap = {}
      for (const p of profilesData || []) pMap[p.id] = p
      setProfiles(pMap)
    }
  }

  function minutesAgo(dateStr) {
    return Math.max(0, Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000))
  }

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'
  const currentLocation = locations.find((l) => l.id === currentLocationId)

  const isDemoBusiness = businesses.find((b) => b.business_id === currentBusinessId)?.is_demo

  async function handleResetDemo() {
    setResetting(true)
    const { error } = await supabase.rpc('reset_demo_data')
    setResetting(false)
    setShowResetConfirm(false)

    if (error) {
      showToast(`Could not reset: ${error.message}`, 'error')
      return
    }

    showToast(t('demoResetDone'))
    setTimeout(() => window.location.reload(), 800)
  }

  if (loading) return <LoadingState label={t('loading')} />

  if (!stats) return <p style={{ color: 'var(--color-text-muted)' }}>No data available.</p>

  const cards = [
    {
      icon: LayoutGrid,
      value: `${stats.tablesOccupied} / ${stats.tablesTotal}`,
      label: t('tablesOccupied'),
      color: 'primary',
    },
    {
      icon: Bell,
      value: stats.openRequests,
      label: t('openRequests'),
      meta: stats.openRequests > 0 ? `${stats.openRequests}` : null,
      color: stats.openRequests > 0 ? 'warning' : 'success',
    },
    {
      icon: Clock,
      value: stats.avgResponseMinutes ? `${stats.avgResponseMinutes}m` : '—',
      label: t('avgResponseTime'),
      color: 'info',
    },
    {
      icon: ShoppingBag,
      value: stats.ordersToday,
      label: t('ordersToday'),
      color: 'primary',
    },
    {
      icon: ChefHat,
      value: stats.ordersPreparing,
      label: t('ordersPreparing'),
      color: stats.ordersPreparing > 0 ? 'warning' : 'success',
    },
    {
      icon: Users,
      value: stats.staffCount,
      label: t('staffMembers'),
      color: 'neutral',
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: '1.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{t(greetingKey())}, {displayName}</h2>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>
            {t('heresWhatsHappening')}{currentLocation ? ` ${t('at')} ${currentLocation.name}` : ''}.
          </p>
        </div>
        {isDemoBusiness && (
          <button onClick={() => setShowResetConfirm(true)} style={styles.demoResetBtn}>
            <RotateCcw size={14} /> {t('demoResetButton')}
          </button>
        )}
      </div>

      {isDemoBusiness && (
        <div style={styles.demoBanner}>{t('demoBanner')}</div>
      )}

      <div style={styles.grid}>
        {cards.map((c) => (
          <Card key={c.label} style={styles.statCard}>
            <div style={{ ...styles.iconWrap, background: colorBg(c.color) }}>
              <c.icon size={18} color={colorFg(c.color)} />
            </div>
            <div style={styles.statValue}>{c.value}</div>
            <div style={styles.statLabel}>{c.label}</div>
            {c.meta && <div style={styles.statMeta}>{c.meta}</div>}
          </Card>
        ))}
      </div>

      <div style={styles.panelGrid}>
        <Card>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>{t('requests')}</h3>
            <a href="/staff" style={styles.panelLink}>
              {t('viewAll')} <ArrowRight size={13} />
            </a>
          </div>
          {recentRequests.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="No active requests"
              description="New requests from customers will appear here."
            />
          ) : (
            <div style={styles.reqList}>
              {recentRequests.map((r) => (
                <div key={r.id} style={styles.reqRow}>
                  <div>
                    <div style={styles.reqTable}>{tablesMap[r.table_id]?.name || 'Table'}</div>
                    <div style={styles.reqType}>{localizedLabel(requestTypesMap[r.request_type_id], lang) || 'Request'}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <span style={styles.waitTime}>{minutesAgo(r.created_at)}m</span>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>{t('recentActivity')}</h3>
            <a href="/admin/activity-log" style={styles.panelLink}>
              {t('viewAll')} <ArrowRight size={13} />
            </a>
          </div>
          {recentActivity.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Actions taken across your business will show up here."
            />
          ) : (
            <div style={styles.reqList}>
              {recentActivity.map((a) => {
                const who = profiles[a.user_id]?.full_name || profiles[a.user_id]?.email || 'Someone'
                return (
                  <div key={a.id} style={styles.activityRow}>
                    <span style={styles.activityText}>
                      <strong>{who}</strong> {translateAction(a.action, t)}
                    </span>
                    <span style={styles.waitTime}>{minutesAgo(a.created_at)}m ago</span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {showResetConfirm && (
        <ConfirmationModal
          title={t('demoResetTitle')}
          description={t('demoResetDesc')}
          confirmLabel={resetting ? '...' : t('demoResetButton')}
          onConfirm={handleResetDemo}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  )
}

function colorBg(color) {
  switch (color) {
    case 'primary': return 'var(--color-primary-soft)'
    case 'success': return 'var(--color-success-soft)'
    case 'warning': return 'var(--color-warning-soft)'
    case 'info': return 'var(--color-info-soft)'
    default: return '#f1f2f5'
  }
}

function colorFg(color) {
  switch (color) {
    case 'primary': return 'var(--color-primary)'
    case 'success': return 'var(--color-success)'
    case 'warning': return 'var(--color-warning)'
    case 'info': return 'var(--color-info)'
    default: return 'var(--color-text-muted)'
  }
}

const styles = {
  demoResetBtn: {
    display: 'flex', alignItems: 'center', gap: '0.4rem',
    padding: '0.55rem 1rem', borderRadius: 'var(--radius-sm)',
    border: '1.5px solid var(--color-warning)', background: '#fff',
    color: 'var(--color-warning)', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
  },
  demoBanner: {
    background: 'var(--color-warning-soft)', color: 'var(--color-warning)',
    padding: '0.7rem 1rem', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem',
    marginBottom: '1.5rem', fontWeight: 500,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: '1rem',
  },
  statCard: {
    transition: 'transform 0.12s, box-shadow 0.12s',
  },
  iconWrap: {
    width: '36px',
    height: '36px',
    borderRadius: '9px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '0.75rem',
  },
  statValue: { fontSize: '1.85rem', fontWeight: 800, letterSpacing: '-0.02em' },
  statLabel: { fontSize: '0.83rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', fontWeight: 500 },
  statMeta: { fontSize: '0.75rem', color: 'var(--color-text-faint)', marginTop: '0.35rem' },
  panelGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: '1rem',
    marginTop: '1.5rem',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.9rem',
  },
  panelTitle: { fontSize: '1rem', margin: 0 },
  panelLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.25rem',
    fontSize: '0.8rem',
    color: 'var(--color-primary)',
    textDecoration: 'none',
    fontWeight: 600,
  },
  reqList: { display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  reqRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.6rem 0',
    borderBottom: '1px solid var(--color-border)',
  },
  reqTable: { fontWeight: 600, fontSize: '0.88rem' },
  reqType: { fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' },
  waitTime: { fontSize: '0.78rem', color: 'var(--color-text-faint)' },
  activityRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.5rem 0',
    borderBottom: '1px solid var(--color-border)',
    gap: '1rem',
  },
  activityText: { fontSize: '0.85rem' },
}
