export function summarizeWatchlistHistory(sales, now = Date.now()) {
  const prices90 = [], prices30 = []
  for (const sale of sales) {
    if (!sale.observed_at || sale.price == null || sale.price === '') continue
    const age = now - new Date(sale.observed_at).getTime()
    const price = Number(sale.price)
    if (!Number.isFinite(age) || age < 0 || age > 90 * 86400000 || !Number.isFinite(price) || price < 0) continue
    prices90.push(price)
    if (age <= 30 * 86400000) prices30.push(price)
  }
  prices90.sort((a, b) => a - b)
  const middle = Math.floor(prices90.length / 2)
  return {
    median90: !prices90.length ? null : prices90.length % 2
      ? prices90[middle] : (prices90[middle - 1] + prices90[middle]) / 2,
    low30: prices30.length ? Math.min(...prices30) : null,
    sales90: prices90.length,
  }
}
