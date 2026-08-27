import { describe, it, expect } from 'vitest'
import { canAccess } from './permissions'

describe('canAccess', () => {
  it('allows owner into every section', () => {
    expect(canAccess('owner', 'staff')).toBe(true)
    expect(canAccess('owner', 'settings')).toBe(true)
    expect(canAccess('owner', 'marginReport')).toBe(true)
  })

  it('blocks server from admin-only sections', () => {
    expect(canAccess('server', 'staff')).toBe(false)
    expect(canAccess('server', 'settings')).toBe(false)
    expect(canAccess('server', 'locations')).toBe(false)
  })

  it('allows server into their expected sections', () => {
    expect(canAccess('server', 'orders')).toBe(true)
    expect(canAccess('server', 'help')).toBe(true)
  })

  it('returns false for an unknown role rather than throwing', () => {
    expect(canAccess('not_a_real_role', 'dashboard')).toBe(false)
  })

  it('returns false for an unknown section rather than throwing', () => {
    expect(canAccess('owner', 'not_a_real_section')).toBe(false)
  })
})
