import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateCollectionItemCounts, calculateCollectionStatistics, hasPurchasePrice } from '../lib/collection-statistics.mjs'
const getValue = item => item.value

test('An unknown purchase price does not invent a profit', () => {
  const stats = calculateCollectionStatistics([
    { quantity: 2, purchase_price: 50, value: 75 },
    { quantity: 3, purchase_price: null, value: 100 },
  ], getValue)
  assert.equal(stats.current, 450)
  assert.equal(stats.invested, 100)
  assert.equal(stats.difference, 50)
  assert.equal(stats.evolution, 50)
  assert.equal(stats.missingPurchaseCount, 3)
  assert.equal(stats.itemCount, 5)
})
test('An explicitly free item differs from a missing purchase price', () => {
  assert.equal(hasPurchasePrice({ purchase_price: 0 }), true)
  assert.equal(hasPurchasePrice({ purchase_price: '' }), false)
  const free = calculateCollectionStatistics([{ purchase_price: 0, value: 20 }], getValue)
  assert.equal(free.difference, 20)
  assert.equal(free.evolution, null)
  const unknown = calculateCollectionStatistics([{ purchase_price: null, value: 20 }], getValue)
  assert.equal(unknown.difference, null)
})


test('Only catalog-linked sealed products count as sealed; other entries stay in the total', () => {
  const counts = calculateCollectionItemCounts([
    { product_id: 'etb', quantity: 2 },
    { product_id: null, custom_name: 'Objet non rattaché', quantity: 3 },
    { product_id: 'unknown', quantity: 4 },
    { product_id: 'card', quantity: 1 },
  ], [
    { id: 'etb', category: 'sealed' },
    { id: 'card', category: 'single' },
  ])
  assert.deepEqual(counts, { sealed: 2, other: 8, total: 10 })
})

test('A catalog sealed category is case and whitespace tolerant, with quantity fallback', () => {
  const counts = calculateCollectionItemCounts([
    { product_id: 'etb', quantity: 0 },
  ], [{ id: 'etb', category: ' Sealed ' }])
  assert.deepEqual(counts, { sealed: 1, other: 0, total: 1 })
})
