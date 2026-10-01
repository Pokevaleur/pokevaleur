import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePostLoginPath } from '../lib/post-login-path.mjs'

const origin = 'https://www.pokevaleur.fr'
test('the current product takes precedence over a saved invitation', () => {
  assert.equal(resolvePostLoginPath(origin, '/collection?product=selected', '/collection/rejoindre?token=old'), '/collection?product=selected')
})
test('a saved invitation still works without a current destination', () => {
  assert.equal(resolvePostLoginPath(origin, null, '/collection/rejoindre?token=saved'), '/collection/rejoindre?token=saved')
})
test('external destinations and lookalike paths are rejected', () => {
  for (const path of ['https://example.org/collection', '//example.org/collection', '/collection-fake', 'javascript:alert(1)']) {
    assert.equal(resolvePostLoginPath(origin, path, null), '/collection')
  }
})
