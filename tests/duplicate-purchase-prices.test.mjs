import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeDuplicatePurchasePrices, summarizeDuplicateValues, summarizeDuplicateGroups } from '../lib/duplicate-purchase-prices.mjs'

test('Missing purchases do not dilute the known average or imply a gain', () => {
  const result = summarizeDuplicatePurchasePrices([
    { quantity: 2, purchase_price: 50 }, { quantity: 3, purchase_price: null },
  ], 100)
  assert.equal(result.avgBuy, 50)
  assert.equal(result.unitGain, null)
  assert.equal(result.missingPurchaseCount, 3)
})
test('The complete weighted average includes explicitly free purchases', () => {
  const result = summarizeDuplicatePurchasePrices([
    { quantity: 2, purchase_price: 30 }, { quantity: 1, purchase_price: 0 },
  ], 50)
  assert.equal(result.avgBuy, 20)
  assert.equal(result.unitGain, 30)
  assert.equal(result.missingPurchaseCount, 0)
})
test('All missing prices produce neither an average nor a gain', () => {
  const result = summarizeDuplicatePurchasePrices([{ quantity: 2, purchase_price: null }], 50)
  assert.equal(result.avgBuy, null)
  assert.equal(result.unitGain, null)
})

test('Mixed conditions retain individual values and keep the highest valued copy', () => {
  const result = summarizeDuplicateValues([
    { quantity: 1, estimatedUnitValue: 100 },
    { quantity: 2, estimatedUnitValue: 40 },
  ])
  assert.equal(result.currentValue, 60)
  assert.equal(result.estimatedSaleValue, 80)
})
test('Identical copies value only the surplus quantity', () => {
  const result = summarizeDuplicateValues([{ quantity: 4, estimatedUnitValue: 25 }])
  assert.equal(result.currentValue, 25)
  assert.equal(result.estimatedSaleValue, 75)
})

test('Unknown market values do not become zero or produce a complete estimate', () => {
  const result = summarizeDuplicateValues([
    { quantity: 1, estimatedUnitValue: 100 },
    { quantity: 2, estimatedUnitValue: null },
  ])
  assert.equal(result.currentValue, null)
  assert.equal(result.estimatedSaleValue, null)
  assert.equal(result.missingValueCount, 2)
})
test('An explicitly zero market value remains known', () => {
  const result = summarizeDuplicateValues([{ quantity: 2, estimatedUnitValue: 0 }])
  assert.equal(result.currentValue, 0)
  assert.equal(result.estimatedSaleValue, 0)
  assert.equal(result.missingValueCount, 0)
})

test('Unverified custom duplicates are counted separately and excluded from value totals', () => {
  assert.deepEqual(summarizeDuplicateGroups([
    { productId: 'known', sellable: 2, estimatedSaleValue: 80 },
    { productId: null, sellable: 3, estimatedSaleValue: 900 },
  ]), { totalDuplicates: 2, possibleDuplicates: 3, incompleteValuation: false, salePotential: 80 })
})
test('All unknown confirmed valuations remain unavailable rather than zero', () => {
  assert.deepEqual(summarizeDuplicateGroups([
    { productId: 'known', sellable: 1, estimatedSaleValue: null },
  ]), { totalDuplicates: 1, possibleDuplicates: 0, incompleteValuation: true, salePotential: null })
})
