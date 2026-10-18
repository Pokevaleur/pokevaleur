import test from 'node:test'
import assert from 'node:assert/strict'
import { saveSealedCopyDetails } from '../lib/sealed-copy-edit.mjs'
import { calculateSealedFormatCounts, getSealedFormat } from '../lib/sealed-collection-counts.mjs'
import { buildSealedProductDetails } from '../lib/sealed-collection-details.mjs'

function client({ user = { id: 'owner' }, error = null, data = { id: 'copy' } } = {}) {
  const calls = []
  const query = {
    update(value) { calls.push(['update', value]); return this },
    eq(...value) { calls.push(['eq', ...value]); return this },
    select() { return this },
    async single() { return { data, error } },
  }
  return { calls, auth: { getUser: async () => ({ data: { user } }) }, from(table) { calls.push(['from', table]); return query } }
}

test('updates only personal fields on the authenticated owner’s copy', async () => {
  const db = client()
  await saveSealedCopyDetails(db, 'copy', { custom_name: ' Mon repère ', product_type_override: 'ETB', name: 'unsafe', product_type: 'unsafe' })
  assert.deepEqual(db.calls, [['from', 'collection_items'], ['update', { custom_name: 'Mon repère', product_type_override: 'ETB' }], ['eq', 'id', 'copy'], ['eq', 'user_id', 'owner']])
})

test('reset saves NULL; invalid drafts and expired sessions cannot write', async () => {
  const db = client()
  await saveSealedCopyDetails(db, 'copy', { custom_name: 'Repère', product_type_override: '' })
  assert.equal(db.calls[1][1].product_type_override, null)
  for (const draft of [{ custom_name: ' ', product_type_override: '' }, { custom_name: 'A', product_type_override: 'x'.repeat(201) }]) {
    await assert.rejects(saveSealedCopyDetails(client(), 'copy', draft))
  }
  const expired = client({ user: null })
  await assert.rejects(saveSealedCopyDetails(expired, 'copy', { custom_name: 'A' }))
  assert.deepEqual(expired.calls, [])
  await assert.rejects(saveSealedCopyDetails(client({ data: null }), 'copy', { custom_name: 'A' }))
})

test('personal assignment overrides conflicting catalog hints and keeps copies in separate summaries', () => {
  const product = { id: 'p', name: 'Case de displays ETB', category: 'sealed', product_type: 'Case' }
  const items = [{ id: 'a', product_id: 'p', quantity: 2 }, { id: 'b', product_id: 'p', quantity: 1, product_type_override: 'Coffret' }]
  assert.equal(getSealedFormat(items[0], product), 'case')
  assert.equal(getSealedFormat(items[1], product), 'coffret')
  const counts = calculateSealedFormatCounts(items, [product])
  assert.equal(counts.total, 3)
  assert.equal(counts.formats.find(f => f.key === 'coffret').count, 1)
  assert.equal(buildSealedProductDetails(items, [product], 'all').length, 2)
  assert.equal(getSealedFormat({ ...items[1], product_type_override: null }, product), 'case')
  assert.equal(product.product_type, 'Case')
})


test('existing personal type labels are preserved and all proposed types classify independently', async () => {
  const { sealedTypeOptions, sealedFormats } = await import('../lib/sealed-collection-counts.mjs')
  const catalog = { name: 'Case de displays ETB', product_type: 'Case' }
  sealedTypeOptions.forEach((type, index) => {
    assert.equal(getSealedFormat({ product_type_override: type, custom_name: 'Case ETB' }, catalog), sealedFormats[index].key, type)
  })
  const db = client()
  await saveSealedCopyDetails(db, 'copy', { custom_name: 'Repère', product_type_override: ' Mon type existant ' })
  assert.equal(db.calls[1][1].product_type_override, 'Mon type existant')
  assert.equal(getSealedFormat({ product_type_override: 'Mon type existant' }, catalog), 'other')
  assert.equal(getSealedFormat({ product_type_override: '  ' }, catalog), 'case')
})
