import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSealedProductDetails } from '../lib/sealed-collection-details.mjs'

test('groups catalog-linked copies by product even when names and contents differ', () => {
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
  const byName = Object.fromEntries(result.map(entry => [entry.name, entry.quantity]))

  assert.equal(result.length, 2)
  assert.equal(byName['Collection Célébrations – Dracaufeu de Peter-V'], 2)
  assert.equal(byName['Collection Premium Lucario VSTAR'], 2)
})
