import type { GroupsBrowserProps } from './contract.ts';
/** Row reference used by drop targets: which kind of row, which key. */
export type DropRowRef = {
    kind: 'category' | 'workspace' | 'topLevel';
    key: string;
};
/**
 * Which level's rows fold while a drag is in progress: dragging a project
 * folds every project row (grouped AND top-level), dragging a group folds
 * every group row. The other level keeps its expansion untouched.
 */
export type DragLevel = 'workspace' | 'category' | null;
/**
 * Current drop indicator. A `line` renders a 2px insertion line above/below a
 * row (project reorder inside a group, or group reorder); an `into` renders
 * the whole-row highlight used when dropping a project into a group. Drop
 * handlers re-derive before/after from the drop event itself, so the
 * indicator is purely visual and can never go stale.
 */
export type DragIndicator = {
    mode: 'line';
    row: DropRowRef;
    before: boolean;
} | {
    mode: 'into';
    categoryKey: string;
} | null;
/**
 * Render the browsing region.
 * @param props - composed slot props (shell owner share + store + injected actions).
 * @returns the region element tree.
 */
export declare function GroupsBrowser({ wide, expandSidebar, useSessions, useWorkspaces, useSessionStatus, useStore, actions, startSession, createSessionIn, open, renameSession, forkSession, renameWorkspace, deleteWorkspace, insertWorkspaceBefore, archiveSession, insertSessionBefore, createWorkspace, pickDirectory, getDirectoryFlow, createDirectory, searchSessions, searchResultLimit, openTab, useTabs, tabActions, t, }: GroupsBrowserProps): import("react").JSX.Element;
