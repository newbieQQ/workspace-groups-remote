/**
 * Client persist-layer tests: the wire document carries the host-owned
 * revision, a successful save adopts the host echo, a stale save surfaces a
 * typed conflict with the host's current document, and the remote-record
 * deletion helper speaks the SSH plugin's RPC shape.
 */
import { describe, expect, it } from 'vitest'
import { FoldersConflictError, loadFolders, saveFolders } from '../src/client/folders-persist.ts'
import { deleteRemoteWorkspaceRecord } from '../src/client/folder-directory.ts'

function stubFetch(status: number, body: unknown, capture?: (url: string, init?: RequestInit) => void): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    capture?.(url, init)
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as unknown as Response
  }) as unknown as typeof fetch
}

describe('loadFolders revision', () => {
  it('carries the stored revision, defaulting an absent one to 0', async () => {
    const withRevision = await loadFolders(stubFetch(200, { version: 1, revision: 7, workspaces: {} }))
    expect(withRevision.document.revision).toBe(7)
    const without = await loadFolders(stubFetch(200, { version: 1, workspaces: {} }))
    expect(without.document.revision).toBe(0)
  })
})

describe('saveFolders', () => {
  it('resolves with the host echo (bumped revision)', async () => {
    const echo = { version: 1, revision: 3, workspaces: { a: { folders: ['/x'] } } }
    const stored = await saveFolders({ version: 1, revision: 2, workspaces: { a: { folders: ['/x'] } } }, stubFetch(200, echo))
    expect(stored).toEqual(echo)
  })
  it('rejects with FoldersConflictError carrying the current document on 409', async () => {
    const current = { version: 1, revision: 5, workspaces: {} }
    const failure = await saveFolders({ version: 1, revision: 2, workspaces: {} }, stubFetch(409, current)).catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(FoldersConflictError)
    expect((failure as FoldersConflictError).current).toEqual(current)
  })
})

describe('deleteRemoteWorkspaceRecord', () => {
  it('posts deleteWorkspace with the record id and resolves on the ok envelope', async () => {
    let url = ''
    let body: unknown
    await deleteRemoteWorkspaceRecord('rec-1', stubFetch(200, { ok: true, value: { ok: true } }, (u, init) => {
      url = u
      body = JSON.parse(String(init?.body))
    }))
    expect(url).toBe('/remote-ssh/api/deleteWorkspace')
    expect(body).toEqual({ id: 'rec-1' })
  })
  it('rejects when the plugin reports an error', async () => {
    await expect(deleteRemoteWorkspaceRecord('rec-1', stubFetch(200, { ok: true, value: { ok: false, error: 'no such workspace' } })))
      .rejects.toThrow(/no such workspace/)
  })
  it('rejects an empty record id without calling the plugin', async () => {
    await expect(deleteRemoteWorkspaceRecord('  ', stubFetch(200, { ok: true, value: { ok: true } }))).rejects.toThrow(/No remote/)
  })
})
