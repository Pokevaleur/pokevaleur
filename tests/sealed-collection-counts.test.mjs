import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateSealedFormatCounts } from '../lib/sealed-collection-counts.mjs'

test('counts sealed product copies by format and keeps the total reconciled', () => {
  const products = [
    { id: 'etb', category: 'sealed', product_type: 'etb', name: 'Coffret Dresseur Elite' },
    { id: 'half', category: 'sealed', product_type: 'display', name: 'Demi-display 18 boosters' },
    { id: 'mini', category: 'sealed', product_type: 'tin', name: 'Mini Tin Pokémon' },
    { id: 'valisette', category: 'sealed', product_type: '', name: 'Valisette Pokémon' },
    { id: 'kit', category: 'sealed', product_type: '', name: 'Kit d’Avant-Première' },
    { id: 'bundle', category: 'sealed', product_type: 'bundle', name: 'Booster Bundle' },
    { id: 'display', category: 'sealed', product_type: 'display', name: 'Display de boosters' },
    { id: 'pokebox', category: 'sealed', product_type: 'tin', name: 'Pokébox Pikachu' },
    { id: 'blister', category: 'sealed', product_type: 'blister', name: 'Blister de booster' },
    { id: 'coffret', category: 'sealed', product_type: '', name: 'Coffret collection' },
    { id: 'unknown', category: 'sealed', product_type: '', name: 'Objet scellé spécial' },
    { id: 'card', category: 'card', product_type: '', name: 'Carte Pokémon' },
  ]
  const items = products.map((product, index) => ({
    product_id: product.id,
    quantity: index + 1,
  }))

  const result = calculateSealedFormatCounts(items, products)
  const counts = Object.fromEntries(result.formats.map(format => [format.key, format.count]))

  assert.equal(result.total, 66)
  assert.equal(counts.etb, 1)
  assert.equal(counts.halfDisplay, 2)
  assert.equal(counts.miniTin, 3)
  assert.equal(counts.valisette, 4)
  assert.equal(counts.prereleaseKit, 5)
  assert.equal(counts.bundle, 6)
  assert.equal(counts.display, 7)
  assert.equal(counts.pokebox, 8)
  assert.equal(counts.booster, 9)
  assert.equal(counts.coffret, 10)
  assert.equal(counts.other, 11)
  assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), result.total)
})

test('ignores products outside the sealed catalog category', () => {
  const result = calculateSealedFormatCounts([
    { product_id: 'card', quantity: 3 },
    { product_id: 'sealed', quantity: 2 },
  ], [
    { id: 'card', category: 'card', product_type: 'booster', name: 'Carte' },
    { id: 'sealed', category: 'sealed', product_type: 'booster', name: 'Booster' },
  ])

  assert.equal(result.total, 2)
  assert.equal(result.formats.find(format => format.key === 'booster').count, 2)
})
