/**
 * Derives the three-level workspace-groups tree: 分类文件夹 → 项目文件夹 →
 * 会话行. Pure derivation — all inputs are snapshots; the renderer never
 * scans. Session visibility rules mirror the official ui-workspace tree
 * (blank rows only when current, archived excluded, subagent rows excluded).
 */
import type {
  SessionListState,
  SessionSearchResultItem,
  SessionSummary,
} from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
// Type-only: the unified UI status snapshot. 0.1.6 把 running / pendingInteraction /
// 未读完成提示收敛为 ui-session 的 SessionStatusSnapshot；SessionSummary.completed
// 与 SessionListState.current 同时移除，当前会话改由 `mainView` 保留位推导。
import type { SessionStatus, SessionStatusSnapshot } from '@deepseek-ai/dsh-client-ui-session/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { indexSubagentDescendants, type SubagentDescendantSummary } from './subagent-lineage.ts'
import { isDefaultWorkspace } from '../core/default-workspace.ts'
import { categoryAppearance, effectiveCategories, orderedWorkspaceIds, resolveCategory } from '../core/matcher.ts'
import {
  absorbedWorkspaceIds,
  EMPTY_FOLDERS_DOCUMENT,
  effectiveFolders,
  entryFor,
  folderOfCwd,
  rootOf,
  samePath,
  type FoldersDocument,
  type WorkspaceFolderEntry,
} from '../core/folders.ts'
import {
  TOP_LEVEL_ORDER_KEY,
  UNCATEGORIZED_LABEL,
  type CategoryAppearance,
  type GroupsConfig,
  type ManualGroups,
} from '../core/types.ts'

/** Pending interaction kinds with dedicated Workspace-row presentation. */
export type SessionPendingInteractionStatus = 'approval' | 'plan-review' | 'question'

/** Current unified UI status by Session (ui-session snapshot). */
type SessionStatuses = SessionStatusSnapshot

/**
 * The Session the Conversation is currently showing.
 *
 * 0.1.6 removed `SessionListState.current`: selection is expressed as the
 * Session retained through the `mainView` reference source (the ui-workspace
 * navigation holds exactly one). Same read the official browser performs.
 * @param list - sessions list snapshot.
 * @returns the retained Session id, or undefined while no Session is selected.
 */
export function currentSessionId(list: SessionListState): SessionId | undefined {
  return Object.values(list.byId).find(session => (session.retainedBy?.mainView ?? 0) > 0)?.id
}

/** Keep navigation presentation independent from domain-owned interaction objects. */
function visiblePendingKind(kind: string | undefined): SessionPendingInteractionStatus | undefined {
  switch (kind) {
    case 'approval':
    case 'plan-review':
    case 'question':
      return kind
    default:
      return undefined
  }
}

/** One top-level session row inside a workspace folder. */
export interface SessionNode {
  id: SessionId
  /** Stored display title; blank rows show the localized New Session label. */
  title: string
  /** The provisional blank session (renderer shows the localized New Session title). */
  blank: boolean
  pendingInteraction?: SessionPendingInteractionStatus
  running: boolean
  /** Running descendants connected through uninterrupted subagent-origin lineage. */
  runningSubagentCount: number
  /** Finished running while not selected and not yet opened (the green "done" reminder dot). */
  completed: boolean
  updatedAt: number
  /** Search-hit marker (rendered with a highlighted tint in search mode). */
  matched?: boolean
  /** Content-match snippet from the Host search (search mode only). */
  snippet?: string
}

/** One folder row inside a workspace folder (base or extra). */
export interface FolderNode {
  /** Absolute folder path. */
  path: string
  /** Display label: last path segment, or the whole path for drive roots. */
  label: string
  /** The workspace's default target for new sessions (★). */
  isRoot: boolean
  expanded: boolean
  /** The workspace's own canonical directory (folder #0); cannot be removed. */
  isBase: boolean
  /** Visible sessions whose recorded cwd lives inside this folder. */
  sessions: readonly SessionNode[]
}

/** One workspace folder row inside a category folder. */
export interface WorkspaceGroupNode {
  workspaceId: WorkspaceId
  /** Canonical host directory path. */
  path: string
  /** Display title. */
  label: string
  /** Workspace creation time (epoch ms). */
  createdAt: number
  /** Total visible sessions in the folder (every folder included). */
  sessionCount: number
  expanded: boolean
  /** The folder contains the selected session (active folder tint). */
  containsCurrent: boolean
  /** Base-owned visible session rows (empty while the folder is folded). */
  sessions: readonly SessionNode[]
  /**
   * Folder rows, present only when the workspace carries at least one extra
   * folder: root first, then stored order, base included. Absent means "this
   * workspace has exactly one directory", the plain pre-folders node shape.
   */
  folders?: readonly FolderNode[]
}

/** One category folder at the top of the tree. */
export interface CategoryNode {
  /** Stable category key: the configured label, or the uncategorized bucket. */
  key: string
  /** Display label. */
  label: string
  expanded: boolean
  /** The category contains the selected session (active folder tint). */
  containsCurrent: boolean
  /** Workspace folders in host order. */
  workspaces: readonly WorkspaceGroupNode[]
  /** Presentation (color / icon / pin) for this category, when configured. */
  appearance?: CategoryAppearance
}

/** Viewing state consumed by the derivation. */
export interface GroupsTreeView {
  expandedCategories: readonly string[]
  expandedWorkspaces: readonly string[]
  /**
   * Collapsed folder rows, keyed by `folderKey(workspaceId, path)`. Folders are
   * expanded by default: adding a folder must never hide the sessions that used
   * to show flat under the project.
   */
  collapsedFolders?: readonly string[]
}

/** Key of the uncategorized bucket (matches the config fallback label). */
export const UNCATEGORIZED_KEY = UNCATEGORIZED_LABEL

/**
 * Names the "not sorted yet" bucket commonly gets. A group whose key matches one
 * of these is docked to the bottom of the sidebar (above the default-workspace
 * row) instead of taking a slot in the tree, so the workspaces a user has not
 * classified yet never push the classified tree around.
 */
const DOCKED_CATEGORY_PATTERN = /^(?:未归类|未分类|未分组|未排序|待归类|ungrouped|uncategorized|unsorted)$/iu

/** Whether this category key names the "not yet classified" bucket. */
export function isDockedCategoryKey(key: string): boolean {
  return DOCKED_CATEGORY_PATTERN.test(key.trim())
}

/** Directory display label: basename of the path (both separators accepted). */
export function workspaceLabel(cwd: string | undefined): string {
  if (cwd === undefined || cwd === '') return UNCATEGORIZED_LABEL
  const base = cwd.replace(/[/\\]+$/, '').split(/[/\\]/).pop()
  return base !== undefined && base !== '' ? base : cwd
}

/** Ordinary sessions are visible; blank only when current; archived/subagent never. */
function sessionVisible(session: SessionSummary, current: SessionId | undefined, archived: ReadonlySet<SessionId>): boolean {
  return session.origin !== 'subagent'
    && !archived.has(session.id)
    && (!session.blank || session.id === current)
}

/** Blank rows display the localized New Session label (never enters search). */
function sessionTitle(session: SessionSummary): string {
  return session.blank ? 'New Session' : session.displayTitle
}

function sessionNode(
  s: SessionSummary,
  descendants: ReadonlyMap<SessionId, SubagentDescendantSummary>,
  statuses: SessionStatuses,
): SessionNode {
  // `SessionStatusSnapshot` is typed as ReadonlyMap, but the framework binds a
  // plain record at runtime (client.js: `statuses[sessionId]`). Read both shapes
  // so a hook backed by an object never throws "statuses.get is not a function".
  const status = typeof (statuses as { get?: unknown } | undefined)?.get === 'function'
    ? statuses.get(s.id)
    : (statuses as unknown as Record<string, SessionStatus | undefined>)[s.id]
  const pending = visiblePendingKind(status?.pendingInteraction?.kind)
  return {
    id: s.id,
    title: sessionTitle(s),
    blank: s.blank,
    running: status?.running ?? s.running,
    runningSubagentCount: descendants.get(s.id)?.runningCount ?? 0,
    completed: status?.completionUnread === true,
    updatedAt: s.updatedAt,
    ...(pending === undefined ? {} : { pendingInteraction: pending }),
  }
}

/** Visible sessions of one workspace in its stored account order. */
function workspaceSessions(
  list: SessionListState,
  workspace: WorkspaceView,
  archived: ReadonlySet<SessionId>,
  descendants: ReadonlyMap<SessionId, SubagentDescendantSummary>,
  statuses: SessionStatuses,
  current: SessionId | undefined,
): SessionNode[] {
  const nodes: SessionNode[] = []
  for (const id of workspace.sessionIds) {
    const summary = list.byId[id]
    if (summary === undefined) continue // account may lead the list pull; appears when the summary lands
    if (!sessionVisible(summary, current, archived)) continue
    nodes.push(sessionNode(summary, descendants, statuses))
  }
  return nodes
}

/** A workspace-backed ("member") folder resolved against the workspace list. */
export interface MemberWorkspaces {
  /** Member workspace id → owning workspace id (the rows to hide). */
  absorbed: ReadonlyMap<string, string>
  /** Owning workspace id → member workspaces in stored folder order. */
  byOwner: ReadonlyMap<string, readonly WorkspaceView[]>
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
export function memberWorkspaces(
  workspaces: readonly WorkspaceView[],
  folders: FoldersDocument = EMPTY_FOLDERS_DOCUMENT,
): MemberWorkspaces {
  const byId = new Map<string, WorkspaceView>()
  for (const workspace of workspaces) byId.set(workspace.workspaceId as string, workspace)
  // Only an owner that still exists may hide a row: if the project itself is gone,
  // its members must come back as their own rows instead of staying invisible. A
  // chained member (an absorbed project that owns members of its own) is refused
  // for the same reason — nesting would swallow the inner sessions.
  const stored = absorbedWorkspaceIds(folders)
  const absorbed = new Map<string, string>()
  for (const [memberId, ownerId] of stored) {
    if (!byId.has(ownerId) || stored.has(ownerId)) continue
    absorbed.set(memberId, ownerId)
  }
  const byOwner = new Map<string, WorkspaceView[]>()
  for (const [ownerId, entry] of Object.entries(folders.workspaces)) {
    for (const member of entry.members ?? []) {
      if (absorbed.get(member.workspaceId) !== ownerId) continue
      const view = byId.get(member.workspaceId)
      if (view === undefined) continue
      const bucket = byOwner.get(ownerId)
      if (bucket === undefined) byOwner.set(ownerId, [view])
      else bucket.push(view)
    }
  }
  return { absorbed, byOwner }
}

/** Visible sessions of a project: its own rows plus every member folder's rows. */
function sessionsWithMembers(
  list: SessionListState,
  workspace: WorkspaceView,
  members: readonly WorkspaceView[],
  archived: ReadonlySet<SessionId>,
  descendants: ReadonlyMap<SessionId, SubagentDescendantSummary>,
  statuses: SessionStatuses,
  current: SessionId | undefined,
): SessionNode[] {
  if (members.length === 0) {
    return workspaceSessions(list, workspace, archived, descendants, statuses, current)
  }
  const nodes = workspaceSessions(list, workspace, archived, descendants, statuses, current)
  for (const member of members) {
    nodes.push(...workspaceSessions(list, member, archived, descendants, statuses, current))
  }
  return nodes
}

/** Whether a session lives in this project or in one of its member folders. */
function projectHoldsSession(
  workspace: WorkspaceView,
  members: readonly WorkspaceView[],
  sessionId: SessionId | undefined,
): boolean {
  if (sessionId === undefined) return false
  if (workspace.sessionIds.includes(sessionId)) return true
  return members.some(member => member.sessionIds.includes(sessionId))
}

/**
 * Display label of one folder: the last path segment. A drive root (`C:\`) or
 * the POSIX root has no segment, so the whole path is the honest label.
 * @param path - absolute folder path.
 */export function folderLabel(path: string): string {
  const trimmed = path.replace(/[/\\]+$/u, '')
  if (trimmed === '' || /^[A-Za-z]:$/u.test(trimmed)) return path
  const base = trimmed.split(/[/\\]/u).pop()
  return base !== undefined && base !== '' ? base : path
}

/** Stable identity of one folder row (same path may live under two workspaces). */
export function folderKey(workspaceId: WorkspaceId, path: string): string {
  return `${workspaceId}\u0000${path}`
}

/**
 * Display labels for member folders.
 *
 * A cloud member's directory is a locally generated mirror id (`wabc123`), which
 * says nothing to the user: its REMOTE path or title is the honest label. Local
 * members keep the last path segment, like every other folder.
 * @param folders - per-workspace folders + members.
 */
function memberFolderLabels(entry: WorkspaceFolderEntry | undefined): Map<string, string> {
  const labels = new Map<string, string>()
  for (const member of entry?.members ?? []) {
    const label = member.kind === 'remote'
      ? (member.title ?? folderLabel(member.remotePath ?? member.path))
      : folderLabel(member.path)
    if (label !== '') labels.set(member.path, label)
  }
  return labels
}

/**
 * Split a workspace's visible sessions between its base directory and its extra
 * folders. Sessions keep the order they already had inside their owner, and a
 * workspace with no extra folder returns its sessions untouched — the pre-
 * folders node shape (no `folders` key at all).
 * @param workspaceId - owning workspace.
 * @param workspacePath - canonical directory (folder #0).
 * @param sessions - every visible session of the workspace, in host order.
 * @param list - sessions list snapshot (records each session's cwd).
 * @param entry - saved extra folders + root for this workspace.
 * @param collapsedFolders - collapsed folder-row keys. Undefined means "nothing
 * is collapsed", which is both the default view and what search uses so every
 * hit is visible without another click.
 */
function applyFolders(
  workspaceId: WorkspaceId,
  workspacePath: string,
  sessions: readonly SessionNode[],
  list: SessionListState,
  entry: WorkspaceFolderEntry | undefined,
  collapsedFolders: ReadonlySet<string> | undefined,
): { sessions: readonly SessionNode[]; folders?: readonly FolderNode[] } {
  const labels = memberFolderLabels(entry)
  const extras = effectiveFolders(workspacePath, entry).slice(1)
  if (extras.length === 0) return { sessions }
  const root = rootOf(workspacePath, entry)
  const base: SessionNode[] = []
  const byFolder = new Map<string, SessionNode[]>()
  for (const node of sessions) {
    const owner = folderOfCwd(list.byId[node.id]?.cwd, workspacePath, entry)
    if (samePath(owner, workspacePath)) {
      base.push(node)
      continue
    }
    const bucket = byFolder.get(owner)
    if (bucket === undefined) byFolder.set(owner, [node])
    else bucket.push(node)
  }
  const folderNode = (path: string, isBase: boolean): FolderNode => {
    const owned = isBase ? base : (byFolder.get(path) ?? [])
    return {
      path,
      label: labels.get(path) ?? folderLabel(path),
      isRoot: samePath(path, root),
      expanded: collapsedFolders === undefined || !collapsedFolders.has(folderKey(workspaceId, path)),
      isBase,
      // Every owned session is kept on the node so the row's count stays honest
      // while the folder is collapsed; the RowGroup does the hiding.
      sessions: owned,
    }
  }
  const folders: FolderNode[] = [
    folderNode(workspacePath, true),
    ...extras.map(path => folderNode(path, false)),
  ]
  // Root first, then stored order: moving the root row to the front keeps the
  // remaining rows (base included) in their stored order.
  const rootIndex = folders.findIndex(folder => folder.isRoot)
  if (rootIndex > 0) {
    const [rootFolder] = folders.splice(rootIndex, 1)
    if (rootFolder !== undefined) folders.unshift(rootFolder)
  }
  return { sessions: base, folders }
}

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
export function deriveGroups(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  archivedSessionIds: readonly SessionId[],
  config: GroupsConfig,
  view: GroupsTreeView,
  manual: ManualGroups,
  statuses: SessionStatuses = new Map(),
  folders: FoldersDocument = EMPTY_FOLDERS_DOCUMENT,
): CategoryNode[] {
  const archived = new Set(archivedSessionIds)
  const expandedCategories = new Set(view.expandedCategories)
  const expandedWorkspaces = new Set(view.expandedWorkspaces)
  const collapsedFolders = new Set(view.collapsedFolders ?? [])
  const descendants = indexSubagentDescendants(list.byId)
  const current = currentSessionId(list)
  const members = memberWorkspaces(workspaces, folders)

  // Bucket workspaces by display key. Seed with every effective category so
  // manual groups render while empty. Top-level (ungrouped) workspaces are
  // handled by deriveTopLevel and never land here.
  const byCategory = new Map<string, WorkspaceView[]>()
  for (const { key } of effectiveCategories(config, manual)) {
    byCategory.set(key, [])
  }
  for (const workspace of workspaces) {
    // The Host default workspace is pinned to its own bottom bar, never grouped.
    if (isDefaultWorkspace(workspace)) continue
    // Member folders render inside their owner; their own row is not a project.
    if (members.absorbed.has(workspace.workspaceId as string)) continue
    const key = resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title)
    if (key === undefined) continue // top-level — rendered by deriveTopLevel
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(workspace)
  }

  const manualCategories = new Set(manual.categories)
  const currentWorkspaceId = current === undefined
    ? undefined
    : workspaces.find(w => !members.absorbed.has(w.workspaceId as string)
      && projectHoldsSession(w, members.byOwner.get(w.workspaceId as string) ?? [], current))?.workspaceId

  const nodes: CategoryNode[] = []
  // Effective categories in display order (categoryOrder applied).
  for (const key of effectiveCategories(config, manual).map(e => e.key)) {
    const bucket = byCategory.get(key) ?? []
    // Manual groups stay visible while empty; everything else hides when empty.
    if (bucket.length === 0 && !manualCategories.has(key)) continue
    const expanded = expandedCategories.has(key)
    const ordered = orderedWorkspaceIds(manual, key, bucket.map(w => w.workspaceId as string))
    const workspaceNodes: WorkspaceGroupNode[] = []
    let containsCurrent = false
    for (const workspaceId of ordered) {
      const workspace = bucket.find(w => w.workspaceId === workspaceId)
      if (workspace === undefined) continue
      const ownerMembers = members.byOwner.get(workspace.workspaceId as string) ?? []
      const sessions = sessionsWithMembers(list, workspace, ownerMembers, archived, descendants, statuses, current)
      const wsExpanded = expandedWorkspaces.has(workspace.workspaceId as string)
      const wsContainsCurrent = workspace.workspaceId === currentWorkspaceId
      const partitioned = applyFolders(
        workspace.workspaceId,
        workspace.path,
        sessions,
        list,
        entryFor(folders, workspace.workspaceId as string),
        collapsedFolders,
      )
      if (wsContainsCurrent) containsCurrent = true
      workspaceNodes.push({
        workspaceId: workspace.workspaceId,
        path: workspace.path,
        label: workspace.title,
        createdAt: Date.parse(workspace.createdAt),
        sessionCount: sessions.length,
        expanded: wsExpanded,
        containsCurrent: wsContainsCurrent,
        sessions: wsExpanded ? partitioned.sessions : [],
        ...(partitioned.folders === undefined ? {} : { folders: partitioned.folders }),
      })
    }
    const appearance = categoryAppearance(manual, key)
    nodes.push({
      key,
      label: key,
      expanded,
      containsCurrent,
      workspaces: workspaceNodes,
      ...(appearance === undefined ? {} : { appearance }),
    })
  }
  return nodes
}

/**
 * Top-level (ungrouped) workspace rows: workspaces resolving to no category
 * (no manual override and no matching rule, or a forced `null` override).
 * Rendered after the group folders as plain project rows (not inside any
 * folder), in manual top-level order (`workspaceOrder[TOP_LEVEL_ORDER_KEY]`),
 * falling back to host registration order.
 */
export function deriveTopLevel(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  archivedSessionIds: readonly SessionId[],
  config: GroupsConfig,
  view: GroupsTreeView,
  manual: ManualGroups,
  statuses: SessionStatuses = new Map(),
  folders: FoldersDocument = EMPTY_FOLDERS_DOCUMENT,
): WorkspaceGroupNode[] {
  const archived = new Set(archivedSessionIds)
  const expandedWorkspaces = new Set(view.expandedWorkspaces)
  const collapsedFolders = new Set(view.collapsedFolders ?? [])
  const descendants = indexSubagentDescendants(list.byId)
  const current = currentSessionId(list)
  const members = memberWorkspaces(workspaces, folders)
  const currentWorkspaceId = current === undefined
    ? undefined
    : workspaces.find(w => !members.absorbed.has(w.workspaceId as string)
      && projectHoldsSession(w, members.byOwner.get(w.workspaceId as string) ?? [], current))?.workspaceId

  const topLevelIds = workspaces
    .filter(w => !isDefaultWorkspace(w))
    .filter(w => !members.absorbed.has(w.workspaceId as string))
    .filter(w => resolveCategory(config, manual, w.workspaceId, w.path, w.title) === undefined)
    .map(w => w.workspaceId as string)
  const ordered = orderedWorkspaceIds(manual, TOP_LEVEL_ORDER_KEY, topLevelIds)

  const nodes: WorkspaceGroupNode[] = []
  for (const workspaceId of ordered) {
    const workspace = workspaces.find(w => w.workspaceId === workspaceId)
    if (workspace === undefined) continue
    const ownerMembers = members.byOwner.get(workspaceId) ?? []
    const sessions = sessionsWithMembers(list, workspace, ownerMembers, archived, descendants, statuses, current)
    const wsExpanded = expandedWorkspaces.has(workspaceId)
    const partitioned = applyFolders(
      workspace.workspaceId,
      workspace.path,
      sessions,
      list,
      entryFor(folders, workspaceId),
      collapsedFolders,
    )
    nodes.push({
      workspaceId: workspace.workspaceId,
      path: workspace.path,
      label: workspace.title,
      createdAt: Date.parse(workspace.createdAt),
      sessionCount: sessions.length,
      expanded: wsExpanded,
      containsCurrent: workspace.workspaceId === currentWorkspaceId,
      sessions: wsExpanded ? partitioned.sessions : [],
      ...(partitioned.folders === undefined ? {} : { folders: partitioned.folders }),
    })
  }
  return nodes
}

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
export function deriveDefaultWorkspace(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  archivedSessionIds: readonly SessionId[],
  view: GroupsTreeView,
  statuses: SessionStatuses = new Map(),
  folders: FoldersDocument = EMPTY_FOLDERS_DOCUMENT,
): WorkspaceGroupNode | undefined {
  const workspace = workspaces.find(w => isDefaultWorkspace(w))
  if (workspace === undefined) return undefined
  const archived = new Set(archivedSessionIds)
  const expandedWorkspaces = new Set(view.expandedWorkspaces)
  const collapsedFolders = new Set(view.collapsedFolders ?? [])
  const descendants = indexSubagentDescendants(list.byId)
  const current = currentSessionId(list)
  const members = memberWorkspaces(workspaces, folders)
  const ownerMembers = members.byOwner.get(workspace.workspaceId as string) ?? []
  const sessions = sessionsWithMembers(list, workspace, ownerMembers, archived, descendants, statuses, current)
  const wsExpanded = expandedWorkspaces.has(workspace.workspaceId as string)
  const partitioned = applyFolders(
    workspace.workspaceId,
    workspace.path,
    sessions,
    list,
    entryFor(folders, workspace.workspaceId as string),
    collapsedFolders,
  )
  return {
    workspaceId: workspace.workspaceId,
    path: workspace.path,
    label: workspace.title,
    createdAt: Date.parse(workspace.createdAt),
    sessionCount: sessions.length,
    expanded: wsExpanded,
    containsCurrent: projectHoldsSession(workspace, ownerMembers, current),
    sessions: wsExpanded ? partitioned.sessions : [],
    ...(partitioned.folders === undefined ? {} : { folders: partitioned.folders }),
  }
}

/** Recency comparator: newest first, id as the deterministic tiebreak. */
function byRecency(a: SessionSummary, b: SessionSummary): number {
  if (b.updatedAt !== a.updatedAt) return b.updatedAt - a.updatedAt
  return a.id < b.id ? -1 : 1
}

/** Bounded set of matched sessions plus content snippets (feeds the search tree). */
export interface SearchMatchSet {
  /** Session ids that matched (local metadata hits + Host content hits). */
  matchedIds: ReadonlySet<SessionId>
  /** Content-match snippets keyed by session id (Host search only). */
  snippetsBySession: ReadonlyMap<SessionId, string>
  hasMore: boolean
}

/**
 * Compute the matched-session set: immediate title/Workspace substring matches
 * from the local list, merged with ranked Host content matches. The consumer
 * (SearchBody) derives the pruned three-level tree from these ids.
 */
export function deriveSearchMatches(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  config: GroupsConfig,
  query: string,
  archivedSessionIds: readonly SessionId[],
  content: { items: readonly SessionSearchResultItem[]; hasMore: boolean },
  limit: number,
  folders: FoldersDocument = EMPTY_FOLDERS_DOCUMENT,
): SearchMatchSet {
  const q = query.trim().toLowerCase()
  if (q === '') return { matchedIds: new Set(), snippetsBySession: new Map(), hasMore: false }
  const archived = new Set(archivedSessionIds)
  const descendants = indexSubagentDescendants(list.byId)
  const current = currentSessionId(list)
  const members = memberWorkspaces(workspaces, folders)

  // A member folder's sessions search as part of the project that shows them.
  const workspaceBySession = new Map<SessionId, WorkspaceView>()
  for (const workspace of workspaces) {
    if (members.absorbed.has(workspace.workspaceId as string)) continue
    const owner = workspace
    for (const sessionId of workspace.sessionIds) {
      if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, owner)
    }
    for (const member of members.byOwner.get(workspace.workspaceId as string) ?? []) {
      for (const sessionId of member.sessionIds) {
        if (!workspaceBySession.has(sessionId)) workspaceBySession.set(sessionId, owner)
      }
    }
  }
  const labelOf = (summary: SessionSummary): string =>
    workspaceBySession.get(summary.id)?.title ?? workspaceLabel(summary.cwd)

  const local: SessionSummary[] = []
  for (const id of list.ids) {
    const summary = list.byId[id]
    if (summary === undefined || summary.blank || !sessionVisible(summary, current, archived)) continue
    if (
      sessionTitle(summary).toLowerCase().includes(q)
      || labelOf(summary).toLowerCase().includes(q)
    ) {
      local.push(summary)
    }
  }
  local.sort(byRecency)

  const ordered: SessionSummary[] = []
  const included = new Set<SessionId>()
  const include = (summary: SessionSummary): void => {
    if (included.has(summary.id)) return
    included.add(summary.id)
    ordered.push(summary)
  }
  for (const summary of local) include(summary)
  for (const item of content.items) {
    const summary = list.byId[item.sessionId]
    if (summary !== undefined && !summary.blank && sessionVisible(summary, current, archived)) include(summary)
  }

  const snippets = new Map<SessionId, string>()
  for (const item of content.items) {
    if (item.snippet !== undefined) snippets.set(item.sessionId, item.snippet)
  }

  return {
    matchedIds: ordered.slice(0, limit).reduce((set, summary) => { set.add(summary.id); return set }, new Set<SessionId>()),
    snippetsBySession: snippets,
    hasMore: content.hasMore || ordered.length > limit,
  }
}

/** Search tree: group folders plus top-level (ungrouped) matched workspaces. */
export interface SearchTree {
  /** Group folders containing matched sessions, in display order. */
  categories: CategoryNode[]
  /** Top-level (ungrouped) workspaces holding matched sessions. */
  topLevel: WorkspaceGroupNode[]
  /**
   * The Host default workspace's matched branch, when it has a hit. It is
   * rendered in the pinned bottom bar instead of the results list, so a hit
   * never makes the default workspace appear twice.
   */
  defaultWorkspace?: WorkspaceGroupNode
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
export function deriveSearchGroups(
  list: SessionListState,
  workspaces: readonly WorkspaceView[],
  config: GroupsConfig,
  matchedIds: ReadonlySet<SessionId>,
  archivedSessionIds: readonly SessionId[],
  manual: ManualGroups,
  snippetsBySession?: ReadonlyMap<SessionId, string>,
  statuses: SessionStatuses = new Map(),
  folders: FoldersDocument = EMPTY_FOLDERS_DOCUMENT,
): SearchTree {
  const archived = new Set(archivedSessionIds)
  const descendants = indexSubagentDescendants(list.byId)
  const current = currentSessionId(list)
  const members = memberWorkspaces(workspaces, folders)

  const byCategory = new Map<string, WorkspaceGroupNode[]>()
  for (const key of effectiveCategories(config, manual).map(e => e.key)) byCategory.set(key, [])

  const topLevel: WorkspaceGroupNode[] = []
  let defaultWorkspace: WorkspaceGroupNode | undefined
  for (const workspace of workspaces) {
    // A member's own row is folded into its owner's folder row below.
    if (members.absorbed.has(workspace.workspaceId as string)) continue
    // Only sessions that matched the query and are visible in this folder.
    const nodes: SessionNode[] = []
    const sources = [workspace, ...(members.byOwner.get(workspace.workspaceId as string) ?? [])]
    for (const source of sources) {
      for (const id of source.sessionIds) {
        const summary = list.byId[id]
        if (summary === undefined || !matchedIds.has(id)) continue
        if (!sessionVisible(summary, current, archived)) continue
        const node = sessionNode(summary, descendants, statuses)
        const snippet = snippetsBySession?.get(id)
        nodes.push({
          ...node,
          matched: true,
          ...(snippet === undefined ? {} : { snippet }),
        })
      }
    }
    if (nodes.length === 0) continue

    const partitioned = applyFolders(
      workspace.workspaceId,
      workspace.path,
      nodes,
      list,
      entryFor(folders, workspace.workspaceId as string),
      undefined,
    )
    const node: WorkspaceGroupNode = {
      workspaceId: workspace.workspaceId,
      path: workspace.path,
      label: workspace.title,
      createdAt: Date.parse(workspace.createdAt),
      sessionCount: nodes.length,
      expanded: true,
      containsCurrent: false,
      sessions: partitioned.sessions,
      ...(partitioned.folders === undefined ? {} : { folders: partitioned.folders }),
    }
    if (isDefaultWorkspace(workspace)) {
      defaultWorkspace = node
      continue
    }
    const key = resolveCategory(config, manual, workspace.workspaceId, workspace.path, workspace.title)
    if (key === undefined) {
      topLevel.push(node)
      continue
    }
    if (!byCategory.has(key)) byCategory.set(key, [])
    byCategory.get(key)!.push(node)
  }

  const categories: CategoryNode[] = []
  // Same display order as the idle tree.
  for (const key of effectiveCategories(config, manual).map(e => e.key)) {
    const workspaceNodes = byCategory.get(key)
    if (workspaceNodes === undefined || workspaceNodes.length === 0) continue
    const appearance = categoryAppearance(manual, key)
    categories.push({
      key,
      label: key,
      expanded: true,
      containsCurrent: false,
      workspaces: workspaceNodes,
      ...(appearance === undefined ? {} : { appearance }),
    })
  }
  return {
    categories,
    topLevel,
    ...(defaultWorkspace === undefined ? {} : { defaultWorkspace }),
  }
}
