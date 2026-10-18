import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSealedProductDetails } from '../lib/sealed-collection-details.mjs'

test('keeps catalog-linked collection fiches separate even for the same product', () => {
  const products = [
    { id: 'charizard', name: 'Collection Célébrations – Dracaufeu de Peter-V', category: 'sealed', product_type: 'Coffret' },
    { id: 'lucario', name: 'Collection Premium Lucario VSTAR', category: 'sealed', product_type: 'Coffret' },
  ]
  const items = [
    { id: 'charizard-a', product_id: 'charizard', custom_name: 'Collection Célébrations – Dracaufeu de Peter-V', quantity: 1, booster_configuration: null },
    { id: 'charizard-b', product_id: 'charizard', custom_name: 'Autre nom saisi', quantity: 1, booster_configuration: 'Autre composition' },
    { id: 'lucario-a', product_id: 'lucario', custom_name: 'Lucario VSTAR 2022', quantity: 1 },
    { id: 'lucario-b', product_id: 'lucario', custom_name: 'Coffret Lucario VSTAR', quantity: 1 },
  ]

  const result = buildSealedProductDetails(items, products, 'coffret')
  assert.equal(result.length, 4)
  assert.deepEqual(new Set(result.map(entry => entry.collectionItemId)), new Set(items.map(item => item.id)))
  assert.deepEqual(result.map(entry => entry.quantity), [1, 1, 1, 1])
})

test('preserves quantity within each individual collection fiche', () => {
  const product = { id: 'snorlax', name: 'Coffret Pokémon – Ronflex', category: 'sealed', product_type: 'Coffret' }
  const items = [
    { id: 'ronflex-a', product_id: 'snorlax', quantity: 1 },
    { id: 'ronflex-b', product_id: 'snorlax', quantity: 1 }
  ]

  const result = buildSealedProductDetails(items, [product], 'coffret')

  assert.equal(result.length, 2)
  assert.deepEqual(result.map(entry => entry.collectionItemId), ['ronflex-a', 'ronflex-b'])
  assert.deepEqual(result.map(entry => entry.quantity), [1, 1])
})
