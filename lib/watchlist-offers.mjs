function price(value) {
  if (value == null || value === '') return null
  const number = Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

export function selectWatchlistOffer(offers, targetValue) {
  const target = price(targetValue)
  const candidates = offers.flatMap(offer => {
    if (String(offer.currency || '').toUpperCase() !== 'EUR') return []
    const explicitTotal = price(offer.total_price)
    const itemPrice = price(offer.price)
    const shipping = price(offer.shipping_price)
    const total = explicitTotal ?? (itemPrice != null && shipping != null ? itemPrice + shipping : null)
    return total == null ? [] : [{ ...offer, comparableTotal: total }]
  }).sort((a, b) => a.comparableTotal - b.comparableTotal)
  const bestOffer = candidates[0] || null
  return {
    bestOffer,
    opportunity: target != null && bestOffer != null && bestOffer.comparableTotal <= target,
  }
}
