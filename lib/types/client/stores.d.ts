/**
 * The workspace-groups viewing store: category / workspace folder expansion,
 * persisted across reloads under an independent key (the official
 * ui-workspace store keeps its own `dsh.workspace.view.v5` — we never touch
 * it). Module level exports the factory only (a module-level handle would pin
 * the store identity across plugin reloads); register() receives the factory
 * and the browser derives its PropsStore share from the return type.
 *
 * The action implementations live in `store-core.ts` (pure, runtime-free) so
 * unit tests exercise the real semantics without a browser module loader;
 * this file only binds them through defineStore.
 */
import { type EngineStoreHandle } from '@deepseek-ai/dsh-client-store';
import { retainKeysImpl, setCategoryExpandedImpl, setWorkspaceExpandedImpl, type GroupsViewState } from './store-core.ts';
/** Annotation twin of the actions literal below (structural type, satisfies `ActionsDecl`). */
type GroupsViewActions = {
    setCategoryExpanded: typeof setCategoryExpandedImpl;
    setWorkspaceExpanded: typeof setWorkspaceExpandedImpl;
    retainKeys: typeof retainKeysImpl;
};
/**
 * Create the workspace-groups viewing store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export declare function createGroupsViewStore(): EngineStoreHandle<GroupsViewState, GroupsViewActions>;
export type { GroupsViewState } from './store-core.ts';
