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
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import type { SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client';
import type { SessionStatus } from '@deepseek-ai/dsh-client-ui-session/client';
/** One open tab: a session id plus its arrival key (React list identity). */
export interface SessionTab {
    /** The session the tab shows. */
    readonly sessionId: SessionId;
    /**
     * Monotonic arrival key. It doubles as the React `key`, so it must stay
     * attached to the session for the tab's whole life — a reused key would make
     * React move an existing chip's DOM node instead of reconciling it in place.
     */
    readonly order: number;
    /**
     * Pinned tabs stay at the front of the strip and survive `close others`.
     *
     * Absent means unpinned: that is both the `false` case and the shape an older
     * build's stored strip has, so no migration step is needed to read one back.
     */
    readonly pinned?: boolean;
    /**
     * A label the user typed for THIS tab, overriding the session's title.
     *
     * Kept separate from the session title on purpose: renaming a tab here must
     * not rewrite the conversation's own name (which the sidebar and the search
     * results show). Absent/empty means "follow the session".
     */
    readonly title?: string;
}
/** Feature switch: whether opening a session also surfaces a tab. */
export type TabOpenMode = 'auto' | 'manual';
/** Per-tab indicator derived from the catalog summary and the live UI status. */
export interface SessionTabIndicator {
    /** A domain request is waiting for the user (approval / plan review / question). */
    readonly attention: boolean;
    /** The agent is producing output, or a descendant subagent is. */
    readonly running: boolean;
    /** The turn finished while the tab was in the background and was never looked at. */
    readonly unread: boolean;
    /** Idle tab whose session already has a title (a settled conversation). */
    readonly settled: boolean;
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
export declare function appendTab(tabs: readonly SessionTab[], sessionId: SessionId, nextOrder: number): SessionTab[];
/**
 * Remove one session's tab. An absent session leaves the strip untouched.
 * @param tabs - current strip.
 * @param sessionId - session whose tab closes.
 * @returns a new strip.
 */
export declare function removeTab(tabs: readonly SessionTab[], sessionId: SessionId): SessionTab[];
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
export declare function pinnedCount(tabs: readonly SessionTab[]): number;
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
export declare function normalizeTabs(tabs: readonly SessionTab[]): SessionTab[];
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
export declare function moveTab(tabs: readonly SessionTab[], sessionId: SessionId, targetIndex: number): SessionTab[];
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
export declare function togglePinTab(tabs: readonly SessionTab[], sessionId: SessionId): SessionTab[];
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
export declare function renameTab(tabs: readonly SessionTab[], sessionId: SessionId, title: string | undefined): SessionTab[];
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
export declare function closeOtherTabs(tabs: readonly SessionTab[], keepSessionId: SessionId): SessionTab[];
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
export declare function closeTabsAfter(tabs: readonly SessionTab[], sessionId: SessionId): SessionTab[];
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
export declare function orderedTabs(tabs: readonly SessionTab[], activeId: SessionId | undefined): SessionTab[];
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
export declare function shouldOpenTab(mode: TabOpenMode, summary: SessionSummary | undefined, status: SessionStatus | undefined): boolean;
/**
 * Derive one tab's indicators from the catalog row and the unified UI status.
 * @param summary - the tab session's catalog row (absent → inert indicators).
 * @param status - the tab session's unified UI status (absent → idle).
 * @returns the indicator quadruple.
 */
export declare function tabIndicator(summary: SessionSummary | undefined, status: SessionStatus | undefined): SessionTabIndicator;
/**
 * Where one session lives: the project (workspace) that accounts for it.
 *
 * Tabs carry this because a strip of bare session titles is ambiguous once
 * several projects are open — two checkouts both named "api", or a session
 * titled after a file, give no hint which project it belongs to.
 */
export interface TabProject {
    /** Stable workspace id. */
    readonly workspaceId: string;
    /** Display label: the workspace title, falling back to its directory name. */
    readonly label: string;
    /** Canonical directory path, for the tooltip. */
    readonly path: string;
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
export declare function projectIndex(workspaces: readonly WorkspaceViewLike[]): ReadonlyMap<SessionId, TabProject>;
/** Minimal workspace shape this module needs (keeps it importable in tests). */
export interface WorkspaceViewLike {
    readonly workspaceId: string;
    readonly path: string;
    readonly title: string;
    readonly sessionIds: readonly SessionId[];
}
/**
 * Display label for a project: its title, else the directory basename.
 * @param workspace - workspace view.
 * @returns a non-empty label, falling back to the raw path.
 */
export declare function projectLabel(workspace: Pick<WorkspaceViewLike, 'title' | 'path'>): string;
/**
 * Whether two strips are the same sequence of sessions (arrival keys ignored).
 * @param left - previous strip.
 * @param right - next strip.
 * @returns true when no entry was added, removed, or reordered.
 */
export declare function sameTabs(left: readonly SessionTab[], right: readonly SessionTab[]): boolean;
/** Session-tab strip state (the shape the store persists). */
export interface SessionTabsState {
    /** Open tabs in arrival order — the strip's one and only order. */
    tabs: SessionTab[];
    /** Monotonic arrival counter; each FIRST-time session spends one. */
    order: number;
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
export declare function touchTabImpl(state: SessionTabsState, sessionId: SessionId): void;
/**
 * Store transform: close one tab. Closing a session that has no tab is not a
 * state change, so it writes nothing.
 * @param state - store draft, mutated in place.
 * @param sessionId - the tab to close.
 */
export declare function closeTabImpl(state: SessionTabsState, sessionId: SessionId): void;
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
export declare function restoreTabsImpl(state: SessionTabsState, tabs: readonly SessionTab[]): void;
/**
 * Store transform: pin or unpin one tab.
 * @param state - store draft, mutated in place.
 * @param sessionId - the tab to toggle.
 */
export declare function pinTabImpl(state: SessionTabsState, sessionId: SessionId): void;
/**
 * Store transform: move one tab to a new index (drag and drop).
 * @param state - store draft, mutated in place.
 * @param sessionId - the tab being moved.
 * @param targetIndex - desired index in the resulting strip.
 */
export declare function moveTabImpl(state: SessionTabsState, sessionId: SessionId, targetIndex: number): void;
/**
 * Store transform: set or clear one tab's own label.
 * @param state - store draft, mutated in place.
 * @param sessionId - the tab to relabel.
 * @param title - the new label; blank clears it.
 */
export declare function renameTabImpl(state: SessionTabsState, sessionId: SessionId, title: string | undefined): void;
/**
 * Store transform: close every unlisted tab, keeping the pinned ones.
 * @param state - store draft, mutated in place.
 * @param keepSessionId - the tab to keep.
 */
export declare function closeOthersImpl(state: SessionTabsState, keepSessionId: SessionId): void;
/**
 * Store transform: close every tab after one in display order.
 * @param state - store draft, mutated in place.
 * @param sessionId - the last tab that stays.
 */
export declare function closeAfterImpl(state: SessionTabsState, sessionId: SessionId): void;
