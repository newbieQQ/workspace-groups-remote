/**
 * Host-side persistence for the session-tab strip.
 *
 * Why the host and not the browser: **browser storage is scoped to the origin,
 * and the origin includes the PORT.** `dsh web` / `dsh test` / the desktop shell
 * each pick a port, and a different port is a different origin, so BOTH
 * `localStorage` and `sessionStorage` start empty on the next launch. A tab list
 * kept there survives a reload only by luck (same port) and is lost on the next
 * start.
 *
 * Host storage has no such problem: one JSON sidecar under `$DSH_HOME`, keyed by
 * nothing but the plugin, so every port and every session reads the same file.
 * That file IS the strip's memory — it is returned as-is, with no browser-session
 * marker gating it.
 *
 * (An earlier version DID gate on a `sessionKey` kept in `sessionStorage`, to
 * express "clear when the browser closes". That cannot work here: the marker is
 * itself per-origin, so a port change erased it, the host saw an unfamiliar
 * marker, and every restart silently discarded the user's tabs. Persistence the
 * user can rely on beats a tidy-up nobody asked for.)
 *
 * Writes are atomic (temp file + fsync + rename), matching the manual overlay.
 */
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { homedir } from 'node:os'

/** One persisted tab. */
export interface PersistedTab {
  /** Session id the tab points at. */
  readonly sessionId: string
  /** Arrival key (React list identity). */
  readonly order: number
  /** Pinned tabs are restored at the front of the strip. */
  readonly pinned?: boolean
  /** A label the user typed for the tab itself (absent = follow the session). */
  readonly title?: string
}

/** The persisted document. */
export interface TabsDocument {
  /**
   * Shape version.
   *
   * 1 = `{sessionId, order}` only (what the shipped build writes); 2 adds the
   * optional `pinned` / `title` per tab. A version-1 file is READ as version 2
   * with every tab unpinned and untitled — that is exactly what it meant — and
   * the next write upgrades it. The two shapes are field-compatible, so no
   * conversion step exists: an older build reading a version-2 file would drop
   * the extra flags and keep working, which is why this stayed a tolerance
   * instead of a hard rejection.
   */
  readonly version: 2
  /** Arrival counter, kept ahead of every tab's own order. */
  readonly order: number
  readonly tabs: readonly PersistedTab[]
}

/** Default location: `$DSH_HOME/workspace-groups.tabs.json`. */
export function defaultTabsPath(): string {
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ''
    ? process.env.DSH_HOME
    : resolve(homedir(), '.dsh')
  return resolve(home, 'workspace-groups.tabs.json')
}

/**
 * Normalize one tab row (used by both the file reader and the PUT body check, so
 * the two can never drift).
 *
 * @param entry - one element of a stored/`posted` `tabs` array.
 * @returns the tab, or null when the row is unusable.
 */
export function parsePersistedTab(entry: unknown): PersistedTab | null {
  if (typeof entry !== 'object' || entry === null) return null
  const row = entry as Record<string, unknown>
  if (typeof row.sessionId !== 'string' || row.sessionId === '') return null
  if (typeof row.order !== 'number' || !Number.isFinite(row.order)) return null
  const pinned = row.pinned === true
  const title = typeof row.title === 'string' && row.title.trim() !== '' ? row.title.trim() : undefined
  return {
    sessionId: row.sessionId,
    order: row.order,
    ...(pinned ? { pinned: true } : {}),
    ...(title !== undefined ? { title } : {}),
  }
}

/**
 * Parse + shape-validate a tabs document.
 *
 * Tolerant on purpose: this file is a display cache, so a malformed one must
 * read as "no tabs" rather than break the strip. Individual bad rows are dropped
 * and the rest kept. Unknown fields (such as the `sessionKey` an older build
 * wrote) are ignored, so an existing file keeps working across the change.
 *
 * @param raw - parsed JSON value.
 * @returns the normalized document, or null when it is unusable.
 */
export function parseTabsDocument(raw: unknown): TabsDocument | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const source = raw as Record<string, unknown>
  // 1 and 2 are field-compatible; anything else is a shape this build cannot
  // reason about and is discarded rather than guessed at.
  if (source.version !== 1 && source.version !== 2) return null
  if (typeof source.order !== 'number' || !Number.isFinite(source.order)) return null
  if (!Array.isArray(source.tabs)) return null
  const tabs: PersistedTab[] = []
  const seen = new Set<string>()
  for (const entry of source.tabs) {
    const tab = parsePersistedTab(entry)
    if (tab === null) continue
    if (seen.has(tab.sessionId)) continue
    seen.add(tab.sessionId)
    tabs.push(tab)
  }
  return {
    version: 2,
    order: source.order,
    tabs,
  }
}

/**
 * Read the tabs document.
 *
 * A missing file is not an error (first run). A corrupt one is reported as null
 * so the caller starts empty, and the next write repairs the file.
 *
 * @param path - sidecar path.
 * @returns the document, or null when absent/unusable.
 */
export async function readTabsDocument(path: string): Promise<TabsDocument | null> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw error
  }
  try {
    return parseTabsDocument(JSON.parse(text))
  } catch {
    return null
  }
}

/**
 * Write the tabs document atomically.
 * @param path - sidecar path.
 * @param document - document to store.
 */
export async function writeTabsDocument(path: string, document: TabsDocument): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temp = `${path}.${process.pid}.${Date.now()}.tmp`
  const body = `${JSON.stringify(document, null, 2)}\n`
  const handle = await open(temp, 'w')
  try {
    await handle.writeFile(body, 'utf8')
    await handle.sync()
  } finally {
    await handle.close()
  }
  try {
    await rename(temp, path)
  } catch (error) {
    await unlink(temp).catch(() => {})
    throw error
  }
}

/**
 * Build the document to persist.
 * @param state - the client's current strip and its arrival counter.
 * @returns the document to write.
 */
export function documentForTabs(state: { order: number; tabs: readonly PersistedTab[] }): TabsDocument {
  const highest = state.tabs.reduce((max, tab) => Math.max(max, tab.order), 0)
  return {
    version: 2,
    order: Math.max(state.order, highest),
    tabs: [...state.tabs],
  }
}
