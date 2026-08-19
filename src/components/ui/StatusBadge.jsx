import Badge from './Badge'

const STATUS_CONFIG = {
  // service requests
  pending: { label: 'Pending', color: 'warning' },
  accepted: { label: 'Accepted', color: 'info' },
  on_the_way: { label: 'On the Way', color: 'info' },
  completed: { label: 'Completed', color: 'success' },
  rejected: { label: 'Rejected', color: 'neutral' },
  cancelled: { label: 'Cancelled', color: 'neutral' },

  // orders
  draft: { label: 'Draft', color: 'neutral' },
  submitted: { label: 'Submitted', color: 'warning' },
  preparing: { label: 'Preparing', color: 'info' },
  ready: { label: 'Ready', color: 'primary' },
  out_for_delivery: { label: 'On the Way', color: 'info' },
  delivered: { label: 'Delivered', color: 'success' },

  // reservations
  confirmed: { label: 'Confirmed', color: 'info' },
  seated: { label: 'Seated', color: 'success' },
  no_show: { label: 'No Show', color: 'danger' },

  // tables
  available: { label: 'Available', color: 'success' },
  occupied: { label: 'Occupied', color: 'danger' },
  reserved: { label: 'Reserved', color: 'warning' },
  needs_service: { label: 'Needs Service', color: 'danger' },
  order_pending: { label: 'Order Pending', color: 'primary' },
  disabled: { label: 'Disabled', color: 'neutral' },
}

export default function StatusBadge({ status, style }) {
  const config = STATUS_CONFIG[status] || { label: status?.replace(/_/g, ' ') || 'Unknown', color: 'neutral' }
  return <Badge color={config.color} style={style}>{config.label}</Badge>
}
