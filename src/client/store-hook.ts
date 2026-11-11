/**
 * A framework-shaped selector hook over a store instance.
 *
 * The renderer builds this hook for slot seats (`bindSnapshotSelector` in
 * ui-renderer, wrapping React's `useSyncExternalStoreWithSelector`), but the tab
 * strip is NOT a slot occupant: it renders through a DOM seat as a child of this
 * plugin's own `sidebar.workspaces` occupant, so it receives its store face as a
 * plain prop and needs the equivalent binding here.
 *
 * The implementation mirrors React's `useSyncExternalStoreWithSelector` without
 * depending on the `use-sync-external-store` package (it is not resolvable from
 * this plugin). The two behaviours that matter:
 *
 * - identity-stable subscribe/getSnapshot closures, so the strip never
 *   resubscribes across renders;
 * - a memoized selection: the selector re-runs only when the state reference
 *   changes, and an equal result (by `eq`, defaulting to `Object.is`) returns
 *   the PREVIOUS reference, so a selector allocating a fresh array or object
 *   does not spin the render loop.
 *
 * The hook must be called unconditionally (Rules of Hooks).
 */
import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { ActionsDecl, StoreInstance } from '@deepseek-ai/dsh-client-store'

/** One memory cell: the state it was derived from, and the value it produced. */
interface Selection<T, S> {
  state: T
  value: S
  /** Whether `value` was produced by the selector (vs. carried over as equal). */
  hasValue: boolean
}

/**
 * Build a selector hook bound to one store instance.
 * @param instance - the live store instance (snapshot source).
 * @returns a `SnapshotSelectorHook`-compatible hook over that instance.
 */
export function createStoreHook<T, A extends ActionsDecl<T>>(
  instance: StoreInstance<T, A>,
): <S>(selector: (state: T) => S, eq?: (a: S, b: S) => boolean) => S {
  // Captured once: stable closures keep uSES from resubscribing every render.
  const subscribe = (onChange: () => void): (() => void) => instance.subscribe(onChange)
  const getState = (): T => instance.getSnapshot()

  return function useSelector<S>(
    selector: (state: T) => S,
    eq?: (a: S, b: S) => boolean,
  ): S {
    // Seeded eagerly so the first render selects without an extra pass.
    const memory = useRef<Selection<T, S> | null>(null)

    // Re-select the value for the current state. Called by uSES on every
    // notification AND on every render; the memory makes it cheap and
    // reference-stable.
    const getSelection = useCallback((): S => {
      const state = getState()
      const previous = memory.current

      // Same state object => the previous value is still valid. This is the
      // path that lets an allocating selector stay reference-stable.
      if (previous !== null && previous.hasValue && Object.is(previous.state, state)) {
        return previous.value
      }

      const value = selector(state)

      // New state, but an equal value: carry the old reference forward so uSES
      // sees no change and skips the re-render.
      if (previous !== null && previous.hasValue) {
        const equal = eq !== undefined ? eq(previous.value, value) : Object.is(previous.value, value)
        if (equal) {
          memory.current = { state, value: previous.value, hasValue: true }
          return previous.value
        }
      }

      memory.current = { state, value, hasValue: true }
      return value
    }, [selector, eq])

    // The third argument is the server snapshot; the client plugin never
    // server-renders, so the same getter is correct for both.
    return useSyncExternalStore(subscribe, getSelection, getSelection)
  }
}
