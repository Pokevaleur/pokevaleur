import { fetchAllRows } from './supabase-pagination.js'

const REQUEST_BATCH_SIZE = 400

export async function loadActiveCollectionProfile(supabase) {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!user) return null

  const { data: profiles, error } = await supabase
    .from('collection_profiles')
    .select('id,display_name,is_default')
    .order('created_at')
  if (error) throw error

  const savedId = window.localStorage.getItem(`pokevaleur-collection:${user.id}`)
  const profile = (profiles || []).find(row => row.id === savedId)
    || (profiles || []).find(row => row.is_default)
    || (profiles || [])[0]
  return profile ? { user, profile } : null
}

export async function fetchCardMarketPrices(cards) {
  const prices = new Map()
  for (let offset = 0; offset < cards.length; offset += REQUEST_BATCH_SIZE) {
    const response = await fetch('/api/card-prices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cards: cards.slice(offset, offset + REQUEST_BATCH_SIZE) })
    })
    if (!response.ok) continue
    const payload = await response.json()
    for (const price of payload.prices || []) prices.set(price.cardId, price)
  }
  return prices
}

function latest(rows = []) {
  return [...rows].sort((a, b) => new Date(b.observed_at) - new Date(a.observed_at))[0] || null
}

function numericPrice(row) {
  if (row?.currency && row.currency !== 'EUR') return null
  const amount = Number(row?.amount)
  return row && Number.isFinite(amount) && amount >= 0 ? amount : null
}

/** Values actual owned copies. Missing market prices stay missing; purchase cost is never used as a valuation. */
export async function loadOwnedCardValuations(supabase, profileId) {
  const copyResult = await fetchAllRows(() => supabase.from('collection_cards')
    .select('id,card_print_variant_id,ownership_type,grade,grade_label,grading_company_id,current_value_override,card_grading_companies(company_name,abbreviation)')
    .eq('collection_profile_id', profileId)
    .order('created_at', { ascending: true }))
  if (copyResult.error) throw copyResult.error
  const copies = copyResult.data || []
  const variantIds = [...new Set(copies.map(copy => copy.card_print_variant_id).filter(Boolean))]
  if (!variantIds.length) return { copies: [], total: 0, pricedCopies: 0, unpricedCopies: 0 }

  const variants = []
  for (let offset = 0; offset < variantIds.length; offset += 100) {
    const batch = variantIds.slice(offset, offset + 100)
    const result = await fetchAllRows(() => supabase.from('card_print_variants')
      .select('id,card_id,finish_code,cards(id,card_name,collector_number,rarity_label,image_url,image_source_url,card_sets(set_code,set_name))')
      .in('id', batch))
    if (result.error) throw result.error
    variants.push(...(result.data || []))
  }
  const variantById = new Map(variants.map(variant => [variant.id, variant]))
  const cardById = new Map(variants.map(variant => [variant.cards?.id, variant.cards]).filter(([id]) => id))
  const cardIds = [...cardById.keys()]

  const observations = []
  for (let offset = 0; offset < variantIds.length; offset += 100) {
    const batch = variantIds.slice(offset, offset + 100)
    const result = await fetchAllRows(() => supabase.from('card_price_observations')
      .select('card_print_variant_id,price_kind,grading_company_id,grade,observation_type,amount,currency,source,observed_at')
      .in('card_print_variant_id', batch)
      .in('observation_type', ['confirmed_sale', 'estimate'])
      .order('observed_at', { ascending: false }))
    if (result.error) throw result.error
    observations.push(...(result.data || []))
  }
  const observationsByVariant = new Map()
  for (const row of observations) {
    const rows = observationsByVariant.get(row.card_print_variant_id) || []
    rows.push(row)
    observationsByVariant.set(row.card_print_variant_id, rows)
  }

  let externalPrices = new Map()
  try {
    const cardsForPricing = cardIds.map(id => {
      const card = cardById.get(id)
      const cardVariants = variants.filter(variant => variant.card_id === id)
      return {
        id,
        image_source_url: card?.image_source_url,
        set_code: card?.card_sets?.set_code,
        collector_number: card?.collector_number,
        variants: cardVariants.map(variant => ({ finish_code: variant.finish_code }))
      }
    })
    externalPrices = await fetchCardMarketPrices(cardsForPricing)
  } catch {
    // Stored observations remain usable when an external source is unavailable.
  }

  const valuedCopies = copies.map(copy => {
    const variant = variantById.get(copy.card_print_variant_id)
    const card = variant?.cards || null
    const rows = observationsByVariant.get(copy.card_print_variant_id) || []
    let price = null
    let source = ''

    if (copy.ownership_type === 'graded') {
      if (copy.current_value_override !== null && copy.current_value_override !== undefined) {
        price = Number(copy.current_value_override)
        source = 'Valeur personnelle pour cette carte gradée'
      } else {
        const match = latest(rows.filter(row => row.price_kind === 'graded'
          && row.grading_company_id === copy.grading_company_id
          && Number(row.grade) === Number(copy.grade)))
        price = numericPrice(match)
        source = match?.source || ''
      }
    } else {
      const market = externalPrices.get(card?.id)
      if (numericPrice(market)) {
        price = Number(market.amount)
        source = market.source || 'Prix de référence'
      } else {
        const match = latest(rows.filter(row => row.price_kind === 'raw' && row.observation_type !== 'observed_listing'))
        price = numericPrice(match)
        source = match?.source || ''
      }
    }
    return { ...copy, card, variant, price, source }
  })

  const pricedCopies = valuedCopies.filter(copy => copy.price !== null && Number.isFinite(copy.price))
  return {
    copies: valuedCopies,
    total: pricedCopies.reduce((sum, copy) => sum + copy.price, 0),
    pricedCopies: pricedCopies.length,
    unpricedCopies: valuedCopies.length - pricedCopies.length
  }
}

export function getSealedItemValue(item, product) {
  if (item.current_value_override !== null && item.current_value_override !== undefined) {
    const value = Number(item.current_value_override)
    return Number.isFinite(value) && value >= 0 ? value : null
  }
  if (!product) return null
  const catalogValue = item.sealed_condition === 'zero_defect'
    ? product.zero_defect_value ?? product.current_value
    : product.current_value
  const value = Number(catalogValue)
  return catalogValue !== null && catalogValue !== undefined && Number.isFinite(value) && value >= 0 ? value : null
}
