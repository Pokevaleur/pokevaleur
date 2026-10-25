const TCGDEX_CARD_URL = /^https:\/\/api\.tcgdex\.net\/v2\/fr\/(?:(?:sets|sv|tk)\/[a-z0-9.-]+\/(?:[a-z0-9.-]+|!|%3f)|cards\/[a-z0-9.-]+)$/i

export const maxDuration = 60

function isPrice(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function orderedFinishes(variants = []) {
  const finishes = variants.map(variant => String(variant?.finish_code || '').toLowerCase())
    .map(value => {
      if (value.startsWith('reverse')) return 'reverse'
      if (value.startsWith('holo')) return 'holo'
      return value
    })
  const known = finishes.filter(value => ['normal', 'standard', 'holo', 'reverse'].includes(value))
  return known.length ? ['normal', 'standard', 'holo', 'reverse'].filter(value => known.includes(value)) : ['normal', 'holo', 'reverse']
}

function firstMarketPrice(cardmarket, finishes) {
  const groups = {
    normal: ['avg30', 'avg7', 'avg', 'trend'],
    standard: ['avg30', 'avg7', 'avg', 'trend'],
    holo: ['avg30-holo', 'avg7-holo', 'avg-holo', 'trend-holo', 'avg30', 'avg'],
    reverse: ['avg30-holo', 'avg7-holo', 'avg-holo', 'trend-holo', 'avg30', 'avg']
  }
  const finishOrder = [...finishes, 'normal', 'holo', 'reverse']
  for (const finish of finishOrder) {
    for (const field of groups[finish] || groups.normal) {
      if (isPrice(cardmarket?.[field])) return { amount: cardmarket[field], field }
    }
  }
  return null
}

function normalizedPriceFinish(value) {
  const finish = String(value || '').toLowerCase()
  if (finish.startsWith('reverse')) return 'reverse'
  if (finish.startsWith('holo')) return 'holo'
  if (finish.startsWith('standard')) return 'standard'
  return 'normal'
}

function detailedFinish(variant) {
  const details = [variant?.type, variant?.subtype, variant?.foil, ...(Array.isArray(variant?.stamp) ? variant.stamp : [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  if (details.includes('reverse')) return 'reverse'
  if (details.includes('holo') || details.includes('foil')) return 'holo'
  return normalizedPriceFinish(variant?.type)
}

function pricingForFinish(data, finish) {
  const details = Array.isArray(data?.variants_detailed) ? data.variants_detailed : []
  const exact = details.find(variant => detailedFinish(variant) === finish)
  // Some catalog records have one finish label that differs from TCGdex's printing metadata.
  // When there is only one marketplace variant, its pricing is the only safe match.
  const detail = exact || (details.length === 1 && details[0]?.pricing ? details[0] : null)
  return {
    cardmarket: detail?.pricing?.cardmarket || null,
    tcgplayer: detail?.pricing?.tcgplayer || null,
    rootCardmarket: data?.pricing?.cardmarket || null,
    rootTcgplayer: data?.pricing?.tcgplayer || null,
    finish: detail ? detailedFinish(detail) : finish
  }
}

function tcgPlayerPrice(tcgplayer, finishes) {
  const buckets = {
    normal: ['normal', 'nonHolo', 'unlimited'],
    standard: ['normal', 'nonHolo', 'unlimited'],
    holo: ['holofoil', 'unlimited-holofoil', '1st-edition-holofoil'],
    reverse: ['reverse', 'reverseHolofoil', 'reverse-holofoil']
  }
  const finishOrder = [...finishes, 'normal', 'holo', 'reverse']
  for (const finish of finishOrder) {
    for (const bucketName of buckets[finish] || buckets.normal) {
      const bucket = tcgplayer?.[bucketName]
      const amount = isPrice(bucket?.marketPrice) ? bucket.marketPrice : bucket?.midPrice
      if (isPrice(amount)) return { amount, bucket: bucketName, field: bucket?.marketPrice ? 'marketPrice' : 'midPrice' }
    }
  }
  return null
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 21600 }
  })
  if (!response.ok) throw new Error(`Source de prix indisponible (${response.status})`)
  return response.json()
}

async function mapWithLimit(values, limit, callback) {
  const results = new Array(values.length)
  let nextIndex = 0
  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex++
      results[index] = await callback(values[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker))
  return results
}

function tcgdexUrlForCard(card) {
  if (TCGDEX_CARD_URL.test(card?.source_url || '')) return card.source_url
  if (TCGDEX_CARD_URL.test(card?.image_source_url || '')) return card.image_source_url
  if (String(card?.set_code || '').toLowerCase() === '2024sv' && /^\d+$/.test(String(card?.collector_number || ''))) {
    return `https://api.tcgdex.net/v2/fr/sets/2024sv/${card.collector_number}`
  }
  return null
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Corps de requête invalide.' }, { status: 400 })
  }

  const cards = Array.isArray(body?.cards) ? body.cards.slice(0, 400) : []
  if (!cards.length) return Response.json({ prices: [] })

  const validCards = cards.map(card => ({ ...card, tcgdexUrl: tcgdexUrlForCard(card) }))
    .filter(card => typeof card?.id === 'string' && card.tcgdexUrl)
  const fetched = await mapWithLimit(validCards, 10, async card => {
    try {
      const data = await fetchJson(card.tcgdexUrl)
      const finishes = orderedFinishes(card.variants)
      const variantPrices = (card.variants || []).map(variant => {
        const finish = normalizedPriceFinish(variant?.finish_code)
        const variantSource = pricingForFinish(data, finish)
        const variantMarket = firstMarketPrice(variantSource.cardmarket, [variantSource.finish])
          || firstMarketPrice(variantSource.rootCardmarket, [variantSource.finish])
        const variantFallback = variantMarket ? null : tcgPlayerPrice(variantSource.tcgplayer, [variantSource.finish])
          || tcgPlayerPrice(variantSource.rootTcgplayer, [variantSource.finish])
        return {
          variantId: variant?.id || null,
          finish,
          market: variantMarket ? { ...variantMarket, updated: variantSource.cardmarket?.updated || null } : null,
          fallback: variantFallback ? { ...variantFallback, updated: variantSource.tcgplayer?.updated || null } : null
        }
      })
      const firstPricedVariant = variantPrices.find(variant => variant.market || variant.fallback)
      const rootPricing = data?.pricing || null
      const rootMarket = firstMarketPrice(rootPricing?.cardmarket, finishes)
      const rootFallback = rootMarket ? null : tcgPlayerPrice(rootPricing?.tcgplayer, finishes)
      const preferredVariant = finishes
        .map(finish => variantPrices.find(variant => variant.finish === finish && (variant.market || variant.fallback)))
        .find(Boolean) || firstPricedVariant
      const market = preferredVariant?.market || rootMarket
      const fallback = preferredVariant?.market ? null : preferredVariant?.fallback || rootFallback
      const cardmarket = rootPricing?.cardmarket || null
      const tcgplayer = rootPricing?.tcgplayer || null
      const tcgDexUpdatedAt = market?.updated || fallback?.updated || cardmarket?.updated || tcgplayer?.updated || null
      return {
        cardId: card.id,
        cardmarket,
        tcgplayer,
        chosenMarket: market ? { ...market, source: 'Cardmarket' } : null,
        chosenFallback: fallback ? { ...fallback, source: 'TCGplayer' } : null,
        variantPrices,
        tcgDexUpdatedAt
      }
    } catch {
      return { cardId: card.id, cardmarket: null, tcgplayer: null, chosenMarket: null, chosenFallback: null, tcgDexUpdatedAt: null }
    }
  })

  const needsConversion = fetched.some(item => item.chosenFallback || item.variantPrices?.some(variant => variant.fallback))
  let exchange = null
  if (needsConversion) {
    try {
      const rates = await fetchJson('https://api.frankfurter.dev/v2/rate/usd/eur')
      if (isPrice(rates?.rate)) exchange = { rate: rates.rate, date: rates.date || null }
    } catch {
      // Keep EUR pricing unavailable if the dated conversion rate cannot be verified.
    }
  }

  const prices = fetched.map(item => {
    const variantPrices = (item.variantPrices || []).map(variant => {
      if (variant.market) return {
        variantId: variant.variantId,
        finish: variant.finish,
        amount: variant.market.amount,
        currency: 'EUR',
        source: 'Cardmarket',
        basis: variant.market.field,
        observedAt: variant.market.updated || item.tcgDexUpdatedAt
      }
      if (variant.fallback && exchange) return {
        variantId: variant.variantId,
        finish: variant.finish,
        amount: Math.round(variant.fallback.amount * exchange.rate * 100) / 100,
        currency: 'EUR',
        source: 'TCGplayer · conversion de référence',
        basis: variant.fallback.field,
        observedAt: variant.fallback.updated || item.tcgDexUpdatedAt,
        exchange
      }
      return {
        variantId: variant.variantId,
        finish: variant.finish,
        amount: null,
        currency: null,
        source: null,
        basis: null,
        observedAt: item.tcgDexUpdatedAt
      }
    })
    if (item.chosenMarket) {
      return {
        ...item,
        variantPrices,
        amount: item.chosenMarket.amount,
        currency: 'EUR',
        source: 'Cardmarket',
        basis: item.chosenMarket.field,
        observedAt: item.tcgDexUpdatedAt
      }
    }
    if (item.chosenFallback && exchange) {
      return {
        ...item,
        variantPrices,
        amount: Math.round(item.chosenFallback.amount * exchange.rate * 100) / 100,
        currency: 'EUR',
        source: 'TCGplayer · conversion de référence',
        basis: item.chosenFallback.field,
        observedAt: item.tcgDexUpdatedAt,
        exchange
      }
    }
    return { ...item, variantPrices, amount: null, currency: null, source: null, basis: null, observedAt: item.tcgDexUpdatedAt, exchange }
  })

  return Response.json({ prices, exchangeDate: exchange?.date || null })
}
