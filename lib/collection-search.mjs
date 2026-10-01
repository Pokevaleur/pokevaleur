import { createProductMatcher, normalizeSearch } from './product-search.mjs'

export function filterCollectionItems(items, catalog, query, condition = 'all') {
  const hasQuery = Boolean(normalizeSearch(query))
  if (!hasQuery && condition === 'all') return []
  const matches = createProductMatcher(query)
  const products = new Map(catalog.map(product => [product.id, product]))
  return items.filter(item => {
    const state = item.sealed_condition === 'zero_defect' ? 'zero_defect' : 'standard'
    if (condition !== 'all' && state !== condition) return false
    if (!hasQuery) return true
    const product = products.get(item.product_id) || {}
    return matches({
      ...product,
      name: [product.name, item.custom_name, item.purchase_place, item.seller_name,
        item.booster_configuration, item.variant_note, item.notes, item.purchase_date,
        state === 'zero_defect' ? 'zero defaut parfait' : 'standard'].filter(Boolean).join(' '),
    })
  })
}
