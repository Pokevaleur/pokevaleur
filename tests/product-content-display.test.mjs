import test from 'node:test'
import assert from 'node:assert/strict'
import { describeProductComponent, sortProductComponents } from '../lib/product-content-display.mjs'

test('un booster non aléatoire conserve sa série quand elle est connue', () => {
  assert.equal(
    describeProductComponent({ component_type: 'booster', set_name: 'Aventures Ensemble', is_random: false }),
    'Extension : Aventures Ensemble'
  )
})

test('une sélection d’extension aléatoire concerne le coffret, pas le booster lui-même', () => {
  assert.equal(
    describeProductComponent({ component_type: 'booster', set_name: null, is_random: true }),
    'Extension aléatoire dans le coffret'
  )
})

test('une extension absente de la source reste explicitement inconnue', () => {
  assert.equal(
    describeProductComponent({ component_type: 'booster', set_name: null, is_random: false }),
    'Série non précisée par la source'
  )
})

test('les composants suivent l’ordre de référence', () => {
  const rows = [{ sort_order: 3 }, { sort_order: 1 }, { sort_order: 2 }]
  assert.deepEqual(sortProductComponents(rows).map(row => row.sort_order), [1, 2, 3])
})
