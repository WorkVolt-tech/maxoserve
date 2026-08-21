import Badge from './Badge'
import { useAppLanguage } from '../../contexts/AppLanguageContext'

const STATUS_CONFIG = {
  // service requests
  pending: { key: 'statusPending', color: 'warning' },
  accepted: { key: 'statusAccepted', color: 'info' },
  on_the_way: { key: 'statusOnTheWay', color: 'info' },
  completed: { key: 'statusCompleted', color: 'success' },
  rejected: { key: 'statusRejected', color: 'neutral' },
  cancelled: { key: 'statusCancelled', color: 'neutral' },

  // orders
  draft: { key: 'statusDraft', color: 'neutral' },
  submitted: { key: 'statusSubmitted', color: 'warning' },
  preparing: { key: 'statusPreparing', color: 'info' },
  ready: { key: 'statusReady', color: 'primary' },
  out_for_delivery: { key: 'statusOnTheWay', color: 'info' },
  delivered: { key: 'statusDelivered', color: 'success' },

  // reservations
  confirmed: { key: 'statusConfirmed', color: 'info' },
  seated: { key: 'statusSeated', color: 'success' },
  no_show: { key: 'statusNoShow', color: 'danger' },

  // tables
  available: { key: 'statusAvailable', color: 'success' },
  occupied: { key: 'statusOccupied', color: 'danger' },
  reserved: { key: 'statusReserved', color: 'warning' },
  needs_service: { key: 'statusNeedsService', color: 'danger' },
  order_pending: { key: 'statusOrderPending', color: 'primary' },
  disabled: { key: 'statusDisabled', color: 'neutral' },
}

export default function StatusBadge({ status, style }) {
  const { t } = useAppLanguage()
  const config = STATUS_CONFIG[status]
  const label = config ? t(config.key) : (status?.replace(/_/g, ' ') || 'Unknown')
  const color = config?.color || 'neutral'
  return <Badge color={color} style={style}>{label}</Badge>
}
