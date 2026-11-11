/**
 * Client side of the session-tab persistence, talking to
 * `GET|PUT /workspace-groups/tabs` on the host.
 *
 * Why not browser storage: **the origin includes the PORT**, and every `dsh web`
 * / `dsh test` / desktop launch picks a different one. `localStorage` and
 * `sessionStorage` are both scoped to the origin, so they start empty on the
 * next launch — a tab list kept there survives a reload only when the port
 * happens to match. The host's JSON sidecar has no such problem, which is why
 * the strip is stored there and read back verbatim.
 *
 * There is deliberately no per-browser-session marker. A marker has to live in
 * browser storage, which the port invalidates, so every restart looked like a
 * fresh session and silently discarded the user's tabs — the exact failure this
 * module exists to prevent.
 *
 * Every call is best-effort: a failed read means "no tabs" and a failed write is
 * swallowed, because the strip is a convenience and must never break the app.
 */

/** Host route holding the strip. */
export const TABS_ROUTE = '/workspace-groups/tabs'

/** One tab as it crosses the wire. */
export interface WireTab {
  readonly sessionId: string
  readonly order: number
  /** Pinned tabs are restored at the front of the strip. */
  readonly pinned?: boolean
  /** A label the user typed for the tab itself (absent = follow the session). */
  readonly title?: string
}

/**
 * Read one tab row off the wire, dropping the row when it is unusable.
 * @param entry - one element of the stored `tabs` array.
 * @returns the tab, or null for a malformed row.
 */
function parseWireTab(entry: unknown): WireTab | null {
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
 * Fetch the stored strip.
 * @param fetchImpl - fetch implementation (injectable for tests).
 * @returns the tabs, oldest first; empty on any failure.
 */
export async function loadTabs(fetchImpl: typeof fetch = fetch): Promise<WireTab[]> {
  try {
    const response = await fetchImpl(TABS_ROUTE, {
      method: 'GET',
      // Per-session state; a cached response would restore stale tabs.
      cache: 'no-store',
    })
    if (!response.ok) return []
    const body: unknown = await response.json()
    if (typeof body !== 'object' || body === null) return []
    const list = (body as { tabs?: unknown }).tabs
    if (!Array.isArray(list)) return []
    const tabs: WireTab[] = []
    for (const entry of list) {
      const tab = parseWireTab(entry)
      if (tab !== null) tabs.push(tab)
    }
    return tabs
  } catch {
    return []
  }
}

/**
 * Store the strip. Failures are swallowed.
 * @param state - the client's current strip and its arrival counter.
 * @param fetchImpl - fetch implementation (injectable for tests).
 */
export async function saveTabs(
  state: { order: number; tabs: readonly WireTab[] },
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    await fetchImpl(TABS_ROUTE, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: state.order, tabs: state.tabs }),
      cache: 'no-store',
      // Survive a navigation that happens while the request is in flight; the
      // write is idempotent so a re-send is harmless.
      keepalive: true,
    })
  } catch {
    // Offline or the host is restarting: the next change writes the full state
    // again, so nothing is lost beyond this tick.
  }
}
