const ROLE_KEY_MAP = {
  owner: 'roleOwner',
  admin: 'roleAdmin',
  manager: 'roleManager',
  hostess: 'roleHostess',
  server: 'roleServer',
  bartender: 'roleBartender',
  kitchen: 'roleKitchen',
  staff: 'roleStaff',
}

export function roleLabel(role, t) {
  if (!role) return ''
  return t(ROLE_KEY_MAP[role]) || role
}
