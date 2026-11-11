/**
 * Folder overlay for @dsh-xhl/workspace-groups: the per-workspace list of
 * EXTRA folders plus the designated root folder. Stored in a plugin-owned JSON
 * sidecar (`$DSH_HOME/workspace-groups.folders.json`), next to the manual
 * grouping overlay, because neither DSH core nor the YAML rule source knows
 * about folders: core gives a workspace exactly one canonical directory and the
 * YAML stays the classification source.
 *
 * Writes are strict (the browser PUT route validates the whole document before
 * replacing it, atomically: temp file + fsync + rename) and reads tolerate
 * hand-edited content (junk entries are dropped instead of thrown), for the
 * same reason the manual overlay does: a stale or malformed sidecar must never
 * freeze the tree.
 */
import { lstat, mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import {
  EMPTY_FOLDERS_DOCUMENT,
  samePath,
  type FolderMember,
  type FoldersDocument,
  type WorkspaceFolderEntry,
} from './core/folders.ts'

/** File name of the folder sidecar (also the stable error-text prefix). */
export const FOLDERS_FILE_NAME = 'workspace-groups.folders.json'

/** Hard limits enforced at the write boundary. */
export const FOLDERS_PER_WORKSPACE_LIMIT = 32
export const MEMBERS_PER_WORKSPACE_LIMIT = 16
export const WORKSPACE_ID_LIMIT = 200
export const FOLDER_PATH_LIMIT = 1024
export const REMOTE_PATH_LIMIT = 1024

/** `C:\…` or `C:/…` — a drive-rooted Windows path. */
const WINDOWS_DRIVE = /^[A-Za-z]:[\\/]/u

/** `\\server\share` — a Windows UNC path. */
const WINDOWS_UNC = /^\\\\/u

/** `/…` — a POSIX absolute path. */
const POSIX_ABSOLUTE = /^\//u

/** Default overlay location: `$DSH_HOME/workspace-groups.folders.json`. */
export function defaultFoldersPath(): string {
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ''
    ? process.env.DSH_HOME
    : resolve(homedir(), '.dsh')
  return resolve(home, FOLDERS_FILE_NAME)
}

/**
 * Local mirror root of `@zhangfengshun/dsh-remote-ssh`.
 *
 * That plugin registers every remote workspace as an ordinary DSH workspace
 * whose canonical directory is a LOCAL mirror (`<homedir>/.dsh/remote-workspaces/
 * <workspaceId>`) and keeps the real remote path in its own records. Telling the
 * browser this base lets it treat such workspaces differently: their extra
 * folders must be subdirectories of the mirror, because only those also exist on
 * the remote side.
 *
 * The path is hardcoded there (not read from `DSH_HOME`), so it is hardcoded
 * here too — a mismatch would silently disable the distinction.
 */
export function defaultRemoteMirrorBase(): string {
  return resolve(homedir(), '.dsh', 'remote-workspaces')
}

/**
 * True when `path` is absolute in the host platform's spelling: a drive
 * letter or UNC prefix on Windows, a leading slash elsewhere.
 * @param path - candidate path.
 */
export function isAbsoluteFolderPath(path: string): boolean {
  return process.platform === 'win32'
    ? WINDOWS_DRIVE.test(path) || WINDOWS_UNC.test(path)
    : POSIX_ABSOLUTE.test(path)
}

/** Validate a local path for the read-only remote hint endpoint. */
export function validateRemoteHintPath(path: unknown): string {
  // A UNC path (\\server\share) would make the lstat walk below reach out
  // over SMB to a machine the caller named — a local hint check must stay
  // local, so this rejection comes before the shape checks.
  if (typeof path === 'string' && path.startsWith('\\\\')) {
    throw new Error('remote hint path must not be a UNC path')
  }
  if (typeof path !== 'string' || path.length === 0 || path.length > FOLDER_PATH_LIMIT
    || path.includes('\u0000') || !isAbsoluteFolderPath(path)) {
    throw new Error('remote hint path must be an absolute host path without NUL, at most 1024 characters')
  }
  return path
}

/**
 * Presence-only safety hint, never a trusted SSH connection or registration.
 * lstat also treats dangling symlinks as hints without reading their targets.
 * Only ENOENT is ignored: permissions and all other inspection failures must
 * prevent callers from silently falling back to local operations.
 */
export async function hasRemoteMarkerHint(path: string): Promise<boolean> {
  let directory = resolve(validateRemoteHintPath(path))
  for (;;) {
    try {
      await lstat(resolve(directory, '.remote-ssh.json'))
      return true
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    const parent = dirname(directory)
    if (parent === directory) return false
    directory = parent
  }
}

/** Reject helper carrying the stable file-scoped message prefix. */
function invalid(detail: string): never {
  throw new Error(`${FOLDERS_FILE_NAME}: ${detail}`)
}

/** Trim one optional free-form string field, dropping it when unusable. */
function optionalText(value: unknown, limit: number, fail: (detail: string) => void): string | undefined {
  if (value === undefined) return undefined
  if (typeof value !== 'string') {
    fail('member text fields must be strings')
    return undefined
  }
  const text = value.trim()
  if (text === '' || text.length > limit || text.includes('\u0000')) return undefined
  return text
}

/**
 * Parse one workspace-backed ("member") folder.
 *
 * A member names a real DSH workspace whose own sidebar row is hidden while this
 * entry lists it; the fields kept here are exactly what the browser needs to
 * start a Session in that workspace and to label the row.
 * @param value - raw member from the document.
 * @param workspaceId - owning workspace id (used in messages and as a guard).
 * @param folders - plain folder paths already accepted for this workspace.
 * @param members - member folders already accepted for this workspace.
 * @param fail - strict-mode reporter (throws) / tolerant no-op.
 * @returns the normalized member, or undefined when unusable.
 */
function parseMember(
  value: unknown,
  workspaceId: string,
  folders: readonly string[],
  members: readonly FolderMember[],
  fail: (detail: string) => void,
): FolderMember | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('member folders must be objects')
    return undefined
  }
  const source = value as Record<string, unknown>
  const rawPath = source.path
  if (typeof rawPath !== 'string') {
    fail('member folder path must be a string')
    return undefined
  }
  const path = rawPath.trim()
  if (path === '' || path.length > FOLDER_PATH_LIMIT || path.includes('\u0000')) {
    fail(`member folder path must be 1-${FOLDER_PATH_LIMIT} characters without NUL`)
    return undefined
  }
  if (!isAbsoluteFolderPath(path)) {
    fail(`member folder path "${path}" must be absolute`)
    return undefined
  }
  if (path.split(/[\\/]/).some(segment => segment === '.' || segment === '..')) {
    fail(`member folder path "${path}" must not contain "." or ".." segments`)
    return undefined
  }
  if (folders.some(folder => samePath(folder, path)) || members.some(member => samePath(member.path, path))) {
    fail(`duplicate folder path "${path}"`)
    return undefined
  }
  const rawId = source.workspaceId
  if (typeof rawId !== 'string') {
    fail('member workspaceId must be a string')
    return undefined
  }
  const memberWorkspaceId = rawId.trim()
  if (memberWorkspaceId === '' || memberWorkspaceId.length > WORKSPACE_ID_LIMIT
    || memberWorkspaceId.includes('\u0000')) {
    fail(`member workspaceId must be 1-${WORKSPACE_ID_LIMIT} characters without NUL`)
    return undefined
  }
  if (memberWorkspaceId === workspaceId) {
    fail('a workspace cannot be a member folder of itself')
    return undefined
  }
  const kind = source.kind
  if (kind !== 'local' && kind !== 'remote') {
    fail('member kind must be "local" or "remote"')
    return undefined
  }
  const title = optionalText(source.title, FOLDER_PATH_LIMIT, fail)
  const keepTitle = title === undefined ? {} : { title }
  if (kind === 'local') return { path, workspaceId: memberWorkspaceId, kind, ...keepTitle }

  const rawRemote = source.remotePath
  if (typeof rawRemote !== 'string') {
    fail('a remote member folder needs its remotePath')
    return undefined
  }
  const remotePath = rawRemote.trim()
  if (remotePath === '' || remotePath.length > REMOTE_PATH_LIMIT || remotePath.includes('\u0000')) {
    fail(`member remotePath must be 1-${REMOTE_PATH_LIMIT} characters without NUL`)
    return undefined
  }
  const rawProfile = source.profileId
  if (typeof rawProfile !== 'string') {
    fail('a remote member folder needs its profileId')
    return undefined
  }
  const profileId = rawProfile.trim()
  if (profileId === '' || profileId.length > WORKSPACE_ID_LIMIT) {
    fail(`member profileId must be 1-${WORKSPACE_ID_LIMIT} characters`)
    return undefined
  }
  const recordId = optionalText(source.recordId, WORKSPACE_ID_LIMIT, fail)
  return {
    path,
    workspaceId: memberWorkspaceId,
    kind,
    remotePath,
    profileId,
    ...(recordId === undefined ? {} : { recordId }),
    ...keepTitle,
  }
}

/**
 * Parse one workspace entry.
 * @param value - raw entry from the document.
 * @param workspaceId - owning workspace id (used in messages).
 * @param strict - throw on the first problem, or drop junk and return undefined.
 * @returns the normalized entry, or undefined when nothing usable remains.
 */
function parseFolderEntry(
  value: unknown,
  workspaceId: string,
  strict: boolean,
): WorkspaceFolderEntry | undefined {
  const fail = (detail: string): void => {
    if (strict) invalid(`workspace "${workspaceId}": ${detail}`)
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    fail('entry must be an object')
    return undefined
  }
  const source = value as Record<string, unknown>
  if (source.folders === undefined) {
    fail('folders is required')
    return undefined
  }
  if (!Array.isArray(source.folders)) {
    fail('folders must be a list')
    return undefined
  }
  if (strict && source.folders.length > FOLDERS_PER_WORKSPACE_LIMIT) {
    invalid(`workspace "${workspaceId}": at most ${FOLDERS_PER_WORKSPACE_LIMIT} folders`)
  }

  const folders: string[] = []
  for (const candidate of source.folders) {
    if (typeof candidate !== 'string') {
      fail('folder paths must be strings')
      continue
    }
    const path = candidate.trim()
    if (path === '') {
      fail('folder paths must be non-empty')
      continue
    }
    if (path.includes('\u0000')) {
      fail(`folder path "${path}" contains a NUL character`)
      continue
    }
    if (path.length > FOLDER_PATH_LIMIT) {
      fail(`folder path exceeds ${FOLDER_PATH_LIMIT} characters`)
      continue
    }
    if (!isAbsoluteFolderPath(path)) {
      fail(`folder path "${path}" must be absolute`)
      continue
    }
    if (path.split(/[\\/]/).some(segment => segment === '.' || segment === '..')) {
      fail(`folder path "${path}" must not contain "." or ".." segments`)
      continue
    }
    if (folders.some(existing => samePath(existing, path))) {
      fail(`duplicate folder path "${path}"`)
      continue
    }
    if (folders.length >= FOLDERS_PER_WORKSPACE_LIMIT) {
      fail(`at most ${FOLDERS_PER_WORKSPACE_LIMIT} folders`)
      break
    }
    folders.push(path)
  }

  const members: FolderMember[] = []
  if (source.members !== undefined) {
    if (!Array.isArray(source.members)) {
      fail('members must be a list')
    } else {
      if (strict && source.members.length > MEMBERS_PER_WORKSPACE_LIMIT) {
        invalid(`workspace "${workspaceId}": at most ${MEMBERS_PER_WORKSPACE_LIMIT} member folders`)
      }
      for (const candidate of source.members) {
        const member = parseMember(candidate, workspaceId, folders, members, fail)
        if (member !== undefined) members.push(member)
        if (members.length >= MEMBERS_PER_WORKSPACE_LIMIT) break
      }
    }
  }

  let root: string | undefined
  if (source.root !== undefined) {
    if (typeof source.root !== 'string') {
      fail('root must be a string')
    } else {
      const candidate = source.root.trim()
      const member = [...folders, ...members.map(entry => entry.path)]
        .find(folder => samePath(folder, candidate))
      if (member === undefined) fail(`root "${candidate}" must name one of folders`)
      else root = member
    }
  }

  if (folders.length === 0 && members.length === 0 && root === undefined) return undefined
  return { folders, ...(members.length === 0 ? {} : { members }), ...(root === undefined ? {} : { root }) }
}

/**
 * Tolerant reader: shape-normalizes whatever was on disk and drops unusable
 * workspaces, folders and roots instead of throwing. A missing, non-mapping or
 * unknown-version document yields the empty document.
 * @param raw - parsed JSON value.
 */
export function parseFoldersDocument(raw: unknown): FoldersDocument {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return EMPTY_FOLDERS_DOCUMENT
  const source = raw as Record<string, unknown>
  if (source.version !== 1) return EMPTY_FOLDERS_DOCUMENT
  const revision = readRevision(source.revision)
  if (typeof source.workspaces !== 'object' || source.workspaces === null || Array.isArray(source.workspaces)) {
    return { version: 1, revision, workspaces: {} }
  }
  const workspaces: Record<string, WorkspaceFolderEntry> = {}
  for (const [workspaceId, value] of Object.entries(source.workspaces)) {
    if (workspaceId.trim() === '' || workspaceId.length > WORKSPACE_ID_LIMIT) continue
    // "__proto__" assigned onto a plain record would mutate its prototype
    // instead of storing an entry — never let it become a key.
    if (workspaceId === '__proto__') continue
    const entry = parseFolderEntry(value, workspaceId, false)
    if (entry !== undefined) workspaces[workspaceId] = entry
  }
  return { version: 1, revision, workspaces }
}

/**
 * The document's write counter: a non-negative safe integer, else 0. Tolerant
 * on purpose — reads must survive hand-edited sidecars; the strict writer
 * below rejects bad values instead of letting them through.
 * @param value - the raw `revision` field.
 */
export function readRevision(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

/**
 * Strict writer-side validation. Every rule is enforced and the first problem
 * throws, so the PUT route rejects instead of persisting a half-valid file.
 * @param raw - parsed JSON value from the request body.
 * @returns the normalized document to save.
 * @throws when version, workspace ids, folder paths, duplicates or the root
 * membership are wrong.
 */
export function validateFoldersDocument(raw: unknown): FoldersDocument {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    invalid('top-level value must be a mapping')
  }
  const source = raw as Record<string, unknown>
  if (source.version !== 1) invalid('version must be 1')
  if (typeof source.workspaces !== 'object' || source.workspaces === null || Array.isArray(source.workspaces)) {
    invalid('workspaces must be a mapping')
  }
  if (source.revision !== undefined
    && (typeof source.revision !== 'number' || !Number.isSafeInteger(source.revision) || source.revision < 0)) {
    invalid('revision must be a non-negative integer')
  }
  const workspaces: Record<string, WorkspaceFolderEntry> = {}
  for (const [workspaceId, value] of Object.entries(source.workspaces)) {
    if (workspaceId.trim() === '' || workspaceId.length > WORKSPACE_ID_LIMIT || workspaceId === '__proto__') {
      invalid(`workspace ids must be non-empty strings of at most ${WORKSPACE_ID_LIMIT} characters`)
    }
    const entry = parseFolderEntry(value, workspaceId, true)
    if (entry !== undefined) workspaces[workspaceId] = entry
  }
  return { version: 1, revision: readRevision(source.revision), workspaces }
}

/**
 * Read + tolerate the overlay file. A missing or unreadable file yields the
 * empty document: folders are a convenience, and a broken sidecar must not take
 * the tree down with it.
 * @param path - overlay file path.
 */
export async function readFoldersDocument(path: string): Promise<FoldersDocument> {
  try {
    const text = await readFile(path, 'utf8')
    return parseFoldersDocument(JSON.parse(text))
  } catch {
    return EMPTY_FOLDERS_DOCUMENT
  }
}

/**
 * Atomically replace the overlay file: write a same-directory temp file,
 * fsync it, then rename over the target. A crash never leaves a torn JSON at
 * the real path (readers see either the old or the new file).
 * @param path - target file path.
 * @param document - validated document to persist.
 */
export async function writeFoldersDocument(path: string, document: FoldersDocument): Promise<void> {
  const json = `${JSON.stringify(document, null, 2)}\n`
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  const handle = await open(tmp, 'w')
  try {
    await handle.writeFile(json, 'utf8')
    await handle.sync()
  } catch (error) {
    await handle.close().catch(() => {})
    await unlink(tmp).catch(() => {})
    throw error
  }
  await handle.close()
  try {
    await rename(tmp, path)
  } catch (error) {
    await unlink(tmp).catch(() => {})
    throw error
  }
}

// Do not copy remote-ssh records into subdirectories. Remote-ssh 2.4.40
// resolves model-tool context only at registered roots; child records do not
// register a workspace and can bypass the parent's writeBack guard.
// Existing records belong to the user / remote-ssh and are left untouched.

/**
 * Join a remote path with a mirror-relative subpath.
 *
 * The remote path is POSIX (the server's), so this never uses `node:path`:
 * a Windows host would otherwise hand `/home/me/proj\data` to the remote shell.
 * @param remotePath - the workspace's remote root (`~`, `~/proj`, `/srv/proj`).
 * @param relativePath - subpath inside the mirror, either separator style.
 * @returns the remote counterpart, or null for an empty or escaping subpath.
 */
export function remoteSubpath(remotePath: string, relativePath: string): string | null {
  const rel = relativePath.trim().replace(/\\/gu, '/').replace(/^\/+|\/+$/gu, '')
  if (rel === '') return null
  if (rel.split('/').some(segment => segment === '..' || segment === '.')) return null
  const base = remotePath === '~' ? '~' : remotePath.replace(/\/+$/u, '')
  return base === '' ? rel : `${base}/${rel}`
}
