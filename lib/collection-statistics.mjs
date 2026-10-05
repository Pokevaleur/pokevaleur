export function hasPurchasePrice(item) {
  return item.purchase_price !== null && item.purchase_price !== undefined && item.purchase_price !== ''
    && Number.isFinite(Number(item.purchase_price))
}

export function calculateCollectionStatistics(items, getValue) {
  let invested = 0, current = 0, difference = 0, itemCount = 0, missingPurchaseCount = 0, pricedRows = 0
  for (const item of items) {
    const quantity = Number(item.quantity) || 1
    const value = Number(getValue(item)) || 0
    itemCount += quantity
    current += value * quantity
    if (hasPurchasePrice(item)) {
      const price = Number(item.purchase_price)
      invested += price * quantity
      difference += (value - price) * quantity
      pricedRows++
    } else missingPurchaseCount += quantity
  }
  if (items.length && !pricedRows) difference = null
  return { invested, current, difference, itemCount, missingPurchaseCount,
    evolution: invested > 0 ? difference / invested * 100 : null }
}

export function collectionItemKind(item, productById) {
  const product = item.product_id ? productById.get(item.product_id) : null
  return product?.category?.trim().toLocaleLowerCase('fr') === 'sealed' ? 'sealed' : 'other'
}

export function calculateCollectionItemCounts(items, products) {
  const productById = new Map(products.map(product => [product.id, product]))
  return items.reduce((counts, item) => {
    const quantity = Number(item.quantity) || 1
    counts[collectionItemKind(item, productById)] += quantity
    counts.total += quantity
    return counts
  }, { sealed: 0, other: 0, total: 0 })
}
