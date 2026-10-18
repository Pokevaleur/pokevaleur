import { normalizeSearch } from './product-search.mjs'
import { getSealedFormat, getSealedSubtype } from './sealed-collection-counts.mjs'

export function buildSealedProductDetails(items, products, selectedFormat) {
  if (!selectedFormat) return []

  const productById = new Map((products || []).map(product => [product.id, product]))
  const details = []

  for (const [index, item] of (items || []).entries()) {
    const product = item.product_id ? productById.get(item.product_id) : null
    if (normalizeSearch(product?.category) !== 'sealed') continue

    const format = getSealedFormat(item, product)
    if (selectedFormat !== 'all' && format !== selectedFormat) continue

    // Keep each collection record separate so its link opens its own fiche.
    details.push({
      key: item.id || `collection-item:${index}`,
      collectionItemId: item.id,
      name: product?.name || item.custom_name || 'Produit sans nom',
      productName: '',
      type: item.product_type_override?.trim() || product?.product_type || '',
      subtype: getSealedSubtype(item, product),
      sealedCondition: item.sealed_condition || '',
      quantity: Math.max(0, Number(item.quantity) || 1)
    })
  }

  return details.sort((a, b) => a.name.localeCompare(b.name, 'fr'))
}
