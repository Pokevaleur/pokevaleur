import { normalizeSearch } from './product-search.mjs'

export const sealedFormats = [
  { key: 'etb', label: 'ETB' },
  { key: 'miniTin', label: 'Mini-tins' },
  { key: 'valisette', label: 'Valisettes' },
  { key: 'prereleaseKit', label: 'Kits AP' },
  { key: 'bundle', label: 'Bundles' },
  { key: 'display', label: 'Displays' },
  { key: 'pokebox', label: 'Pokébox' },
  { key: 'case', label: 'Cases' },
  { key: 'booster', label: 'Boosters et blisters' },
  { key: 'coffret', label: 'Coffrets' },
  { key: 'premiumCollection', label: 'Collections Premium' },
  { key: 'other', label: 'Autres produits scellés' },
]

export const sealedTypeOptions = [
  'ETB', 'Mini-tin', 'Valisette', 'Kit AP', 'Bundle',
  'Demi-display', 'Display', 'Display de Kits AP', 'Display de mini-tins',
  'Display de bundles', 'Pokébox', 'Case', 'Booster', 'Coffret',
  'Ultra-Premium Collection', 'Super-Premium Collection', 'Autre produit scellé',
]

function getProductType(item, product) {
  return normalizeSearch(item.product_type_override?.trim() || product?.product_type)
}

function getSearchableText(item, product, productType) {
  return normalizeSearch([
    product?.name,
    productType,
    product?.case_unit_product_type,
    item.custom_name,
  ].filter(Boolean).join(' '))
}

function getPremiumCollectionSubtype(item, product, productType, searchableText) {
  const text = normalizeSearch([
    item.product_type_override,
    product?.product_type,
    product?.name,
    item.custom_name,
  ].filter(Boolean).join(' '))

  if (productType === 'spc' || productType.startsWith('super premium collection')
    || /\\b(spc|super premium collection|collection super premium)\\b/.test(text)) return 'SPC'
  if (productType === 'upc' || productType === 'ultra premium'
    || productType.startsWith('ultra premium collection')
    || /\\b(upc|ultra premium collection|collection ultra premium)\\b/.test(text)) return 'UPC'
  return ''
}

function isDisplayText(text) {
  return /\\b(display|booster box|boite de boosters|boite boosters)\\b/.test(text)
}

function isDemiDisplayText(text) {
  return /\\bdemi display\\b|\\bdemie display\\b|\\bhalf display\\b|\\b18 boosters\\b/.test(text)
}

function isPrereleaseKitText(text) {
  return /\\bkits? ap\\b/.test(text)
    || /\\b(kit d avant premiere|kit avant premiere|build and battle|prerelease kit|pre release kit)\\b/.test(text)
}

function isMiniTinText(text) {
  return /\\b(mini tin|minitin|mini boite|mini pokebox)\\b/.test(text)
}

function isBundleText(text) {
  return /\\b(bundle|booster bundle)\\b/.test(text)
}

export function getSealedFormat(item, product) {
  const productType = getProductType(item, product)
  const searchableText = getSearchableText(item, product, productType)

  // Cases and premium collections are their own outer products, even when their
  // names mention products packed inside them.
  if (productType === 'case' || productType.startsWith('case ') || /^case\\b/.test(searchableText)) return 'case'
  if (getPremiumCollectionSubtype(item, product, productType, searchableText)) return 'premiumCollection'

  // All display formats use the same top-level bucket. The exact display type
  // is shown as a subtype in the expanded details.
  if (isDemiDisplayText(searchableText) || isDisplayText(searchableText)) return 'display'

  if (productType === 'etb' || /\\b(etb|elite trainer box|coffret dresseur)\\b/.test(searchableText)) return 'etb'
  if (productType.startsWith('coffret')) return 'coffret'
  if (isMiniTinText(searchableText)) return 'miniTin'
  if (/\\b(valisette|valizette|collector chest|coffre de collection)\\b/.test(searchableText)) return 'valisette'
  if (isPrereleaseKitText(searchableText)) return 'prereleaseKit'
  if (productType === 'bundle' || productType === 'booster bundle' || isBundleText(searchableText)) return 'bundle'
  if (/\\bpoke ?box\\b/.test(searchableText) || (productType === 'tin' && !/\\b(poke ball|pokeball)\\b/.test(searchableText))) return 'pokebox'
  if (productType === 'booster' || productType === 'blister' || /\\b(booster|blister|tripack|duopack)\\b/.test(searchableText)) return 'booster'
  if (/\\bcoffret\\b/.test(searchableText)) return 'coffret'
  return 'other'
}

export function getSealedSubtype(item, product) {
  const format = getSealedFormat(item, product)
  const productType = getProductType(item, product)
  const searchableText = getSearchableText(item, product, productType)

  if (format === 'premiumCollection') {
    return getPremiumCollectionSubtype(item, product, productType, searchableText) || 'Autres collections premium'
  }
  if (format !== 'display') return ''

  if (isDemiDisplayText(searchableText)) return 'Demi-displays'

  // Prefer a specific catalog or personal type over broad words in its name.
  if (/\\bdisplay de kits ap\\b/.test(productType)) return 'Displays de Kits AP'
  if (/\\bdisplay de mini tins\\b/.test(productType)) return 'Displays de mini-tins'
  if (/\\bdisplay de bundles\\b/.test(productType)) return 'Displays de bundles'

  const kit = isPrereleaseKitText(searchableText)
  const miniTin = isMiniTinText(searchableText)
  const bundle = isBundleText(searchableText)
  const explicitlyMixed = /\\b(mixte|assortiment mixte)\\b/.test(searchableText)
  const familyCount = [kit, miniTin, bundle].filter(Boolean).length
  if (explicitlyMixed || familyCount > 1) return 'Displays mixtes'
  if (kit) return 'Displays de Kits AP'
  if (miniTin) return 'Displays de mini-tins'
  if (bundle) return 'Displays de bundles'
  if (/\\b(booster|blister)\\b/.test(searchableText)) return 'Displays de boosters'
  return 'Autres displays'
}

export function calculateSealedFormatCounts(items, products) {
  const productById = new Map((products || []).map(product => [product.id, product]))
  const counts = Object.fromEntries(sealedFormats.map(format => [format.key, 0]))
  let total = 0

  for (const item of items || []) {
    const product = item.product_id ? productById.get(item.product_id) : null
    if (normalizeSearch(product?.category) !== 'sealed') continue

    const quantity = Math.max(0, Number(item.quantity) || 1)
    counts[getSealedFormat(item, product)] += quantity
    total += quantity
  }

  return {
    total,
    formats: sealedFormats.map(({ key, label }) => ({ key, label, count: counts[key] })),
  }
}
