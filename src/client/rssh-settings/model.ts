/**
 * Remote-SSH settings — pure model.
 *
 * Everything here is plain data transformation (no React, no DOM, no
 * imports from other plugin sources), so the real behaviour can be covered
 * by unit tests without mounting the shell:
 *
 * - connection form validation and the exact `saveProfile` payload
 * - `~/.ssh/config` import mapping, per-item outcomes, partial-failure counts
 *   and failed-only retry merges (the old face reported the selection size as
 *   "imported" regardless of each save result)
 * - per-workspace guard drafts, dirty detection, reload reconciliation and the
 *   exact `updateWorkspaceGuards` payload
 * - global preferences draft/payload/dirty/reconcile
 *
 * Field semantics and unit conversions are copied from the vendored client
 * (`splitList`, `bytesToGibText`, `gibTextToBytes`, `prefsForUi`) so the face
 * keeps the existing Host contract: lists accept comma/newline/semicolon,
 * the size cap is edited in GiB and stored in bytes, empty = Host default.
 */
import type {
  RemoteSshPrefs,
  RemoteSshProfile,
  RemoteSshWorkspace,
  SavePrefsPayload,
  SaveProfilePayload,
  SshConfigHost,
  TestConnectionResponse,
  UpdateWorkspaceGuardsPayload,
} from './contract.ts'

/* ------------------------------------------------------------------ */
/* Connection form                                                     */
/* ------------------------------------------------------------------ */

/** Controlled draft of the "add connection" form (all fields are strings). */
export interface ConnectionForm {
  name: string
  host: string
  port: string
  user: string
  authMethod: 'key' | 'password'
  keyPath: string
  password: string
  remoteRoot: string
  proxyJump: string
}

/** Values the vendored client used when opening/clearing the form. */
export const EMPTY_CONNECTION_FORM: ConnectionForm = {
  name: '',
  host: '',
  port: '22',
  user: '',
  authMethod: 'key',
  keyPath: '',
  password: '',
  remoteRoot: '~',
  proxyJump: '',
}

/** Fresh copy (never share the frozen constant with component state). */
export function emptyConnectionForm(): ConnectionForm {
  return { ...EMPTY_CONNECTION_FORM }
}

/** Field-level issue; the component maps `messageKey` through `t`. */
export interface FormIssue {
  field: 'host' | 'user' | 'port'
  messageKey: 'add.errHost' | 'add.errUser' | 'add.errPort'
}

/**
 * Validate exactly what the Host requires (`host` + `user`) plus a real port
 * range. The Host would otherwise `parseInt(port) || 22`, silently turning a
 * typo into 22; the UI refuses it instead. Aliases, empty key paths and the
 * reliance on ssh-agent / ~/.ssh/config stay legal (the backend accepts them).
 */
export function validateConnectionForm(form: ConnectionForm): FormIssue[] {
  const issues: FormIssue[] = []
  if (!form.host.trim()) issues.push({ field: 'host', messageKey: 'add.errHost' })
  if (!form.user.trim()) issues.push({ field: 'user', messageKey: 'add.errUser' })
  const portText = form.port.trim()
  const portNumber = Number(portText)
  if (!/^\d+$/.test(portText) || !Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
    issues.push({ field: 'port', messageKey: 'add.errPort' })
  }
  return issues
}

/** Whether the form can be submitted (callers still re-check on submit). */
export function isConnectionFormValid(form: ConnectionForm): boolean {
  return validateConnectionForm(form).length === 0
}

/**
 * Exact `saveProfile` body. Fields are passed through as typed by the user
 * (the Host trims/derives where it always did: name falls back to host, port
 * parsing is already done here, password only persists for password auth).
 */
export function toSaveProfilePayload(form: ConnectionForm): SaveProfilePayload {
  return {
    name: form.name,
    host: form.host,
    port: Number(form.port),
    user: form.user,
    authMethod: form.authMethod,
    keyPath: form.keyPath,
    password: form.password,
    remoteRoot: form.remoteRoot,
    proxyJump: form.proxyJump,
  }
}

/** `user@host:port` summary used by connection cards. */
export function profileSummary(profile: RemoteSshProfile): string {
  return `${profile.user || ''}@${profile.host || ''}:${profile.port || 22}`
}

/** Display name with the upstream `name || host` fallback. */
export function profileName(profile: RemoteSshProfile): string {
  return profile.name || profile.host
}

/* ------------------------------------------------------------------ */
/* Shared conversion helpers (copied from the vendored client)          */
/* ------------------------------------------------------------------ */

/** "comma or newline (or semicolon) separated" text → trimmed non-empty list. */
export function splitList(value: string | null | undefined): string[] {
  return String(value == null ? '' : value)
    .split(/[\n,;]/)
    .map(item => item.trim())
    .filter(Boolean)
}

/** Byte count → GiB text (empty = Host built-in default cap). */
export function bytesToGibText(bytes: number | null | undefined): string {
  const n = Number(bytes) || 0
  if (!n) return ''
  return String(Math.round((n / 1073741824) * 100) / 100)
}

/** GiB text → bytes; empty/invalid → 0 (= Host built-in default cap). */
export function gibTextToBytes(text: string | number | null | undefined): number {
  const n = parseFloat(String(text == null ? '' : text).replace(/[^0-9.]/g, ''))
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 1073741824)
}

/** Trimmed error text from an API envelope, else the caller's fallback. */
export function apiErrorMessage(
  value: { error?: string } | null | undefined,
  fallback: string,
): string {
  const text = value && typeof value.error === 'string' ? value.error.trim() : ''
  return text || fallback
}

/* ------------------------------------------------------------------ */
/* Connection test feedback                                            */
/* ------------------------------------------------------------------ */

export type TestStatus = 'success' | 'warning' | 'error'

/** Rendered shape of one connection test result. */
export interface ConnectionTestView {
  status: TestStatus
  /** Localized status line (caller resolves the keys). */
  titleKey: 'connection.testOk' | 'connection.testWarn' | 'connection.testFail'
  /** Raw warning returned by the Host (successful connect with degraded key path). */
  warning: string
  /** stdout for success, stderr/error text for failure. */
  detail: string
}

/**
 * Map `testConnection` output to the card feedback. A successful probe that
 * carries `warning` stays a warning (never collapsed into a plain success).
 */
export function connectionTestView(
  result: TestConnectionResponse | null | undefined,
): ConnectionTestView {
  const warning = String(result?.warning || '').trim()
  if (result?.ok) {
    return {
      status: warning ? 'warning' : 'success',
      titleKey: warning ? 'connection.testWarn' : 'connection.testOk',
      warning,
      detail: String(result.stdout || '').trim(),
    }
  }
  const detail = [result?.error, result?.stderr].filter(Boolean).join('\n').trim()
  return {
    status: 'error',
    titleKey: 'connection.testFail',
    warning,
    detail,
  }
}

/* ------------------------------------------------------------------ */
/* SSH config import                                                   */
/* ------------------------------------------------------------------ */

/** Stable row key; same spelling the vendored importer used for selection. */
export function importHostKey(host: SshConfigHost): string {
  return `${host.name}|${host.hostName}`
}

/** Default selection: every discovered host (upstream opened all checked). */
export function selectAllHosts(hosts: SshConfigHost[]): Record<string, boolean> {
  const selected: Record<string, boolean> = {}
  for (const host of hosts) selected[importHostKey(host)] = true
  return selected
}

/** Toggle one selection key without mutating the previous map. */
export function toggleHostSelection(
  selected: Record<string, boolean>,
  key: string,
): Record<string, boolean> {
  return { ...selected, [key]: !selected[key] }
}

/** Selected hosts, in discovery order (never trusts map iteration order). */
export function selectedHosts(
  hosts: SshConfigHost[],
  selected: Record<string, boolean>,
): SshConfigHost[] {
  return hosts.filter(host => selected[importHostKey(host)])
}

/** Count of checked rows. */
export function countSelected(selected: Record<string, boolean>): number {
  return Object.keys(selected).filter(key => selected[key]).length
}

/**
 * Exact import mapping kept from the vendored face: name, host, port, user,
 * keyPath (identityFile), proxyJump; key auth, empty password, remoteRoot ~.
 */
export function importProfilePayload(host: SshConfigHost): SaveProfilePayload {
  return {
    name: host.name,
    host: host.hostName,
    port: Number(host.port) || 22,
    user: host.user || '',
    authMethod: 'key',
    keyPath: host.identityFile || '',
    password: '',
    remoteRoot: '~',
    proxyJump: host.proxyJump || '',
  }
}

/** One save attempt inside an import run. */
export interface ImportItemOutcome {
  key: string
  name: string
  hostName: string
  ok: boolean
  /** Host/transport error text (absent when ok). */
  error?: string
  /** Synthesized reason when the call resolved without an envelope. */
  errorCode?: 'no-result'
}

/** Aggregated per-run statistics (never "selected size" as success count). */
export interface ImportSummary {
  outcomes: ImportItemOutcome[]
  okCount: number
  failCount: number
  failedHosts: SshConfigHost[]
}

/** Injected `saveProfile` port (the vendored api wrapper satisfies this). */
export type SaveProfileCall = (
  payload: SaveProfilePayload,
) => Promise<{ ok?: boolean; error?: string } | null | undefined>

/**
 * Import hosts one by one. Each item is checked individually:
 * - `ok: true` counts as success;
 * - `ok: false` (or any thrown request error) counts as failure with its reason;
 * - a missing envelope counts as failure (`errorCode: 'no-result'`) so a
 *   silent transport layer can never be reported as imported.
 *
 * Sequential on purpose: profile saves rewrite one settings table, and the
 * calls are cheap compared to SSH; this also keeps progress deterministic.
 */
export async function runImport(
  hosts: SshConfigHost[],
  saveProfile: SaveProfileCall,
  options: {
    onProgress?: (done: number, total: number, host: SshConfigHost) => void
  } = {},
): Promise<ImportSummary> {
  const outcomes: ImportItemOutcome[] = []
  const failedHosts: SshConfigHost[] = []
  let okCount = 0
  let failCount = 0

  for (let index = 0; index < hosts.length; index += 1) {
    const host = hosts[index] as SshConfigHost
    options.onProgress?.(index, hosts.length, host)
    const outcome: ImportItemOutcome = {
      key: importHostKey(host),
      name: host.name,
      hostName: host.hostName,
      ok: false,
    }
    try {
      const result = await saveProfile(importProfilePayload(host))
      if (result && result.ok === true) {
        outcome.ok = true
        okCount += 1
      } else {
        const error = result && typeof result.error === 'string' ? result.error.trim() : ''
        if (error) outcome.error = error
        else outcome.errorCode = 'no-result'
        failCount += 1
        failedHosts.push(host)
      }
    } catch (error) {
      outcome.error = error instanceof Error ? error.message : String(error)
      failCount += 1
      failedHosts.push(host)
    }
    outcomes.push(outcome)
  }
  const lastHost = hosts[hosts.length - 1]
  if (lastHost) options.onProgress?.(hosts.length, hosts.length, lastHost)
  return { outcomes, okCount, failCount, failedHosts }
}

/**
 * Fold a failed-only retry run into the previous summary: previously
 * successful items stay successes (they are never resubmitted), failed items
 * take the retry outcome.
 */
export function mergeImportRetry(
  previous: ImportSummary,
  retry: ImportSummary,
): ImportSummary {
  const kept = previous.outcomes.filter(outcome => outcome.ok)
  const outcomes = [...kept, ...retry.outcomes]
  const okCount = kept.length + retry.okCount
  const failCount = retry.failCount
  return { outcomes, okCount, failCount, failedHosts: retry.failedHosts }
}

/* ------------------------------------------------------------------ */
/* Per-workspace guards                                                */
/* ------------------------------------------------------------------ */

/** Controlled draft of one workspace's write-back / sync settings. */
export interface GuardDraft {
  writeBack: boolean
  writeBackExclude: string
  syncPaths: string
  syncExclude: string
  syncMaxBytes: string
}

/** Draft initialized from a persisted record (defaults match the Host). */
export function guardDraftFromWorkspace(workspace: RemoteSshWorkspace): GuardDraft {
  return {
    writeBack: workspace.writeBack !== false,
    writeBackExclude: (workspace.writeBackExclude || []).join(', '),
    syncPaths: (workspace.syncPaths || []).join(', '),
    syncExclude: (workspace.syncExclude || []).join(', '),
    syncMaxBytes: bytesToGibText(workspace.syncMaxBytes),
  }
}

/** Drafts + baselines keyed by workspace id. */
export function guardsFromWorkspaces(
  workspaces: RemoteSshWorkspace[],
): Record<string, GuardDraft> {
  const drafts: Record<string, GuardDraft> = {}
  for (const workspace of workspaces) drafts[workspace.id] = guardDraftFromWorkspace(workspace)
  return drafts
}

/** Canonical signature: list formatting / "2" vs "2.0" must not look dirty. */
export function guardDraftSignature(draft: GuardDraft): string {
  return [
    draft.writeBack ? '1' : '0',
    splitList(draft.writeBackExclude).join('\u0000'),
    splitList(draft.syncPaths).join('\u0000'),
    splitList(draft.syncExclude).join('\u0000'),
    String(gibTextToBytes(draft.syncMaxBytes)),
  ].join('\u0001')
}

/** Whether the draft differs semantically from the persisted baseline. */
export function isGuardDraftDirty(draft: GuardDraft, baseline: GuardDraft): boolean {
  return guardDraftSignature(draft) !== guardDraftSignature(baseline)
}

/** Exact `updateWorkspaceGuards` body — always carries the target workspace id. */
export function toUpdateWorkspaceGuardsPayload(
  workspaceId: string,
  draft: GuardDraft,
): UpdateWorkspaceGuardsPayload {
  return {
    id: workspaceId,
    writeBack: draft.writeBack !== false,
    writeBackExclude: splitList(draft.writeBackExclude),
    syncPaths: splitList(draft.syncPaths),
    syncExclude: splitList(draft.syncExclude),
    syncMaxBytes: gibTextToBytes(draft.syncMaxBytes),
  }
}

/**
 * Reconcile drafts with a freshly persisted list. Dirty drafts survive a
 * reload (their baseline moves to the new server truth); clean drafts adopt
 * it. Records removed on the Host disappear. A draft with no baseline is
 * treated as dirty so an unrelated refresh can never wipe typed text.
 */
export function reconcileGuards(
  previousDrafts: Record<string, GuardDraft>,
  previousBaselines: Record<string, GuardDraft>,
  workspaces: RemoteSshWorkspace[],
): { drafts: Record<string, GuardDraft>; baselines: Record<string, GuardDraft> } {
  const baselines: Record<string, GuardDraft> = guardsFromWorkspaces(workspaces)
  const drafts: Record<string, GuardDraft> = {}
  for (const [id, baseline] of Object.entries(baselines)) {
    const previousDraft = previousDrafts[id]
    const previousBaseline = previousBaselines[id]
    const dirty = previousDraft !== undefined
      && (previousBaseline === undefined || isGuardDraftDirty(previousDraft, previousBaseline))
    drafts[id] = dirty ? previousDraft : baseline
  }
  return { drafts, baselines }
}

/* ------------------------------------------------------------------ */
/* Global preferences                                                  */
/* ------------------------------------------------------------------ */

/** Controlled draft of the advanced section. */
export interface PrefsDraft {
  nodePath: string
  writeBackFailure: 'error' | 'log'
  writeBackFreshness: boolean
  defaultSyncPaths: string
  defaultSyncExclude: string
  defaultSyncMaxBytes: string
}

/** Host preferences → draft (same projection the vendored face used). */
export function prefsDraftFromApi(prefs: RemoteSshPrefs | null | undefined): PrefsDraft {
  const value = prefs || {}
  return {
    nodePath: String(value.nodePath || ''),
    writeBackFailure: String(value.writeBackFailure || 'error') === 'log' ? 'log' : 'error',
    writeBackFreshness: value.writeBackFreshness !== false,
    defaultSyncPaths: (value.defaultSyncPaths || []).join(', '),
    defaultSyncExclude: (value.defaultSyncExclude || []).join(', '),
    defaultSyncMaxBytes: bytesToGibText(value.defaultSyncMaxBytes),
  }
}

/** Canonical preference signature for dirty detection. */
export function prefsDraftSignature(draft: PrefsDraft): string {
  return [
    draft.nodePath.trim(),
    draft.writeBackFailure === 'log' ? 'log' : 'error',
    draft.writeBackFreshness === false ? '0' : '1',
    splitList(draft.defaultSyncPaths).join('\u0000'),
    splitList(draft.defaultSyncExclude).join('\u0000'),
    String(gibTextToBytes(draft.defaultSyncMaxBytes)),
  ].join('\u0001')
}

/** Whether the advanced draft differs from the saved preferences. */
export function isPrefsDraftDirty(draft: PrefsDraft, baseline: PrefsDraft): boolean {
  return prefsDraftSignature(draft) !== prefsDraftSignature(baseline)
}

/** Exact `savePrefs` body (array conversions + GiB → bytes). */
export function toSavePrefsPayload(draft: PrefsDraft): SavePrefsPayload {
  return {
    nodePath: draft.nodePath.trim(),
    writeBackFailure: draft.writeBackFailure === 'log' ? 'log' : 'error',
    writeBackFreshness: draft.writeBackFreshness !== false,
    defaultSyncPaths: splitList(draft.defaultSyncPaths),
    defaultSyncExclude: splitList(draft.defaultSyncExclude),
    defaultSyncMaxBytes: gibTextToBytes(draft.defaultSyncMaxBytes),
  }
}

/**
 * Reconcile the advanced draft with a fresh `getPrefs` read: unsaved edits
 * survive, clean drafts adopt server truth. Baselines always follow the
 * server so the dirty badge compares against what is actually stored.
 */
export function reconcilePrefs(
  previousDraft: PrefsDraft | null,
  previousBaseline: PrefsDraft | null,
  serverDraft: PrefsDraft,
): { draft: PrefsDraft; baseline: PrefsDraft } {
  if (previousDraft && previousBaseline && isPrefsDraftDirty(previousDraft, previousBaseline)) {
    return { draft: previousDraft, baseline: serverDraft }
  }
  return { draft: serverDraft, baseline: serverDraft }
}
