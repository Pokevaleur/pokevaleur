import test from 'node:test'
import assert from 'node:assert/strict'
import { filterCollectionItems } from '../lib/collection-search.mjs'
const catalog = [{ id: 'etb', name: 'Coffret Dresseur Élite', series: '151' }, { id: 'upc', name: 'Collection Ultra Premium Dracaufeu' }]
const items = [
  { id: 'a', product_id: 'etb', seller_name: 'Élodie', sealed_condition: 'zero_defect' },
  { id: 'b', product_id: 'upc', sealed_condition: 'standard' },
  { id: 'c', custom_name: 'Coffret personnel', notes: 'cadeau anniversaire', purchase_place: 'Lyon' },
]
const ids = (query, condition) => filterCollectionItems(items, catalog, query, condition).map(item => item.id)
test('No default item list; state filter works without a query', () => {
  assert.deepEqual(ids(''), [])
  assert.deepEqual(ids('  '), [])
  assert.deepEqual(ids('', 'zero_defect'), ['a'])
  assert.deepEqual(ids('', 'standard'), ['b', 'c'])
})
test('Catalogue aliases combine with private collection fields', () => {
  assert.deepEqual(ids('ETB 151 elodie'), ['a'])
  assert.deepEqual(ids('UPC charizard'), ['b'])
  assert.deepEqual(ids('cadeau lyon'), ['c'])
  assert.deepEqual(ids('ETB', 'standard'), [])
  assert.deepEqual(ids('introuvable'), [])
})
