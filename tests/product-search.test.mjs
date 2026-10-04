import test from 'node:test'
import assert from 'node:assert/strict'
import { createProductMatcher } from '../lib/product-search.mjs'

const products = [
  { name: 'Coffret Dresseur d’élite Écarlate et Violet – 151', product_type: 'ETB' },
  { name: 'Coffret Dresseur d’élite Célébrations', product_type: 'ETB' },
  { name: 'Demi-display 18 boosters Méga Évolution' },
  { name: 'Display 36 boosters Méga Évolution' },
  { name: 'Collection Ultra-Premium Dracaufeu' },
  { name: 'Collection Ultra-Premium Arceus' },
  { name: 'Coffret 30e Anniversaire – Nymphali-ex' },
  { name: 'Coffret 30e Anniversaire – Amphinobi-ex' },
  { name: 'Coffret Collection K.O.' },
  { name: 'Mini-boîte Évoli' },
]
const found = query => products.filter(createProductMatcher(query)).map(product => product.name)

test('an empty or whitespace query never shows the catalogue', () => {
  assert.deepEqual(found(''), [])
  assert.deepEqual(found('   '), [])
})
test('aliases preserve the series criterion and accept a different word order', () => {
  for (const query of ['ETB 151', '151 ETB', 'coffret dresseur 151', 'élite trainer box 151']) {
    assert.deepEqual(found(query), [products[0].name])
  }
})
test('half displays do not expand to full displays', () => {
  assert.deepEqual(found('demie-display mega evolution'), [products[2].name])
  assert.deepEqual(found('half display'), [products[2].name])
})
test('UPCs and anniversary aliases retain the requested Pokémon', () => {
  assert.deepEqual(found('UPC Dracaufeu'), [products[4].name])
  assert.deepEqual(found('30 ans Nymphali'), [products[6].name])
  assert.deepEqual(found('30ans Amphinobi'), [products[7].name])
})
test('short anniversary searches recognize 30e without matching unrelated numbers', () => {
  for (const query of ['30', '3 0', '30e']) {
    assert.deepEqual(found(query), [products[6].name, products[7].name, products[8].name])
    assert.equal(createProductMatcher(query)({ name: 'Lot de 130 boosters' }), false)
  }
  assert.deepEqual(found('30 Nymphali'), [products[6].name])
  assert.deepEqual(found('3 0 Amphinobi'), [products[7].name])
  assert.deepEqual(found('collection ko'), [products[8].name])
})
test('punctuation, accents and whole alias words are handled', () => {
  assert.deepEqual(found('collection ko'), [products[8].name])
  assert.deepEqual(found('mini tin evoli'), [products[9].name])
  assert.deepEqual(found('tin'), [products[9].name]) // Generic metal-box search includes mini-tins, never Destinées.
  assert.deepEqual(found('produit inexistant'), [])
})

test('metal box formats stay distinct and tin includes the whole family', () => {
  const boxes = [
    {name:'Mini-tin 151', product_type:'Mini-tin'},
    {name:'Mini-boîte Évoli', product_type:'Mini-tin'},
    {name:'Pokébox Mew', product_type:'Pokébox'},
    {name:'Boîte Lucario', product_type:'Tin'},
    {name:'Valisette Arceus', product_type:'Valisette'},
    {name:'Boîte Poké Ball', product_type:'Poké Ball tin'},
    {name:'Coffret Destinées Radieuses'},
    {name:'Boîte Énergies de base', product_type:'Boîte Énergies'},
  ]
  const search=q=>boxes.filter(createProductMatcher(q)).map(p=>p.name)
  assert.deepEqual(search('mini-tin'),boxes.slice(0,2).map(p=>p.name))
  assert.deepEqual(search('mini boîte'),search('mini-tin'))
  assert.deepEqual(search('pokebox'),boxes.slice(2,4).map(p=>p.name))
  assert.deepEqual(search('valizette'),[boxes[4].name])
  assert.deepEqual(search('valisette'),[boxes[4].name])
  assert.deepEqual(search('tin'),boxes.slice(0,6).map(p=>p.name))
  assert.deepEqual(search('mini tin 151'),[boxes[0].name])
})
