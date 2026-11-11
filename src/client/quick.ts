/**
 * Pure data shaping for the Ctrl+R quick switch panel. Runtime-free (same
 * discipline as store-core.ts): unit tests exercise the real semantics
 * without a browser module loader; the panel only binds them to the
 * framework's global hooks.
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionListState, SessionSummary } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'

/** A session row eligible for quick switching: running, top-level, real. */
function quickEligible(summary: SessionSummary): boolean {
  return summary.running === true && summary.origin !== 'subagent' && !summary.blank
}

/**
 * Running quick-switchable sessions across the whole list, newest first.
 * @param list - sessions list snapshot.
 * @param archived - registry-global archive set (archived rows never surface).
 * @returns running summaries in recency order (id as deterministic tiebreak).
 */
export function runningSessions(list: SessionListState, archived: ReadonlySet<SessionId>): SessionSummary[] {
  const out: SessionSummary[] = []
  for (const id of list.ids) {
    if (archived.has(id)) continue
    const summary = list.byId[id]
    if (summary !== undefined && quickEligible(summary)) out.push(summary)
  }
  out.sort((a, b) => (b.updatedAt !== a.updatedAt ? b.updatedAt - a.updatedAt : (a.id < b.id ? -1 : 1)))
  return out
}

/**
 * Every quick-switchable session across the whole list — the sessions tab's
 * data: running rows pinned on top, everything else under them, both groups
 * newest first. Visibility mirrors the tree (subagent rows never; archived
 * never; a blank row only while it is the open session).
 * @param list - sessions list snapshot.
 * @param archived - registry-global archive set (archived rows never surface).
 * @param current - the selected session (`mainView` retention; keeps its blank row visible).
 * @returns summaries with running first, then recency (id as deterministic tiebreak).
 */
export function allSessions(
  list: SessionListState,
  archived: ReadonlySet<SessionId>,
  current: SessionId | undefined,
): SessionSummary[] {
  const out: SessionSummary[] = []
  for (const id of list.ids) {
    if (archived.has(id)) continue
    const summary = list.byId[id]
    if (summary === undefined) continue
    if (summary.origin === 'subagent') continue
    if (summary.blank && summary.id !== current) continue
    out.push(summary)
  }
  out.sort((a, b) => {
    if (a.running !== b.running) return a.running ? -1 : 1
    return b.updatedAt !== a.updatedAt ? b.updatedAt - a.updatedAt : (a.id < b.id ? -1 : 1)
  })
  return out
}

/**
 * Session search for the quick panel: display-title or owning-workspace-title
 * substring match (trimmed, case-insensitive). Filters only — the incoming
 * running-first/recency order is preserved verbatim, so "running on top"
 * survives any query.
 * @param sessions - allSessions() output (running pinned on top, then recency).
 * @param query - raw query.
 * @param workspaceTitleOf - owning workspace title resolver (sub-line source).
 * @param limit - hard render cap.
 * @returns matching sessions in the given order.
 */
export function filterSessions(
  sessions: readonly SessionSummary[],
  query: string,
  workspaceTitleOf: (session: SessionSummary) => string | undefined,
  limit = 200,
): SessionSummary[] {
  const q = query.trim().toLowerCase()
  if (q === '') return sessions.slice(0, limit)
  const out: SessionSummary[] = []
  for (const session of sessions) {
    const workspace = workspaceTitleOf(session)?.toLowerCase() ?? ''
    if (session.displayTitle.toLowerCase().includes(q) || workspace.includes(q)) out.push(session)
  }
  return out.slice(0, limit)
}

/**
 * Most recently updated running session inside one workspace.
 * @param list - sessions list snapshot.
 * @param workspace - target workspace (its session account order is irrelevant;
 * recency picks the row).
 * @returns the session id, or undefined when nothing in the workspace runs.
 */
export function latestRunningInWorkspace(list: SessionListState, workspace: WorkspaceView): SessionId | undefined {
  let best: SessionId | undefined
  let bestTime = Number.NEGATIVE_INFINITY
  for (const id of workspace.sessionIds) {
    const summary = list.byId[id]
    if (summary === undefined || !quickEligible(summary)) continue
    if (summary.updatedAt > bestTime) {
      best = summary.id
      bestTime = summary.updatedAt
    }
  }
  return best
}

/**
 * Running-session count per workspace id (badge on the workspace tab rows).
 * @param running - runningSessions() output.
 * @param workspaces - real workspaces in stable Host order.
 * @returns counts keyed by workspace id; absent key = none running.
 */
export function runningCountByWorkspace(
  running: readonly SessionSummary[],
  workspaces: readonly WorkspaceView[],
): Map<string, number> {
  const counts = new Map<string, number>()
  if (running.length === 0) return counts
  const runningIds = new Set(running.map(s => s.id))
  for (const workspace of workspaces) {
    let count = 0
    for (const sessionId of workspace.sessionIds) {
      if (runningIds.has(sessionId)) count += 1
    }
    if (count > 0) counts.set(workspace.workspaceId as string, count)
  }
  return counts
}

/**
 * The workspace that owns the currently open session.
 * @param workspaces - real workspaces in stable Host order.
 * @param currentSessionId - the selected session (`mainView` retention); may be undefined
 *   (no session open, cleared selection) or an id no listed workspace holds
 *   (e.g. an addressed subagent session).
 * @returns the workspace id, or undefined when there is no active workspace.
 */
export function activeWorkspaceId(
  workspaces: readonly WorkspaceView[],
  currentSessionId: SessionId | undefined,
): string | undefined {
  if (currentSessionId === undefined) return undefined
  const workspace = workspaces.find(w => w.sessionIds.includes(currentSessionId))
  return workspace?.workspaceId as string | undefined
}

/**
 * Workspace search for the quick panel: title prefix → title substring →
 * category label substring → path substring; ties keep host order via a
 * stable title compare inside one rank.
 * @param workspaces - real workspaces in stable Host order.
 * @param query - raw query (trimmed, case-insensitive).
 * @param categoryLabelOf - category label resolver (grouped workspaces only).
 * @param limit - hard render cap.
 * @returns ranked matches; an empty query returns host order.
 */
export function filterWorkspaces(
  workspaces: readonly WorkspaceView[],
  query: string,
  categoryLabelOf?: (workspace: WorkspaceView) => string | undefined,
  limit = 50,
): WorkspaceView[] {
  const q = query.trim().toLowerCase()
  if (q === '') return workspaces.slice(0, limit)
  const scored: { workspace: WorkspaceView; score: number }[] = []
  for (const workspace of workspaces) {
    const title = workspace.title.toLowerCase()
    const path = workspace.path.toLowerCase()
    const category = (categoryLabelOf?.(workspace) ?? '').toLowerCase()
    let score: number | undefined
    if (title.startsWith(q)) score = 0
    else if (title.includes(q)) score = 1
    else if (category !== '' && category.includes(q)) score = 2
    else if (path.includes(q)) score = 3
    if (score !== undefined) scored.push({ workspace, score })
  }
  scored.sort((a, b) => (a.score !== b.score
    ? a.score - b.score
    : a.workspace.title.localeCompare(b.workspace.title)))
  return scored.slice(0, limit).map(entry => entry.workspace)
}
