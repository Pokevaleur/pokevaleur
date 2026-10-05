import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCardRarityBreakdown } from '../lib/card-rarity-statistics.mjs'

test('Rarity progress counts each target print variant once, never duplicate copies', () => {
  const breakdown = buildCardRarityBreakdown([
    { id: 'card-a', rarity_label: 'Common' },
    { id: 'card-b', rarity_label: 'Rare' },
    { id: 'card-c', rarity_label: 'Common' },
    { id: 'card-d', rarity_label: null },
    { id: 'card-e', rarity_label: 'Rare' },
  ], [
    { id: 'a-normal', card_id: 'card-a', is_master_set_target: true },
    { id: 'a-reverse', card_id: 'card-a', is_master_set_target: true },
    { id: 'b-holo', card_id: 'card-b', is_master_set_target: true },
    { id: 'c-alt', card_id: 'card-c', is_master_set_target: false },
    { id: 'd-target', card_id: 'card-d', is_master_set_target: true },
    { id: 'e-target', card_id: 'card-e', is_master_set_target: true },
  ], new Set(['a-normal', 'a-reverse', 'b-holo', 'd-target']))

  assert.deepEqual(breakdown, [
    { label: 'Common', count: 2, total: 2 },
    { label: 'Rare', count: 1, total: 2 },
    { label: 'Rareté non renseignée', count: 1, total: 1 },
  ])
})
