/**
 * Pure session-tab state: the ordered strip of sessions the user has opened,
 * the active one, and each tab's derived presentation.
 *
 * Position model: a tab's place in the strip is decided when it is first opened
 * and otherwise only moves when the USER moves it. Switching to a tab, or
 * re-opening a session that already has one, leaves the strip exactly as it was
 * — so clicking a chip never moves the chip out from under the pointer. The
 * order changes on: a session opening for the FIRST time (append), a tab closing
 * (remove), a drag (move), and a pin toggle (which carries the chip across the
 * pinned boundary).
 *
 * The array IS the display order, with one invariant the transforms maintain:
 * every pinned tab sits before every unpinned one. New tabs therefore append at
 * the end (the unpinned block) and pinning/unpinning re-inserts at the boundary
 * between the two blocks. A stored strip from an older build has no `pinned`
 * flag, which reads as "unpinned" and satisfies the invariant as-is.
 *
 * Runtime-free on purpose (same discipline as `store-core.ts` / `quick.ts`):
 * the component owns the ref + React state, this module owns every rule, and
 * unit tests exercise the real semantics without a browser module loader.
 *
 * Retention note: a tab outlives whatever it points at. The strip is a list of
 * things the USER opened, so nothing here consults the session catalog — a tab
 * whose session is gone stays visible until the user closes it, and no
 * background sweep ever trims the strip.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { SessionStatus } from '@deepseek-ai/dsh-client-ui-session/client'

/** One open tab: a session id plus its arrival key (React list identity). */
export interface SessionTab {
  /** The session the tab shows. */
  readonly sessionId: SessionId
  /**
   * Monotonic arrival key. It doubles as the React `key`, so it must stay
   * attached to the session for the tab's whole life — a reused key would make
   * React move an existing chip's DOM node instead of reconciling it in place.
   */
  readonly order: number
  /**
   * Pinned tabs stay at the front of the strip and survive `close others`.
   *
   * Absent means unpinned: that is both the `false` case and the shape an older
   * build's stored strip has, so no migration step is needed to read one back.
   */
  readonly pinned?: boolean
  /**
   * A label the user typed for THIS tab, overriding the session's title.
   *
   * Kept separate from the session title on purpose: renaming a tab here must
   * not rewrite the conversation's own name (which the sidebar and the search
   * results show). Absent/empty means "follow the session".
   */
  readonly title?: string
}

/** Feature switch: whether opening a session also surfaces a tab. */
export type TabOpenMode = 'auto' | 'manual'

/** Per-tab indicator derived from the catalog summary and the live UI status. */
export interface SessionTabIndicator {
  /** A domain request is waiting for the user (approval / plan review / question). */
  readonly attention: boolean
  /** The agent is producing output, or a descendant subagent is. */
  readonly running: boolean
  /** The turn finished while the tab was in the background and was never looked at. */
  readonly unread: boolean
  /** Idle tab whose session already has a title (a settled conversation). */
  readonly settled: boolean
}

/**
 * Add a session to the strip, or leave an existing entry exactly where it is.
 *
 * Arrival order is the strip's only order, so re-opening a session that already
 * has a tab is a NO-OP: the tab keeps its position and its arrival key. Moving
 * it to the front here would fight the whole point of stable positions — a user
 * clicking through sessions would watch the strip reshuffle on every click.
 *
 * @param tabs - current strip (oldest first).
 * @param sessionId - arriving session.
 * @param nextOrder - monotonic arrival counter to spend when appending.
 * @returns the strip, unchanged (same array) when the session already has a tab.
 */
export function appendTab(tabs: readonly SessionTab[], sessionId: SessionId, nextOrder: number): SessionTab[] {
  const existing = tabs.find(tab => tab.sessionId === sessionId)
  if (existing !== undefined) return tabs as SessionTab[]
  return [...tabs, { sessionId, order: nextOrder }]
}

/**
 * Remove one session's tab. An absent session leaves the strip untouched.
 * @param tabs - current strip.
 * @param sessionId - session whose tab closes.
 * @returns a new strip.
 */
export function removeTab(tabs: readonly SessionTab[], sessionId: SessionId): SessionTab[] {
  return tabs.filter(tab => tab.sessionId !== sessionId)
}

/**
 * Whether a tab is pinned (absent counts as unpinned).
 * @param tab - the tab.
 * @returns true when the tab belongs in the pinned block.
 */
function isPinned(tab: SessionTab): boolean {
  return tab.pinned === true
}

/**
 * Count the leading pinned block.
 *
 * The transforms keep every pinned tab before every unpinned one, so the pinned
 * block is always a prefix and its length is the single index that separates
 * the two blocks — which is exactly where a chip lands when it changes sides.
 *
 * @param tabs - strip in display order.
 * @returns how many leading tabs are pinned.
 */
export function pinnedCount(tabs: readonly SessionTab[]): number {
  let count = 0
  while (count < tabs.length && isPinned(tabs[count] as SessionTab)) count += 1
  return count
}

/**
 * Stable-partition a strip so every pinned tab precedes every unpinned one.
 *
 * Needed by the restore path: stored tabs are merged onto whatever the startup
 * flow already opened, and an append would otherwise park a pinned tab at the
 * end of the strip. Already-normalized strips come back as a copy.
 *
 * @param tabs - any strip.
 * @returns a strip satisfying the pinned-first invariant.
 */
export function normalizeTabs(tabs: readonly SessionTab[]): SessionTab[] {
  const pinned = tabs.filter(isPinned)
  if (pinned.length === 0 || pinned.length === tabs.length) return [...tabs]
  return [...pinned, ...tabs.filter(tab => !isPinned(tab))]
}

/**
 * Move one tab to a new place in the strip (drag and drop).
 *
 * `targetIndex` is an index in the RESULTING strip. The move is clamped to the
 * tab's own block — a dragged chip can be reordered within the pinned block or
 * within the unpinned one, but never carried across that boundary. Crossing it
 * is `togglePinTab`'s job, because it changes the tab's meaning rather than
 * just its position: pinning is what makes a tab survive `close others`.
 *
 * @param tabs - strip in display order.
 * @param sessionId - the tab being moved.
 * @param targetIndex - desired index in the resulting strip.
 * @returns a new strip, or the same array when nothing moved.
 */
export function moveTab(
  tabs: readonly SessionTab[],
  sessionId: SessionId,
  targetIndex: number,
): SessionTab[] {
  const from = tabs.findIndex(tab => tab.sessionId === sessionId)
  if (from < 0) return tabs as SessionTab[]
  const moving = tabs[from] as SessionTab
  const rest = tabs.filter(tab => tab.sessionId !== sessionId)
  const boundary = pinnedCount(rest)
  const min = isPinned(moving) ? 0 : boundary
  const max = isPinned(moving) ? boundary : rest.length
  const clamped = Math.min(Math.max(Math.trunc(targetIndex), min), max)
  if (clamped === from) return tabs as SessionTab[]
  return [...rest.slice(0, clamped), moving, ...rest.slice(clamped)]
}

/**
 * Pin or unpin one tab, re-inserting it at the boundary between the blocks.
 *
 * Pinning puts the chip at the END of the pinned block (next to the other
 * kept tabs) and unpinning at the START of the unpinned one, so a toggle never
 * throws a chip to the far end of the strip.
 *
 * @param tabs - strip in display order.
 * @param sessionId - the tab to toggle.
 * @returns a new strip, or the same array when the tab is absent.
 */
export function togglePinTab(tabs: readonly SessionTab[], sessionId: SessionId): SessionTab[] {
  const from = tabs.findIndex(tab => tab.sessionId === sessionId)
  if (from < 0) return tabs as SessionTab[]
  const moving = tabs[from] as SessionTab
  const rest = tabs.filter(tab => tab.sessionId !== sessionId)
  const boundary = pinnedCount(rest)
  const repinned: SessionTab = isPinned(moving)
    ? { sessionId: moving.sessionId, order: moving.order, ...(moving.title !== undefined ? { title: moving.title } : {}) }
    : { sessionId: moving.sessionId, order: moving.order, pinned: true, ...(moving.title !== undefined ? { title: moving.title } : {}) }
  return [...rest.slice(0, boundary), repinned, ...rest.slice(boundary)]
}

/**
 * Set or clear one tab's own label.
 *
 * A blank value CLEARS the override (the chip falls back to the session title)
 * rather than storing an empty label, so "rename to nothing" and "rename back to
 * the session title" are the same gesture.
 *
 * @param tabs - strip.
 * @param sessionId - the tab to relabel.
 * @param title - the new label; blank clears it.
 * @returns a new strip, or the same array when the tab is absent.
 */
export function renameTab(
  tabs: readonly SessionTab[],
  sessionId: SessionId,
  title: string | undefined,
): SessionTab[] {
  const from = tabs.findIndex(tab => tab.sessionId === sessionId)
  if (from < 0) return tabs as SessionTab[]
  const trimmed = title?.trim() ?? ''
  // No change: return the same array so the store can skip the write.
  if ((tabs[from]?.title ?? '') === trimmed) return tabs as SessionTab[]
  return tabs.map((tab) => {
    if (tab.sessionId !== sessionId) return tab
    if (trimmed === '') {
      const { title: _cleared, ...rest } = tab
      void _cleared
      return rest
    }
    return { ...tab, title: trimmed }
  })
}

/**
 * Close every tab except one — pinned tabs stay.
 *
 * Pinning is exactly how a user says "keep this no matter what"; letting
 * `close others` eat the pinned block would make the flag pointless.
 *
 * @param tabs - strip.
 * @param keepSessionId - the tab to keep (plus every pinned one).
 * @returns a new strip.
 */
export function closeOtherTabs(tabs: readonly SessionTab[], keepSessionId: SessionId): SessionTab[] {
  if (!tabs.some(tab => tab.sessionId === keepSessionId)) return tabs as SessionTab[]
  return tabs.filter(tab => isPinned(tab) || tab.sessionId === keepSessionId)
}

/**
 * Close every tab after one in display order.
 *
 * "After" is display order (pinned block first), which is the order the user
 * sees; a pinned tab is never after an unpinned one, so this cannot silently
 * drop the kept block.
 *
 * @param tabs - strip in display order.
 * @param sessionId - the last tab that stays.
 * @returns a new strip, or the same array when the tab is absent.
 */
export function closeTabsAfter(tabs: readonly SessionTab[], sessionId: SessionId): SessionTab[] {
  const from = tabs.findIndex(tab => tab.sessionId === sessionId)
  if (from < 0) return tabs as SessionTab[]
  return tabs.slice(0, from + 1)
}

/**
 * Order the strip for display: strictly by arrival, regardless of which tab is
 * active.
 *
 * Position is a property of the TAB, not of the selection. Switching to a tab
 * must not move it — an earlier version pulled the active tab to the front,
 * which made every click reshuffle the strip and slid the chip out from under
 * the pointer that had just clicked it.
 *
 * `activeId` is therefore accepted only to document that "active" deliberately
 * does NOT participate in ordering; it is unused. The returned array is a copy
 * so callers cannot mutate the store's state through it.
 *
 * @param tabs - strip in arrival order.
 * @param activeId - the open session, if it has a tab (intentionally unused).
 * @returns a new array in arrival order.
 */
export function orderedTabs(tabs: readonly SessionTab[], activeId: SessionId | undefined): SessionTab[] {
  void activeId
  return [...tabs]
}

/**
 * Whether the open session must surface a tab.
 *
 * A tab means "this conversation is in play right now", not "I once opened
 * this". Browsing history is what the sidebar is for; opening an old
 * conversation to read it should not litter the strip, which is the whole point
 * of the strip being a working set rather than a second session list.
 *
 * A session therefore earns a tab only once a conversation has actually STARTED
 * in it and is still engaged, which is any of:
 * - **running** — the agent is producing output (including subagents);
 * - **waiting on you** — an approval / plan review / question is pending;
 * - **unseen completion** — it finished while you were elsewhere, so the tab is
 *   the thing that tells you to come back.
 *
 * A still-blank draft gets NO tab: the tab appears the moment the first message
 * is sent (which is when the controller flips `blank` on `turn/start`). Once the
 * turn ends and you have read the result, the session is settled history and
 * does not earn a tab — so clicking through finished conversations leaves the
 * strip alone. Tabs already opened stay open: this gate only decides whether a
 * NEW tab appears, never whether an existing one closes.
 *
 * `blank` (from `sessionListMetadata`) is exactly "no turn has started": the
 * controller flips it to false on `turn/start`. It is the right signal for
 * "has this conversation begun", and the wrong one ALONE — a conversation
 * finished a week ago is also non-blank, which is why the earlier `!blank` rule
 * surfaced every old conversation the user clicked.
 *
 * @param mode - feature switch ('auto' applies the engagement rule).
 * @param summary - the session's catalog row (absent while the catalog has not
 *   caught up with a just-created session).
 * @param status - the session's unified UI status (absent → no live signal).
 * @returns true when a tab belongs in the strip.
 */
export function shouldOpenTab(
  mode: TabOpenMode,
  summary: SessionSummary | undefined,
  status: SessionStatus | undefined,
): boolean {
  if (mode === 'manual') return false
  if (summary === undefined) return false
  // No turn yet: a scratch draft is not a conversation, so it holds no tab. The
  // first message flips `blank`, and the tab appears then.
  if (summary.blank) return false
  // A conversation has begun. Keep the tab only while it is still in play.
  if (summary.running) return true
  if (status?.running === true) return true
  if (status?.pendingInteraction !== undefined) return true
  if (status?.completionUnread === true) return true
  // Begun, but quiet and read: settled history, not a working tab.
  return false
}

/**
 * Derive one tab's indicators from the catalog row and the unified UI status.
 * @param summary - the tab session's catalog row (absent → inert indicators).
 * @param status - the tab session's unified UI status (absent → idle).
 * @returns the indicator quadruple.
 */
export function tabIndicator(
  summary: SessionSummary | undefined,
  status: SessionStatus | undefined,
): SessionTabIndicator {
  const pending = status?.pendingInteraction !== undefined
  const running = status?.running === true || summary?.running === true
  const unread = status?.completionUnread === true
  const blank = summary?.blank !== false
  return {
    attention: pending,
    running,
    unread,
    settled: !pending && !running && !unread && summary !== undefined && !blank,
  }
}

/**
 * Where one session lives: the project (workspace) that accounts for it.
 *
 * Tabs carry this because a strip of bare session titles is ambiguous once
 * several projects are open — two checkouts both named "api", or a session
 * titled after a file, give no hint which project it belongs to.
 */
export interface TabProject {
  /** Stable workspace id. */
  readonly workspaceId: string
  /** Display label: the workspace title, falling back to its directory name. */
  readonly label: string
  /** Canonical directory path, for the tooltip. */
  readonly path: string
}

/**
 * Index sessions by the project that owns them.
 *
 * Membership comes from the workspace registry (`sessionIds`), which is the same
 * authority the sidebar tree uses — a tab and its sidebar row therefore agree on
 * the project without a second derivation.
 *
 * Built once per render pass rather than scanned per tab: a strip of N tabs over
 * M projects is O(N×M) with a naive `find` per tab.
 *
 * @param workspaces - workspace views from the controller snapshot.
 * @returns a session id → project map; sessions in no workspace are absent.
 */
export function projectIndex(
  workspaces: readonly WorkspaceViewLike[],
): ReadonlyMap<SessionId, TabProject> {
  const index = new Map<SessionId, TabProject>()
  for (const workspace of workspaces) {
    const label = projectLabel(workspace)
    const project: TabProject = {
      workspaceId: workspace.workspaceId,
      label,
      path: workspace.path,
    }
    for (const sessionId of workspace.sessionIds) {
      // First writer wins: a session wrongly listed by two workspaces keeps the
      // first, so the tab never flickers between labels across renders.
      if (!index.has(sessionId)) index.set(sessionId, project)
    }
  }
  return index
}

/** Minimal workspace shape this module needs (keeps it importable in tests). */
export interface WorkspaceViewLike {
  readonly workspaceId: string
  readonly path: string
  readonly title: string
  readonly sessionIds: readonly SessionId[]
}

/**
 * Display label for a project: its title, else the directory basename.
 * @param workspace - workspace view.
 * @returns a non-empty label, falling back to the raw path.
 */
export function projectLabel(workspace: Pick<WorkspaceViewLike, 'title' | 'path'>): string {
  const title = workspace.title.trim()
  if (title !== '') return title
  // Both separators: the host path may be Windows or POSIX.
  const parts = workspace.path.split(/[\\/]/).filter(part => part !== '')
  return parts[parts.length - 1] ?? workspace.path
}

/**
 * Whether two strips are the same sequence of sessions (arrival keys ignored).
 * @param left - previous strip.
 * @param right - next strip.
 * @returns true when no entry was added, removed, or reordered.
 */
export function sameTabs(left: readonly SessionTab[], right: readonly SessionTab[]): boolean {
  return left.length === right.length
    && left.every((tab, index) => right[index]?.sessionId === tab.sessionId)
}

/** Session-tab strip state (the shape the store persists). */
export interface SessionTabsState {
  /** Open tabs in arrival order — the strip's one and only order. */
  tabs: SessionTab[]
  /** Monotonic arrival counter; each FIRST-time session spends one. */
  order: number
}

/**
 * Store transform: add the open session, or leave its existing tab in place.
 *
 * Live here rather than in `tab-store.ts` so unit tests can exercise the real
 * semantics without importing `@deepseek-ai/dsh-client-store` (which pulls
 * `zustand` into the test process). The store module binds these into its
 * actions table.
 *
 * The no-op guard matters: this runs on EVERY catalog change for the open
 * session, so an unguarded write would wake the strip and spend arrival keys on
 * every projection tick.
 *
 * @param state - store draft, mutated in place.
 * @param sessionId - the session that just became open.
 */
export function touchTabImpl(state: SessionTabsState, sessionId: SessionId): void {
  const next = appendTab(state.tabs, sessionId, state.order + 1)
  // Same array => the session already had a tab; nothing changed, so nothing is
  // written and no subscriber wakes.
  if (next === state.tabs) return
  state.order += 1
  state.tabs = next
}

/**
 * Store transform: close one tab. Closing a session that has no tab is not a
 * state change, so it writes nothing.
 * @param state - store draft, mutated in place.
 * @param sessionId - the tab to close.
 */
export function closeTabImpl(state: SessionTabsState, sessionId: SessionId): void {
  const next = removeTab(state.tabs, sessionId)
  if (next.length === state.tabs.length) return
  state.tabs = next
}

/**
 * Store transform: adopt tabs loaded from the host, MERGING with whatever is
 * already in the strip.
 *
 * Async by nature (the host read is a `fetch`), so it can land after the browser
 * has already opened a tab for the current session. Merging — rather than
 * "ignore the read if the strip is non-empty" — is what makes a restart safe:
 * the tab opened during startup survives AND the stored tabs still come back.
 * (Bailing on a non-empty strip would silently drop every stored tab whenever
 * the startup tab won the race, which is the common case for a session that is
 * running or unread.)
 *
 * The arrival counter is lifted above every restored key so a tab opened later
 * cannot reuse one; a reused key makes React move a chip's DOM node instead of
 * reconciling it.
 *
 * @param state - store draft, mutated in place.
 * @param tabs - tabs read from the host, oldest first.
 */
export function restoreTabsImpl(state: SessionTabsState, tabs: readonly SessionTab[]): void {
  if (tabs.length === 0) return
  const present = new Set(state.tabs.map(tab => tab.sessionId))
  const additions: SessionTab[] = []
  let order = state.order
  for (const tab of tabs) {
    // Never duplicate: a session already in the strip keeps its existing entry
    // and position.
    if (present.has(tab.sessionId)) continue
    present.add(tab.sessionId)
    // Re-key onto a fresh, monotonically increasing counter so a restored key
    // can never collide with one already spent.
    order += 1
    // Carry the chip's own presentation across the restore: a pinned tab or a
    // custom label that came back unpinned/untitled would silently lose the
    // user's configuration on every restart.
    additions.push({
      sessionId: tab.sessionId,
      order,
      ...(tab.pinned === true ? { pinned: true } : {}),
      ...(tab.title !== undefined ? { title: tab.title } : {}),
    })
  }
  if (additions.length > 0) {
    const merged = [...state.tabs, ...additions]
    // Restored tabs can be pinned, and appending them would park a pinned chip
    // past the unpinned ones. Re-establish the pinned-first invariant.
    state.tabs = merged.some(isPinned) ? normalizeTabs(merged) : merged
  }
  state.order = order
}

/**
 * Store transform: pin or unpin one tab.
 * @param state - store draft, mutated in place.
 * @param sessionId - the tab to toggle.
 */
export function pinTabImpl(state: SessionTabsState, sessionId: SessionId): void {
  const next = togglePinTab(state.tabs, sessionId)
  if (next === state.tabs) return
  state.tabs = next
}

/**
 * Store transform: move one tab to a new index (drag and drop).
 * @param state - store draft, mutated in place.
 * @param sessionId - the tab being moved.
 * @param targetIndex - desired index in the resulting strip.
 */
export function moveTabImpl(state: SessionTabsState, sessionId: SessionId, targetIndex: number): void {
  const next = moveTab(state.tabs, sessionId, targetIndex)
  if (next === state.tabs) return
  state.tabs = next
}

/**
 * Store transform: set or clear one tab's own label.
 * @param state - store draft, mutated in place.
 * @param sessionId - the tab to relabel.
 * @param title - the new label; blank clears it.
 */
export function renameTabImpl(state: SessionTabsState, sessionId: SessionId, title: string | undefined): void {
  const next = renameTab(state.tabs, sessionId, title)
  if (next === state.tabs) return
  state.tabs = next
}

/**
 * Store transform: close every unlisted tab, keeping the pinned ones.
 * @param state - store draft, mutated in place.
 * @param keepSessionId - the tab to keep.
 */
export function closeOthersImpl(state: SessionTabsState, keepSessionId: SessionId): void {
  const next = closeOtherTabs(state.tabs, keepSessionId)
  if (next.length === state.tabs.length) return
  state.tabs = next
}

/**
 * Store transform: close every tab after one in display order.
 * @param state - store draft, mutated in place.
 * @param sessionId - the last tab that stays.
 */
export function closeAfterImpl(state: SessionTabsState, sessionId: SessionId): void {
  const next = closeTabsAfter(state.tabs, sessionId)
  if (next.length === state.tabs.length) return
  state.tabs = next
}
