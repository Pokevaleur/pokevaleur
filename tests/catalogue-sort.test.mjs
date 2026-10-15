import test from 'node:test'
import assert from 'node:assert/strict'
import { sortProductsByRelease } from '../lib/catalogue-sort.mjs'

test('catalogue results follow chronological product release dates', () => {
  const products = [
    { name: 'Display EV3', release_date: '2024-02-23' },
    { name: 'Display EV1', release_date: '2023-09-22' },
    { name: 'Display EV2', release_date: '2023-12-01' },
  ]

  assert.deepEqual(sortProductsByRelease(products).map(product => product.name), [
    'Display EV1', 'Display EV2', 'Display EV3',
  ])
})

test('explicit EV labels sort numerically when release dates are absent', () => {
  const products = [
    { name: 'Display EV10' },
    { name: 'Display EV2' },
    { name: 'Display EV1' },
    { name: 'Display EV10.5' },
  ]

  assert.deepEqual(sortProductsByRelease(products).map(product => product.name), [
    'Display EV1', 'Display EV2', 'Display EV10', 'Display EV10.5',
  ])
})

test('release periods provide a chronological fallback and undated items follow dated ones', () => {
  const products = [
    { name: 'Produit inconnu' },
    { name: 'Série tardive', release_period: '2024-03' },
    { name: 'Série ancienne', release_period: '2023-08' },
  ]

  assert.deepEqual(sortProductsByRelease(products).map(product => product.name), [
    'Série ancienne', 'Série tardive', 'Produit inconnu',
  ])
})
