import { useState } from 'react'
import { HelpCircle, Search, ChevronDown, PlayCircle } from 'lucide-react'
import { useAppLanguage } from '../../contexts/AppLanguageContext'
import { useTour } from '../../contexts/TourContext'
import { helpTopics } from '../../lib/helpContent'
import PageHeader from '../../components/ui/PageHeader'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'

export default function AdminHelp() {
  const { t, lang } = useAppLanguage()
  const { startTour } = useTour()
  const [query, setQuery] = useState('')
  const [openItems, setOpenItems] = useState({})

  const sections = helpTopics[lang] || helpTopics.en

  function toggleItem(key) {
    setOpenItems((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const filteredSections = sections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (!query.trim()) return true
        const q = query.toLowerCase()
        return item.title.toLowerCase().includes(q) || item.body.toLowerCase().includes(q)
      }),
    }))
    .filter((section) => section.items.length > 0)

  return (
    <div>
      <PageHeader
        title={t('helpCenterTitle')}
        subtitle={t('helpCenterDesc')}
        actions={<Button icon={PlayCircle} onClick={startTour}>{t('startTour')}</Button>}
      />

      <div style={styles.searchWrap}>
        <Search size={16} color="var(--color-text-faint)" />
        <input
          type="text"
          placeholder={t('helpSearchPlaceholder')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {filteredSections.length === 0 ? (
        <EmptyState icon={HelpCircle} title={t('helpNoResults')} description="" />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {filteredSections.map((section) => (
            <div key={section.section}>
              <h3 style={styles.sectionTitle}>{section.section}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {section.items.map((item) => {
                  const key = `${section.section}-${item.title}`
                  const isOpen = !!openItems[key] || !!query.trim()
                  return (
                    <Card key={key} padding="0">
                      <button onClick={() => toggleItem(key)} style={styles.itemHeader}>
                        <span style={styles.itemTitle}>{item.title}</span>
                        <ChevronDown
                          size={16}
                          color="var(--color-text-faint)"
                          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}
                        />
                      </button>
                      {isOpen && (
                        <div style={styles.itemBody}>{item.body}</div>
                      )}
                    </Card>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.6rem',
    background: 'var(--color-surface)',
    border: '1.5px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    padding: '0.65rem 0.9rem',
    marginBottom: '1.75rem',
    maxWidth: '420px',
  },
  searchInput: {
    border: 'none',
    outline: 'none',
    fontSize: '0.9rem',
    flex: 1,
    background: 'transparent',
  },
  sectionTitle: {
    fontSize: '0.95rem',
    marginBottom: '0.6rem',
    color: 'var(--color-text)',
  },
  itemHeader: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.9rem 1.1rem',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
  },
  itemTitle: { fontWeight: 600, fontSize: '0.9rem' },
  itemBody: {
    padding: '0 1.1rem 1rem',
    fontSize: '0.87rem',
    color: 'var(--color-text-muted)',
    lineHeight: 1.55,
  },
}
