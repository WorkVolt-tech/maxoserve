import { useEffect, useState } from 'react'
import {
  LayoutGrid, Bell, ShoppingBag, Clock, ChefHat, Users,
} from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useCurrentLocation } from '../../contexts/LocationContext'
import Card from '../../components/ui/Card'
import LoadingState from '../../components/ui/LoadingState'

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function AdminDashboard() {
  const { user } = useAuth()
  const { locations, currentLocationId } = useCurrentLocation()
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadStats()
  }, [])

  async function loadStats() {
    setLoading(true)

    const { data: membership } = await supabase
      .from('business_members')
      .select('business_id')
      .eq('user_id', user.id)
      .limit(1)
      .single()

    if (!membership) {
      setLoading(false)
      return
    }

    const businessId = membership.business_id
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

  const displayName = user?.user_metadata?.full_name?.split(' ')[0] || 'there'
  const currentLocation = locations.find((l) => l.id === currentLocationId)

  if (loading) return <LoadingState label="Loading dashboard…" />

  if (!stats) return <p style={{ color: 'var(--color-text-muted)' }}>No data available.</p>

  const cards = [
    {
      icon: LayoutGrid,
      value: `${stats.tablesOccupied} / ${stats.tablesTotal}`,
      label: 'Tables Occupied',
      color: 'primary',
    },
    {
      icon: Bell,
      value: stats.openRequests,
      label: 'Open Requests',
      meta: stats.openRequests > 0 ? `${stats.openRequests} need attention` : 'All caught up',
      color: stats.openRequests > 0 ? 'warning' : 'success',
    },
    {
      icon: Clock,
      value: stats.avgResponseMinutes ? `${stats.avgResponseMinutes}m` : '—',
      label: 'Avg. Response Time',
      color: 'info',
    },
    {
      icon: ShoppingBag,
      value: stats.ordersToday,
      label: 'Orders Today',
      color: 'primary',
    },
    {
      icon: ChefHat,
      value: stats.ordersPreparing,
      label: 'Orders Preparing',
      meta: stats.ordersPreparing > 0 ? 'In the kitchen now' : null,
      color: stats.ordersPreparing > 0 ? 'warning' : 'success',
    },
    {
      icon: Users,
      value: stats.staffCount,
      label: 'Staff Members',
      color: 'neutral',
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: '1.75rem' }}>
        <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{greeting()}, {displayName}</h2>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.3rem' }}>
          Here's what's happening{currentLocation ? ` at ${currentLocation.name}` : ''}.
        </p>
      </div>

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
}
