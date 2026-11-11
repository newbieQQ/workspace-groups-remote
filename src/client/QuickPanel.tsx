/**
 * Ctrl+R quick switch panel: two tabs over the framework's global hooks.
 *
 * - Workspaces tab: search real Workspaces, select one, then either start a
 *   New Session in it or jump straight to its most recently updated running
 *   session (the button reads the none-running state and disables).
 * - Sessions tab: every top-level session across workspaces — running ones
 *   pinned on top, everything else under them, both groups newest first; one
 *   click (or Enter) opens it. The shared search input filters by session or
 *   workspace title and never re-sorts, so the running-first order survives.
 *
 * Current-row marker: the open workspace (workspaces tab) and the open
 * session (sessions tab) render `.wgQuickRowCurrent`; with no current
 * session — or one no listed workspace holds — nothing is marked.
 *
 * Mount discipline: the parent conditionally mounts this component, so every
 * open starts from a fresh query/selection (quick-switcher semantics). The
 * overlay portals to document.body (sidebar ancestors clip `fixed`), sizes
 * itself like a launcher (top-anchored, 640px) instead of the host Modal's
 * 380px dialog, and handles Escape / mask click by itself. Pure data shaping
 * lives in quick.ts; this file only binds hooks + actions.
 */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { Button, StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client'
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { activeWorkspaceId, allSessions, filterSessions, filterWorkspaces, latestRunningInWorkspace, runningCountByWorkspace, runningSessions } from './quick.ts'
import { relativeTimeLabel } from './rows.tsx'

/** Which surface of the quick panel is active. */
export type QuickTab = 'workspaces' | 'sessions'

/** The locale seat's translate function (same shape GroupsBrowser receives). */
type Translate = PropsLocale<'workspaceGroups'>['t']

/** Quick panel props: hooks snapshots + the two injected verbs + shared CSS context. */
export type QuickPanelProps = {
  /** Close request (Escape, mask click, action completed, or parent Ctrl+R toggle). */
  onClose: () => void
  /** Sessions list snapshot (drives running detection). */
  list: SessionListState
  /** Real workspaces in stable Host order. */
  workspaces: readonly WorkspaceView[]
  /** Registry-global archive set. */
  archivedSessionIds: readonly SessionId[]
  /** Category label per grouped workspace id (badge column; top-level absent). */
  categoryByWorkspace: ReadonlyMap<string, string>
  /** The Session the Conversation currently shows (mainView retention), if any. */
  current: SessionId | undefined
  /** Start a New Session in a workspace (injected share verb). */
  startSession: (workspaceId?: WorkspaceId) => void
  /** Open a real Session (injected share verb). */
  openSession: (sessionId: SessionId) => void
  /** Render clock for relative times (parent refreshes per render). */
  now: number
  /** Dictionary accessor (workspaceGroups namespace). */
  t: Translate
}

/** Basename of a host path (both separators; shortens the workspace row sub-line). */
function pathBasename(path: string): string {
  const trimmed = path.replace(/[/\\]+$/, '')
  const base = trimmed.split(/[/\\]/).pop()
  return base !== undefined && base !== '' ? base : trimmed
}

/**
 * Render the quick switch panel (portaled overlay).
 * @param props - hooks snapshots + injected verbs.
 * @returns the panel element tree.
 */
export function QuickPanel({
  onClose,
  list,
  workspaces,
  archivedSessionIds,
  categoryByWorkspace,
  current: currentSessionId,
  startSession,
  openSession,
  now,
  t,
}: QuickPanelProps) {
  const [tab, setTab] = useState<QuickTab>('workspaces')
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const activeRowRef = useRef<HTMLButtonElement>(null)

  const archived = useMemo(() => new Set(archivedSessionIds), [archivedSessionIds])
  const running = useMemo(() => runningSessions(list, archived), [list, archived])
  const runCounts = useMemo(() => runningCountByWorkspace(running, workspaces), [running, workspaces])
  const filtered = useMemo(
    () => filterWorkspaces(workspaces, query, ws => categoryByWorkspace.get(ws.workspaceId as string)),
    [workspaces, query, categoryByWorkspace],
  )

  // Where the user is right now: the open session and its owning workspace.
  // Both may be absent (no mainView retention, or a session no listed
  // workspace holds) — the current-row marker simply never renders then.
  const currentWorkspaceId = useMemo(
    () => activeWorkspaceId(workspaces, currentSessionId),
    [workspaces, currentSessionId],
  )

  // Sessions tab data: every top-level session, running pinned on top then
  // recency, filtered by the shared search query (filter never re-sorts).
  const sessions = useMemo(
    () => allSessions(list, archived, currentSessionId),
    [list, archived, currentSessionId],
  )
  // Owning workspace title per session id (row sub-line + search field);
  // first workspace wins — a session lives in exactly one.
  const workspaceTitleBySession = useMemo(() => {
    const map = new Map<SessionId, string>()
    for (const workspace of workspaces) {
      for (const sessionId of workspace.sessionIds) {
        if (!map.has(sessionId)) map.set(sessionId, workspace.title)
      }
    }
    return map
  }, [workspaces])
  const filteredSessions = useMemo(
    () => filterSessions(sessions, query, s => workspaceTitleBySession.get(s.id)),
    [sessions, query, workspaceTitleBySession],
  )

  const selected = selectedId === null
    ? undefined
    : workspaces.find(w => (w.workspaceId as string) === selectedId)
  const selectedRunningId = selected === undefined ? undefined : latestRunningInWorkspace(list, selected)

  // Focus the search input whenever a tab becomes reachable (both tabs own it).
  useEffect(() => {
    inputRef.current?.focus()
  }, [tab])

  // Keep the keyboard-active row visible while arrowing through the list.
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  /** Select the workspace and close (New Session verb). */
  const launchNewSession = (workspace: WorkspaceView): void => {
    startSession(workspace.workspaceId)
    onClose()
  }

  /** Open a session row and close (sessions tab click or Enter). */
  const launchSession = (sessionId: SessionId): void => {
    openSession(sessionId)
    onClose()
  }

  /** Switch tabs; the query carries over, the per-tab selection resets. */
  const switchTab = (next: QuickTab): void => {
    setTab(next)
    setSelectedId(null)
    setActiveIndex(0)
  }

  /** Search-input keyboard: arrows move the active row; Enter confirms it. */
  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      const max = (tab === 'workspaces' ? filtered.length : filteredSessions.length) - 1
      setActiveIndex(i => Math.min(i + 1, Math.max(max, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (tab === 'workspaces') {
        if (selected === undefined) {
          const target = filtered[activeIndex]
          if (target !== undefined) setSelectedId(target.workspaceId as string)
        } else {
          launchNewSession(selected)
        }
      } else {
        const target = filteredSessions[activeIndex]
        if (target !== undefined) launchSession(target.id)
      }
    }
  }

  /** Escape closes (capture so row buttons and the input can't swallow it). */
  const onCardKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
  }

  /** Mask click closes; clicks inside the card never reach the mask. */
  const onOverlayMouseDown = (e: MouseEvent<HTMLDivElement>): void => {
    if (e.target === e.currentTarget) onClose()
  }

  const selectWorkspace = (id: string): void => {
    setSelectedId(id)
    inputRef.current?.focus()
  }

  return createPortal(
    <div className="wgQuickOverlay" onMouseDown={onOverlayMouseDown}>
      <div
        className="wgQuickCard"
        role="dialog"
        aria-modal="true"
        aria-label={t('quick.title')}
        onKeyDown={onCardKeyDown}
      >
        <div className="wgQuickHeader">
          <span className="wgQuickTitle">{t('quick.title')}</span>
          <div className="wgQuickTabs" role="tablist" aria-label={t('quick.title')}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'workspaces'}
              className={`wgQuickTab${tab === 'workspaces' ? ' wgQuickTabActive' : ''}`}
              onClick={() => { switchTab('workspaces') }}
            >
              {t('quick.tab.workspaces')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'sessions'}
              className={`wgQuickTab${tab === 'sessions' ? ' wgQuickTabActive' : ''}`}
              onClick={() => { switchTab('sessions') }}
            >
              {t('quick.tab.sessions')}
              {running.length > 0 && <span className="wgQuickTabCount">{running.length}</span>}
            </button>
          </div>
        </div>

        {/* Shared search: workspaces on one tab, sessions on the other. */}
        <div className="wgQuickSearchWrap">
          <input
            ref={inputRef}
            className="wgQuickSearch"
            value={query}
            placeholder={tab === 'workspaces' ? t('quick.search.placeholder') : t('quick.search.sessions')}
            aria-label={tab === 'workspaces' ? t('quick.search.placeholder') : t('quick.search.sessions')}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedId(null)
              setActiveIndex(0)
            }}
            onKeyDown={onSearchKeyDown}
          />
        </div>
        {tab === 'workspaces' ? (
          <>
            <div className="wgQuickList" role="listbox" aria-label={t('quick.tab.workspaces')}>
              {filtered.map((workspace, i) => {
                const id = workspace.workspaceId as string
                const count = runCounts.get(id) ?? 0
                const category = categoryByWorkspace.get(id)
                const isCurrent = id === currentWorkspaceId
                return (
                  <button
                    key={id}
                    ref={i === activeIndex ? activeRowRef : undefined}
                    type="button"
                    role="option"
                    aria-selected={selectedId === id}
                    aria-current={isCurrent || undefined}
                    className={
                      `wgQuickRow${i === activeIndex ? ' wgQuickRowActive' : ''}${selectedId === id ? ' wgQuickRowSelected' : ''}${isCurrent ? ' wgQuickRowCurrent' : ''}`
                    }
                    onMouseEnter={() => { setActiveIndex(i) }}
                    onClick={() => { selectWorkspace(id) }}
                  >
                    <span className="wgQuickRowMain">
                      <span className="wgQuickRowTitle">{workspace.title}</span>
                      {count > 0 && <span className="wgQuickRunBadge">● {count}</span>}
                    </span>
                    <span className="wgQuickRowSub">
                      <span className="wgQuickRowPath">
                        {category !== undefined ? `${category} · ${pathBasename(workspace.path)}` : pathBasename(workspace.path)}
                      </span>
                    </span>
                  </button>
                )
              })}
              {filtered.length === 0 && <div className="wgQuickEmpty">{t('quick.empty.workspaces')}</div>}
            </div>
            <div className="wgQuickFooter">
              <span className="wgQuickSelected">
                {selected === undefined ? t('quick.select.hint') : selected.title}
              </span>
              <Button
                variant="outline"
                disabled={selected === undefined || selectedRunningId === undefined}
                onClick={() => { if (selectedRunningId !== undefined) launchSession(selectedRunningId) }}
              >
                {selectedRunningId !== undefined ? t('quick.action.running') : t('quick.action.noneRunning')}
              </Button>
              <Button
                variant="primary"
                disabled={selected === undefined}
                onClick={() => { if (selected !== undefined) launchNewSession(selected) }}
              >
                {t('quick.action.newSession')}
              </Button>
            </div>
          </>
        ) : (
          <div className="wgQuickList" role="listbox" aria-label={t('quick.tab.sessions')}>
            {filteredSessions.map((session, i) => {
              const workspaceTitle = workspaceTitleBySession.get(session.id) ?? ''
              const isCurrent = session.id === currentSessionId
              return (
                <button
                  key={session.id}
                  ref={i === activeIndex ? activeRowRef : undefined}
                  type="button"
                  role="option"
                  aria-selected={i === activeIndex}
                  aria-current={isCurrent || undefined}
                  className={`wgQuickRow${i === activeIndex ? ' wgQuickRowActive' : ''}${isCurrent ? ' wgQuickRowCurrent' : ''}`}
                  onMouseEnter={() => { setActiveIndex(i) }}
                  onClick={() => { launchSession(session.id) }}
                >
                  <span className="wgQuickRowMain">
                    <StateDot state={session.running ? 'ongoing' : 'done'} />
                    <span className="wgQuickRowTitle">{session.blank ? t('newSession') : session.displayTitle}</span>
                    <span className="wgQuickTime">{relativeTimeLabel(session.updatedAt, now)}</span>
                  </span>
                  <span className="wgQuickRowSub">
                    <span className="wgQuickRowPath">{workspaceTitle}</span>
                  </span>
                </button>
              )
            })}
            {filteredSessions.length === 0 && <div className="wgQuickEmpty">{t('quick.empty.sessions')}</div>}
          </div>
        )}

        <div className="wgQuickHint">{t('quick.hint')}</div>
      </div>
    </div>,
    document.body,
  )
}
