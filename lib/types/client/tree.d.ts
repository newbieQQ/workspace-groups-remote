/**
 * Derives the three-level workspace-groups tree: 分类文件夹 → 项目文件夹 →
 * 会话行. Pure derivation — all inputs are snapshots; the renderer never
 * scans. Session visibility rules mirror the official ui-workspace tree
 * (blank rows only when current, archived excluded, subagent rows excluded).
 */
import type { SessionListState, SessionSearchResultItem } from '@deepseek-ai/dsh-api-session-controller/client';
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import { type FoldersDocument } from '../core/folders.ts';
import { type CategoryAppearance, type GroupsConfig, type ManualGroups } from '../core/types.ts';
/** Pending interaction kinds with dedicated Workspace-row presentation. */
export type SessionPendingInteractionStatus = 'approval' | 'plan-review' | 'question';
/** Current unified UI status by Session (ui-session snapshot). */
type SessionStatuses = SessionStatusSnapshot;
/**
 * The Session the Conversation is currently showing.
 *
 * 0.1.6 removed `SessionListState.current`: selection is expressed as the
 * Session retained through the `mainView` reference source (the ui-workspace
 * navigation holds exactly one). Same read the official browser performs.
 * @param list - sessions list snapshot.
 * @returns the retained Session id, or undefined while no Session is selected.
 */
export declare function currentSessionId(list: SessionListState): SessionId | undefined;
/** One top-level session row inside a workspace folder. */
export interface SessionNode {
    id: SessionId;
    /** Stored display title; blank rows show the localized New Session label. */
    title: string;
    /** The provisional blank session (renderer shows the localized New Session title). */
    blank: boolean;
    pendingInteraction?: SessionPendingInteractionStatus;
    running: boolean;
    /** Running descendants connected through uninterrupted subagent-origin lineage. */
    runningSubagentCount: number;
    /** Finished running while not selected and not yet opened (the green "done" reminder dot). */
    completed: boolean;
    updatedAt: number;
    /** Search-hit marker (rendered with a highlighted tint in search mode). */
    matched?: boolean;
    /** Content-match snippet from the Host search (search mode only). */
    snippet?: string;
}
/** One folder row inside a workspace folder (base or extra). */
export interface FolderNode {
    /** Absolute folder path. */
    path: string;
    /** Display label: last path segment, or the whole path for drive roots. */
    label: string;
    /** The workspace's default target for new sessions (★). */
    isRoot: boolean;
    expanded: boolean;
    /** The workspace's own canonical directory (folder #0); cannot be removed. */
    isBase: boolean;
    /** Visible sessions whose recorded cwd lives inside this folder. */
    sessions: readonly SessionNode[];
}
/** One workspace folder row inside a category folder. */
export interface WorkspaceGroupNode {
    workspaceId: WorkspaceId;
    /** Canonical host directory path. */
    path: string;
    /** Display title. */
    label: string;
    /** Workspace creation time (epoch ms). */
    createdAt: number;
    /** Total visible sessions in the folder (every folder included). */
    sessionCount: number;
    expanded: boolean;
    /** The folder contains the selected session (active folder tint). */
    containsCurrent: boolean;
    /** Base-owned visible session rows (empty while the folder is folded). */
    sessions: readonly SessionNode[];
    /**
     * Folder rows, present only when the workspace carries at least one extra
     * folder: root first, then stored order, base included. Absent means "this
     * workspace has exactly one directory", the plain pre-folders node shape.
     */
    folders?: readonly FolderNode[];
}
/** One category folder at the top of the tree. */
export interface CategoryNode {
    /** Stable category key: the configured label, or the uncategorized bucket. */
    key: string;
    /** Display label. */
    label: string;
    expanded: boolean;
    /** The category contains the selected session (active folder tint). */
    containsCurrent: boolean;
    /** Workspace folders in host order. */
    workspaces: readonly WorkspaceGroupNode[];
    /** Presentation (color / icon / pin) for this category, when configured. */
    appearance?: CategoryAppearance;
}
/** Viewing state consumed by the derivation. */
export interface GroupsTreeView {
    expandedCategories: readonly string[];
    expandedWorkspaces: readonly string[];
    /**
     * Collapsed folder rows, keyed by `folderKey(workspaceId, path)`. Folders are
     * expanded by default: adding a folder must never hide the sessions that used
     * to show flat under the project.
     */
    collapsedFolders?: readonly string[];
}
/** Key of the uncategorized bucket (matches the config fallback label). */
export declare const UNCATEGORIZED_KEY = "\u672A\u5206\u7C7B";
/** Whether this category key names the "not yet classified" bucket. */
export declare function isDockedCategoryKey(key: string): boolean;
/** Directory display label: basename of the path (both separators accepted). */
export declare function workspaceLabel(cwd: string | undefined): string;
/** A workspace-backed ("member") folder resolved against the workspace list. */
export interface MemberWorkspaces {
    /** Member workspace id → owning workspace id (the rows to hide). */
    absorbed: ReadonlyMap<string, string>;
    /** Owning workspace id → member workspaces in stored folder order. */
    byOwner: ReadonlyMap<string, readonly WorkspaceView[]>;
}
/**
 * Resolve the workspace-backed folders of every project.
 *
 * A member folder is a real DSH workspace whose OWN row must disappear: its
 * sessions are rendered under its owner's folder row instead, so one project can
 * carry local and cloud (SSH-mirrored) folders at once. Members the Host no
 * longer knows are dropped from the index — the folder row survives (its path is
 * still stored) but shows no sessions.
 * @param workspaces - real workspaces in Host order.
 * @param folders - per-workspace extra folders + members + root.
 */
export declare function memberWorkspaces(workspaces: readonly WorkspaceView[], folders?: FoldersDocument): MemberWorkspaces;
/**
 * Display label of one folder: the last path segment. A drive root (`C:\`) or
 * the POSIX root has no segment, so the whole path is the honest label.
 * @param path - absolute folder path.
 */ export declare function folderLabel(path: string): string;
/** Stable identity of one folder row (same path may live under two workspaces). */
export declare function folderKey(workspaceId: WorkspaceId, path: string): string;
/**
 * Derive the three-level tree.
 * @param list - sessions list snapshot (`current` feeds containsCurrent).
 * @param workspaces - real workspaces in stable Host order.
 * @param archivedSessionIds - registry-global archive set.
 * @param config - sidecar grouping config (rule categories).
 * @param view - local expansion arrays.
 * @param manual - runtime overlay (manual groups + overrides). A workspace's
 * manual override wins over rule classification; removing it reverts to rules.
 * @param statuses - unified UI status by Session (drives the running / warning
 * / unread-completion row indicators); defaults to none (tests).
 * @param folders - per-workspace extra folders + root. A workspace with extras
 * gains folder rows and its extra-folder sessions move under them; a workspace
 * without extras keeps exactly the pre-folders node shape.
 * @returns category sections in render order (rule categories first, then
 * manual-only ones, uncategorized last). Manual groups render even while
 * empty; empty rule buckets stay hidden.
 */
export declare function deriveGroups(list: SessionListState, workspaces: readonly WorkspaceView[], archivedSessionIds: readonly SessionId[], config: GroupsConfig, view: GroupsTreeView, manual: ManualGroups, statuses?: SessionStatuses, folders?: FoldersDocument): CategoryNode[];
/**
 * Top-level (ungrouped) workspace rows: workspaces resolving to no category
 * (no manual override and no matching rule, or a forced `null` override).
 * Rendered after the group folders as plain project rows (not inside any
 * folder), in manual top-level order (`workspaceOrder[TOP_LEVEL_ORDER_KEY]`),
 * falling back to host registration order.
 */
export declare function deriveTopLevel(list: SessionListState, workspaces: readonly WorkspaceView[], archivedSessionIds: readonly SessionId[], config: GroupsConfig, view: GroupsTreeView, manual: ManualGroups, statuses?: SessionStatuses, folders?: FoldersDocument): WorkspaceGroupNode[];
/**
 * The Host's default workspace as a standalone node for the pinned bottom bar.
 *
 * The default workspace is not part of the grouping tree (it is excluded from
 * `deriveGroups`, `deriveTopLevel` and the search results), yet it keeps the
 * full workspace-row behaviour: expansion, session count, its sessions and its
 * extra folders. This derives exactly that node, reusing the same visibility,
 * folder partitioning and current-session marking as the tree.
 *
 * @param list - sessions list snapshot.
 * @param workspaces - real workspaces in stable Host order.
 * @param archivedSessionIds - registry-global archive set.
 * @param view - local expansion arrays.
 * @param statuses - unified UI status by Session.
 * @param folders - per-workspace extra folders + root.
 * @returns the default workspace node, or undefined when the Host has none.
 */
export declare function deriveDefaultWorkspace(list: SessionListState, workspaces: readonly WorkspaceView[], archivedSessionIds: readonly SessionId[], view: GroupsTreeView, statuses?: SessionStatuses, folders?: FoldersDocument): WorkspaceGroupNode | undefined;
/** Bounded set of matched sessions plus content snippets (feeds the search tree). */
export interface SearchMatchSet {
    /** Session ids that matched (local metadata hits + Host content hits). */
    matchedIds: ReadonlySet<SessionId>;
    /** Content-match snippets keyed by session id (Host search only). */
    snippetsBySession: ReadonlyMap<SessionId, string>;
    hasMore: boolean;
}
/**
 * Compute the matched-session set: immediate title/Workspace substring matches
 * from the local list, merged with ranked Host content matches. The consumer
 * (SearchBody) derives the pruned three-level tree from these ids.
 */
export declare function deriveSearchMatches(list: SessionListState, workspaces: readonly WorkspaceView[], config: GroupsConfig, query: string, archivedSessionIds: readonly SessionId[], content: {
    items: readonly SessionSearchResultItem[];
    hasMore: boolean;
}, limit: number, folders?: FoldersDocument): SearchMatchSet;
/** Search tree: group folders plus top-level (ungrouped) matched workspaces. */
export interface SearchTree {
    /** Group folders containing matched sessions, in display order. */
    categories: CategoryNode[];
    /** Top-level (ungrouped) workspaces holding matched sessions. */
    topLevel: WorkspaceGroupNode[];
    /**
     * The Host default workspace's matched branch, when it has a hit. It is
     * rendered in the pinned bottom bar instead of the results list, so a hit
     * never makes the default workspace appear twice.
     */
    defaultWorkspace?: WorkspaceGroupNode;
}
/**
 * Build a three-level search tree containing ONLY the branches that hold a
 * matched session: 分类文件夹 → 项目文件夹 → 命中会话行. Every matched
 * session carries `matched: true` so rows render with the search-hit tint.
 * Classification uses the same precedence as the idle tree (manual override →
 * rules), so search shows the same grouping the user sees. Matched top-level
 * workspaces are returned separately (rendered as plain rows).
 *
 * @param list - sessions list snapshot.
 * @param workspaces - real workspaces in stable Host order.
 * @param config - sidecar grouping config.
 * @param matchedIds - set of session ids that matched the query.
 * @param archivedSessionIds - registry-global archive set.
 * @param manual - runtime overlay (manual groups + overrides).
 * @param snippetsBySession - optional content-match snippets keyed by session id.
 * @param statuses - unified UI status by Session (drives the running / warning
 * / unread-completion row indicators); defaults to none (tests).
 * @param folders - per-workspace extra folders + root, so a hit inside an extra
 * folder surfaces under that folder instead of flat under the project.
 * @returns group folders in render order plus top-level matched workspaces,
 * pruned to matched branches only.
 */
export declare function deriveSearchGroups(list: SessionListState, workspaces: readonly WorkspaceView[], config: GroupsConfig, matchedIds: ReadonlySet<SessionId>, archivedSessionIds: readonly SessionId[], manual: ManualGroups, snippetsBySession?: ReadonlyMap<SessionId, string>, statuses?: SessionStatuses, folders?: FoldersDocument): SearchTree;
export {};
