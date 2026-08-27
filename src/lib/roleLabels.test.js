import { describe, it, expect } from 'vitest'
import { roleLabel, shapeLabel } from './roleLabels'

const fakeT = (key) => `TRANSLATED:${key}`

describe('roleLabel', () => {
  it('translates a known role', () => {
    expect(roleLabel('owner', fakeT)).toBe('TRANSLATED:roleOwner')
    expect(roleLabel('bartender', fakeT)).toBe('TRANSLATED:roleBartender')
  })

  it('falls back to the raw role string for an unknown role', () => {
    expect(roleLabel('made_up_role', fakeT)).toBe('made_up_role')
  })

  it('returns an empty string for a missing role', () => {
    expect(roleLabel(null, fakeT)).toBe('')
    expect(roleLabel(undefined, fakeT)).toBe('')
  })
})

describe('shapeLabel', () => {
  it('translates a known shape', () => {
    expect(shapeLabel('round', fakeT)).toBe('TRANSLATED:shapeRound')
    expect(shapeLabel('bar_seat', fakeT)).toBe('TRANSLATED:shapeBarSeat')
  })

  it('falls back to the raw shape string for an unknown shape', () => {
    expect(shapeLabel('hexagon', fakeT)).toBe('hexagon')
  })
})
