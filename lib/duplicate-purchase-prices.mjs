import { hasPurchasePrice } from './collection-statistics.mjs'

export function summarizeDuplicatePurchasePrices(rows, unitValue) {
  let invested = 0, pricedQuantity = 0, missingPurchaseCount = 0
  for (const item of rows) {
    const quantity = Number(item.quantity) || 1
    if (hasPurchasePrice(item)) {
      invested += Number(item.purchase_price) * quantity
      pricedQuantity += quantity
    } else missingPurchaseCount += quantity
  }
  const avgBuy = pricedQuantity ? invested / pricedQuantity : null
  const unitGain = avgBuy !== null && missingPurchaseCount === 0 && unitValue != null
    ? Number(unitValue) - avgBuy : null
  return { avgBuy, unitGain, missingPurchaseCount, pricedQuantity }
}

export function summarizeDuplicateValues(rows) {
  let totalValue = 0, quantity = 0, highestValue = 0, missingValueCount = 0
  for (const row of rows) {
    const count = Number(row.quantity) || 1
    const rawValue = row.estimatedUnitValue
    if (rawValue == null || rawValue === '' || !Number.isFinite(Number(rawValue))) {
      missingValueCount += count
      continue
    }
    const value = Number(rawValue)
    quantity += count
    totalValue += value * count
    highestValue = Math.max(highestValue, value)
  }
  return {
    currentValue: missingValueCount ? null : quantity ? totalValue / quantity : null,
    estimatedSaleValue: missingValueCount ? null : Math.max(0, totalValue - highestValue),
    missingValueCount,
  }
}

export function summarizeDuplicateGroups(groups) {
  const confirmed = groups.filter(group => group.productId)
  return {
    totalDuplicates: confirmed.reduce((sum, group) => sum + group.sellable, 0),
    possibleDuplicates: groups.filter(group => !group.productId).reduce((sum, group) => sum + group.sellable, 0),
    incompleteValuation: confirmed.some(group => group.estimatedSaleValue == null),
    salePotential: confirmed.length > 0 && confirmed.every(group => group.estimatedSaleValue == null)
      ? null : confirmed.reduce((sum, group) => sum + (group.estimatedSaleValue ?? 0), 0),
  }
}
