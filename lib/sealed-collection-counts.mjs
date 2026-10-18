import { normalizeSearch } from './product-search.mjs'

export const sealedFormats = [
  { key: 'halfDisplay', label: 'Demi-displays' },
  { key: 'etb', label: 'ETB' },
  { key: 'miniTin', label: 'Mini-tins' },
  { key: 'valisette', label: 'Valisettes' },
  { key: 'prereleaseKit', label: 'Kits AP' },
  { key: 'prereleaseKitDisplay', label: 'Displays de Kits AP' },
  { key: 'bundle', label: 'Bundles' },
  { key: 'display', label: 'Displays' },
  { key: 'pokebox', label: 'Pokébox' },
  { key: 'case', label: 'Cases' },
  { key: 'booster', label: 'Boosters et blisters' },
  { key: 'coffret', label: 'Coffrets' },
  { key: 'other', label: 'Autres produits scellés' },
]

export function getSealedFormat(item, product) {
  if (sealedFormats.some(format => format.key === item.sealed_format_override)) return item.sealed_format_override

  const productType = normalizeSearch(product?.product_type)
  const searchableText = normalizeSearch([
    product?.name,
    productType,
    product?.case_unit_product_type,
    item.custom_name,
  ].filter(Boolean).join(' '))

  // A sealed Case remains one distinct catalog item, even when its name
  // contains the name of the products packed inside it.
  if (productType === 'case' || productType.startsWith('case ') || /^case\b/.test(searchableText)) return 'case'

  const isPrereleaseKit = /\bkits? ap\b/.test(searchableText) || productType === 'kit ap' || /\b(kit d avant premiere|kit avant premiere|build and battle|prerelease kit|pre release kit)\b/.test(searchableText)
  const isDisplay = /\b(display|booster box|boite de boosters|boite boosters)\b/.test(searchableText)
  if (isPrereleaseKit && isDisplay) return 'prereleaseKitDisplay'
  if (/\bdemi display\b|\bdemie display\b|\bhalf display\b|\b18 boosters\b/.test(searchableText)) return 'halfDisplay'
  if (productType === 'etb' || /\b(etb|elite trainer box|coffret dresseur)\b/.test(searchableText)) return 'etb'
  if (productType.startsWith('coffret')) return 'coffret'
  if (/\b(mini tin|minitin|mini boite|mini pokebox)\b/.test(searchableText)) return 'miniTin'
  if (/\b(valisette|valizette|collector chest|coffre de collection)\b/.test(searchableText)) return 'valisette'
  if (isPrereleaseKit) return 'prereleaseKit'
  if (productType === 'bundle' || productType === 'booster bundle' || /\bbooster bundle\b/.test(searchableText)) return 'bundle'
  if (productType === 'display' || /\b(display|booster box|boite de boosters|boite boosters)\b/.test(searchableText)) return 'display'
  if (/\bpoke ?box\b/.test(searchableText) || (productType === 'tin' && !/\b(poke ball|pokeball)\b/.test(searchableText))) return 'pokebox'
  if (productType === 'booster' || productType === 'blister' || /\b(booster|blister|tripack|duopack)\b/.test(searchableText)) return 'booster'
  if (/\bcoffret\b/.test(searchableText)) return 'coffret'
  return 'other'
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
