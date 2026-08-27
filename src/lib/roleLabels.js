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
  const key = ROLE_KEY_MAP[role]
  if (!key) return role
  return t(key) || role
}

const SHAPE_KEY_MAP = {
  round: 'shapeRound',
  square: 'shapeSquare',
  rectangle: 'shapeRectangle',
  oval: 'shapeOval',
  booth: 'shapeBooth',
  bar_seat: 'shapeBarSeat',
  vip_section: 'shapeVipSection',
  custom: 'shapeCustom',
}

export function shapeLabel(shape, t) {
  if (!shape) return ''
  const key = SHAPE_KEY_MAP[shape]
  if (!key) return shape
  return t(key) || shape
}
