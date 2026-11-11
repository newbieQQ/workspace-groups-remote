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
export declare const TABS_ROUTE = "/workspace-groups/tabs";
/** One tab as it crosses the wire. */
export interface WireTab {
    readonly sessionId: string;
    readonly order: number;
    /** Pinned tabs are restored at the front of the strip. */
    readonly pinned?: boolean;
    /** A label the user typed for the tab itself (absent = follow the session). */
    readonly title?: string;
}
/**
 * Fetch the stored strip.
 * @param fetchImpl - fetch implementation (injectable for tests).
 * @returns the tabs, oldest first; empty on any failure.
 */
export declare function loadTabs(fetchImpl?: typeof fetch): Promise<WireTab[]>;
/**
 * Store the strip. Failures are swallowed.
 * @param state - the client's current strip and its arrival counter.
 * @param fetchImpl - fetch implementation (injectable for tests).
 */
export declare function saveTabs(state: {
    order: number;
    tabs: readonly WireTab[];
}, fetchImpl?: typeof fetch): Promise<void>;
