import test from 'node:test'
import assert from 'node:assert/strict'
import { selectWatchlistOffer } from '../lib/watchlist-offers.mjs'

test('Offer ranking includes shipping rather than the item price alone', () => {
  const result = selectWatchlistOffer([
    { id: 'a', currency: 'EUR', price: 40, shipping_price: 20 },
    { id: 'b', currency: 'EUR', price: 50, shipping_price: 0 },
  ], 55)
  assert.equal(result.bestOffer.id, 'b')
  assert.equal(result.bestOffer.comparableTotal, 50)
  assert.equal(result.opportunity, true)
})
test('Unknown totals and foreign currencies cannot trigger an opportunity', () => {
  const result = selectWatchlistOffer([
    { currency: 'EUR', price: null, total_price: null },
    { currency: 'EUR', price: 10, shipping_price: null },
    { currency: 'USD', total_price: 5 },
  ], 20)
  assert.equal(result.bestOffer, null)
  assert.equal(result.opportunity, false)
})
test('An explicit euro total and a zero target are supported', () => {
  assert.equal(selectWatchlistOffer([{ currency: 'EUR', total_price: 0 }], 0).opportunity, true)
  assert.equal(selectWatchlistOffer([{ currency: 'EUR', total_price: 5 }], null).opportunity, false)
})
