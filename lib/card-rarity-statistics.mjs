export function buildCardRarityBreakdown(cards, variants, ownedVariantIds) {
  const cardById = new Map(cards.map(card => [card.id, card]))
  const totals = new Map()
  const ownedCounts = new Map()

  for (const variant of variants) {
    if (!variant.is_master_set_target) continue
    const card = cardById.get(variant.card_id)
    if (!card) continue
    const label = card.rarity_label?.trim() || 'Rareté non renseignée'
    totals.set(label, (totals.get(label) || 0) + 1)
    if (ownedVariantIds.has(variant.id)) {
      ownedCounts.set(label, (ownedCounts.get(label) || 0) + 1)
    }
  }

  return [...totals.entries()]
    .map(([label, total]) => ({
      label,
      count: ownedCounts.get(label) || 0,
      total
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
}
