/** One directory operation for local DSH and optional remote-ssh workspaces.
 * Never send remote writes through the sidebar route: without its SSH interceptor
 * that route can create a LOCAL directory instead. Use the SSH-owned API instead.
 */
import { isUnderBase, joinSubpath, samePath } from '../core/folders.ts'

export interface RemoteFolderWorkspace {
  mirrorPath: string
  remotePath: string
  profileId: string
  /** Native DSH workspace registered for the mirror root ('' when unregistered). */
  workspaceId: string
  /** remote-ssh's own record id ('' when it cannot be resolved). */
  recordId: string
}

type JsonObject = Record<string, unknown>
function object(value: unknown): JsonObject | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonObject : undefined
}
function message(value: JsonObject | undefined): string {
  const error = value?.error
  return typeof error === 'string' ? error
    : typeof object(error)?.message === 'string' ? String(object(error)?.message)
      : typeof value?.stderr === 'string' && value.stderr !== '' ? value.stderr
        : 'Remote SSH request failed'
}

async function rpc(method: string, body: JsonObject, fetchImpl: typeof fetch): Promise<JsonObject | null> {
  const response = await fetchImpl(`/remote-ssh/api/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
    body: JSON.stringify(body), cache: 'no-store', signal: AbortSignal.timeout(30000),
  })
  // Only catalog absence denotes an optional plugin not installed/running.
  if (response.status === 404 && method === 'listWorkspaces') return null
  if (!response.ok) throw new Error(`Remote SSH ${method}: HTTP ${response.status}`)
  const envelope = object(await response.json())
  const value = object(envelope?.value)
  if (envelope?.ok !== true || value?.ok !== true) throw new Error(message(value ?? envelope))
  return value
}

/** A marker is only a refusal hint, never authority to execute remote commands. */
async function refuseMarkedLocalPath(path: string, fetchImpl: typeof fetch): Promise<void> {
  const response = await fetchImpl(`/workspace-groups/remote-hint?path=${encodeURIComponent(path)}`, {
    cache: 'no-store', signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) throw new Error(`Cannot verify local directory: HTTP ${response.status}`)
  const body = object(await response.json())
  if (typeof body?.remoteHint !== 'boolean') throw new Error('Invalid directory safety response')
  if (body.remoteHint) throw new Error('SSH marker detected but no active registered remote workspace; refusing local operation')
}

/** One SSH connection the remote plugin offers, as the picker needs it. */
export interface RemoteProfileSummary {
  id: string
  name: string
  host: string
  user: string
  /** Directory the connection opens on (`~` when the plugin leaves it empty). */
  remoteRoot: string
}

/** One row of a remote directory listing. */
export interface RemoteDirEntry {
  name: string
  type: 'directory' | 'file'
  size: number
}

/** A remote directory and its children, as the cloud folder picker needs them. */
export interface RemoteDirListing {
  /** Path as requested (`~`, a relative name or an absolute path). */
  requested: string
  /** Absolute path the remote shell resolved it to (`requested` when unknown). */
  resolved: string
  entries: readonly RemoteDirEntry[]
}

/** Single-quote one POSIX shell word; `~` expands only when it stays unquoted. */
function shellWord(path: string): string {
  return `'${path.replace(/'/gu, `'\\''`)}'`
}

/** Quote a remote path for `sh`, keeping a leading `~` expandable. */
function shellPath(path: string): string {
  if (path === '~') return '~'
  if (path.startsWith('~/')) return `~/${shellWord(path.slice(2))}`
  return shellWord(path)
}

/** Parent of a directory path, or null where going up stops (`~`, `/`, root). */
export function remoteDirParent(path: string): string | null {
  const trimmed = path.trim().replace(/\/+$/u, '')
  if (trimmed === '' || trimmed === '~' || trimmed === '.') return null
  const cut = trimmed.lastIndexOf('/')
  if (cut < 0) return null
  if (cut === 0) return '/'
  return trimmed.slice(0, cut)
}

/** Join a child directory name onto a remote directory path. */
export function remoteDirJoin(base: string, name: string): string {
  if (base === '') return name
  return base.endsWith('/') ? `${base}${name}` : `${base}/${name}`
}

/**
 * List one remote directory through the SSH plugin's own pooled session, so
 * password auth, ProxyJump and host-key handling stay where they already work.
 * @param profileId - SSH connection to browse.
 * @param path - directory to list; empty means the connection's remote root.
 * @param fetchImpl - fetch implementation (tests inject one).
 */
export async function listRemoteDirectory(
  profileId: string, path: string, fetchImpl: typeof fetch = fetch,
): Promise<RemoteDirListing> {
  const requested = path.trim() === '' ? '~' : path.trim()
  const value = await rpc('listDir', { profileId, path: requested }, fetchImpl)
  if (value === null) throw new Error('The SSH plugin is unavailable; cannot browse that connection')
  const rows = Array.isArray(value.entries) ? value.entries : []
  const entries: RemoteDirEntry[] = []
  for (const raw of rows) {
    const row = object(raw)
    if (row === undefined || typeof row.name !== 'string' || row.name === '') continue
    entries.push({
      name: row.name,
      type: row.type === 'directory' ? 'directory' : 'file',
      size: typeof row.size === 'number' && Number.isFinite(row.size) ? row.size : 0,
    })
  }
  return { requested, resolved: await resolveRemoteDirectory(profileId, requested, fetchImpl) ?? requested, entries }
}

/** Absolute form of a remote path, or null when the remote shell cannot resolve it. */
async function resolveRemoteDirectory(
  profileId: string, path: string, fetchImpl: typeof fetch,
): Promise<string | null> {
  try {
    const value = await rpc('remoteExec', { profileId, command: `cd ${shellPath(path)} && pwd -P` }, fetchImpl)
    const stdout = typeof value?.stdout === 'string' ? value.stdout.trim() : ''
    const line = stdout.split('\n').filter(text => text.trim() !== '').pop()
    return line === undefined ? null : line.trim()
  } catch {
    // Listing succeeded but the path cannot be named (a shell without cd): keep browsing.
    return null
  }
}

/** A newly registered remote (mirror-backed) folder workspace. */
export interface CreatedRemoteFolder {
  /** Absolute LOCAL mirror path — the member workspace's canonical directory. */
  path: string
  /** Native DSH workspace id that now backs the folder row. */
  workspaceId: string
  /** remote-ssh's own record id (used to delete the record again). */
  recordId: string
  remotePath: string
  profileId: string
  title: string
  /** True when an existing record for the same profile + remote path was taken over. */
  reused: boolean
}

/**
 * The SSH connections available for a cloud folder, or null when the
 * `@zhangfengshun/dsh-remote-ssh` plugin does not answer at all.
 * @param fetchImpl - fetch implementation (tests inject one).
 */
export async function listRemoteProfiles(
  fetchImpl: typeof fetch = fetch,
): Promise<RemoteProfileSummary[] | null> {
  let value: JsonObject | null
  try {
    value = await rpc('listProfiles', {}, fetchImpl)
  } catch (reason) {
    // A missing plugin answers HTTP 404 with no JSON envelope at all.
    if (reason instanceof Error && reason.message.includes('HTTP 404')) return null
    throw reason
  }
  if (value === null) return null
  const rows = Array.isArray(value.profiles) ? value.profiles : []
  const profiles: RemoteProfileSummary[] = []
  for (const raw of rows) {
    const row = object(raw)
    if (row === undefined || typeof row.id !== 'string' || row.id === '') continue
    profiles.push({
      id: row.id,
      name: typeof row.name === 'string' && row.name !== '' ? row.name : row.id,
      host: typeof row.host === 'string' ? row.host : '',
      user: typeof row.user === 'string' ? row.user : '',
      remoteRoot: typeof row.remoteRoot === 'string' && row.remoteRoot !== '' ? row.remoteRoot : '~',
    })
  }
  return profiles
}

/**
 * Register one cloud folder: the SSH plugin creates the local mirror, writes the
 * connection marker and registers a real DSH workspace for it — exactly what its
 * own "new remote workspace" flow does. The returned native workspace id backs
 * the folder row, and the workspace's own sidebar row is hidden once the entry
 * lists it (see `absorbedWorkspaceIds`).
 * @param profileId - SSH connection to use.
 * @param remotePath - remote directory (`~`, `~/proj`, `/srv/proj`).
 * @param title - optional display title; the plugin derives one from the path.
 * @param fetchImpl - fetch implementation (tests inject one).
 */
export async function createRemoteFolder(
  profileId: string,
  remotePath: string,
  title?: string,
  fetchImpl: typeof fetch = fetch,
): Promise<CreatedRemoteFolder> {
  const trimmedPath = remotePath.trim()
  if (profileId.trim() === '' || trimmedPath === '') throw new Error('Pick a connection and enter a remote path')
  const value = await rpc('createRemoteWorkspace', {
    profileId,
    remotePath: trimmedPath,
    ...(title === undefined || title.trim() === '' ? {} : { title: title.trim() }),
  }, fetchImpl)
  if (value === null) throw new Error('The SSH plugin is unavailable; cannot add a cloud folder')
  const record = object(value.workspace) ?? {}
  const workspaceId = typeof value.workspaceId === 'string' ? value.workspaceId : ''
  const mirrorPath = typeof value.mirrorPath === 'string' ? value.mirrorPath : ''
  const recordId = typeof record.id === 'string' ? record.id : ''
  if (workspaceId === '' || mirrorPath === '') {
    throw new Error('The SSH plugin did not register a workspace for this folder')
  }
  return {
    path: mirrorPath,
    workspaceId,
    recordId,
    remotePath: typeof record.remotePath === 'string' ? record.remotePath : trimmedPath,
    profileId: typeof record.profileId === 'string' ? record.profileId : profileId,
    title: typeof record.title === 'string' && record.title !== '' ? record.title : trimmedPath,
    reused: value.reused === true,
  }
}

/**
 * Delete one remote workspace record through the SSH plugin: it removes the
 * record, unregisters the native workspace behind it (that workspace's
 * sessions go with it) and cleans up the mirror — the counterpart of
 * {@link createRemoteFolder}, for when a member folder is removed for good.
 * @param recordId - remote-ssh record id stored on the member.
 * @param fetchImpl - fetch implementation (tests inject one).
 */
export async function deleteRemoteWorkspaceRecord(
  recordId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  if (recordId.trim() === '') throw new Error('No remote workspace record to delete')
  const value = await rpc('deleteWorkspace', { id: recordId }, fetchImpl)
  if (value === null) throw new Error('The SSH plugin is unavailable; cannot delete the remote workspace')
}

/** Resolve against the SSH plugin's registered mirrors, not copied marker files. */
export async function remoteFolderWorkspace(
  path: string, remoteBase: string | null, fetchImpl: typeof fetch = fetch,
): Promise<RemoteFolderWorkspace | null> {
  const value = await rpc('listWorkspaces', {}, fetchImpl)
  const knownMirror = remoteBase !== null && isUnderBase(path, remoteBase)
  if (value === null) {
    if (knownMirror) throw new Error('SSH plugin is unavailable; refusing a local operation in a remote mirror')
    await refuseMarkedLocalPath(path, fetchImpl)
    return null
  }
  if (!Array.isArray(value.workspaces)) throw new Error('Invalid SSH workspace catalog')
  const matches: RemoteFolderWorkspace[] = []
  for (const raw of value.workspaces) {
    const row = object(raw)
    if (!row || typeof row.mirrorPath !== 'string' || typeof row.remotePath !== 'string'
      || typeof row.profileId !== 'string' || !row.mirrorPath || !row.remotePath || !row.profileId) {
      throw new Error('Invalid SSH workspace entry')
    }
    if (samePath(path, row.mirrorPath) || isUnderBase(path, row.mirrorPath)) {
      matches.push({
        mirrorPath: row.mirrorPath,
        remotePath: row.remotePath,
        profileId: row.profileId,
        workspaceId: typeof row.shellWorkspaceId === 'string' ? row.shellWorkspaceId : '',
        recordId: typeof row.id === 'string' ? row.id : '',
      })
    }
  }
  if (matches.length > 1) throw new Error('Overlapping SSH workspaces are not supported safely')
  if (matches.length === 1) return matches[0]!
  if (knownMirror) throw new Error('Remote mirror is not registered with the SSH plugin')
  await refuseMarkedLocalPath(path, fetchImpl)
  return null
}

/** Single-segment names match DSH createDirectory(path, name). */
export function validateFolderName(raw: string): string {
  const name = raw.trim()
  if (!name || name === '.' || name === '..' || /[\\/\u0000-\u001f]/u.test(name)) {
    throw new Error('Enter a single folder name, not an absolute path or nested path')
  }
  return name
}

export async function createWorkspaceDirectory(
  parent: string, rawName: string, remoteBase: string | null,
  createLocal: (path: string, name: string) => Promise<string>, fetchImpl: typeof fetch = fetch,
): Promise<{ path: string; remote: boolean }> {
  const name = validateFolderName(rawName)
  const path = joinSubpath(parent, name)
  if (path === null) throw new Error('Invalid folder name')
  const remote = await remoteFolderWorkspace(parent, remoteBase, fetchImpl)
  if (!remote) return { path: await createLocal(parent, name), remote: false }
  // Names with shell expansions are rejected defensively for older SSH wrappers.
  if (/[\u0000-\u001f`$"\\]/u.test(name)) throw new Error('Unsupported remote folder name')
  const normalizedParent = parent.trim().replace(/\\/gu, '/').replace(/\/+$/u, '')
  const normalizedRoot = remote.mirrorPath.trim().replace(/\\/gu, '/').replace(/\/+$/u, '')
  const suffix = normalizedParent.slice(normalizedRoot.length).replace(/^\/+/, '')
  if (suffix.split('/').some(part => part === '..' || part === '.')) throw new Error('Invalid mirror path')
  const root = remote.remotePath.replace(/\/+$/u, '')
  const remotePath = `${root}/${suffix ? `${suffix}/` : ''}${name}`
  await rpc('mkdir', { profileId: remote.profileId, path: remotePath }, fetchImpl)
  return { path, remote: true }
}
