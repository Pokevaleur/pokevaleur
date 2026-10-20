import test from 'node:test'
import assert from 'node:assert/strict'
import { createSeriesReleaseDateMap, sortProductsByRelease } from '../lib/catalogue-sort.mjs'

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


test('series dates from the card catalogue order products that lack their own date', () => {
  const seriesReleaseDates = createSeriesReleaseDateMap([
    { set_name: 'Écarlate et Violet – Aventures Ensemble', release_date: '2025-03-28' },
    { set_name: 'Écarlate et Violet – Évolutions à Paldea', release_date: '2023-06-09' },
  ])
  const products = [
    { name: 'Display de 10 Kits AP', series: 'Écarlate et Violet – Aventures Ensemble' },
    { name: 'Kit AP', series: 'Écarlate et Violet – Évolutions à Paldea' },
  ]

  assert.deepEqual(sortProductsByRelease(products, seriesReleaseDates).map(product => product.series), [
    'Écarlate et Violet – Évolutions à Paldea',
    'Écarlate et Violet – Aventures Ensemble',
  ])
})

test('combined block and expansion labels sort AP displays by actual expansion dates', () => {
  const seriesReleaseDates = createSeriesReleaseDateMap([
    { series_name: 'Écarlate et Violet', set_name: 'Écarlate et Violet', release_date: '2023-03-31' },
    { series_name: 'Écarlate et Violet', set_name: 'Évolutions à Paldea', release_date: '2023-06-09' },
    { series_name: 'Écarlate et Violet', set_name: 'Flammes Obsidiennes', release_date: '2023-08-11' },
    { series_name: 'Écarlate et Violet', set_name: 'Couronne Stellaire', release_date: '2024-09-13' },
    { series_name: 'Écarlate et Violet', set_name: 'Écarlate et Violet – Aventures Ensemble', release_date: '2025-03-28' },
    { series_name: 'Écarlate et Violet', set_name: 'Rivalités Destinées', release_date: '2025-05-30' },
  ])
  const products = [
    { name: 'Display AP Rivalités Destinées', series: 'Écarlate et Violet – Rivalités Destinées' },
    { name: 'Display AP Couronne Stellaire', series: 'Écarlate et Violet – Couronne Stellaire' },
    { name: 'Display AP Aventures Ensemble', series: 'Écarlate et Violet – Aventures Ensemble' },
    { name: 'Display AP Évolutions à Paldea', series: 'Écarlate et Violet – Évolutions à Paldea' },
    { name: 'Display AP Flammes Obsidiennes', series: 'Écarlate et Violet – Flammes Obsidiennes' },
    { name: 'Display AP Écarlate et Violet', series: 'Écarlate et Violet' },
  ]

  assert.deepEqual(sortProductsByRelease(products, seriesReleaseDates).map(product => product.name), [
    'Display AP Écarlate et Violet',
    'Display AP Évolutions à Paldea',
    'Display AP Flammes Obsidiennes',
    'Display AP Couronne Stellaire',
    'Display AP Aventures Ensemble',
    'Display AP Rivalités Destinées',
  ])
})


test('loose boosters inherit their expansion date, including shortened series labels', () => {
  const seriesReleaseDates = createSeriesReleaseDateMap([
    { series_name: 'Écarlate et Violet', set_name: 'Évolutions à Paldea', release_date: '2023-06-09' },
    { series_name: 'Écarlate et Violet', set_name: '151', release_date: '2023-09-22' },
  ])
  const products = [
    { name: 'Booster loose – Pokémon 151', series: 'Pokémon 151', product_type: 'Booster loose' },
    { name: 'Booster loose – Évolutions à Paldea', series: 'Écarlate et Violet – Évolutions à Paldea', product_type: 'Booster loose' },
  ]

  assert.deepEqual(sortProductsByRelease(products, seriesReleaseDates).map(product => product.series), [
    'Écarlate et Violet – Évolutions à Paldea',
    'Pokémon 151',
  ])
})
