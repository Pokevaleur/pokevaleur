import { normalizeSearch } from './product-search.mjs'
import { getSealedFormat } from './sealed-collection-counts.mjs'

export function buildSealedProductDetails(items, products, selectedFormat) {
  if (!selectedFormat) return []

  const productById = new Map((products || []).map(product => [product.id, product]))
  const grouped = new Map()

  for (const item of items || []) {
    const product = item.product_id ? productById.get(item.product_id) : null
    if (normalizeSearch(product?.category) !== 'sealed') continue

    const format = getSealedFormat(item, product)
    if (selectedFormat !== 'all' && format !== selectedFormat) continue

    // Catalog-linked copies share one summary row, even when their recorded
    // names, condition, booster contents, or variant notes differ.
    const key = product?.id
      ? `product:${product.id}`
      : [item.custom_name || '', item.sealed_condition || '', item.booster_configuration || '', item.variant_note || ''].join('|')
    const condition = item.sealed_condition || ''
    const entry = grouped.get(key) || {
      key,
      name: product?.name || item.custom_name || 'Produit sans nom',
      productName: '',
      type: product?.product_type || '',
      sealedCondition: condition,
      quantity: 0
    }

    if (entry.sealedCondition !== condition) entry.sealedCondition = ''
    entry.quantity += Math.max(0, Number(item.quantity) || 1)
    grouped.set(key, entry)
  }

  return [...grouped.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}
