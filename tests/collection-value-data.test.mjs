import test from 'node:test'
import assert from 'node:assert/strict'
import { getSealedItemValue } from '../lib/collection-value-data.js'

test('a personal valuation overrides the catalogue for a sealed item', () => {
  assert.equal(getSealedItemValue({ current_value_override: 42, sealed_condition: 'standard' }, { current_value: 55 }), 42)
})

test('sealed items use the zero-defect catalogue value when selected', () => {
  assert.equal(getSealedItemValue({ current_value_override: null, sealed_condition: 'zero_defect' }, { current_value: 50, zero_defect_value: 65 }), 65)
})

test('missing sealed prices remain unavailable instead of falling back to purchase price', () => {
  assert.equal(getSealedItemValue({ current_value_override: null, purchase_price: 80, sealed_condition: 'standard' }, { current_value: null }), null)
})

test('a zero personal valuation is retained as an explicit value', () => {
  assert.equal(getSealedItemValue({ current_value_override: 0 }, { current_value: 55 }), 0)
})
