import { describe, it, expect } from 'vitest'
import { cartLineTotal, cartSubtotal, cartTotals } from './cartMath'

describe('cartLineTotal', () => {
  it('calculates a simple line with no modifiers', () => {
    const line = { item: { price: 10 }, quantity: 2, options: [] }
    expect(cartLineTotal(line)).toBe(20)
  })

  it('adds modifier price deltas before multiplying by quantity', () => {
    const line = {
      item: { price: 10 },
      quantity: 3,
      options: [{ price_delta: 2 }, { price_delta: 1.5 }],
    }
    // (10 + 2 + 1.5) * 3 = 40.5
    expect(cartLineTotal(line)).toBe(40.5)
  })

  it('handles a missing options array without crashing', () => {
    const line = { item: { price: 5 }, quantity: 1 }
    expect(cartLineTotal(line)).toBe(5)
  })
})

describe('cartSubtotal', () => {
  it('sums multiple cart lines', () => {
    const cart = [
      { item: { price: 10 }, quantity: 1, options: [] },
      { item: { price: 5 }, quantity: 2, options: [] },
    ]
    expect(cartSubtotal(cart)).toBe(20)
  })

  it('returns 0 for an empty cart', () => {
    expect(cartSubtotal([])).toBe(0)
  })
})

describe('cartTotals', () => {
  it('applies a tax rate correctly', () => {
    const cart = [{ item: { price: 100 }, quantity: 1, options: [] }]
    const result = cartTotals(cart, 0.15)
    expect(result.subtotal).toBe(100)
    expect(result.tax).toBeCloseTo(15)
    expect(result.total).toBeCloseTo(115)
  })

  it('treats a missing tax rate as zero', () => {
    const cart = [{ item: { price: 50 }, quantity: 1, options: [] }]
    const result = cartTotals(cart, null)
    expect(result.tax).toBe(0)
    expect(result.total).toBe(50)
  })
})
