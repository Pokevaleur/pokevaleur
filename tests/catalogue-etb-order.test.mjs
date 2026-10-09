import test from 'node:test'
import assert from 'node:assert/strict'
import { createProductMatcher, isEtbSelection } from '../lib/product-search.mjs'
import { getProductReleaseOrder, sortEtbsByReleaseDate } from '../lib/catalogue-sort.mjs'

test('ETB quick selections are exact product type filters', () => {
  assert.equal(isEtbSelection('ETB'), true)
  assert.equal(isEtbSelection('Coffret Dresseur'), true)
  assert.equal(isEtbSelection('Case de 10 ETB'), false)

  const matcher = createProductMatcher('ETB')
  assert.equal(matcher({ name: 'Coffret Dresseur d’élite', product_type: 'ETB' }), true)
  assert.equal(matcher({ name: 'Case de 10 ETB', product_type: 'Case' }), false)
})

test('case packs remain findable through an explicit case search', () => {
  const matcher = createProductMatcher('Case de 10 ETB')
  assert.equal(matcher({ name: 'Case de 10 ETB Origine Perdue', product_type: 'Case' }), true)
})

test('ETBs sort by exact, month, quarter, then year fallback dates', () => {
  assert.equal(getProductReleaseOrder({ release_period: 'février 2014' }), '2014-02-01')
  assert.equal(getProductReleaseOrder({ release_period: '2e trimestre 2024' }), '2024-04-01')
  assert.equal(getProductReleaseOrder({ release_year: 2025, release_period: '2025' }), '2025-12-31')

  const sorted = sortEtbsByReleaseDate([
    { name: 'A, année seule', release_year: 2025, release_period: '2025' },
    { name: 'B, date précise', release_date: '2024-05-24' },
    { name: 'C, trimestre', release_period: '1er trimestre 2025' },
  ])
  assert.deepEqual(sorted.map(item => item.name), ['B, date précise', 'C, trimestre', 'A, année seule'])
})
