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
import type { Context } from '@deepseek-ai/cordis';
import type { SnapshotSelectorHook } from '@deepseek-ai/dsh-client-ui-slots';
import type { WorkspaceSnapshot } from '@deepseek-ai/dsh-api-workspace-controller/client';
import { type WorkspaceGroupsKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        /** The workspace-groups browsing region copy. */
        workspaceGroups: WorkspaceGroupsKey;
    }
    interface GlobalStandardProps {
        /** Selector hook over the pure Workspace Controller snapshot. */
        useWorkspaces: SnapshotSelectorHook<WorkspaceSnapshot>;
    }
}
/**
 * Required services (cordis fiber inject; 0.1.6 service roster). `uiWorkspace`
 * is the shipped navigation face this entry delegates selection to.
 */
export declare const inject: string[];
/**
 * Register the grouped browser once the sidebar slot declaration is on the
 * ledger. Inject factory returns plain callbacks; data reads use the
 * framework's global hooks.
 * @param ctx - client root context.
 */
export declare function apply(ctx: Context): void;
