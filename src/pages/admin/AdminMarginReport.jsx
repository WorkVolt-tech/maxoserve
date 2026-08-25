import { useEffect, useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import { useCurrentBusiness } from '../../contexts/BusinessContext'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'

export default function AdminMarginReport() {
  const { user } = useAuth()
  const { t } = useAppLanguage()
  const { currentBusinessId } = useCurrentBusiness()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { if (currentBusinessId) loadData() }, [currentBusinessId])

  async function loadData() {
    setLoading(true)

    const { data } = await supabase
      .from('menu_items')
      .select('*')
      .eq('business_id', currentBusinessId)
      .not('cost', 'is', null)
      .order('name', { ascending: true })

    setItems(data || [])
    setLoading(false)
  }

  if (loading) return <LoadingState label={t('loading')} />

  if (items.length === 0) {
    return (
      <div>
        <PageHeader title={t('marginReport')} subtitle={t('marginReportDesc')} />
        <EmptyState icon={TrendingUp} title={t('noCostData')} description={t('noCostDataDesc')} />
      </div>
    )
  }

  const withMargin = items.map((item) => {
    const profit = Number(item.price) - Number(item.cost)
    const marginPct = Number(item.price) > 0 ? (profit / Number(item.price)) * 100 : 0
    return { ...item, profit, marginPct }
  })

  const avgMargin = withMargin.reduce((sum, i) => sum + i.marginPct, 0) / withMargin.length

  return (
    <div>
      <PageHeader title={t('marginReport')} subtitle={t('marginReportDesc')} />

      <div style={styles.summaryRow}>
        <Card style={styles.summaryCard}>
          <div style={styles.summaryValue}>{avgMargin.toFixed(1)}%</div>
          <div style={styles.summaryLabel}>{t('avgMargin')}</div>
        </Card>
        <Card style={styles.summaryCard}>
          <div style={styles.summaryValue}>{items.length}</div>
          <div style={styles.summaryLabel}>{t('totalItemsCosted')}</div>
        </Card>
      </div>

      <Card padding="0">
        <div style={styles.tableHeader}>
          <span style={{ flex: 2 }}>{t('itemColumn')}</span>
          <span style={{ flex: 1, textAlign: 'right' }}>{t('priceColumn')}</span>
          <span style={{ flex: 1, textAlign: 'right' }}>{t('costColumn')}</span>
          <span style={{ flex: 1, textAlign: 'right' }}>{t('profitColumn')}</span>
          <span style={{ flex: 1, textAlign: 'right' }}>{t('marginColumn')}</span>
        </div>
        {withMargin.map((item) => (
          <div key={item.id} style={styles.tableRow}>
            <span style={{ flex: 2, fontWeight: 600 }}>{item.name}</span>
            <span style={{ flex: 1, textAlign: 'right' }}>${Number(item.price).toFixed(2)}</span>
            <span style={{ flex: 1, textAlign: 'right', color: 'var(--color-text-muted)' }}>${Number(item.cost).toFixed(2)}</span>
            <span style={{ flex: 1, textAlign: 'right', color: 'var(--color-success)' }}>${item.profit.toFixed(2)}</span>
            <span style={{
              flex: 1, textAlign: 'right', fontWeight: 700,
              color: item.marginPct >= 50 ? 'var(--color-success)' : item.marginPct >= 25 ? 'var(--color-warning)' : 'var(--color-danger)',
            }}>
              {item.marginPct.toFixed(0)}%
            </span>
          </div>
        ))}
      </Card>
    </div>
  )
}

const styles = {
  summaryRow: { display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' },
  summaryCard: { flex: '1 1 180px' },
  summaryValue: { fontSize: '1.85rem', fontWeight: 800 },
  summaryLabel: { fontSize: '0.83rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' },
  tableHeader: {
    display: 'flex', padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--color-border)',
    fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em',
  },
  tableRow: {
    display: 'flex', padding: '0.85rem 1.1rem', borderBottom: '1px solid var(--color-border)', fontSize: '0.9rem', alignItems: 'center',
  },
}
