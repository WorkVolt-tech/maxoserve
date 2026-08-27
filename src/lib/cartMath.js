export function cartLineTotal(line) {
  const optionsTotal = (line.options || []).reduce((sum, o) => sum + Number(o.price_delta), 0)
  return (Number(line.item.price) + optionsTotal) * line.quantity
}

export function cartSubtotal(cart) {
  return cart.reduce((sum, line) => sum + cartLineTotal(line), 0)
}

export function cartTotals(cart, taxRate) {
  const subtotal = cartSubtotal(cart)
  const tax = subtotal * (taxRate || 0)
  const total = subtotal + tax
  return { subtotal, tax, total }
}
