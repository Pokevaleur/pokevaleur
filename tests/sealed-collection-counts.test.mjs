import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateSealedFormatCounts } from '../lib/sealed-collection-counts.mjs'

test('counts sealed copies by parent format and keeps totals reconciled', () => {
  const products = [
    { id: 'etb', category: 'sealed', product_type: 'etb', name: 'Coffret Dresseur Elite' },
    { id: 'half', category: 'sealed', product_type: 'display', name: 'Demi-display 18 boosters' },
    { id: 'mini', category: 'sealed', product_type: 'tin', name: 'Mini Tin Pokémon' },
    { id: 'valisette', category: 'sealed', product_type: '', name: 'Valisette Pokémon' },
    { id: 'kit', category: 'sealed', product_type: '', name: 'Kit d’Avant-Première' },
    { id: 'kit-display', category: 'sealed', product_type: 'Display de kits AP', name: 'Display de 10 Kits AP Aventures Ensemble' },
    { id: 'bundle', category: 'sealed', product_type: 'bundle', name: 'Booster Bundle' },
    { id: 'display', category: 'sealed', product_type: 'display', name: 'Display de boosters' },
    { id: 'pokebox', category: 'sealed', product_type: 'tin', name: 'Pokébox Pikachu' },
    { id: 'blister', category: 'sealed', product_type: 'blister', name: 'Blister de booster' },
    { id: 'coffret', category: 'sealed', product_type: '', name: 'Coffret collection' },
    { id: 'unknown', category: 'sealed', product_type: '', name: 'Objet scellé spécial' },
    { id: 'card', category: 'card', product_type: '', name: 'Carte Pokémon' },
  ]
  const items = products.map((product, index) => ({ product_id: product.id, quantity: index + 1 }))
  const result = calculateSealedFormatCounts(items, products)
  const counts = Object.fromEntries(result.formats.map(format => [format.key, format.count]))

  assert.equal(result.total, 78)
  assert.equal(counts.etb, 1)
  assert.equal(counts.display, 16)
  assert.equal(counts.miniTin, 3)
  assert.equal(counts.valisette, 4)
  assert.equal(counts.prereleaseKit, 5)
  assert.equal(counts.bundle, 7)
  assert.equal(counts.pokebox, 9)
  assert.equal(counts.booster, 10)
  assert.equal(counts.coffret, 11)
  assert.equal(counts.other, 12)
  assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), result.total)
})

test('displays remain separate from their individual contents', () => {
  const products = [
    { id: 'kit', category: 'sealed', product_type: 'Kit Avant-première', name: 'Kit AP Écarlate et Violet – Aventures Ensemble' },
    { id: 'display-bundles', category: 'sealed', product_type: 'Display de bundles', name: 'Display de 10 booster bundles – Aventures Ensemble' },
  ]
  const result = calculateSealedFormatCounts([
    { product_id: 'kit', quantity: 2 },
    { product_id: 'display-bundles', quantity: 1, custom_name: 'Display bundle Kit AP EV09 Aventures Ensemble' },
  ], products)
  const counts = Object.fromEntries(result.formats.map(format => [format.key, format.count]))

  assert.equal(counts.prereleaseKit, 2)
  assert.equal(counts.display, 1)
  assert.equal(result.total, 3)
})

test('a Case stays separate and a coffret-typed Pokébox remains a coffret', () => {
  const products = [
    { id: 'case', category: 'sealed', product_type: 'Case', name: 'Case de Pokébox Dracaufeu X et Y', case_unit_count: 6 },
    { id: 'coffret', category: 'sealed', product_type: 'Coffret Pokémon-V', name: 'Pokébox Destinées Radieuses – Fulgudog-V' },
    { id: 'pokebox', category: 'sealed', product_type: 'Pokébox', name: 'Pokébox Amphinobi EX' },
  ]
  const result = calculateSealedFormatCounts([
    { product_id: 'case', quantity: 1 },
    { product_id: 'coffret', quantity: 2 },
    { product_id: 'pokebox', quantity: 3 },
  ], products)
  const counts = Object.fromEntries(result.formats.map(format => [format.key, format.count]))

  assert.equal(counts.case, 1)
  assert.equal(counts.coffret, 2)
  assert.equal(counts.pokebox, 3)
  assert.equal(result.total, 6)
})


test('a personal type override controls the parent format despite catalog wording', () => {
  const result = calculateSealedFormatCounts([
    { product_id: 'mixed-name', quantity: 1, product_type_override: 'Booster' },
  ], [
    { id: 'mixed-name', category: 'sealed', product_type: 'Display', name: 'Display de 36 boosters' },
  ])
  const counts = Object.fromEntries(result.formats.map(format => [format.key, format.count]))

  assert.equal(counts.booster, 1)
  assert.equal(counts.display, 0)
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

test('groups UPC and SPC together while allowing a personal UPC type', () => {
  const products = [
    { id: 'upc', category: 'sealed', product_type: 'Ultra-Premium Collection', name: 'Collection Ultra-Premium Célébrations' },
    { id: 'spc', category: 'sealed', product_type: 'Super-Premium Collection', name: 'Collection Super-Premium Évolutions Prismatiques' },
    { id: 'manual', category: 'sealed', product_type: '', name: 'Produit scellé personnalisé' },
  ]
  const result = calculateSealedFormatCounts([
    { product_id: 'upc', quantity: 2 },
    { product_id: 'spc', quantity: 3 },
    { product_id: 'manual', quantity: 1, product_type_override: 'UPC' },
  ], products)
  const counts = Object.fromEntries(result.formats.map(format => [format.key, format.count]))

  assert.equal(counts.premiumCollection, 6)
  assert.equal(counts.other, 0)
  assert.equal(result.formats.find(format => format.key === 'premiumCollection').label, 'Collections Premium')
  assert.equal(result.total, 6)
})
