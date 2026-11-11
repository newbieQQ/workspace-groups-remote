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

/** Persistent marker for the injected container (survives React re-renders). */
const SEAT_ATTRIBUTE = 'data-wg-tab-seat'

/** Sentinel attribute on the container so discovery can skip our own node. */
const SEAT_SELECTOR = `[${SEAT_ATTRIBUTE}]`

/**
 * Match the conversation column by its hashed CSS-Modules class.
 *
 * The hash prefix (`pI_x6G_`) is build-dependent, so the probe matches the
 * `_centerCol` suffix that the Modules transform always preserves. A plain
 * `class*="centerCol"` scan would risk matching unrelated utility classes, so
 * the leading underscore is required.
 * @param root - subtree to scan (normally `document`).
 * @returns the column element, or null while it has not mounted.
 */
function findCenterColumn(root: ParentNode): HTMLElement | null {
  // Fast path: the seat is already in place and still attached, which is the
  // steady state on every re-render (portal into an existing element).
  const existing = root.querySelector<HTMLElement>(SEAT_SELECTOR)
  if (existing?.isConnected === true) return existing.parentElement

  // Structural probe: the column is the direct child of the app frame grid
  // that contains the `main` panel. Querying the class suffix first keeps this
  // to one selector evaluation in the common case.
  const column = root.querySelector<HTMLElement>('[class*="_centerCol"]')
  if (column !== null) return column

  // Nothing matched: either the shell has not mounted yet, or the Modules hash
  // convention changed. Returning null keeps the caller in its wait loop
  // instead of guessing at a wrong node (which would visually corrupt the
  // shell). The strip simply appears once the frame is up.
  return null
}

/** A mounted seat: the host element plus the disposer that removes it. */
export interface TabSeat {
  /**
   * The element the React portal renders into — null until the conversation
   * column mounts. The portal is simply not rendered while this is null.
   */
  readonly host: HTMLElement | null
  /** Remove the seat and stop watching for the column. */
  dispose: () => void
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
export function mountTabSeat(onReady: (host: HTMLElement) => void): TabSeat {
  let host: HTMLElement | null = null
  let column: HTMLElement | null = null
  let observer: MutationObserver | null = null
  let raf = 0
  let attempts = 0
  let disposed = false

  // Bounded retry: ~5s at 60fps. The shell mounts well inside this; the bound
  // exists so a missing column degrades to "no strip" instead of a permanent
  // frame loop.
  const MAX_ATTEMPTS = 300

  /**
   * Put the seat at the head of the column, creating it on first success.
   * Idempotent: a seat already first is left untouched, so repeated calls from
   * the observer cause no DOM churn (and therefore no observer feedback loop —
   * our insertion schedules one more callback, which then takes this early
   * return instead of re-inserting).
   */
  const place = (target: HTMLElement): void => {
    if (disposed) return
    if (host === null) {
      host = document.createElement('div')
      host.setAttribute(SEAT_ATTRIBUTE, '')
    }
    if (target.firstChild === host) return
    target.insertBefore(host, target.firstChild)
  }

  /** Locate the column and, on success, seat the host and notify the caller. */
  const tryMount = (): boolean => {
    if (disposed) return true
    // Steady state: the column we already found is still attached.
    if (column !== null && column.isConnected) {
      place(column)
      return true
    }
    const found = findCenterColumn(document)
    if (found === null) return false
    // A different column than last time (shell remount): re-seat AND re-notify,
    // because the caller may hold a stale host element from the old tree.
    const changed = found !== column
    column = found
    place(found)
    if (changed) onReady(host as HTMLElement)
    return true
  }

  const tick = (): void => {
    if (disposed) return
    raf = 0
    if (tryMount()) return
    attempts += 1
    if (attempts >= MAX_ATTEMPTS) return
    raf = requestAnimationFrame(tick)
  }

  // The observer covers both "column mounts later" and "React dropped our
  // node": either way the child list changes and we re-seat. `requestAnimationFrame`
  // alone would miss a removal that happens after the retry budget is spent.
  observer = new MutationObserver(() => {
    if (disposed) return
    if (tryMount()) return
    if (raf === 0 && attempts < MAX_ATTEMPTS) raf = requestAnimationFrame(tick)
  })
  observer.observe(document.body, { childList: true, subtree: true })

  if (!tryMount() && raf === 0) raf = requestAnimationFrame(tick)

  return {
    get host(): HTMLElement | null {
      // Null until the column mounts; the caller's `onReady` fires at the same
      // moment this becomes non-null, so the two never disagree.
      return host
    },
    dispose: () => {
      disposed = true
      if (raf !== 0) cancelAnimationFrame(raf)
      raf = 0
      observer?.disconnect()
      observer = null
      host?.remove()
      host = null
      column = null
    },
  } as TabSeat
}
