/**
 * @dsh-xhl/workspace-groups client half. ONE registration, plus a DOM-seated
 * view that hangs off it:
 *
 * The three-level grouped workspace browser into `sidebar.workspaces`,
 * shadowing the official ui-workspace browser.
 *
 *    Shadowing mechanics (SlotCore semantics):
 *    - `sidebar.workspaces` is a `single`/`root` slot. The official browser
 *      registers at priority 0; this entry registers at priority -1, and the
 *      single-cell shadow rule makes the LOWEST priority the winner — the
 *      sidebar renders this browser instead of the official one.
 *    - This entry deliberately declares NO child slots: the official entry
 *      already declared `sidebar.workspaces.directoryFlow` (a second declaration
 *      of an occupied child key throws). Add Workspace is therefore self-
 *      contained — the shared navigation service + `workspaces.create()`, no
 *      hole.
 *
 * The session tab strip is NOT a second registration. It renders into a DOM
 * seat at the head of the conversation column (`pI_x6G_centerCol`) because that
 * column declares no child slot — its only child is the `main` slot's occupant
 * — so there is nowhere to register. See `tab-seat.ts` for the injection and
 * `SessionTabs.tsx` for the portal.
 *
 *    Two consequences of that choice, both deliberate:
 *    - The strip is a CHILD of this entry's component, so it inherits this
 *      fiber's frame; it needs no injected seam, no cross-entry callback set,
 *      and the rename dialog stays owned by one place.
 *    - The tab store is seated by exactly ONE entry. Registering one handle
 *      under a second, differently-scoped slot throws inside the registry
 *      ("one handle, one scope") and would abort this whole `apply()` — which
 *      is precisely why the strip does not occupy a slot.
 *
 * 0.1.6 适配：导航（选中会话 / New Session / fork / archive / 目录选择）从
 * `ctx.sessions` 抽到 ui-workspace 提供的 `ctx.uiWorkspace` 服务
 * （`ISessions` 现在只有目录 / retain / search 能力，选中由 `mainView` 保留位
 * 表达）。本插件不再自建 connectWorkspace/recentWorkspace 语义，全部委托给该
 * 服务，只保留改名、删除、排序、搜索等数据动作。
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only service merges: sessions/workspaces controllers, the ui-workspace
// navigation service face (ctx.uiWorkspace), locale dictionary seat, the
// SlotRegistry, and the sidebar SlotMap.
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
import type {} from '@deepseek-ai/dsh-api-workspace-controller/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots'
// `useWorkspaces` is contributed by the ui-workspace browser domain (same
// declaration as the official ui-workspace client half).
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { GroupsBrowserInjected } from './contract.ts'
import { createGroupsViewStore } from './stores.ts'
import { createSessionTabsStore } from './tab-store.ts'
import { loadTabs, saveTabs } from './tab-persist.ts'
import { createStoreHook } from './store-hook.ts'
import { shouldOpenTab, type TabOpenMode } from './tabs.ts'
import { GroupsBrowser } from './GroupsBrowser.tsx'
import { directoryFlowFromEntry } from './directory-flow.ts'
import { en, zh, type WorkspaceGroupsKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** The workspace-groups browsing region copy. */
    workspaceGroups: WorkspaceGroupsKey
  }

  interface GlobalStandardProps {
    /** Selector hook over the pure Workspace Controller snapshot. */
    useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'workspaceGroups'

/**
 * Tab visibility policy. `auto` is the behaviour the feature was asked for —
 * opening a session that has no tab yet adds one at the front of the strip;
 * `manual` leaves the strip to callers that drive `openTab` themselves.
 */
const TAB_OPEN_MODE: TabOpenMode = 'auto'

/**
 * Required services (cordis fiber inject; 0.1.6 service roster). `uiWorkspace`
 * is the shipped navigation face this entry delegates selection to.
 */
export const inject = ['slots', 'sessions', 'workspaces', 'uiWorkspace', 'locale']

/**
 * Register the grouped browser once the sidebar slot declaration is on the
 * ledger. Inject factory returns plain callbacks; data reads use the
 * framework's global hooks.
 * @param ctx - client root context.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), '@dsh-xhl/workspace-groups: dictionaries')

  // ONE store, ONE scope. The tab store is seated only by the
  // `sidebar.workspaces` entry below (scope root); the strip reads it as a
  // plain prop because it renders as a CHILD of that entry through a DOM
  // portal, not as a second slot occupant. Seating the same handle under a
  // session-scoped slot as well throws inside the registry
  // (one handle, one scope) and would abort this whole apply().
  const tabsStore = createSessionTabsStore()
  const tabInstance = tabsStore.create()
  const tabWrites = tabInstance.actions

  // Persist the strip on the HOST, not in browser storage: the origin includes
  // the port and every launch picks a new one, so localStorage/sessionStorage
  // both start empty next time.
  //
  // Writes are GATED until the initial restore has settled. The store starts
  // empty and the browser's own effects run before the host read resolves, so an
  // ungated subscriber would write that empty state over the stored tabs —
  // erasing exactly what it was supposed to restore. `hydrated` is the latch.
  let hydrated = false
  ctx.effect(() => {
    const stop = tabInstance.subscribe(() => {
      if (!hydrated) return
      void saveTabs({
        order: tabInstance.getSnapshot().order,
        tabs: tabInstance.getSnapshot().tabs,
      })
    })
    return () => { stop() }
  }, '@dsh-xhl/workspace-groups: tab persistence')

  // Hydrate once from the host, then open the write gate.
  //
  // `restore` is a no-op if the user already opened a tab while this was in
  // flight, so a slow response cannot discard live work. The settle deliberately
  // does NOT write: writing the strip here would erase the stored tabs whenever
  // the read came back empty for a transient reason (host still booting, a
  // dropped request). Only a real state CHANGE persists, via the subscriber.
  ctx.effect(() => {
    let cancelled = false
    void loadTabs().then((tabs) => {
      if (cancelled) return
      if (tabs.length > 0) {
        tabWrites.restore(tabs.map(tab => ({
          sessionId: tab.sessionId as SessionId,
          order: tab.order,
          ...(tab.pinned === true ? { pinned: true } : {}),
          ...(tab.title !== undefined ? { title: tab.title } : {}),
        })))
      }
      hydrated = true
    }).catch(() => {
      // The read failed; leave the gate open so the user's own actions persist,
      // but never write on the strength of a failed read.
      if (!cancelled) hydrated = true
    })
    return () => { cancelled = true }
  }, '@dsh-xhl/workspace-groups: tab restore')

  const searchSessions: GroupsBrowserInjected['searchSessions'] = async (query, signal) => {
    const result = await ctx.sessions.search(query, signal)
    if (!result.ok) throw new Error(result.error.message)
    return result.value
  }

  const browserInjected = (): GroupsBrowserInjected => ({
    // Navigation verbs belong to the shipped ui-workspace service: it owns the
    // retained `mainView` selection, supersession and pending-navigation
    // cancellation (0.1.6 moved them out of `ctx.sessions`).
    startSession: (workspaceId) => { ctx.uiWorkspace.startSession(workspaceId) },
    // Folder rows create a real Session rooted in that folder. `cwd` stays out
    // of the call for the base folder (the Workspace's canonical directory),
    // where the controller already defaults to `WorkspaceView.path`.
    createSessionIn: async (workspaceId, cwd) => {
      const sessionId = await ctx.sessions.create({
        workspaceId,
        ...(cwd === undefined ? {} : { cwd }),
      })
      ctx.uiWorkspace.openSession(sessionId)
      return sessionId
    },
    open: (sessionId) => { ctx.uiWorkspace.openSession(sessionId) },
    forkSession: (sessionId) => {
      ctx.uiWorkspace.forkSession(sessionId).catch((reason: unknown) => {
        console.warn('fork session failed:', reason)
      })
    },
    archiveSession: async (sessionId) => {
      await ctx.uiWorkspace.archiveSession(sessionId)
      // The tab is deliberately LEFT ALONE. Archiving hides the session from the
      // grouped surfaces, but a tab is something the user opened, and the rule
      // for this strip is that only they close one — an automatic close here
      // would silently drop work they were keeping an eye on. The chip keeps
      // rendering (falling back to the session id when the title no longer
      // resolves).
    },
    pickDirectory: () => ctx.uiWorkspace.pickDirectory(),
    // Our shadow entry cannot own/render the official browser's child slot.
    // Reuse the elected self-contained picker and its actual injected services.
    getDirectoryFlow: () => directoryFlowFromEntry(ctx.slots.entriesOfSlot('sidebar.workspaces.directoryFlow')[0]),
    createDirectory: (path, name) => ctx.uiWorkspace.createDirectory(path, name),
    searchSessions,
    searchResultLimit: ctx.sessions.searchResultLimit,
    // Directory-flow hole occupancy. The official ui-workspace browser gates
    // its "Add workspace…" affordance on the hole being occupied (the shipped
    // picker package's client half fills it); this browser drives the picker
    // itself through `pickDirectory`, so it must keep the hole occupied or the
    // official entry (still live at priority 0) would silently withdraw the
    // affordance.
    hooks: {
      directoryFlow: {
        getSnapshot: () => true,
        subscribe: () => () => {},
      },
    },
    // Data-only verbs stay on the controllers.
    renameSession: async (sessionId, title) => {
      const session = ctx.sessions.binding(sessionId)?.session
      if (session === undefined) throw new Error(`unknown session "${sessionId}"`)
      const result = await session.rename(title)
      if (!result.ok) throw new Error(result.error.message)
    },
    renameWorkspace: async (workspaceId, title) => { await ctx.workspaces.rename(workspaceId, title) },
    deleteWorkspace: async (workspaceId) => { await ctx.workspaces.delete(workspaceId) },
    insertWorkspaceBefore: async (workspaceId, beforeWorkspaceId) => {
      await ctx.workspaces.insertBefore(workspaceId, beforeWorkspaceId)
    },
    insertSessionBefore: async (workspaceId, sessionId, beforeSessionId) => {
      await ctx.workspaces.insertSessionBefore(workspaceId, sessionId, beforeSessionId)
    },
    createWorkspace: input => ctx.workspaces.create(input),
    // "Show a tab for what I just opened" — but only while it is actually in
    // play. The browser decides per session (see `shouldOpenTab`): a draft that
    // has not been talked to, and settled history, both stay out of the strip.
    // The status arrives from the caller because it is a live UI fact read
    // through a hook, which this (non-React) factory cannot reach.
    openTab: (sessionId, status) => {
      const summary = ctx.sessions.list.getSnapshot().byId[sessionId]
      if (shouldOpenTab(TAB_OPEN_MODE, summary, status)) tabWrites.touch(sessionId)
    },
    // The strip rides this entry's own store seat, so it needs both faces
    // explicitly: a selector hook over the one live instance, and the baked
    // writes. Both come from the same instance the browser writes through.
    useTabs: createStoreHook(tabInstance),
    tabActions: tabWrites,
  })

  // priority: -1 — lower than the official browser's default 0, so the
  // single-slot shadow rule elects this entry. No children declaration: the
  // official entry already owns `sidebar.workspaces.directoryFlow`.
  //
  // The official WorkspaceBrowser entry is NEVER disposed — shadowing only
  // changes which entry renders (activation just bumps the store's mount
  // count). Both entries live at the same cell, so if this one ever throws
  // during render the slot core retires it for the rest of its registration's
  // life and silently falls back to the official browser. Anything that can
  // throw belongs outside the hot path.
  ctx.slots.inject('sidebar.workspaces', () => ctx.slots.register(
    {
      name: 'sidebar.workspaces',
      priority: -1,
      store: createGroupsViewStore(),
      inject: browserInjected,
      locale: NS,
      registrant: 'workspace-groups-local',
    },
    GroupsBrowser,
  ))
}
