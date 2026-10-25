const TCGDEX_CARD_URL = /^https:\/\/api\.tcgdex\.net\/v2\/fr\/(?:(?:sets|sv|tk)\/[a-z0-9.-]+\/(?:[a-z0-9.-]+|!|%3f)|cards\/[a-z0-9.-]+)$/i
const CARDMARKET_GUIDE_URL = 'https://downloads.s3.cardmarket.com/productCatalog/priceGuide/price_guide_6.json'
const CARDMARKET_SINGLES_URL = 'https://downloads.s3.cardmarket.com/productCatalog/productList/products_singles_6.json'
const CARDMARKET_PRODUCTS_URL = 'https://downloads.s3.cardmarket.com/productCatalog/productList/products_nonsingles_6.json'

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
    cardmarketProductId: detail?.thirdParty?.cardmarket || detail?.pricing?.cardmarket?.idProduct || data?.thirdParty?.cardmarket || data?.pricing?.cardmarket?.idProduct || null,
    tcgplayer: detail?.pricing?.tcgplayer || null,
    rootCardmarket: data?.pricing?.cardmarket || null,
    rootTcgplayer: data?.pricing?.tcgplayer || null,
    finish: detail ? detailedFinish(detail) : finish
  }
}

function productText(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function cardmarketExpansionIds(setName, products) {
  const normalizedSetName = productText(setName)
  if (!normalizedSetName) return []
  const regionalSuffix = /^(jp|japanese|simplified chinese|traditional chinese|indonesian|thai|korean|portuguese|spanish|italian|german|french)\b/
  const counts = new Map()
  for (const product of products) {
    const name = productText(product?.name)
    if (!name.startsWith(`${normalizedSetName} `)) continue
    const suffix = name.slice(normalizedSetName.length).trim()
    if (regionalSuffix.test(suffix)) continue
    counts.set(product.idExpansion, (counts.get(product.idExpansion) || 0) + 1)
  }
  if (!counts.size) return []
  const bestCount = Math.max(...counts.values())
  return [...counts].filter(([, count]) => count === bestCount).map(([id]) => id)
}

function productHasCollectorNumber(productName, collectorNumber) {
  const productTokens = productText(productName).split(' ').filter(Boolean)
  const numberTokens = productText(collectorNumber).split(' ').filter(Boolean)
  if (!numberTokens.length) return false
  for (let index = 0; index <= productTokens.length - numberTokens.length; index += 1) {
    if (numberTokens.every((token, offset) => productTokens[index + offset] === token)) return true
  }
  return false
}

function cardmarketProductForCard(cardData, products, expansionIds) {
  if (!cardData?.name || !expansionIds.length) return null
  const labels = [
    ...(Array.isArray(cardData.abilities) ? cardData.abilities.map(ability => ability?.name) : []),
    ...(Array.isArray(cardData.attacks) ? cardData.attacks.map(attack => attack?.name) : [])
  ].filter(Boolean).map(productText)
  const cardName = productText(cardData.name)
  const candidates = products.filter(product => {
    if (!expansionIds.includes(product?.idExpansion)) return false
    const name = productText(product?.name)
    return name === cardName || name.startsWith(cardName + ' ')
  })

  const localId = cardData.localId || cardData.number || null
  if (localId) {
    const numberedCandidates = candidates.filter(product => productHasCollectorNumber(product?.name, localId))
    if (numberedCandidates.length === 1) return numberedCandidates[0]
    if (numberedCandidates.length > 1) {
      const disambiguated = numberedCandidates.filter(product =>
        labels.every(label => productText(product?.name).includes(label))
      )
      if (disambiguated.length === 1) return disambiguated[0]
    }
  }

  if (candidates.length === 1) return candidates[0]
  const disambiguated = candidates.filter(product =>
    labels.every(label => productText(product?.name).includes(label))
  )
  return disambiguated.length === 1 ? disambiguated[0] : null
}

function tcgdexEnglishUrl(url) {
  return String(url || '').replace('https://api.tcgdex.net/v2/fr/', 'https://api.tcgdex.net/v2/en/')
}

function tcgdexSetId(url) {
  return String(url || '').match(/\/sets\/([a-z0-9.+-]+)\//i)?.[1] || null
}

function directCardmarketProductId(data, variants = []) {
  for (const variant of variants) {
    const source = pricingForFinish(data, normalizedPriceFinish(variant?.finish_code))
    if (source.cardmarketProductId) return source.cardmarketProductId
  }
  return data?.thirdParty?.cardmarket || data?.pricing?.cardmarket?.idProduct || null
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

function isRgbMewCard(card) {
  return String(card?.set_code || '').toLowerCase() === '30c'
    && String(card?.card_name || card?.name || '').toLowerCase() === 'mew'
    && /^[RGB]\/RGB$/i.test(String(card?.collector_number || ''))
}

function cardmarketProductForRgbMew(card, products) {
  const collectorNumber = String(card?.collector_number || '').toUpperCase()
  const verifiedProductIds = { 'R/RGB': 909509, 'G/RGB': 909510, 'B/RGB': 909511 }
  const verifiedId = verifiedProductIds[collectorNumber]
  const byId = products.find(product =>
    Number(product?.idExpansion) === 6601 && Number(product?.idProduct) === verifiedId
  )
  if (byId) return byId

  const expected = productText(`Mew (30C ${collectorNumber})`)
  const matches = products.filter(product =>
    Number(product?.idExpansion) === 6601 && productText(product?.name) === expected
  )
  return matches.length === 1 ? matches[0] : null
}

function tcgdexUrlForCard(card) {
  if (TCGDEX_CARD_URL.test(card?.source_url || '')) return card.source_url
  if (TCGDEX_CARD_URL.test(card?.image_source_url || '')) return card.image_source_url
  const setCode = String(card?.set_code || '').trim().toLowerCase()
  const collectorNumber = String(card?.collector_number || '').trim()
  if (setCode === '2024sv' && /^\d+$/.test(collectorNumber)) {
    return `https://api.tcgdex.net/v2/fr/sets/2024sv/${collectorNumber}`
  }
  const catalogOnlySets = new Set(['mee30', 'sme17', 'sme19', 'tk-sm-l', 'tk-sm-r'])
  const tcgdexSetId = setCode === '30c' ? '30th' : setCode
  if (!catalogOnlySets.has(setCode)
    && /^[a-z0-9.-]+$/.test(tcgdexSetId)
    && /^[a-z0-9.+-]+$/i.test(collectorNumber)) {
    return `https://api.tcgdex.net/v2/fr/sets/${tcgdexSetId}/${encodeURIComponent(collectorNumber)}`
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
    .filter(card => typeof card?.id === 'string' && (card.tcgdexUrl || isRgbMewCard(card)))
  const fetched = await mapWithLimit(validCards, 10, async card => {
    if (isRgbMewCard(card)) {
      return {
        cardId: card.id, card, tcgdexUrl: null, tcgdexData: null,
        cardmarket: null, tcgplayer: null, chosenMarket: null, chosenFallback: null,
        variantPrices: [], tcgDexUpdatedAt: null
      }
    }
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
        card,
        tcgdexUrl: card.tcgdexUrl,
        tcgdexData: data,
        cardmarket,
        tcgplayer,
        chosenMarket: market ? { ...market, source: 'Cardmarket' } : null,
        chosenFallback: fallback ? { ...fallback, source: 'TCGplayer' } : null,
        variantPrices,
        tcgDexUpdatedAt
      }
    } catch {
      return { cardId: card.id, card, tcgdexUrl: card.tcgdexUrl, tcgdexData: null, cardmarket: null, tcgplayer: null, chosenMarket: null, chosenFallback: null, variantPrices: [], tcgDexUpdatedAt: null }
    }
  })

  const cardsNeedingCardmarket = fetched.filter(item => !item.chosenMarket && (
    (item.tcgdexData && item.tcgdexUrl) || isRgbMewCard(item.card)
  ))
  if (cardsNeedingCardmarket.length) {
    try {
      const needsProductCatalog = cardsNeedingCardmarket.some(item =>
        isRgbMewCard(item.card) || !directCardmarketProductId(item.tcgdexData, item.card?.variants || [])
      )
      const [guideData, singleProducts, expansionProducts] = await Promise.all([
        fetchJson(CARDMARKET_GUIDE_URL),
        needsProductCatalog ? fetchJson(CARDMARKET_SINGLES_URL) : Promise.resolve(null),
        needsProductCatalog ? fetchJson(CARDMARKET_PRODUCTS_URL) : Promise.resolve(null)
      ])
      const guideByProductId = new Map((guideData?.priceGuides || []).map(guide => [guide.idProduct, guide]))
      const guideDate = guideData?.createdAt || null
      const resolved = await mapWithLimit(cardsNeedingCardmarket, 5, async item => {
        try {
          const variants = item.card?.variants || []
          const productForVariant = new Map()
          const directIds = variants.map(variant => {
            const finish = normalizedPriceFinish(variant?.finish_code)
            const source = pricingForFinish(item.tcgdexData, finish)
            if (source.cardmarketProductId) productForVariant.set(variant?.id, source.cardmarketProductId)
            return source.cardmarketProductId
          }).filter(Boolean)
          let productId = directIds[0] || null

          if (isRgbMewCard(item.card)) {
            const rgbProduct = cardmarketProductForRgbMew(item.card, singleProducts?.products || [])
            productId = rgbProduct?.idProduct || null
            if (productId) {
              for (const variant of variants) productForVariant.set(variant?.id, productId)
            }
          }

          if (!productId && item.tcgdexUrl) {
            const englishData = await fetchJson(tcgdexEnglishUrl(item.tcgdexUrl))
            const setId = tcgdexSetId(item.tcgdexUrl)
            const expansionIds = cardmarketExpansionIds(englishData?.set?.name, expansionProducts?.products || [])
            const fallbackProduct = cardmarketProductForCard(englishData, singleProducts?.products || [], expansionIds)
              || (setId === '30th' ? cardmarketProductForCard(englishData, singleProducts?.products || [], [6601]) : null)
            productId = fallbackProduct?.idProduct || null
          }
          if (!productId) return item

          const rootGuide = guideByProductId.get(productId)
          if (!rootGuide) return item
          const pricedVariants = variants.map(variant => {
            const finish = normalizedPriceFinish(variant?.finish_code)
            const variantProductId = productForVariant.get(variant?.id) || productId
            const guide = guideByProductId.get(variantProductId) || rootGuide
            const market = firstMarketPrice(guide, [finish])
            return {
              variantId: variant?.id || null,
              finish,
              market: market ? { ...market, updated: guideDate } : null,
              fallback: null
            }
          })
          const finishes = orderedFinishes(variants)
          const preferredVariant = finishes
            .map(finish => pricedVariants.find(variant => variant.finish === finish && variant.market))
            .find(Boolean)
          const market = preferredVariant?.market || firstMarketPrice(rootGuide, finishes)
          if (!market) return item
          return {
            ...item,
            cardmarket: rootGuide,
            chosenMarket: { ...market, source: 'Cardmarket' },
            chosenFallback: null,
            variantPrices: pricedVariants,
            tcgDexUpdatedAt: guideDate
          }
        } catch {
          return item
        }
      })
      const resolvedById = new Map(resolved.map(item => [item.cardId, item]))
      for (let index = 0; index < fetched.length; index += 1) {
        if (resolvedById.has(fetched[index].cardId)) fetched[index] = resolvedById.get(fetched[index].cardId)
      }
    } catch {
      // Continue with existing TCGdex and TCGplayer sources when the public Cardmarket files fail.
    }
  }

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
    const { card, tcgdexUrl, tcgdexData, ...publicItem } = item
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
        ...publicItem,
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
        ...publicItem,
        variantPrices,
        amount: Math.round(item.chosenFallback.amount * exchange.rate * 100) / 100,
        currency: 'EUR',
        source: 'TCGplayer · conversion de référence',
        basis: item.chosenFallback.field,
        observedAt: item.tcgDexUpdatedAt,
        exchange
      }
    }
    return { ...publicItem, variantPrices, amount: null, currency: null, source: null, basis: null, observedAt: item.tcgDexUpdatedAt, exchange }
  })

  return Response.json({ prices, exchangeDate: exchange?.date || null })
}
