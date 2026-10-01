import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchAllRows } from '../lib/supabase-pagination.js'

test('Loading spans multiple pages instead of truncating the latest data', async () => {
  const source = Array.from({ length: 1201 }, (_, id) => ({ id }))
  const result = await fetchAllRows(() => ({ range: async (start, end) => ({ data: source.slice(start, end + 1), error: null }) }))
  assert.equal(result.data.length, 1201)
  assert.equal(result.data.at(-1).id, 1200)
})
test('A later-page failure returns an error rather than a misleading partial result', async () => {
  const error = { message: 'network failed' }
  const result = await fetchAllRows(() => ({ range: async start => start === 0
    ? { data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null }
    : { data: null, error } }))
  assert.equal(result.data, null)
  assert.equal(result.error, error)
})
