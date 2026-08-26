import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useCurrentBusiness } from '../../contexts/BusinessContext'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'

export default function AdminSalesReport() {
  const { currentBusinessId } = useCurrentBusiness()
  const { t } = useAppLanguage()
  const [rangeDays, setRangeDays] = useState(7)
  const [orders, setOrders] = useState([])
  const [itemSales, setItemSales] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentBusinessId) loadData()
  }, [currentBusinessId, rangeDays])

  async function loadData() {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - rangeDays)

    const { data: ordersData } = await supabase
      .from('orders')
      .select('*')
      .eq('business_id', currentBusinessId)
      .not('status', 'in', '(draft,cancelled,rejected)')
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true })

    setOrders(ordersData || [])

    if (ordersData && ordersData.length > 0) {
      const orderIds = ordersData.map((o) => o.id)
      const { data: itemsData } = await supabase
        .from('order_items')
        .select('menu_item_id, quantity, unit_price, menu_items(name)')
        .in('order_id', orderIds)

      const salesMap = {}
      for (const item of itemsData || []) {
        const key = item.menu_item_id
        if (!salesMap[key]) salesMap[key] = { name: item.menu_items?.name || 'Unknown', units: 0, revenue: 0 }
        salesMap[key].units += item.quantity
        salesMap[key].revenue += item.quantity * Number(item.unit_price)
      }
      setItemSales(Object.values(salesMap).sort((a, b) => b.units - a.units).slice(0, 10))
    } else {
      setItemSales([])
    }

    setLoading(false)
  }

  if (loading) return <LoadingState label={t('loading')} />

  if (orders.length === 0) {
    return (
      <div>
        <PageHeader title={t('salesReport')} subtitle={t('salesReportDesc')} />
        <RangeToggle rangeDays={rangeDays} setRangeDays={setRangeDays} t={t} />
        <EmptyState icon={TrendingUp} title={t('noSalesData')} description={t('noSalesDataDesc')} />
      </div>
    )
  }

  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total), 0)
  const totalOrders = orders.length
  const avgOrderValue = totalRevenue / totalOrders

  // Revenue grouped by calendar day
  const revenueByDay = {}
  for (const o of orders) {
    const day = new Date(o.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    revenueByDay[day] = (revenueByDay[day] || 0) + Number(o.total)
  }
  const dayEntries = Object.entries(revenueByDay)
  const maxDayRevenue = Math.max(...dayEntries.map(([, v]) => v), 1)

  // Orders grouped by hour of day (0-23), summed across the whole range
  const ordersByHour = Array(24).fill(0)
  for (const o of orders) {
    const hour = new Date(o.created_at).getHours()
    ordersByHour[hour] += 1
  }
  const maxHourCount = Math.max(...ordersByHour, 1)
  const peakHours = ordersByHour
    .map((count, hour) => ({ hour, count }))
    .filter((h) => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  function formatHour(h) {
    const period = h >= 12 ? 'PM' : 'AM'
    const displayHour = h % 12 === 0 ? 12 : h % 12
    return `${displayHour}${period}`
  }

  return (
    <div>
      <PageHeader title={t('salesReport')} subtitle={t('salesReportDesc')} />
      <RangeToggle rangeDays={rangeDays} setRangeDays={setRangeDays} t={t} />

      <div style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <div style={styles.summaryValue}>${totalRevenue.toFixed(2)}</div>
          <div style={styles.summaryLabel}>{t('totalRevenue')}</div>
        </Card>
        <Card style={styles.summaryCard}>
          <div style={styles.summaryValue}>{totalOrders}</div>
          <div style={styles.summaryLabel}>{t('totalOrders')}</div>
        </Card>
        <Card style={styles.summaryCard}>
          <div style={styles.summaryValue}>${avgOrderValue.toFixed(2)}</div>
          <div style={styles.summaryLabel}>{t('avgOrderValue')}</div>
        </Card>
      </div>

      <div style={styles.panelGrid}>
        <Card>
          <h3 style={styles.panelTitle}>{t('topSellingItems')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {itemSales.map((item, i) => (
              <div key={item.name} style={styles.itemRow}>
                <span style={styles.itemRank}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{item.name}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{item.units} {t('unitsSold')}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--color-primary)' }}>${item.revenue.toFixed(2)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 style={styles.panelTitle}>{t('busiestHours')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {peakHours.map((h) => (
              <div key={h.hour} style={styles.hourRow}>
                <span style={{ fontSize: '0.85rem', width: '48px', fontWeight: 600 }}>{formatHour(h.hour)}</span>
                <div style={styles.hourBarTrack}>
                  <div style={{ ...styles.hourBarFill, width: `${(h.count / maxHourCount) * 100}%` }} />
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', width: '30px', textAlign: 'right' }}>{h.count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card style={{ marginTop: '1rem' }}>
        <h3 style={styles.panelTitle}>{t('revenueByDay')}</h3>
        <div style={styles.dayChartRow}>
          {dayEntries.map(([day, revenue]) => (
            <div key={day} style={styles.dayBarWrap}>
              <div style={styles.dayBarTrack}>
                <div style={{ ...styles.dayBarFill, height: `${(revenue / maxDayRevenue) * 100}%` }} />
              </div>
              <div style={styles.dayLabel}>{day}</div>
              <div style={styles.dayValue}>${revenue.toFixed(0)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

function RangeToggle({ rangeDays, setRangeDays, t }) {
  return (
    <div style={styles.rangeToggle}>
      <button
        onClick={() => setRangeDays(7)}
        style={{ ...styles.rangeBtn, ...(rangeDays === 7 ? styles.rangeBtnActive : {}) }}
      >
        {t('last7Days')}
      </button>
      <button
        onClick={() => setRangeDays(30)}
        style={{ ...styles.rangeBtn, ...(rangeDays === 30 ? styles.rangeBtnActive : {}) }}
      >
        {t('last30Days')}
      </button>
    </div>
  )
}

const styles = {
  rangeToggle: { display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' },
  rangeBtn: {
    padding: '0.5rem 1rem', borderRadius: '999px', border: '1px solid var(--color-border)',
    background: 'var(--color-surface)', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
  },
  rangeBtnActive: { background: 'var(--color-primary)', borderColor: 'var(--color-primary)', color: '#fff' },
  summaryRow: { display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  summaryCard: { flex: '1 1 180px' },
  summaryValue: { fontSize: '1.85rem', fontWeight: 800 },
  summaryLabel: { fontSize: '0.83rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' },
  panelGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' },
  panelTitle: { fontSize: '1rem', margin: '0 0 1rem' },
  itemRow: { display: 'flex', alignItems: 'center', gap: '0.75rem' },
  itemRank: {
    width: '22px', height: '22px', borderRadius: '50%', background: 'var(--color-bg)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--color-text-muted)', flexShrink: 0,
  },
  hourRow: { display: 'flex', alignItems: 'center', gap: '0.6rem' },
  hourBarTrack: { flex: 1, height: '8px', background: 'var(--color-bg)', borderRadius: '999px', overflow: 'hidden' },
  hourBarFill: { height: '100%', background: 'var(--color-primary)', borderRadius: '999px' },
  dayChartRow: { display: 'flex', alignItems: 'flex-end', gap: '0.75rem', height: '160px', overflowX: 'auto', paddingTop: '0.5rem' },
  dayBarWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '48px' },
  dayBarTrack: { width: '24px', height: '110px', display: 'flex', alignItems: 'flex-end', background: 'var(--color-bg)', borderRadius: '4px', overflow: 'hidden' },
  dayBarFill: { width: '100%', background: 'var(--color-primary)', borderRadius: '4px 4px 0 0', minHeight: '2px' },
  dayLabel: { fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.4rem', whiteSpace: 'nowrap' },
  dayValue: { fontSize: '0.7rem', fontWeight: 700, marginTop: '0.1rem' },
}
