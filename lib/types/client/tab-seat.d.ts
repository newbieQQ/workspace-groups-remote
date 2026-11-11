/**
 * DOM seat for the session tab strip.
 *
 * Why this exists instead of a slot: the strip belongs at the very top of the
 * conversation column — `pI_x6G_centerCol` (ui-layout's AppFrame `.centerCol`,
 * a hashed CSS-Modules class). That column declares NO child slots: its only
 * child is the `main` slot's occupant (`renderSlot('main', …)`, the
 * Conversation or a global panel), so there is nowhere to register. The
 * shipped slot in that neighbourhood — `conversation.composer.dock` — is the
 * band UNDER the composer card, a different place entirely.
 *
 * So the strip gets a real DOM seat: this module finds the column, prepends a
 * `<div>` to it, and hands that element to a React portal. The element is
 * OURS, never React's: it is inserted outside the column's child list that
 * React reconciles, and it is re-inserted if React (or a theme/titlebar
 * re-render) ever drops it.
 *
 * Two hazards this module is built around:
 *
 * 1. `centerCol` is a hashed class name (`pI_x6G_centerCol`) that changes when
 *    the package is rebuilt. Matching is therefore done on the *structural*
 *    contract — a grid-item column that holds the `main` panel — plus a
 *    `[class*="_centerCol"]` probe, never on the exact hash.
 * 2. The column mounts after the client plugin's `apply()` runs. Discovery is
 *    therefore a MutationObserver on `document.body` plus a `requestAnimationFrame`
 *    retry, and both are torn down when the owning effect disposes.
 */
/** A mounted seat: the host element plus the disposer that removes it. */
export interface TabSeat {
    /**
     * The element the React portal renders into — null until the conversation
     * column mounts. The portal is simply not rendered while this is null.
     */
    readonly host: HTMLElement | null;
    /** Remove the seat and stop watching for the column. */
    dispose: () => void;
}
/**
 * Ensure a seat exists as the FIRST child of the conversation column, creating
 * it if needed, and keep it there for as long as the returned handle is live.
 *
 * The seat element is created once and reused: a portal that re-mounts into a
 * fresh node on every shell re-render would drop the tab strip's React state
 * and visible focus. If React removes the node (it owns the column's child
 * list, and our node is not part of it), the observer re-inserts the SAME
 * element, so the portal's subtree moves with it.
 *
 * @param onReady - called with the host element each time it becomes attached
 *   (once immediately when the column already exists). Used to seed React
 *   state; may fire more than once if the column is remounted.
 * @returns the seat handle. `host` is null until the column appears, so the
 *   caller renders nothing meanwhile and starts rendering when `onReady`
 *   fires. Never null: a missing column must degrade to "no strip", not to a
 *   thrown error that would take the whole client plugin down.
 */
export declare function mountTabSeat(onReady: (host: HTMLElement) => void): TabSeat;
