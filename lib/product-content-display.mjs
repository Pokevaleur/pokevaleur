export const PRODUCT_COMPONENT_LABELS = {
  guaranteed_card: 'Carte garantie',
  booster: 'Booster',
  accessory: 'Accessoire',
  digital_code: 'Carte à code',
  deck: 'Deck'
}

export function sortProductComponents(rows = []) {
  return [...rows].sort((a, b) => {
    const aOrder = Number.isFinite(Number(a.sort_order)) ? Number(a.sort_order) : Number.MAX_SAFE_INTEGER
    const bOrder = Number.isFinite(Number(b.sort_order)) ? Number(b.sort_order) : Number.MAX_SAFE_INTEGER
    return aOrder - bOrder
  })
}

export function describeProductComponent(item) {
  if (item?.component_type === 'booster') {
    if (item.is_random) return 'Extension aléatoire dans le coffret'
    if (item.set_name) return `Extension : ${item.set_name}`
    return 'Série non précisée par la source'
  }

  if (item?.is_random) return 'Contenu aléatoire dans le coffret'
  return PRODUCT_COMPONENT_LABELS[item?.component_type] || 'Composant'
}
