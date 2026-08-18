// Role hierarchy (higher roles inherit access implicitly via explicit checks below)
// owner > admin > manager > hostess/server/bartender/kitchen > staff

export const ROLE_HIERARCHY = {
  owner: 100,
  admin: 90,
  manager: 70,
  hostess: 40,
  server: 40,
  bartender: 40,
  kitchen: 40,
  staff: 10,
}

// Which admin sections each role is allowed to see/use.
// Owner and admin get everything automatically (handled in code, not listed per-page).
const SECTION_ACCESS = {
  dashboard: ['owner', 'admin', 'manager', 'hostess', 'server', 'bartender', 'kitchen', 'staff'],
  locations: ['owner', 'admin'],
  areas: ['owner', 'admin'],
  tables: ['owner', 'admin'],
  floorPlan: ['owner', 'admin', 'manager', 'hostess', 'server'],
  menu: ['owner', 'admin'],
  modifiers: ['owner', 'admin'],
  staff: ['owner', 'admin'],
  assignments: ['owner', 'admin', 'manager'],
  reservations: ['owner', 'admin', 'manager', 'hostess'],
  events: ['owner', 'admin', 'manager'],
  activityLogs: ['owner', 'admin'],
  orders: ['owner', 'admin', 'manager', 'bartender', 'kitchen', 'server'],
  requestTypes: ['owner', 'admin'],
}

export function canAccess(role, section) {
  if (!role) return false
  if (role === 'owner' || role === 'admin') return true
  return SECTION_ACCESS[section]?.includes(role) ?? false
}

export function isOwnerOrAdmin(role) {
  return role === 'owner' || role === 'admin'
}

export function outranks(roleA, roleB) {
  return (ROLE_HIERARCHY[roleA] || 0) > (ROLE_HIERARCHY[roleB] || 0)
}
