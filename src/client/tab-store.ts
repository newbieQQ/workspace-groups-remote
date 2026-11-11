/**
 * The session-tab store: the `defineStore` binding and nothing else.
 *
 * The action TRANSFORMS live in `tabs.ts` (pure, runtime-free), so unit tests
 * exercise the real semantics without pulling in the store engine — this module
 * is the only place that needs `@deepseek-ai/dsh-client-store`, and importing it
 * from a test would drag `zustand` into the test process.
 *
 * One handle, one scope: the tab store is seated by the `sidebar.workspaces`
 * entry alone. The tab strip is a CHILD of that entry (rendered through a DOM
 * portal into the conversation column), not a second slot registration, so the
 * handle is never mounted under a second, differently-scoped slot — which the
 * registry rejects outright ("one handle, one scope").
 *
 * Placement is navigation, not data: the strip derives its active chip from the
 * open session, and arrival order is the strip's only order, so nothing here
 * mirrors selection.
 */
import { defineStore, type EngineStoreHandle, type StoreHandle } from '@deepseek-ai/dsh-client-store'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  closeAfterImpl,
  closeOthersImpl,
  closeTabImpl,
  moveTabImpl,
  pinTabImpl,
  renameTabImpl,
  restoreTabsImpl,
  touchTabImpl,
  type SessionTab,
  type SessionTabsState,
} from './tabs.ts'

export type { SessionTabsState }

/**
 * Session-tab strip actions (bound by the framework, handed to the browser).
 *
 * There is deliberately NO "drop tabs whose session vanished" action. An open
 * tab is closed by the USER and by nothing else — a program that trims the strip
 * on its own eventually eats tabs the user wanted, and the whole point of the
 * strip is that it holds what you opened.
 *
 * This is also why the store needs no catalog at all: it never consults one.
 */
export interface SessionTabsActions {
  /** Add the open session, or leave its existing tab untouched in place. */
  touch: (sessionId: SessionId) => void
  /** Close one tab; navigation is untouchable from here (the caller decides). */
  close: (sessionId: SessionId) => void
  /**
   * Replace the strip with tabs loaded from the host.
   *
   * The host read is a `fetch`, so it cannot happen inside `init()`. This action
   * is how the async result lands, and it is a no-op once the user has already
   * opened a tab — a slow response must never discard what they just did.
   */
  restore: (tabs: readonly SessionTab[]) => void
  /** Pin or unpin one tab (re-inserts it at the block boundary). */
  pin: (sessionId: SessionId) => void
  /** Move one tab to an index in the resulting strip (drag and drop). */
  move: (sessionId: SessionId, targetIndex: number) => void
  /** Set (or clear, with a blank value) one tab's own label. */
  rename: (sessionId: SessionId, title: string | undefined) => void
  /** Close everything except one tab; pinned tabs are kept. */
  closeOthers: (sessionId: SessionId) => void
  /** Close every tab after one in display order. */
  closeAfter: (sessionId: SessionId) => void
}

/** Annotation twin of the actions literal below (structural `ActionsDecl`). */
type SessionTabsActionsDecl = {
  touch: typeof touchTabImpl
  close: typeof closeTabImpl
  restore: typeof restoreTabsImpl
  pin: typeof pinTabImpl
  move: typeof moveTabImpl
  rename: typeof renameTabImpl
  closeOthers: typeof closeOthersImpl
  closeAfter: typeof closeAfterImpl
}

/**
 * The tab store's registered handle: identity + spec + the instance factory the
 * framework resolves per entry x scope. It deliberately does NOT claim the live
 * instance's faces (`getSnapshot` / `actions`) — `defineStore`'s concrete return
 * is structurally narrower, and this alias has to stay a type that value can be
 * assigned to.
 */
export type SessionTabsStoreHandle = StoreHandle<SessionTabsState, SessionTabsActionsDecl>

/**
 * The live tab store value: the handle's `create()` product, which carries the
 * baked write set and the snapshot source. Named here so the registrations and
 * the strip's props can share one type without importing the store engine.
 */
export type SessionTabsInstance = ReturnType<EngineStoreHandle<SessionTabsState, SessionTabsActionsDecl>['create']>

/**
 * Create the session-tab store handle.
 *
 * The strip starts EMPTY and is hydrated by the caller through the `restore`
 * action: persistence lives on the host behind a `fetch`, which cannot run
 * during `init()`. Browser storage is deliberately not used — the origin
 * includes the port, and every launch picks a new one, so `localStorage` and
 * `sessionStorage` both start empty on the next start.
 *
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createSessionTabsStore(): EngineStoreHandle<SessionTabsState, SessionTabsActionsDecl> {
  return defineStore({
    init: (): SessionTabsState => ({ tabs: [], order: 0 }),
    actions: {
      touch: touchTabImpl,
      close: closeTabImpl,
      restore: restoreTabsImpl,
      pin: pinTabImpl,
      move: moveTabImpl,
      rename: renameTabImpl,
      closeOthers: closeOthersImpl,
      closeAfter: closeAfterImpl,
    },
  })
}

export type { SessionTab }