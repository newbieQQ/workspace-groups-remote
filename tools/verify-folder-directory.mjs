import assert from 'node:assert/strict'
import { createWorkspaceDirectory, remoteFolderWorkspace, validateFolderName } from '../src/client/folder-directory.ts'

const mirror = 'C:\\Users\\test\\.dsh\\remote-workspaces\\one'
const base = 'C:\\Users\\test\\.dsh\\remote-workspaces'
const ws = { mirrorPath: mirror, profileId: 'test-profile', remotePath: '~/project' }
const response = value => new Response(JSON.stringify({ ok: true, value }), { status: 200 })
const catalog = workspaces => response({ ok: true, workspaces })
let localCalls = 0
const local = async (path, name) => { localCalls++; return `${path}/${name}` }
const hint = remoteHint => new Response(JSON.stringify({ remoteHint }))
const missing = async url => url.startsWith('/workspace-groups/remote-hint?') ? hint(false) : new Response('', { status: 404 })
assert.deepEqual(await createWorkspaceDirectory('/tmp/project', 'data', base, local, missing), { path: '/tmp/project/data', remote: false })
assert.equal(localCalls, 1)
await assert.rejects(createWorkspaceDirectory(mirror, 'data', base, local, missing), /unavailable/)
assert.equal(localCalls, 1)

const calls = []
const ssh = async (url, init) => {
  calls.push({ url, body: JSON.parse(init.body), headers: init.headers })
  return url.endsWith('listWorkspaces') ? catalog([ws]) : response({ ok: true, exitCode: 0 })
}
const created = await createWorkspaceDirectory(mirror, '数据', base, local, ssh)
assert.equal(created.remote, true)
assert.equal(created.path, `${mirror}\\数据`)
assert.deepEqual(calls[1].body, { profileId: 'test-profile', path: '~/project/数据' })
assert.equal(calls[1].url, '/remote-ssh/api/mkdir')
assert.equal(calls[1].headers['X-Requested-With'], 'XMLHttpRequest')
assert.equal(localCalls, 1)
calls.length = 0
await createWorkspaceDirectory(`${mirror}\\src`, 'data', base, local, ssh)
assert.equal(calls[1].body.path, '~/project/src/data')
calls.length = 0
await createWorkspaceDirectory(mirror.toUpperCase().replaceAll('\\', '/') + '/src', 'space name', base, local, ssh)
assert.equal(calls[1].body.path, '~/project/src/space name')
let rootRequest
await createWorkspaceDirectory(mirror, 'data', base, local, async (url, init) => {
  if (url.endsWith('listWorkspaces')) return catalog([{ ...ws, remotePath: '/' }])
  rootRequest = JSON.parse(init.body)
  return response({ ok: true })
})
assert.equal(rootRequest.path, '/data')
// Non-default mirror location is recognized from the registered catalog.
assert.ok(await remoteFolderWorkspace('D:/custom', base, async () => catalog([{ ...ws, mirrorPath: 'D:\\custom' }])))
assert.equal(await remoteFolderWorkspace(`${mirror}-other`, null, async url => url.startsWith('/workspace-groups/remote-hint?') ? hint(false) : catalog([ws])), null)
// Custom mirrors and even the initial null mirror-base state are guarded by a read-only marker hint.
for (const remoteBase of [null, base]) {
  await assert.rejects(createWorkspaceDirectory('D:/custom', 'data', remoteBase, local,
    async url => url.startsWith('/workspace-groups/remote-hint?') ? hint(true) : new Response('', { status: 404 })), /marker detected/)
}
await assert.rejects(createWorkspaceDirectory('/tmp/project', 'data', base, local,
  async url => url.startsWith('/workspace-groups/remote-hint?') ? new Response('', { status: 500 }) : new Response('', { status: 404 })), /Cannot verify/)
await assert.rejects(createWorkspaceDirectory('/tmp/project', 'data', base, local,
  async url => url.startsWith('/workspace-groups/remote-hint?') ? new Response('{}') : catalog([])), /Invalid directory/)
await assert.rejects(remoteFolderWorkspace(mirror, base, async () => new Response(JSON.stringify({ ok: false, error: { message: 'denied' } }))), /denied/)
await assert.rejects(remoteFolderWorkspace(mirror, base, async () => catalog([])), /not registered/)
await assert.rejects(remoteFolderWorkspace(`${mirror}\\src`, base, async () => catalog([ws, { ...ws, mirrorPath: `${mirror}\\src` }])), /Overlapping/)
for (const value of [{ ok: true }, { ok: true, workspaces: [null] }, { ok: false, error: 'denied' }]) {
  await assert.rejects(remoteFolderWorkspace('/tmp/project', base, async () => response(value)))
}
for (const status of [403, 500]) {
  await assert.rejects(createWorkspaceDirectory('/tmp/project', 'data', base, local, async () => new Response('', { status })))
}
await assert.rejects(createWorkspaceDirectory('/tmp/project', 'data', base, local, async () => { throw new Error('network') }), /network/)
await assert.rejects(createWorkspaceDirectory('/tmp/project', 'data', base, local, async () => new Response('not json')))
for (const status of [404, 403, 500]) {
  await assert.rejects(createWorkspaceDirectory(mirror, 'data', base, local, async url => url.endsWith('listWorkspaces') ? catalog([ws]) : new Response('', { status })))
}
await assert.rejects(createWorkspaceDirectory(mirror, 'data', base, local, async url => url.endsWith('listWorkspaces') ? catalog([ws]) : response({ ok: false, stderr: 'permission denied' })), /permission denied/)
assert.equal(localCalls, 1, 'Failures must never fall back to local mkdir')
for (const name of ['', '.', '..', '/absolute', 'C:\\drive', 'nested/path', 'nested\\path', '\u0000']) {
  assert.throws(() => validateFolderName(name))
}
for (const name of ['$(whoami)', '`date`', 'a"b']) {
  await assert.rejects(createWorkspaceDirectory(mirror, name, base, local, ssh))
}
assert.equal(validateFolderName(' 中文 '), '中文')
console.log('folder-directory: all assertions passed (mocked APIs, no SSH connection)')
