/**
 * Pure folder-list logic for per-workspace multi-root folders.
 *
 * DSH core gives a workspace exactly ONE canonical directory
 * (`WorkspaceView.path`). This module layers a plugin-owned list of EXTRA
 * folders on top of it, plus one designated root folder per workspace:
 *
 *   - the canonical directory is always folder #0 (the "base"); it cannot be
 *     removed and may be the root;
 *   - `root` is stored only when it names an EXTRA folder — "base is the root"
 *     is expressed by omitting the key, so the base path is never duplicated
 *     into the sidecar;
 *   - a session whose recorded `cwd` lives inside an extra folder belongs to
 *     that folder, not to the project row.
 *
 * Everything here is pure and platform-agnostic: it imports no React, no DOM
 * and no cordis so plain Node (the verifier, the host route) can load it.
 */

/** Kind of a member folder: a plain local directory, or an SSH-mirrored one. */
export type FolderMemberKind = 'local' | 'remote'

/**
 * A folder row that is backed by its OWN DSH workspace ("member").
 *
 * Plain extra folders ( {@link WorkspaceFolderEntry.folders} ) live inside the
 * owner's canonical directory tree and their sessions run with the OWNER's
 * workspace id. A member has a directory the owner cannot reach that way — a
 * remote (mirror-backed) folder, or a local directory added to a remote project
 * — so the platform registers a real workspace for it and the row delegates
 * session creation to that workspace id. The member's own workspace row is
 * hidden from the sidebar while some entry lists it (see
 * {@link absorbedWorkspaceIds}), so the project reads as one project with both
 * kinds of folders.
 */
export interface FolderMember {
  /** Absolute LOCAL path of the member workspace (its canonical directory). */
  readonly path: string
  /** Native DSH workspace id backing this folder row. */
  readonly workspaceId: string
  readonly kind: FolderMemberKind
  /** Remote root, when `kind` is 'remote' (`~`, `~/proj`, `/srv/proj`). */
  readonly remotePath?: string
  /** SSH connection profile id, when `kind` is 'remote'. */
  readonly profileId?: string
  /** remote-ssh's own record id, when `kind` is 'remote'. */
  readonly recordId?: string
  /** Display title the platform gave the member workspace. */
  readonly title?: string
}

/** Folders attached to one workspace: EXTRA folders only (the base is implicit). */
export interface WorkspaceFolderEntry {
  /**
   * Plain local extra folders: directories the owner workspace can address
   * directly, so their sessions keep the owner's workspace id.
   */
  readonly folders: readonly string[]
  /** Workspace-backed extra folders (remote mirrors, or local on a remote owner). */
  readonly members?: readonly FolderMember[]
  readonly root?: string
}

/** The whole `workspace-groups.folders.json` document. */
export interface FoldersDocument {
  readonly version: 1
  /**
   * Monotonic write counter, owned by the host: every accepted PUT bumps it
   * and a PUT whose revision does not match the stored one is rejected
   * (409), so two windows can no longer silently overwrite each other's
   * edits. Absent in documents written before revisions existed — read as 0.
   */
  readonly revision?: number
  readonly workspaces: Readonly<Record<string, WorkspaceFolderEntry>>
}

/** Canonical empty document, shared so callers need not allocate one each time. */
export const EMPTY_FOLDERS_DOCUMENT: FoldersDocument = { version: 1, revision: 0, workspaces: {} }

/** `C:\…` or `C:/…` — a drive-rooted Windows path. */
const WINDOWS_DRIVE = /^[A-Za-z]:[\\/]/u

/** `\\server\share` — a Windows UNC path. */
const WINDOWS_UNC = /^\\\\/u

/** True for both Windows path spellings accepted by the write validator. */
function isWindowsStyle(path: string): boolean {
  return WINDOWS_DRIVE.test(path) || WINDOWS_UNC.test(path)
}

/**
 * One path with trailing separators removed, spelling preserved (no case
 * folding) — the form to STORE. A drive/UNC/root prefix keeps its separator.
 * @param path - raw path.
 */
function withoutTrailingSeparator(path: string): string {
  if (isWindowsStyle(path)) {
    let value = path.replaceAll('/', '\\')
    while (value.length > 3 && value.endsWith('\\')) value = value.slice(0, -1)
    return value
  }
  let value = path
  while (value.length > 1 && value.endsWith('/')) value = value.slice(0, -1)
  return value
}

/**
 * Comparison form of one path: trimmed, separator-normalized and, for Windows
 * spellings, lower-cased (drive letters and file names are case-insensitive
 * there). Trailing separators are dropped except for a drive/UNC/root prefix.
 * @param path - raw path as stored or picked.
 * @returns the canonical comparison form.
 */
function canonicalPath(path: string): string {
  const trimmed = path.trim()
  const value = withoutTrailingSeparator(trimmed)
  return isWindowsStyle(trimmed) ? value.toLowerCase() : value
}

/**
 * Path equality: case-insensitive for Windows-style paths, tolerant of
 * trailing separators, exact for POSIX paths.
 * @param a - first path.
 * @param b - second path.
 */
export function samePath(a: string, b: string): boolean {
  return canonicalPath(a) === canonicalPath(b)
}

/**
 * Look up the folder entry saved for one workspace.
 * @param doc - folders document.
 * @param workspaceId - host workspace id.
 * @returns the entry, or undefined when the workspace has none.
 */
export function entryFor(doc: FoldersDocument, workspaceId: string): WorkspaceFolderEntry | undefined {
  return doc.workspaces[workspaceId]
}

/**
 * The workspace's effective folder list, base first. The base cannot be
 * duplicated and blank extra entries are dropped.
 * @param workspacePath - canonical directory of the workspace.
 * @param entry - saved folder entry, if any.
 */
export function effectiveFolders(
  workspacePath: string,
  entry: WorkspaceFolderEntry | undefined,
): readonly string[] {
  const extras: string[] = []
  const candidates: string[] = [
    ...(entry?.folders ?? []),
    ...(entry?.members ?? []).map(member => member.path),
  ]
  for (const folder of candidates) {
    if (folder.trim() === '') continue
    if (samePath(folder, workspacePath)) continue
    if (extras.some(existing => samePath(existing, folder))) continue
    extras.push(folder)
  }
  return [workspacePath, ...extras]
}

/**
 * The member record behind one folder path, when that folder is workspace-backed.
 * @param entry - saved folder entry, if any.
 * @param path - folder path as stored.
 */
export function memberOf(entry: WorkspaceFolderEntry | undefined, path: string): FolderMember | undefined {
  return (entry?.members ?? []).find(member => samePath(member.path, path))
}

/**
 * Light canonical form of a REMOTE path (POSIX — the server's filesystem):
 * trimmed, trailing slashes removed. Deliberately string-only: the client
 * cannot resolve `~` or symlinks; the remote-ssh host canonicalizes fully
 * at registration time. This is the second line of defense, catching the
 * spelling variants a user can type into the add-cloud-folder dialog.
 * @param raw - remote path as typed or as stored.
 */
export function lightRemotePath(raw: string): string {
  const trimmed = raw.trim()
  return trimmed.length > 1 ? trimmed.replace(/\/+$/, '') : trimmed
}

/**
 * Whether two remote paths name the same directory under {@link lightRemotePath}.
 * @param a - first remote path.
 * @param b - second remote path.
 */
export function sameRemotePath(a: string, b: string): boolean {
  return lightRemotePath(a) === lightRemotePath(b)
}

/**
 * The member backed by one native workspace id, when one exists.
 * @param entry - saved folder entry, if any.
 * @param workspaceId - native workspace id backing the member.
 */
export function memberByWorkspaceId(entry: WorkspaceFolderEntry | undefined, workspaceId: string): FolderMember | undefined {
  return (entry?.members ?? []).find(member => member.workspaceId === workspaceId)
}

/**
 * The remote member for one connection + remote directory, when one exists.
 * @param entry - saved folder entry, if any.
 * @param profileId - remote-ssh connection id.
 * @param remotePath - remote directory to look up.
 */
export function findRemoteMember(entry: WorkspaceFolderEntry | undefined, profileId: string, remotePath: string): FolderMember | undefined {
  return (entry?.members ?? []).find(member =>
    member.kind === 'remote'
    && member.profileId === profileId
    && member.remotePath !== undefined
    && sameRemotePath(member.remotePath, remotePath))
}

/**
 * Every member folder of one owner workspace, in stored order.
 * @param doc - folders document.
 * @param ownerWorkspaceId - workspace the members hang off.
 */
export function membersOf(doc: FoldersDocument, ownerWorkspaceId: string): readonly FolderMember[] {
  return entryFor(doc, ownerWorkspaceId)?.members ?? []
}

/**
 * Member workspace id → owning workspace id.
 *
 * These are the workspaces whose own row disappears from the sidebar: their
 * sessions render under the owning project's folder row instead. A workspace
 * that is itself an owner (it carries an entry) is never absorbed — absorbing
 * it would hide a project together with the folders nested below it.
 * @param doc - folders document.
 */
export function absorbedWorkspaceIds(doc: FoldersDocument): ReadonlyMap<string, string> {
  const owners = new Set(Object.keys(doc.workspaces))
  const absorbed = new Map<string, string>()
  for (const [ownerId, entry] of Object.entries(doc.workspaces)) {
    for (const member of entry.members ?? []) {
      if (member.workspaceId === '' || member.workspaceId === ownerId) continue
      if (owners.has(member.workspaceId)) continue
      if (!absorbed.has(member.workspaceId)) absorbed.set(member.workspaceId, ownerId)
    }
  }
  return absorbed
}

/**
 * True when the entry carries neither a plain folder nor a member, i.e. it can
 * be dropped from the sidecar instead of being written empty.
 * @param entry - folder entry.
 */
export function isEmptyEntry(entry: WorkspaceFolderEntry | undefined): boolean {
  return (entry?.folders.length ?? 0) === 0 && (entry?.members?.length ?? 0) === 0
}

/**
 * The folder new sessions start in by default.
 * @param workspacePath - canonical directory of the workspace.
 * @param entry - saved folder entry, if any.
 * @returns the stored root when it names an effective extra folder, else the
 * workspace's own directory.
 */
export function rootOf(workspacePath: string, entry: WorkspaceFolderEntry | undefined): string {
  const root = entry?.root
  if (root === undefined) return workspacePath
  const folders = effectiveFolders(workspacePath, entry)
  return folders.find(folder => samePath(folder, root)) ?? workspacePath
}

/**
 * Owning folder of a session cwd: the most specific (longest) effective folder
 * that equals the cwd or is a proper path ancestor of it.
 * @param cwd - recorded session cwd; undefined means "the workspace itself".
 * @param workspacePath - canonical directory of the workspace.
 * @param entry - saved folder entry, if any.
 * @returns the owning folder, or the workspace path when nothing matches.
 */
export function folderOfCwd(
  cwd: string | undefined,
  workspacePath: string,
  entry: WorkspaceFolderEntry | undefined,
): string {
  if (cwd === undefined) return workspacePath
  const target = canonicalPath(cwd)
  let best: string | undefined
  let bestLength = -1
  for (const folder of effectiveFolders(workspacePath, entry)) {
    const root = canonicalPath(folder)
    if (root === '') continue
    const separator = isWindowsStyle(root) ? '\\' : '/'
    const prefix = root.endsWith(separator) ? root : `${root}${separator}`
    if (target !== root && !target.startsWith(prefix)) continue
    if (root.length > bestLength) {
      best = folder
      bestLength = root.length
    }
  }
  return best ?? workspacePath
}

/**
 * Append an extra folder. Idempotent under `samePath`, and the stored root (if
 * any) survives untouched.
 * @param entry - current entry, or undefined for a workspace with no extras.
 * @param path - folder path to append.
 */
export function addFolder(entry: WorkspaceFolderEntry | undefined, path: string): WorkspaceFolderEntry {
  const folders = entry?.folders ?? []
  const members = entry?.members ?? []
  const root = entry?.root
  const trimmed = path.trim()
  const keepRoot = root === undefined ? {} : { root }
  const keepMembers = members.length === 0 ? {} : { members: [...members] }
  if (trimmed === '' || folders.some(folder => samePath(folder, trimmed))
    || members.some(member => samePath(member.path, trimmed))) {
    return { folders: [...folders], ...keepMembers, ...keepRoot }
  }
  return { folders: [...folders, trimmed], ...keepMembers, ...keepRoot }
}

/**
 * Append a workspace-backed folder. Idempotent under `samePath`: a later call
 * for the same path replaces the stored member (so a re-registered workspace id
 * wins) instead of stacking a duplicate row.
 * @param entry - current entry, or undefined for a workspace with no extras.
 * @param member - member record to store.
 */
export function addMember(entry: WorkspaceFolderEntry | undefined, member: FolderMember): WorkspaceFolderEntry {
  const folders = (entry?.folders ?? []).filter(folder => !samePath(folder, member.path))
  const members = (entry?.members ?? []).filter(existing => !samePath(existing.path, member.path))
  const root = entry?.root
  // The root survives even when it names the member's own path: the member
  // replaces the plain folder at that path, so the root still resolves —
  // dropping it would silently change where new sessions start.
  const keepRoot = root === undefined ? {} : { root }
  return { folders: [...folders], members: [...members, member], ...keepRoot }
}

/**
 * Drop an extra folder, plain or workspace-backed. A root that pointed at it is
 * cleared, so the workspace falls back to its own directory instead of
 * referencing a folder it no longer has.
 * @param entry - current entry, or undefined.
 * @param path - folder path to drop.
 */
export function removeFolder(entry: WorkspaceFolderEntry | undefined, path: string): WorkspaceFolderEntry {
  const folders = (entry?.folders ?? []).filter(folder => !samePath(folder, path))
  const members = (entry?.members ?? []).filter(member => !samePath(member.path, path))
  const root = entry?.root
  const keepRoot = root !== undefined && !samePath(root, path)
  const keepMembers = members.length === 0 ? {} : { members }
  return { folders: folders, ...keepMembers, ...(keepRoot ? { root } : {}) }
}

/**
 * Designate the root folder. Only an extra folder can be stored: naming the
 * base directory means "no explicit root", which is represented by clearing
 * the key.
 * @param entry - current entry, or undefined.
 * @param path - folder to make the root.
 */
export function setRoot(entry: WorkspaceFolderEntry | undefined, path: string): WorkspaceFolderEntry {
  const folders = entry?.folders ?? []
  const members = entry?.members ?? []
  const keepMembers = members.length === 0 ? {} : { members: [...members] }
  const match = [...folders, ...members.map(member => member.path)]
    .find(folder => samePath(folder, path))
  if (match === undefined) return { folders: [...folders], ...keepMembers }
  return { folders: [...folders], ...keepMembers, root: match }
}

/**
 * True when `path` is `base` itself or lives somewhere below it, with the same
 * separator and case rules as {@link samePath}.
 * @param path - candidate path.
 * @param base - containing directory.
 */
export function isUnderBase(path: string, base: string): boolean {
  const root = canonicalPath(base)
  const target = canonicalPath(path)
  if (root === '' || target === '') return false
  if (target === root) return true
  const separator = isWindowsStyle(root) ? '\\' : '/'
  const prefix = root.endsWith(separator) ? root : `${root}${separator}`
  return target.startsWith(prefix)
}

/**
 * Resolve a user-typed SUBPATH against a base directory.
 *
 * This is what remote (mirror-backed) workspaces need: their canonical
 * directory is a local mirror of a remote root, so an extra folder must be a
 * directory INSIDE the mirror — that is the only spelling that also exists on
 * the remote side. Absolute input and `..` escapes are rejected outright so a
 * typo cannot smuggle in an unrelated local directory.
 * @param base - the workspace's canonical directory.
 * @param relative - typed subpath, either separator style.
 * @returns the joined path, or null when the input is empty, absolute, or
 * escapes the base.
 */
export function joinSubpath(base: string, relative: string): string | null {
  const root = base.trim()
  const raw = relative.trim()
  if (root === '' || raw === '') return null
  if (WINDOWS_DRIVE.test(raw) || WINDOWS_UNC.test(raw) || raw.startsWith('/')) return null
  const segments = raw.split(/[\\/]+/u).filter(segment => segment !== '' && segment !== '.')
  if (segments.length === 0) return null
  if (segments.includes('..')) return null
  const windows = isWindowsStyle(root)
  const separator = windows ? '\\' : '/'
  return `${withoutTrailingSeparator(root)}${separator}${segments.join(separator)}`
}
