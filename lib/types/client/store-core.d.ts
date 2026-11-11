/**
 * Pure expansion-state transforms for the workspace-groups store. Kept free
 * of any runtime import so both the store (which binds them via defineStore)
 * and unit tests (which exercise them directly) share one implementation.
 *
 * Expansion semantics follow the official ui-workspace store: collapse
 * WRITES `false` (never deletes the key). The browser's auto-expand guard
 * uses `Object.hasOwn` — a present `false` means "user deliberately
 * collapsed this" and must NOT be re-expanded; only a fully absent key means
 * "never touched" and may auto-expand. (Earlier versions deleted the key on
 * collapse, which made the current category/workspace impossible to fold.)
 */
/** Workspace-groups browser viewing state persisted across surface remounts and reloads. */
export interface GroupsViewState {
    /** Category folder expansion keyed by category label (absent = never touched). */
    categoryExpansion: Record<string, boolean>;
    /** Workspace folder expansion keyed by workspace id (absent = never touched). */
    workspaceExpansion: Record<string, boolean>;
}
/** Collapse writes `false` (key retained); expand writes `true`. */
export declare function setCategoryExpandedImpl(state: GroupsViewState, key: string, expanded: boolean): void;
/** Collapse writes `false` (key retained); expand writes `true`. */
export declare function setWorkspaceExpandedImpl(state: GroupsViewState, key: string, expanded: boolean): void;
/** Drop expansion keys that no longer exist (renames/deletes/config edits). */
export declare function retainKeysImpl(state: GroupsViewState, categoryKeys: readonly string[], workspaceKeys: readonly string[]): void;
