import test from 'node:test'
import assert from 'node:assert/strict'
import { saveUploadedPhotoBatch } from '../lib/collection-photo-save.mjs'

test('A primary-photo failure keeps files already linked to the item', async () => {
  const stored = new Set(['photo-a', 'photo-b'])
  const rows = []
  await assert.rejects(saveUploadedPhotoBatch({
    paths: [...stored], link: async paths => rows.push(...paths),
    setPrimary: async () => { throw new Error('update failed') },
    remove: async paths => paths.forEach(path => stored.delete(path)),
  }), error => error.photosLinked === true)
  assert.deepEqual(rows, ['photo-a', 'photo-b'])
  assert.equal(stored.size, 2)
})
test('A failed link cleans new files and never sets the primary photo', async () => {
  let removed = []; let primary = false
  await assert.rejects(saveUploadedPhotoBatch({
    paths: ['new'], link: async () => { throw new Error('insert failed') },
    setPrimary: async () => { primary = true }, remove: async paths => { removed = paths },
  }), error => error.photosLinked === false)
  assert.deepEqual(removed, ['new'])
  assert.equal(primary, false)
})
test('Successful saving links the batch before choosing its primary photo', async () => {
  const actions = []
  await saveUploadedPhotoBatch({ paths: ['first', 'second'],
    link: async paths => actions.push(['linked', ...paths]),
    setPrimary: async path => actions.push(['primary', path]),
    remove: async () => assert.fail('must keep saved files'),
  })
  assert.deepEqual(actions, [['linked', 'first', 'second'], ['primary', 'first']])
})
