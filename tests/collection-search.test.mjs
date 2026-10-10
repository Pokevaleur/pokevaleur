import test from 'node:test'
import assert from 'node:assert/strict'
import { filterCollectionItems } from '../lib/collection-search.mjs'
const catalog = [
  { id: 'etb', name: 'Coffret Dresseur Élite', series: '151', product_type: 'ETB' },
  { id: 'etb-case', name: 'Case de 10 Coffret Dresseur Élite 151', series: '151', product_type: 'Case', case_unit_product_type: 'ETB' },
  { id: 'gift-box', name: 'Coffret figurine Pikachu', series: '151', product_type: 'Collection figurine' },
  { id: 'upc', name: 'Collection Ultra Premium Dracaufeu' },
]
const items = [
  { id: 'a', product_id: 'etb', seller_name: 'Élodie', sealed_condition: 'zero_defect' },
  { id: 'b', product_id: 'upc', sealed_condition: 'standard' },
  { id: 'd', product_id: 'etb-case', sealed_condition: 'standard' },
  { id: 'e', product_id: 'gift-box', sealed_condition: 'standard' },
  { id: 'c', custom_name: 'Coffret personnel', notes: 'cadeau anniversaire', purchase_place: 'Lyon' },
]
const ids = (query, condition) => filterCollectionItems(items, catalog, query, condition).map(item => item.id)
test('No default item list; state filter works without a query', () => {
  assert.deepEqual(ids(''), [])
  assert.deepEqual(ids('  '), [])
  assert.deepEqual(ids('', 'zero_defect'), ['a'])
  assert.deepEqual(ids('', 'standard'), ['b', 'd', 'e', 'c'])
})
test('Catalogue aliases combine with private collection fields', () => {
  assert.deepEqual(ids('ETB 151 elodie'), ['a'])
  assert.deepEqual(ids('UPC charizard'), ['b'])
  assert.deepEqual(ids('cadeau lyon'), ['c'])
  assert.deepEqual(ids('ETB', 'standard'), ['d'])
  assert.deepEqual(ids('introuvable'), [])
})

test('The Coffret shortcut excludes ETBs and cases of ETBs, while ETB keeps them accessible', () => {
  assert.deepEqual(filterCollectionItems(items, catalog, 'Coffret', 'all', 'Coffret').map(item => item.id), ['b', 'e', 'c'])
  assert.deepEqual(filterCollectionItems(items, catalog, 'ETB', 'all', 'ETB').map(item => item.id), ['a', 'd'])
})
