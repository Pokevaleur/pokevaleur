import test from 'node:test'
import assert from 'node:assert/strict'
import { findWatchlistProducts } from '../lib/watchlist-search.mjs'
const products = [
  { id: '151', name: 'Coffret Dresseur Élite', series: '151' },
  { id: 'other', name: 'Coffret Dresseur Élite', series: 'Flammes Obsidiennes' },
  { id: 'upc', name: 'Collection Ultra Premium Dracaufeu' },
]
test('Watchlist search shares precise catalogue aliases and hides already watched products', () => {
  assert.deepEqual(findWatchlistProducts(products, [], 'ETB 151').map(p => p.id), ['151'])
  assert.deepEqual(findWatchlistProducts(products, [{ product_id: '151' }], 'ETB 151'), [])
  assert.deepEqual(findWatchlistProducts(products, [], 'UPC charizard').map(p => p.id), ['upc'])
})
test('Watchlist search is empty before typing and limits suggestions to eight', () => {
  assert.deepEqual(findWatchlistProducts(products, [], ''), [])
  assert.deepEqual(findWatchlistProducts(products, [], 'e'), [])
  const many = Array.from({ length: 20 }, (_, id) => ({ id, name: 'Coffret Dresseur Élite' }))
  assert.equal(findWatchlistProducts(many, [], 'ETB').length, 8)
})
