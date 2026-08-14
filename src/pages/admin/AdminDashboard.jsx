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

  if (loading) return <div><h2>Dashboard</h2><p>Loading...</p></div>

  if (!stats) return <div><h2>Dashboard</h2><p>No data available.</p></div>

  const cards = [
    { label: 'Tables Occupied', value: `${stats.tablesOccupied} / ${stats.tablesTotal}` },
    { label: 'Open Requests', value: stats.openRequests },
    { label: 'Completed Requests Today', value: stats.completedRequestsToday },
    { label: 'Avg. Response Time', value: stats.avgResponseMinutes ? `${stats.avgResponseMinutes} min` : '—' },
    { label: 'Orders Today', value: stats.ordersToday },
    { label: 'Orders Preparing', value: stats.ordersPreparing },
    { label: 'Staff Members', value: stats.staffCount },
  ]

  return (
    <div>
      <h2>Dashboard</h2>
      <p style={{ color: '#666' }}>An overview of what's happening right now.</p>

      <div style={styles.grid}>
        {cards.map((c) => (
          <div key={c.label} style={styles.card}>
            <div style={styles.cardValue}>{c.value}</div>
            <div style={styles.cardLabel}>{c.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '1rem',
  },
  card: {
    background: '#fff',
    borderRadius: '10px',
    border: '1px solid #e2e4e9',
    padding: '1.25rem',
  },
  cardValue: { fontSize: '1.8rem', fontWeight: 700, color: '#1a1d23' },
  cardLabel: { fontSize: '0.85rem', color: '#888', marginTop: '0.3rem' },
}
