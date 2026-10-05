export function buildCardRarityBreakdown(cards, variants, ownedVariantIds) {
  const cardById = new Map(cards.map(card => [card.id, card]))
  const totals = new Map()
  const ownedCards = new Map()

  for (const variant of variants) {
    if (!variant.is_master_set_target) continue
    const card = cardById.get(variant.card_id)
    if (!card) continue
    const label = card.rarity_label?.trim() || 'Rareté non renseignée'
    if (!totals.has(label)) totals.set(label, new Set())
    totals.get(label).add(card.id)
    if (ownedVariantIds.has(variant.id)) {
      if (!ownedCards.has(label)) ownedCards.set(label, new Set())
      ownedCards.get(label).add(card.id)
    }
  }

  return [...totals.entries()]
    .map(([label, cardIds]) => ({
      label,
      count: ownedCards.get(label)?.size || 0,
      total: cardIds.size
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'fr'))
}
