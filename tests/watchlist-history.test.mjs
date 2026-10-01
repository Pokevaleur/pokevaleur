import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeWatchlistHistory } from '../lib/watchlist-history.mjs'
const now = Date.parse('2026-10-01T12:00:00Z')
const dated = (days, price) => ({ observed_at: new Date(now - days * 86400000).toISOString(), price })
test('Watchlist history excludes future dates, invalid dates and unknown prices', () => {
  const result = summarizeWatchlistHistory([
    dated(1, 50), dated(-1, 1), dated(91, 2), dated(1, null),
    { observed_at: 'invalid', price: 3 }, { observed_at: null, price: 4 },
  ], now)
  assert.deepEqual(result, { median90: 50, low30: 50, sales90: 1 })
})
test('Thirty and ninety day boundaries are inclusive and zero is a known price', () => {
  const result = summarizeWatchlistHistory([dated(30, 0), dated(90, 100), dated(31, 50)], now)
  assert.deepEqual(result, { median90: 50, low30: 0, sales90: 3 })
  assert.deepEqual(summarizeWatchlistHistory([], now), { median90: null, low30: null, sales90: 0 })
})
