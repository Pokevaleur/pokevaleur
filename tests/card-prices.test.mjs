import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../app/api/card-prices/route.js', import.meta.url), 'utf8')
const { POST } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
const originalFetch = globalThis.fetch
let requestedUrls

beforeEach(() => { requestedUrls = [] })
afterEach(() => { globalThis.fetch = originalFetch })

function mockPrices(responses) {
  globalThis.fetch = async input => {
    const url = String(input)
    requestedUrls.push(url)
    if (url.includes('frankfurter.dev')) return Response.json({ rate: 0.92, date: '2026-10-10' })
    const body = responses[url]
    if (!body) throw new Error(`Unexpected URL: ${url}`)
    return Response.json(body)
  }
}

async function getPrices(cards) {
  const request = new Request('https://pokevaleur.test/api/card-prices', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cards })
  })
  const response = await POST(request)
  assert.equal(response.status, 200)
  return (await response.json()).prices
}

test('uses the Cardmarket 30-day price in euros before TCGplayer', async () => {
  const url = 'https://api.tcgdex.net/v2/fr/sets/test/1'
  mockPrices({ [url]: { pricing: {
    cardmarket: { avg30: 0.45, updated: '2026-10-09' },
    tcgplayer: { normal: { marketPrice: 2.1 } }
  } } })

  const [price] = await getPrices([{ id: 'card-1', image_source_url: url, variants: [{ finish_code: 'normal' }] }])
  assert.equal(price.amount, 0.45)
  assert.equal(price.currency, 'EUR')
  assert.equal(price.source, 'Cardmarket')
  assert.equal(price.basis, 'avg30')
  assert.equal(requestedUrls.some(url => url.includes('frankfurter.dev')), false)
})

test('converts the TCGplayer fallback into euros with a dated exchange rate', async () => {
  const url = 'https://api.tcgdex.net/v2/fr/sets/test/2'
  mockPrices({ [url]: { pricing: { cardmarket: null, tcgplayer: { normal: { marketPrice: 1 } } } } })

  const [price] = await getPrices([{ id: 'card-2', image_source_url: url, variants: [{ finish_code: 'normal' }] }])
  assert.equal(price.amount, 0.92)
  assert.equal(price.currency, 'EUR')
  assert.match(price.source, /TCGplayer/)
  assert.equal(price.exchange.date, '2026-10-10')
})

test('matches reverse foil variants to the holographic price fields', async () => {
  const url = 'https://api.tcgdex.net/v2/fr/sets/test/3'
  mockPrices({ [url]: { pricing: { cardmarket: { avg30: 0.4, 'avg30-holo': 1.2 }, tcgplayer: null } } })

  const [price] = await getPrices([{ id: 'card-3', image_source_url: url, variants: [{ finish_code: 'reverse-pokeball' }] }])
  assert.equal(price.amount, 1.2)
  assert.equal(price.basis, 'avg30-holo')
})

test('uses the TCGdex McDonald’s 2024 identifier and leaves an unpriced card unknown', async () => {
  const url = 'https://api.tcgdex.net/v2/fr/sets/2024sv/001'
  mockPrices({ [url]: { pricing: { cardmarket: { avg30: 0.12 }, tcgplayer: null } } })

  const [price] = await getPrices([{ id: 'mcd-1', set_code: '2024sv', collector_number: '001' }])
  assert.equal(requestedUrls[0], url)
  assert.equal(price.amount, 0.12)
})

test('does not invent a price when neither market has one', async () => {
  const url = 'https://api.tcgdex.net/v2/fr/sets/test/4'
  mockPrices({ [url]: { pricing: { cardmarket: null, tcgplayer: null } } })

  const [price] = await getPrices([{ id: 'card-4', image_source_url: url, variants: [] }])
  assert.equal(price.amount, null)
  assert.equal(price.currency, null)
})
