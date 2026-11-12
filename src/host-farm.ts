/**
 * A farm gathers several project folders into one real directory, so a single
 * session can read and write all of them.
 *
 * A session's file scope is its workspace directory, so "one project, several
 * folders" needs one directory that contains all of them. The farm is that
 * directory: every entry is a link (a junction on Windows, a directory symlink
 * elsewhere) to a folder the user already owns. Nothing is copied or moved, and
 * the user's folders keep their own life.
 *
 * Deletion is the dangerous half. A recursive delete that followed a link would
 * erase the user's real folder, so {@link removeFarm} only ever unlinks entries
 * that are links, and refuses as soon as it meets a real directory.
 */
import { lstat, mkdir, readdir, realpath, rmdir, stat, symlink, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, isAbsolute, join, relative as relativePath, resolve } from 'node:path'

/** Characters Windows refuses in a name, plus control characters. */
// \u005C is a backslash and \u002F a slash: written this way so this file holds
// no literal backslash at all.
const RESERVED_CHARS = /[\u005C\u002F:*?"<>|\u0000-\u001f]/gu
/** Device names Windows refuses as a whole entry name. */
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/iu
const MAX_NAME_LENGTH = 64
const WINDOWS = process.platform === 'win32'

export interface FarmLink {
  /** Entry name inside the farm directory. */
  readonly name: string
  /** Absolute real path of the folder it points at. */
  readonly target: string
}

export interface FarmResult {
  /** Absolute path of the farm directory. */
  readonly path: string
  readonly links: readonly FarmLink[]
}

function dshHome(): string {
  const configured = process.env.DSH_HOME
  return configured === undefined || configured.trim() === '' ? join(homedir(), '.dsh') : configured
}

/** Root that holds every farm: `$DSH_HOME/workspace-groups/farms`. */
export function defaultFarmRoot(): string {
  return resolve(dshHome(), 'workspace-groups', 'farms')
}

/** One directory-safe name for a farm, derived from a workspace title. */
export function farmDirectoryName(title: string): string {
  const cleaned = title
    .replace(RESERVED_CHARS, ' ')
    .replace(/\s+/gu, ' ')
    .trim()
    .replace(/[. ]+$/u, '')
    .slice(0, MAX_NAME_LENGTH)
    .trim()
    .replace(/[. ]+$/u, '')
  if (cleaned === '') return 'farm'
  return RESERVED_NAMES.test(cleaned) ? `_${cleaned}` : cleaned
}

function linkNameFor(target: string, taken: Set<string>): string {
  const raw = basename(target).replace(RESERVED_CHARS, ' ').replace(/\s+/gu, ' ').trim() || 'folder'
  const base = RESERVED_NAMES.test(raw) ? `_${raw}` : raw
  let name = base
  let suffix = 2
  while (taken.has(name.toLowerCase())) {
    name = `${base} (${suffix})`
    suffix += 1
  }
  taken.add(name.toLowerCase())
  return name
}

/**
 * Delete one farm entry, and only one.
 *
 * A junction reports as a symbolic link to `lstat` but is a reparse point that
 * `unlink` refuses; a directory symlink on POSIX removes fine with `unlink`. A
 * real directory is never touched.
 */
async function unlinkEntry(path: string): Promise<void> {
  const info = await lstat(path)
  if (info.isDirectory() && !info.isSymbolicLink()) {
    throw new Error(`farm: refusing to delete a real directory: ${path}`)
  }
  try {
    await unlink(path)
  } catch {
    // Windows junction: unlink is EPERM, rmdir removes the reparse point only.
    await rmdir(path)
  }
}

async function discard(path: string): Promise<void> {
  let entries: string[]
  try {
    entries = await readdir(path)
  } catch {
    return
  }
  for (const entry of entries) {
    try {
      await unlinkEntry(join(path, entry))
    } catch {
      // Best effort: a half-built farm is still better than a thrown rollback.
    }
  }
  try {
    await rmdir(path)
  } catch {
    // Leave it: an empty directory is harmless and the next build reports it.
  }
}

/** Resolve and validate one folder the user asked to gather. */
async function resolveFolder(raw: unknown): Promise<string> {
  if (typeof raw !== 'string' || raw.trim() === '') throw new Error('farm: empty folder path')
  if (!isAbsolute(raw)) throw new Error(`farm: folder must be an absolute path: ${raw}`)
  let real: string
  try {
    real = await realpath(raw)
  } catch {
    throw new Error(`farm: folder does not exist: ${raw}`)
  }
  const info = await stat(real)
  if (!info.isDirectory()) throw new Error(`farm: not a directory: ${raw}`)
  return real
}

/**
 * Build a farm for `folders` under `defaultFarmRoot()`.
 *
 * Refuses to reuse an existing farm directory: a silent merge into a directory
 * that already holds links would hide which entries this call owns.
 */
export async function buildFarm(input: { name: string; folders: readonly unknown[] }): Promise<FarmResult> {
  const seen = new Set<string>()
  const targets: string[] = []
  for (const raw of input.folders) {
    const target = await resolveFolder(raw)
    const key = WINDOWS ? target.toLowerCase() : target
    if (seen.has(key)) continue
    seen.add(key)
    targets.push(target)
  }
  if (targets.length < 2) throw new Error('farm: needs at least two distinct folders')

  const root = defaultFarmRoot()
  const path = join(root, farmDirectoryName(String(input.name)))
  await mkdir(root, { recursive: true })
  try {
    await mkdir(path)
  } catch (error) {
    const code = (error as { code?: string }).code
    if (code === 'EEXIST') throw new Error(`farm: already exists, remove it first: ${path}`)
    throw new Error(`farm: cannot create ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }

  const taken = new Set<string>()
  const links: FarmLink[] = []
  try {
    for (const target of targets) {
      const name = linkNameFor(target, taken)
      await symlink(target, join(path, name), WINDOWS ? 'junction' : 'dir')
      links.push({ name, target })
    }
  } catch (error) {
    await discard(path)
    throw new Error(`farm: cannot link into ${path}: ${error instanceof Error ? error.message : String(error)}`)
  }
  return { path, links }
}

/**
 * Remove a farm this module built. Only entries under `defaultFarmRoot()` are
 * accepted, and only links are unlinked: a real directory aborts the removal.
 */
export async function removeFarm(farmPath: string): Promise<void> {
  const root = defaultFarmRoot()
  const target = resolve(farmPath)
  const inside = relativePath(root, target)
  if (inside === '' || inside.startsWith('..') || isAbsolute(inside)) {
    throw new Error(`farm: not a farm directory: ${farmPath}`)
  }
  const entries = await readdir(target)
  for (const entry of entries) {
    await unlinkEntry(join(target, entry))
  }
  await rmdir(target)
}
