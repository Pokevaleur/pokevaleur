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


test('keeps Artsets and loose boosters in their own parent format with subtypes', () => {
  const products = [
    { id: 'display', name: 'Display 36 boosters', category: 'sealed', product_type: 'Display' },
    { id: 'artset', name: 'Artset 4 boosters Écarlate et Violet – Forces Temporelles', category: 'sealed', product_type: 'Artset' },
    { id: 'loose', name: 'Booster loose – Soleil et Lune – Ultra-Prisme', category: 'sealed', product_type: 'Booster loose' },
  ]
  const items = [
    { id: 'display-item', product_id: 'display', quantity: 1 },
    { id: 'artset-item', product_id: 'artset', quantity: 1, custom_name: 'non pesés non triés sortis de display' },
    { id: 'loose-item', product_id: 'loose', quantity: 1, custom_name: 'booster loose sorti display' },
  ]

  const displays = buildSealedProductDetails(items, products, 'display')
  const boosters = buildSealedProductDetails(items, products, 'booster')

  assert.deepEqual(displays.map(item => item.collectionItemId), ['display-item'])
  assert.deepEqual(boosters.map(item => item.subtype), ['Artsets', 'Boosters à l’unité'])
  assert.deepEqual(boosters.map(item => item.collectionItemId), ['artset-item', 'loose-item'])
})

test('shows display subtypes and UPC/SPC subtypes without combining collection fiches', () => {
  const products = [
    { id: 'mini-display', name: 'Display de 10 Mini Tins', category: 'sealed', product_type: 'Display de mini-tins' },
    { id: 'kit-display', name: 'Display de 10 Kits AP', category: 'sealed', product_type: 'Display de Kits AP' },
    { id: 'booster-display', name: 'Display 36 boosters', category: 'sealed', product_type: 'Display' },
    { id: 'upc', name: 'Collection Ultra-Premium Célébrations', category: 'sealed', product_type: 'Ultra-Premium Collection' },
    { id: 'spc', name: 'Coffret SPC 8.5 Évolutions Prismatiques', category: 'sealed', product_type: 'Super-Premium Collection' },
  ]
  const items = products.map((product, i) => ({ id: `item-${i}`, product_id: product.id, quantity: i + 1 }))
  const displays = buildSealedProductDetails(items, products, 'display')
  const premium = buildSealedProductDetails(items, products, 'premiumCollection')

  assert.deepEqual(displays.map(item => item.subtype), [
    'Displays de boosters',
    'Displays de Kits AP',
    'Displays de mini-tins',
  ])
  assert.deepEqual(displays.map(item => item.collectionItemId), ['item-2', 'item-1', 'item-0'])
  assert.deepEqual(premium.map(item => item.subtype), ['SPC', 'UPC'])
  assert.deepEqual(premium.map(item => item.collectionItemId), ['item-4', 'item-3'])
  assert.deepEqual(premium.map(item => item.quantity), [5, 4])
})
