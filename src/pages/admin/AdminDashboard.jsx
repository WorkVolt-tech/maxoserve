import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'

export default function AdminDashboard() {
  const { user } = useAuth()
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
    const occupied = tables.filter((t) => t.status === 'occupied' || t.status === 'needs_service' || t.status === 'order_pending').length

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

  if (loading) return <div><h2>Dashboard</h2><p style={{ color: 'var(--color-text-muted)' }}>Loading…</p></div>
  if (!stats) return <div><h2>Dashboard</h2><p style={{ color: 'var(--color-text-muted)' }}>No data available.</p></div>

  const cards = [
    { label: 'Tables Occupied', value: `${stats.tablesOccupied} / ${stats.tablesTotal}`, accent: 'primary' },
    { label: 'Open Requests', value: stats.openRequests, accent: stats.openRequests > 0 ? 'warning' : 'default' },
    { label: 'Completed Today', value: stats.completedRequestsToday, accent: 'success' },
    { label: 'Avg. Response Time', value: stats.avgResponseMinutes ? `${stats.avgResponseMinutes}m` : '—', accent: 'default' },
    { label: 'Orders Today', value: stats.ordersToday, accent: 'primary' },
    { label: 'Orders Preparing', value: stats.ordersPreparing, accent: stats.ordersPreparing > 0 ? 'warning' : 'default' },
    { label: 'Staff Members', value: stats.staffCount, accent: 'default' },
  ]

  return (
    <div>
      <h2 style={styles.title}>Dashboard</h2>
      <p style={styles.subtitle}>An overview of what's happening right now.</p>

      <div style={styles.grid}>
        {cards.map((c) => (
          <div key={c.label} style={styles.card}>
            <div style={{ ...styles.cardValue, color: accentColor(c.accent) }}>{c.value}</div>
            <div style={styles.cardLabel}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function accentColor(accent) {
  switch (accent) {
    case 'primary': return 'var(--color-primary)'
    case 'success': return 'var(--color-success)'
    case 'warning': return 'var(--color-warning)'
    default: return 'var(--color-text)'
  }
}

const styles = {
  title: { fontSize: '1.5rem' },
  subtitle: { color: 'var(--color-text-muted)', marginTop: '-0.5rem', marginBottom: '1.75rem' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
    gap: '1rem',
  },
  card: {
    background: 'var(--color-surface)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border)',
    padding: '1.4rem',
    boxShadow: 'var(--shadow-sm)',
  },
  cardValue: { fontSize: '1.9rem', fontWeight: 800, letterSpacing: '-0.02em' },
  cardLabel: { fontSize: '0.83rem', color: 'var(--color-text-muted)', marginTop: '0.35rem', fontWeight: 500 },
}
