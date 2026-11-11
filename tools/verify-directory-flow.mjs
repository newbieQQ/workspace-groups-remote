import assert from 'node:assert/strict'
import { directoryFlowFromEntry } from '../src/client/directory-flow.ts'
assert.equal(directoryFlowFromEntry(undefined), null)
const component = () => null
const workspaces = { create() {} }
let called = 0
const entry = { component, options: {}, inject: () => { called++; return { workspaces } } }
const flow = directoryFlowFromEntry(entry)
assert.equal(flow.component, component)
assert.equal(flow.injected.workspaces, workspaces)
assert.equal(called, 1)
assert.deepEqual(directoryFlowFromEntry({ component, options: {} }).injected, {})
for (const extra of [{ locale: 'picker' }, { store: {} }, { children: {} }, { component: null }]) {
  assert.throws(() => directoryFlowFromEntry({ ...entry, ...extra }), /unsupported renderer context/)
}
assert.throws(() => directoryFlowFromEntry({ ...entry, inject: () => { throw new Error('service unavailable') } }), /service unavailable/)
console.log('directory flow adapter: all assertions passed')
