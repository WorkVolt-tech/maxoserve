import { useEffect, useState } from 'react'
import { ScrollText } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../contexts/AuthContext'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import EmptyState from '../../components/ui/EmptyState'
import LoadingState from '../../components/ui/LoadingState'
import { useAppLanguage } from '../../contexts/AppLanguageContext'

export default function AdminActivityLog() {
  const { user } = useAuth()
  const { t } = useAppLanguage()
  const [logs, setLogs] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadInitial() }, [])

  async function loadInitial() {
    setLoading(true)
    const { data: membership } = await supabase
      .from('business_members').select('business_id').eq('user_id', user.id).limit(1).single()
    if (!membership) { setLoading(false); return }

    const { data: logsData } = await supabase
      .from('activity_logs').select('*').eq('business_id', membership.business_id).order('created_at', { ascending: false }).limit(100)
    setLogs(logsData || [])

    if (logsData && logsData.length > 0) {
      const userIds = [...new Set(logsData.map((l) => l.user_id).filter(Boolean))]
      const { data: profilesData } = await supabase.from('profiles').select('*').in('id', userIds)
      const map = {}
      for (const p of profilesData || []) map[p.id] = p
      setProfiles(map)
    }
    setLoading(false)
  }

  if (loading) return <LoadingState label={t('loading')} />

  return (
    <div>
      <PageHeader title={t('activityLog')} subtitle="The last 100 actions taken across your business." />

      {logs.length === 0 ? (
        <EmptyState icon={ScrollText} title="No activity yet" description="Actions taken across your business will show up here." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {logs.map((log) => {
            const who = profiles[log.user_id]?.full_name || profiles[log.user_id]?.email || 'Someone'
            return (
              <Card key={log.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }} padding="0.85rem 1.1rem">
                <div>
                  <span style={{ fontSize: '0.9rem' }}><strong>{who}</strong> — {log.action}</span>
                  {log.details && <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>{JSON.stringify(log.details)}</div>}
                </div>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-text-faint)', whiteSpace: 'nowrap' }}>
                  {new Date(log.created_at).toLocaleString()}
                </span>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
