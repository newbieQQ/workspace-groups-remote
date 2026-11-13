/**
 * Remote-SSH settings — pure-model behaviour.
 *
 * These tests pin the real semantics the new settings face relies on:
 * the exact Host payloads, per-item import outcomes (never "selected size"
 * reported as success), GiB/bytes conversion with the empty = Host-default
 * convention, unsaved-draft reconciliation, and the connection-test verdict
 * that keeps a successful probe with a warning as a warning.
 */
import { describe, expect, it, vi } from 'vitest'
import type { GuardDraft, ImportSummary, PrefsDraft } from '../src/client/rssh-settings/model.ts'
import type { RemoteSshWorkspace, SshConfigHost } from '../src/client/rssh-settings/contract.ts'
import {
  apiErrorMessage,
  bytesToGibText,
  connectionTestView,
  countSelected,
  emptyConnectionForm,
  gibTextToBytes,
  guardDraftFromWorkspace,
  guardDraftSignature,
  guardsFromWorkspaces,
  importHostKey,
  importProfilePayload,
  isConnectionFormValid,
  isGuardDraftDirty,
  isPrefsDraftDirty,
  mergeImportRetry,
  prefsDraftFromApi,
  reconcileGuards,
  reconcilePrefs,
  runImport,
  selectAllHosts,
  selectedHosts,
  splitList,
  toSavePrefsPayload,
  toSaveProfilePayload,
  toUpdateWorkspaceGuardsPayload,
  toggleHostSelection,
  validateConnectionForm,
} from '../src/client/rssh-settings/model.ts'
import type { SaveProfilePayload } from '../src/client/rssh-settings/contract.ts'

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const HOSTS: SshConfigHost[] = [
  {
    name: 'alpha',
    hostName: 'alpha.example.com',
    port: 2222,
    user: 'alice',
    identityFile: '~/.ssh/alpha',
    proxyJump: 'bastion.example.com',
  },
  { name: 'beta', hostName: 'beta.example.com', user: 'bob' },
  { name: 'gamma', hostName: 'gamma.example.com' },
]

function hostSummary(hosts: SshConfigHost[]): string[] {
  return hosts.map(importHostKey)
}

function makeSaveProfile(
  results: Array<{ ok?: boolean; error?: string } | null | undefined | Error>,
) {
  return vi.fn(async (_payload: SaveProfilePayload) => {
    const next = results.shift()
    if (next instanceof Error) throw next
    return next
  })
}

const WS: RemoteSshWorkspace = {
  id: 'ws-1',
  profileId: 'p-1',
  title: 'Alpha',
  remotePath: '~/project',
  writeBack: true,
  writeBackExclude: ['_patch/', '*.log'],
  syncPaths: ['.dsh'],
  syncExclude: ['data/'],
  syncMaxBytes: 2147483648,
}

/* ------------------------------------------------------------------ */
/* Connection form → saveProfile payload                               */
/* ------------------------------------------------------------------ */

describe('connection form validation and saveProfile payload', () => {
  it('accepts the default form: empty keyPath is legal (ssh-agent / ~/.ssh/config)', () => {
    const form = emptyConnectionForm()
    form.host = 'login.example.com'
    form.user = 'alice'
    expect(validateConnectionForm(form)).toEqual([])
    expect(isConnectionFormValid(form)).toBe(true)

    const payload = toSaveProfilePayload(form)
    expect(payload.keyPath).toBe('')
    expect(payload.port).toBe(22)
    expect(payload.authMethod).toBe('key')
  })

  it('rejects an invalid port instead of silently falling back to 22', () => {
    for (const port of ['', 'abc', '0', '65536', '-1', '22.5', '22abc']) {
      const form = { ...emptyConnectionForm(), host: 'h', user: 'u', port }
      const issues = validateConnectionForm(form)
      expect(issues, `port=${JSON.stringify(port)}`).toContainEqual({
        field: 'port',
        messageKey: 'add.errPort',
      })
      expect(isConnectionFormValid(form), `port=${JSON.stringify(port)}`).toBe(false)
    }

    const form = { ...emptyConnectionForm(), host: 'h', user: 'u', port: ' 22 ' }
    expect(validateConnectionForm(form)).toEqual([])
    expect(toSaveProfilePayload(form).port).toBe(22)
  })

  it('reports host and user as required, together with the port issue', () => {
    const form = { ...emptyConnectionForm(), host: '   ', user: '', port: 'x' }
    expect(validateConnectionForm(form)).toEqual([
      { field: 'host', messageKey: 'add.errHost' },
      { field: 'user', messageKey: 'add.errUser' },
      { field: 'port', messageKey: 'add.errPort' },
    ])
  })

  it('keeps both draft fields across key/password auth switching (same form state)', () => {
    const keyForm = {
      ...emptyConnectionForm(),
      host: 'h',
      user: 'u',
      authMethod: 'key' as const,
      keyPath: '~/.ssh/id_ed25519',
      password: 'hunter2',
    }
    const keyPayload = toSaveProfilePayload(keyForm)
    expect(keyPayload.authMethod).toBe('key')
    expect(keyPayload.keyPath).toBe('~/.ssh/id_ed25519')
    expect(keyPayload.password).toBe('hunter2')

    const passwordForm = { ...keyForm, authMethod: 'password' as const }
    const passwordPayload = toSaveProfilePayload(passwordForm)
    expect(passwordPayload.authMethod).toBe('password')
    expect(passwordPayload.keyPath).toBe('~/.ssh/id_ed25519')
    expect(passwordPayload.password).toBe('hunter2')
  })

  it('carries every saveProfile field, including proxyJump and a real numeric port', () => {
    const form = {
      name: 'HPC',
      host: 'login.example.com',
      port: '2222',
      user: 'alice',
      authMethod: 'password' as const,
      keyPath: '',
      password: 'secret',
      remoteRoot: '~/project',
      proxyJump: 'bastion.example.com:22',
    }
    expect(toSaveProfilePayload(form)).toEqual({
      name: 'HPC',
      host: 'login.example.com',
      port: 2222,
      user: 'alice',
      authMethod: 'password',
      keyPath: '',
      password: 'secret',
      remoteRoot: '~/project',
      proxyJump: 'bastion.example.com:22',
    })
  })
})

/* ------------------------------------------------------------------ */
/* SSH config import                                                   */
/* ------------------------------------------------------------------ */

describe('SSH config import — per-item outcomes', () => {
  it('maps a discovered host to the exact saveProfile payload (incl. proxyJump)', () => {
    expect(importProfilePayload(HOSTS[0] as SshConfigHost)).toEqual({
      name: 'alpha',
      host: 'alpha.example.com',
      port: 2222,
      user: 'alice',
      authMethod: 'key',
      keyPath: '~/.ssh/alpha',
      password: '',
      remoteRoot: '~',
      proxyJump: 'bastion.example.com',
    })
    expect(importProfilePayload(HOSTS[2] as SshConfigHost)).toMatchObject({
      port: 22,
      user: '',
      keyPath: '',
      proxyJump: '',
    })
  })

  it('counts every success only when every save resolves ok', async () => {
    const save = makeSaveProfile([{ ok: true }, { ok: true }, { ok: true }])
    const summary = await runImport(HOSTS, save)

    expect(save).toHaveBeenCalledTimes(3)
    expect(save.mock.calls.map(call => call[0].name)).toEqual(['alpha', 'beta', 'gamma'])
    expect(summary.okCount).toBe(3)
    expect(summary.failCount).toBe(0)
    expect(summary.failedHosts).toEqual([])
    expect(summary.outcomes.every(outcome => outcome.ok)).toBe(true)
  })

  it('reports real partial failures (ok:false + error text), never the selection size', async () => {
    const save = makeSaveProfile([
      { ok: true },
      { ok: false, error: '  duplicate host  ' },
      { ok: false, error: 'boom' },
    ])
    const summary = await runImport(HOSTS, save)

    expect(summary.okCount).toBe(1)
    expect(summary.failCount).toBe(2)
    expect(summary.outcomes.map(outcome => outcome.ok)).toEqual([true, false, false])
    expect(summary.outcomes[1]?.error).toBe('duplicate host')
    expect(summary.outcomes[2]?.error).toBe('boom')
    expect(hostSummary(summary.failedHosts)).toEqual(hostSummary([HOSTS[1]!, HOSTS[2]!]))
  })

  it('reports every failure when all saves fail', async () => {
    const save = makeSaveProfile([
      { ok: false, error: 'one' },
      { ok: false, error: 'two' },
      { ok: false, error: 'three' },
    ])
    const summary = await runImport(HOSTS, save)

    expect(summary.okCount).toBe(0)
    expect(summary.failCount).toBe(3)
    expect(hostSummary(summary.failedHosts)).toEqual(hostSummary(HOSTS))
    expect(summary.outcomes.map(outcome => outcome.error)).toEqual(['one', 'two', 'three'])
  })

  it('turns thrown request errors into failures with the thrown message', async () => {
    const save = makeSaveProfile([{ ok: true }, new Error('network down'), { ok: false, error: 'denied' }])
    const summary = await runImport(HOSTS, save)

    expect(summary.okCount).toBe(1)
    expect(summary.failCount).toBe(2)
    expect(summary.outcomes[1]?.ok).toBe(false)
    expect(summary.outcomes[1]?.error).toBe('network down')
    expect(hostSummary(summary.failedHosts)).toEqual(hostSummary([HOSTS[1]!, HOSTS[2]!]))
  })

  it('treats an undefined/null save result as failure (no-result), never as imported', async () => {
    const save = makeSaveProfile([undefined, null])
    const summary = await runImport(HOSTS.slice(0, 2), save)

    expect(save).toHaveBeenCalledTimes(2)
    expect(summary.okCount).toBe(0)
    expect(summary.failCount).toBe(2)
    expect(summary.outcomes.map(outcome => outcome.ok)).toEqual([false, false])
    expect(summary.outcomes.map(outcome => outcome.errorCode)).toEqual(['no-result', 'no-result'])
    expect(summary.outcomes.every(outcome => outcome.error === undefined)).toBe(true)
    expect(summary.failedHosts).toHaveLength(2)
  })

  it('treats ok:false without error text as a failure too', async () => {
    const summary = await runImport([HOSTS[1] as SshConfigHost], makeSaveProfile([{ ok: false }]))
    expect(summary.okCount).toBe(0)
    expect(summary.failCount).toBe(1)
    expect(summary.outcomes[0]?.errorCode).toBe('no-result')
  })

  it('an empty selection imports nothing and calls no endpoint', async () => {
    const save = makeSaveProfile([])
    const summary = await runImport([], save)
    expect(save).not.toHaveBeenCalled()
    expect(summary).toEqual({ outcomes: [], okCount: 0, failCount: 0, failedHosts: [] })
  })

  it('reports progress per host only through the injected callback', async () => {
    const progress: string[] = []
    const summary = await runImport(HOSTS.slice(0, 2), makeSaveProfile([{ ok: true }, { ok: false }]), {
      onProgress: (done, total, host) => progress.push(`${done}/${total}:${host.name}`),
    })
    expect(progress).toEqual(['0/2:alpha', '1/2:beta', '2/2:beta'])
    expect(summary.failCount).toBe(1)
  })
})

describe('failed-only retry merge', () => {
  it('does not resubmit successful items and keeps their success count', async () => {
    const firstSave = makeSaveProfile([{ ok: true }, { ok: false, error: 'timeout' }, { ok: false, error: 'x' }])
    const first = await runImport(HOSTS, firstSave)

    const retrySave = makeSaveProfile([{ ok: true }, { ok: true }])
    const retry = await runImport(first.failedHosts, retrySave)

    expect(retrySave).toHaveBeenCalledTimes(2)
    expect(retrySave.mock.calls.map(call => call[0].name)).toEqual(['beta', 'gamma'])
    expect(firstSave).toHaveBeenCalledTimes(3)
    expect(firstSave.mock.calls.map(call => call[0].name)).toEqual(['alpha', 'beta', 'gamma'])

    const merged = mergeImportRetry(first, retry)
    expect(merged.okCount).toBe(3)
    expect(merged.failCount).toBe(0)
    expect(merged.failedHosts).toEqual([])
    expect(merged.outcomes).toHaveLength(3)
    expect(merged.outcomes.every(outcome => outcome.ok)).toBe(true)
  })

  it('keeps a still-failing retry item as failed with its retry reason', async () => {
    const first = await runImport(
      HOSTS,
      makeSaveProfile([{ ok: true }, { ok: false, error: 'timeout' }, { ok: false, error: 'nope' }]),
    )
    const retry = await runImport(first.failedHosts, makeSaveProfile([{ ok: false, error: 'still bad' }, { ok: true }]))

    const merged = mergeImportRetry(first, retry)
    expect(merged.okCount).toBe(2)
    expect(merged.failCount).toBe(1)
    expect(hostSummary(merged.failedHosts)).toEqual(hostSummary([HOSTS[1] as SshConfigHost]))
    expect(merged.outcomes).toHaveLength(3)
    expect(merged.outcomes.filter(outcome => !outcome.ok)[0]?.error).toBe('still bad')
  })

  it('a fully failed retry keeps the merged summary fully failed', () => {
    const previous: ImportSummary = {
      outcomes: [
        { key: 'a|h', name: 'a', hostName: 'h', ok: false, error: 'first' },
        { key: 'b|h2', name: 'b', hostName: 'h2', ok: false, error: 'second' },
      ],
      okCount: 0,
      failCount: 2,
      failedHosts: [HOSTS[0] as SshConfigHost, HOSTS[1] as SshConfigHost],
    }
    const retry: ImportSummary = {
      outcomes: [
        { key: 'a|h', name: 'a', hostName: 'h', ok: false, errorCode: 'no-result' },
        { key: 'b|h2', name: 'b', hostName: 'h2', ok: false, error: 'second' },
      ],
      okCount: 0,
      failCount: 2,
      failedHosts: [HOSTS[0] as SshConfigHost, HOSTS[1] as SshConfigHost],
    }
    const merged = mergeImportRetry(previous, retry)
    expect(merged.okCount).toBe(0)
    expect(merged.failCount).toBe(2)
    expect(merged.failedHosts).toHaveLength(2)
    expect(merged.outcomes.every(outcome => !outcome.ok)).toBe(true)
  })
})

describe('host selection', () => {
  it('selects nothing when every row is unchecked', () => {
    const selected = { [importHostKey(HOSTS[0]!)]: false, [importHostKey(HOSTS[1]!)]: false }
    expect(selectedHosts(HOSTS, selected)).toEqual([])
    expect(countSelected(selected)).toBe(0)
  })

  it('selects all discovered hosts by default and counts only checked rows', () => {
    const selected = selectAllHosts(HOSTS)
    expect(countSelected(selected)).toBe(3)
    expect(hostSummary(selectedHosts(HOSTS, selected))).toEqual(hostSummary(HOSTS))

    const toggled = toggleHostSelection(selected, importHostKey(HOSTS[1]!))
    expect(toggled[importHostKey(HOSTS[1]!)]).toBe(false)
    expect(countSelected(toggled)).toBe(2)
    expect(hostSummary(selectedHosts(HOSTS, toggled))).toEqual(
      hostSummary([HOSTS[0] as SshConfigHost, HOSTS[2] as SshConfigHost]),
    )
  })

  it('treats an empty selection map as no selection', () => {
    expect(selectedHosts(HOSTS, {})).toEqual([])
    expect(countSelected({})).toBe(0)
  })
})

/* ------------------------------------------------------------------ */
/* GiB ↔ bytes                                                         */
/* ------------------------------------------------------------------ */

describe('sync size unit conversion and empty-value semantics', () => {
  it('bytesToGibText: empty input means "use the Host default"', () => {
    expect(bytesToGibText(0)).toBe('')
    expect(bytesToGibText(0)).toBe('')
    expect(bytesToGibText(null)).toBe('')
    expect(bytesToGibText(undefined)).toBe('')
    expect(bytesToGibText(Number.NaN)).toBe('')
  })

  it('bytesToGibText: tiny byte counts collapse to "0", GiB values round to 2 decimals', () => {
    expect(bytesToGibText(2)).toBe('0')
    expect(bytesToGibText(1073741824)).toBe('1')
    expect(bytesToGibText(2 * 1073741824)).toBe('2')
    expect(bytesToGibText(1.5 * 1073741824)).toBe('1.5')
  })

  it('gibTextToBytes: empty / zero / invalid all mean 0 (Host default)', () => {
    expect(gibTextToBytes('')).toBe(0)
    expect(gibTextToBytes('0')).toBe(0)
    expect(gibTextToBytes('0.0')).toBe(0)
    expect(gibTextToBytes('abc')).toBe(0)
    expect(gibTextToBytes(null)).toBe(0)
    expect(gibTextToBytes(undefined)).toBe(0)
  })

  it('gibTextToBytes: "2" and "2.0" both mean 2 GiB = 2147483648 bytes', () => {
    expect(gibTextToBytes(2)).toBe(2147483648)
    expect(gibTextToBytes('2')).toBe(2147483648)
    expect(gibTextToBytes('2.0')).toBe(2147483648)
    expect(gibTextToBytes('2.5')).toBe(2684354560)
    expect(gibTextToBytes('2 GiB')).toBe(2147483648)
  })

  it('round-trips the default 2 GiB cap', () => {
    expect(gibTextToBytes(bytesToGibText(2147483648))).toBe(2147483648)
  })
})

describe('list splitting', () => {
  it('accepts commas, newlines and semicolons, trimming and dropping empty entries', () => {
    expect(splitList('a, b\nc; d')).toEqual(['a', 'b', 'c', 'd'])
    expect(splitList('a,, b, ,\n')).toEqual(['a', 'b'])
    expect(splitList('')).toEqual([])
    expect(splitList(null)).toEqual([])
    expect(splitList(undefined)).toEqual([])
  })
})

/* ------------------------------------------------------------------ */
/* Workspace guard drafts                                              */
/* ------------------------------------------------------------------ */

describe('workspace guard drafts', () => {
  it('builds a draft from a persisted record (defaults match the Host)', () => {
    expect(guardDraftFromWorkspace(WS)).toEqual({
      writeBack: true,
      writeBackExclude: '_patch/, *.log',
      syncPaths: '.dsh',
      syncExclude: 'data/',
      syncMaxBytes: '2',
    })

    expect(guardDraftFromWorkspace({ id: 'w2', profileId: 'p' })).toEqual({
      writeBack: true,
      writeBackExclude: '',
      syncPaths: '',
      syncExclude: '',
      syncMaxBytes: '',
    })
    expect(guardDraftFromWorkspace({ id: 'w3', profileId: 'p', writeBack: false })).toMatchObject({
      writeBack: false,
    })
  })

  it('does not call formatting-only differences dirty', () => {
    const baseline = guardDraftFromWorkspace(WS)
    expect(isGuardDraftDirty(baseline, baseline)).toBe(false)

    expect(isGuardDraftDirty({ ...baseline, writeBackExclude: '_patch/,\n*.log' }, baseline)).toBe(false)
    expect(isGuardDraftDirty({ ...baseline, syncPaths: ' .dsh ' }, baseline)).toBe(false)
    expect(isGuardDraftDirty({ ...baseline, syncMaxBytes: '2.0' }, baseline)).toBe(false)
    expect(isGuardDraftDirty({ ...baseline, syncMaxBytes: ' 2 ' }, baseline)).toBe(false)
    expect(guardDraftSignature({ ...baseline, syncMaxBytes: '2.0' })).toBe(guardDraftSignature(baseline))
  })

  it('marks real edits dirty', () => {
    const baseline = guardDraftFromWorkspace(WS)
    expect(isGuardDraftDirty({ ...baseline, writeBackExclude: '_patch/, *.log, tmp/' }, baseline)).toBe(true)
    expect(isGuardDraftDirty({ ...baseline, syncPaths: '.dsh, ..' }, baseline)).toBe(true)
    expect(isGuardDraftDirty({ ...baseline, writeBack: false }, baseline)).toBe(true)
    expect(isGuardDraftDirty({ ...baseline, syncMaxBytes: '3' }, baseline)).toBe(true)
    expect(isGuardDraftDirty({ ...baseline, syncMaxBytes: '' }, baseline)).toBe(true)
  })

  it('produces the exact updateWorkspaceGuards payload for the target workspace id', () => {
    const draft: GuardDraft = {
      writeBack: false,
      writeBackExclude: '_patch/, *.log',
      syncPaths: '.dsh\nsrc',
      syncExclude: 'data/, *.tmp',
      syncMaxBytes: '2',
    }
    expect(toUpdateWorkspaceGuardsPayload('ws-1', draft)).toEqual({
      id: 'ws-1',
      writeBack: false,
      writeBackExclude: ['_patch/', '*.log'],
      syncPaths: ['.dsh', 'src'],
      syncExclude: ['data/', '*.tmp'],
      syncMaxBytes: 2147483648,
    })
    expect(toUpdateWorkspaceGuardsPayload('ws-1', { ...draft, syncMaxBytes: '' }).syncMaxBytes).toBe(0)
    expect(toUpdateWorkspaceGuardsPayload('ws-1', { ...draft, syncMaxBytes: '2.0' }).syncMaxBytes).toBe(2147483648)
  })
})

describe('reconcileGuards', () => {
  it('keeps a dirty draft across an unrelated reload and moves its baseline to server truth', () => {
    const previousDrafts = guardsFromWorkspaces([WS])
    const previousBaselines = guardsFromWorkspaces([WS])
    const dirtyDraft: GuardDraft = { ...previousDrafts['ws-1']!, writeBackExclude: '_patch/, *.log, tmp/' }
    previousDrafts['ws-1'] = dirtyDraft

    const serverWorkspace: RemoteSshWorkspace = { ...WS, writeBackExclude: ['server/'] }
    const result = reconcileGuards(previousDrafts, previousBaselines, [serverWorkspace])

    expect(result.drafts['ws-1']).toBe(dirtyDraft)
    expect(result.baselines['ws-1']).toEqual(guardDraftFromWorkspace(serverWorkspace))
    expect(isGuardDraftDirty(result.drafts['ws-1']!, result.baselines['ws-1']!)).toBe(true)
  })

  it('adopts server truth for a clean draft', () => {
    const previousDrafts = guardsFromWorkspaces([WS])
    const previousBaselines = guardsFromWorkspaces([WS])
    const serverWorkspace: RemoteSshWorkspace = { ...WS, writeBack: false, syncPaths: [] }
    const result = reconcileGuards(previousDrafts, previousBaselines, [serverWorkspace])

    expect(result.drafts['ws-1']).toEqual(guardDraftFromWorkspace(serverWorkspace))
    expect(result.baselines['ws-1']).toEqual(guardDraftFromWorkspace(serverWorkspace))
    expect(isGuardDraftDirty(result.drafts['ws-1']!, result.baselines['ws-1']!)).toBe(false)
  })

  it('drops drafts and baselines for records deleted on the Host', () => {
    const previousDrafts = guardsFromWorkspaces([WS, { id: 'ws-2', profileId: 'p-2' }])
    const previousBaselines = guardsFromWorkspaces([WS, { id: 'ws-2', profileId: 'p-2' }])
    const result = reconcileGuards(previousDrafts, previousBaselines, [WS])

    expect(Object.keys(result.drafts)).toEqual(['ws-1'])
    expect(Object.keys(result.baselines)).toEqual(['ws-1'])
    expect(result.drafts['ws-2']).toBeUndefined()
  })

  it('treats a draft without a previous baseline as dirty so a refresh cannot wipe typed text', () => {
    const typed: GuardDraft = {
      writeBack: true,
      writeBackExclude: 'tmp/',
      syncPaths: '',
      syncExclude: '',
      syncMaxBytes: '',
    }
    const result = reconcileGuards({ 'ws-1': typed }, {}, [WS])
    expect(result.drafts['ws-1']).toEqual(typed)
    expect(result.baselines['ws-1']).toEqual(guardDraftFromWorkspace(WS))
  })
})

/* ------------------------------------------------------------------ */
/* Global preferences                                                  */
/* ------------------------------------------------------------------ */

const PREFS: PrefsDraft = {
  nodePath: '/usr/local/bin/node',
  writeBackFailure: 'log',
  writeBackFreshness: false,
  defaultSyncPaths: '.dsh, src',
  defaultSyncExclude: 'data/',
  defaultSyncMaxBytes: '2',
}

describe('global preferences draft', () => {
  it('projects Host preferences with the upstream defaults', () => {
    expect(prefsDraftFromApi({})).toEqual({
      nodePath: '',
      writeBackFailure: 'error',
      writeBackFreshness: true,
      defaultSyncPaths: '',
      defaultSyncExclude: '',
      defaultSyncMaxBytes: '',
    })
    expect(prefsDraftFromApi({ nodePath: '/opt/node', writeBackFailure: 'log', writeBackFreshness: false, defaultSyncPaths: ['a', 'b'], defaultSyncMaxBytes: 2147483648 })).toEqual({
      nodePath: '/opt/node',
      writeBackFailure: 'log',
      writeBackFreshness: false,
      defaultSyncPaths: 'a, b',
      defaultSyncExclude: '',
      defaultSyncMaxBytes: '2',
    })
  })

  it('does not call formatting-only differences dirty', () => {
    expect(isPrefsDraftDirty(PREFS, PREFS)).toBe(false)
    expect(isPrefsDraftDirty({ ...PREFS, defaultSyncPaths: '.dsh\nsrc' }, PREFS)).toBe(false)
    expect(isPrefsDraftDirty({ ...PREFS, defaultSyncMaxBytes: '2.0' }, PREFS)).toBe(false)
    expect(isPrefsDraftDirty({ ...PREFS, nodePath: '  /usr/local/bin/node  ' }, PREFS)).toBe(false)
  })

  it('marks real edits dirty', () => {
    expect(isPrefsDraftDirty({ ...PREFS, defaultSyncPaths: '.dsh, src, tests' }, PREFS)).toBe(true)
    expect(isPrefsDraftDirty({ ...PREFS, writeBackFailure: 'error' }, PREFS)).toBe(true)
    expect(isPrefsDraftDirty({ ...PREFS, writeBackFreshness: true }, PREFS)).toBe(true)
    expect(isPrefsDraftDirty({ ...PREFS, defaultSyncMaxBytes: '3' }, PREFS)).toBe(true)
  })

  it('produces the exact savePrefs payload', () => {
    expect(toSavePrefsPayload(PREFS)).toEqual({
      nodePath: '/usr/local/bin/node',
      writeBackFailure: 'log',
      writeBackFreshness: false,
      defaultSyncPaths: ['.dsh', 'src'],
      defaultSyncExclude: ['data/'],
      defaultSyncMaxBytes: 2147483648,
    })
    expect(toSavePrefsPayload({ ...PREFS, nodePath: '  ', defaultSyncMaxBytes: '' })).toMatchObject({
      nodePath: '',
      defaultSyncMaxBytes: 0,
    })
  })

  it('keeps an unsaved preferences draft on refresh and adopts server truth for a clean one', () => {
    const serverDraft: PrefsDraft = { ...PREFS, nodePath: '/server/node' }
    const dirty: PrefsDraft = { ...PREFS, nodePath: '/typed/node' }

    const kept = reconcilePrefs(dirty, PREFS, serverDraft)
    expect(kept.draft).toEqual(dirty)
    expect(kept.baseline).toEqual(serverDraft)

    const clean = reconcilePrefs(PREFS, PREFS, serverDraft)
    expect(clean.draft).toEqual(serverDraft)
    expect(clean.baseline).toEqual(serverDraft)

    const firstLoad = reconcilePrefs(null, null, serverDraft)
    expect(firstLoad.draft).toEqual(serverDraft)
    expect(firstLoad.baseline).toEqual(serverDraft)
  })
})

/* ------------------------------------------------------------------ */
/* Guards ↔ prefs independence                                         */
/* ------------------------------------------------------------------ */

describe('workspace guards and global preferences never overwrite each other', () => {
  it('their payload shapes stay disjoint', () => {
    const guardsPayload = toUpdateWorkspaceGuardsPayload('ws-1', guardDraftFromWorkspace(WS))
    const prefsPayload = toSavePrefsPayload(prefsDraftFromApi({ nodePath: '/node', defaultSyncPaths: ['a'] }))

    expect(Object.keys(guardsPayload).sort()).toEqual(
      ['id', 'syncExclude', 'syncMaxBytes', 'syncPaths', 'writeBack', 'writeBackExclude'].sort(),
    )
    expect(Object.keys(prefsPayload).sort()).toEqual(
      ['defaultSyncExclude', 'defaultSyncMaxBytes', 'defaultSyncPaths', 'nodePath', 'writeBackFailure', 'writeBackFreshness'].sort(),
    )
    expect(guardsPayload).not.toHaveProperty('nodePath')
    expect(guardsPayload).not.toHaveProperty('writeBackFailure')
    expect(prefsPayload).not.toHaveProperty('id')
    expect(prefsPayload).not.toHaveProperty('writeBack')
    expect(prefsPayload).not.toHaveProperty('syncPaths')
  })

  it('reconcileGuards and reconcilePrefs keep their own dirty drafts independently', () => {
    const guards = guardsFromWorkspaces([WS])
    const dirtyGuard: GuardDraft = { ...guards['ws-1']!, syncPaths: '.dsh, extra' }
    const dirtyPrefs: PrefsDraft = { ...PREFS, nodePath: '/typed/node' }

    const guardResult = reconcileGuards({ 'ws-1': dirtyGuard }, guards, [{ ...WS, syncPaths: ['server'] }])
    const prefsResult = reconcilePrefs(dirtyPrefs, PREFS, { ...PREFS, nodePath: '/server/node' })

    expect(guardResult.drafts['ws-1']).toEqual(dirtyGuard)
    expect(prefsResult.draft).toEqual(dirtyPrefs)
    // Never imported across the boundary: a guard draft has no prefs keys and vice versa.
    expect(guardResult.drafts['ws-1']).not.toHaveProperty('nodePath')
    expect(prefsResult.draft).not.toHaveProperty('syncMaxBytes')
  })

  it('a guard save baseline update does not touch the prefs draft', () => {
    const before = toSavePrefsPayload(PREFS)
    const result = reconcileGuards(guardsFromWorkspaces([WS]), guardsFromWorkspaces([WS]), [
      { ...WS, writeBackExclude: ['server/'] },
    ])
    expect(result.drafts['ws-1']?.writeBackExclude).toBe('server/')
    expect(toSavePrefsPayload(PREFS)).toEqual(before)
  })
})

/* ------------------------------------------------------------------ */
/* Connection test feedback                                            */
/* ------------------------------------------------------------------ */

describe('connectionTestView', () => {
  it('plain success shows the success status and stdout detail', () => {
    expect(connectionTestView({ ok: true, stdout: '  connected  \n' })).toEqual({
      status: 'success',
      titleKey: 'connection.testOk',
      warning: '',
      detail: 'connected',
    })
  })

  it('a successful probe carrying a warning stays a warning, never a plain success', () => {
    const view = connectionTestView({ ok: true, warning: '  key path not found, using agent  ', stdout: 'ok' })
    expect(view.status).toBe('warning')
    expect(view.titleKey).toBe('connection.testWarn')
    expect(view.warning).toBe('key path not found, using agent')
    expect(view.detail).toBe('ok')
  })

  it('failure joins error and stderr into pre-wrap diagnostics', () => {
    const view = connectionTestView({
      ok: false,
      error: 'connect failed',
      stderr: 'ssh: Could not resolve hostname',
      exitCode: 255,
    })
    expect(view).toEqual({
      status: 'error',
      titleKey: 'connection.testFail',
      warning: '',
      detail: 'connect failed\nssh: Could not resolve hostname',
    })
  })

  it('failure with only stderr, only error, or no envelope still yields the failure status', () => {
    expect(connectionTestView({ ok: false, stderr: 'stderr only' }).detail).toBe('stderr only')
    expect(connectionTestView({ ok: false, error: 'error only' }).detail).toBe('error only')

    for (const empty of [undefined, null, {}, { ok: false }]) {
      const view = connectionTestView(empty)
      expect(view.status).toBe('error')
      expect(view.titleKey).toBe('connection.testFail')
      expect(view.detail).toBe('')
    }
  })

  it('a failure that also carries a warning keeps both the failure status and the warning text', () => {
    const view = connectionTestView({ ok: false, warning: 'identity ignored', error: 'denied' })
    expect(view.status).toBe('error')
    expect(view.warning).toBe('identity ignored')
    expect(view.detail).toBe('denied')
  })
})

describe('apiErrorMessage', () => {
  it('trims the Host error and falls back when the envelope has none', () => {
    expect(apiErrorMessage({ error: '  denied  ' }, 'fallback')).toBe('denied')
    expect(apiErrorMessage({ error: '   ' }, 'fallback')).toBe('fallback')
    expect(apiErrorMessage({}, 'fallback')).toBe('fallback')
    expect(apiErrorMessage(null, 'fallback')).toBe('fallback')
    expect(apiErrorMessage({ error: 42 as unknown as string }, 'fallback')).toBe('fallback')
  })
})
