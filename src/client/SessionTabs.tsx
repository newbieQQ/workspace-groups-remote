/**
 * The session tab strip: one chip per opened conversation, rendered into the
 * DOM seat at the head of the conversation column (see `tab-seat.ts` for why
 * this is a DOM injection rather than a slot).
 *
 * A tab is a *view* of the open session, not a second navigation model:
 * clicking a chip navigates through `ctx.uiWorkspace.openSession`, which is the
 * one path that retains a target session; the owning component derives the
 * strip from the open session plus the tab store.
 *
 * The active chip is derived, never stored: it is the chip whose session is the
 * open one, so clicking a background chip immediately shows that chip active.
 *
 * Every affordance beyond "click to switch" is an explicit USER gesture, and
 * each one maps to exactly one store action: middle-click closes, the context
 * menu pins / renames / closes a range, a drag reorders, and a double-click
 * edits the tab's own label. None of them can run on their own — the strip stays
 * a record of what the user opened.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconCloseFillMedium,
  IconPinFillMedium,
  StateDot,
  Tooltip,
  type StateDotState,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import type { SessionsTabsProps } from './contract.ts'
import { mountTabSeat } from './tab-seat.ts'
import {
  orderedTabs,
  projectIndex,
  tabIndicator,
  type SessionTab,
  type SessionTabIndicator,
} from './tabs.ts'
import { currentSessionId } from './tree.ts'

/** Dot state for one tab (the sidebar's session rows share this vocabulary). */
function dotState(indicator: SessionTabIndicator): StateDotState {
  if (indicator.attention) return 'warning'
  if (indicator.running) return 'ongoing'
  return 'done'
}

/** Where the context menu is pinned, and which chip it belongs to. */
interface MenuAnchor {
  readonly sessionId: SessionId
  readonly x: number
  readonly y: number
}

/** Which chip a drag is hovering, and which half of it. */
interface DropTarget {
  readonly sessionId: SessionId
  readonly side: 'before' | 'after'
}

/** In-flight inline label edit. */
interface LabelEdit {
  readonly sessionId: SessionId
  readonly draft: string
}

/** One row of the tab context menu. */
function MenuRow({
  label,
  onSelect,
  disabled = false,
  danger = false,
}: {
  readonly label: string
  readonly onSelect: () => void
  readonly disabled?: boolean
  readonly danger?: boolean
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`wgTabMenuItem${danger ? ' wgTabMenuDanger' : ''}`}
      disabled={disabled}
      onClick={onSelect}
    >
      {label}
    </button>
  )
}

/**
 * Render the session tab strip into the conversation column's head seat.
 * @param props - tab store, catalog/status hooks, navigation, locale.
 * @returns the portal (or null until the column has mounted).
 */
export function SessionTabs({
  useTabs,
  actions,
  useSessions,
  useSessionStatus,
  useWorkspaces,
  activate,
  rename,
  t,
}: SessionsTabsProps) {
  const tabs = useTabs(s => s.tabs)
  const list = useSessions(s => s)
  const statuses = useSessionStatus(s => s)
  const currentId = useSessions(s => currentSessionId(s))
  const workspaces = useWorkspaces(s => s.items)

  // Session → owning project, in one pass over the workspace registry. This is
  // what lets each chip name its project; without it a strip of session titles
  // is ambiguous as soon as two projects are open.
  const projects = useMemo(() => projectIndex(workspaces), [workspaces])

  // The seat is a DOM node outside React's tree, so it cannot arrive through
  // props; it is discovered once per mount and held in state to trigger the
  // portal's first render when the column appears.
  const [seat, setSeat] = useState<HTMLElement | null>(null)
  // The scrolling row, for wheel redirection and keep-active-in-view.
  const scrollRef = useRef<HTMLDivElement | null>(null)
  // The open context menu, its chip, and its viewport position.
  const [menu, setMenu] = useState<MenuAnchor | null>(null)
  // The chip whose label is being typed into, plus the in-progress text.
  const [editing, setEditing] = useState<LabelEdit | null>(null)
  // The chip being dragged and the chip/half it would land on.
  const [dragging, setDragging] = useState<SessionId | null>(null)
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
  // Timestamp of the last drag end: a drop must not also count as a click on
  // the chip it landed on (which would navigate away from what was just moved).
  const dragEndedAt = useRef(0)

  useEffect(() => {
    const mounted = mountTabSeat(setSeat)
    // The column may already exist, in which case onReady fired synchronously
    // during mountTabSeat and setSeat is already queued; adopt it here too so
    // the very first paint has a host instead of waiting a frame.
    if (mounted.host !== null) setSeat(mounted.host)
    return () => {
      mounted.dispose()
      // The portal must stop targeting a removed node before the next mount.
      setSeat(null)
    }
  }, [])

  // The strip renders exactly the tabs the store holds. There is deliberately NO
  // filtering against the session catalog and no "close tabs whose session
  // vanished" sweep: a tab is removed when the USER closes it, and by nothing
  // else. Trimming automatically also misfires — the catalog is briefly empty on
  // every load, which deleted restored tabs before the sessions arrived.
  const display = useMemo(() => orderedTabs(tabs, currentId), [tabs, currentId])
  const index = useMemo(() => new Map(display.map((tab, at) => [tab.sessionId, at])), [display])

  // With the row scrollable, the active chip can sit outside the viewport —
  // e.g. after clicking a session in the sidebar that has a tab far to the
  // right. Bring it into view on selection change. `block: 'nearest'` keeps
  // this a horizontal-only scroll, and `inline: 'nearest'` avoids nudging the
  // row when the chip is already fully visible.
  useEffect(() => {
    const el = scrollRef.current
    if (el === null || currentId === undefined) return
    const chip = el.querySelector<HTMLElement>(`[data-tab-session="${CSS.escape(currentId)}"]`)
    chip?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [currentId, display.length])

  // Dismiss the context menu on any interaction outside it. Pointerdown covers
  // both buttons; Escape and a viewport change (which would leave a fixed menu
  // pointing at the wrong chip) close it too. `capture` matters for the scroll
  // case: the strip's own row scrolls without bubbling a scroll event up.
  useEffect(() => {
    if (menu === null) return
    const dismiss = (): void => { setMenu(null) }
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (target instanceof Element && target.closest('.wgTabMenu') !== null) return
      dismiss()
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') dismiss()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', dismiss)
    window.addEventListener('scroll', dismiss, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', dismiss)
      window.removeEventListener('scroll', dismiss, true)
    }
  }, [menu])

  if (seat === null || display.length === 0) return null

  /** Commit the in-flight label edit (blank clears the override). */
  const commitEdit = (): void => {
    if (editing === null) return
    actions.rename(editing.sessionId, editing.draft)
    setEditing(null)
  }

  /** Start editing a tab's own label, pre-filled with what the chip shows. */
  const startEdit = (sessionId: SessionId, current: string): void => {
    setMenu(null)
    setEditing({ sessionId, draft: current })
  }

  /** Translate a drop onto `target` into an index in the resulting strip. */
  const dropIndexFor = (draggedSessionId: SessionId, target: DropTarget): number | null => {
    const from = index.get(draggedSessionId)
    const at = index.get(target.sessionId)
    if (from === undefined || at === undefined || from === at) return null
    // Insertion index in the CURRENT strip, then corrected for the removal the
    // move implies: removing a chip before the insertion point shifts it left.
    const insertion = at + (target.side === 'after' ? 1 : 0)
    return from < insertion ? insertion - 1 : insertion
  }

  const chips = display.map((tab: SessionTab, at: number) => {
    const summary = list.byId[tab.sessionId]
    // A restored tab can render before its catalog row arrives. Show the
    // session id meanwhile rather than an empty chip — the tab is real, and
    // the title fills in as soon as the catalog catches up.
    const sessionLabel = summary === undefined
      ? tab.sessionId
      : summary.blank ? t('newSession') : summary.displayTitle
    // The user's own label wins over the session title; blank means "follow the
    // session", so the override is absent rather than empty.
    const label = tab.title ?? sessionLabel
    const active = tab.sessionId === currentId
    const pinned = tab.pinned === true
    const indicator = tabIndicator(summary, statuses.get(tab.sessionId))
    // The project this session belongs to. Absent for a session that is in
    // no workspace (a bare session, or one just created before the
    // registry caught up) — the chip then shows the title alone rather
    // than a placeholder.
    const project = projects.get(tab.sessionId)
    // Title attribute carries the full pair plus the directory, so the
    // truncated chip text is recoverable on hover.
    const tip = project === undefined
      ? label
      : `${project.label} · ${label}\n${project.path}`
    const drop = dropTarget !== null && dropTarget.sessionId === tab.sessionId ? dropTarget.side : null
    const isEditing = editing !== null && editing.sessionId === tab.sessionId
    const draft = isEditing && editing !== null ? editing.draft : ''
    const className = [
      'wgTab',
      active ? 'wgTabActive' : '',
      pinned ? 'wgTabPinned' : '',
      dragging === tab.sessionId ? 'wgTabDragging' : '',
      drop === 'before' ? 'wgTabDropBefore' : '',
      drop === 'after' ? 'wgTabDropAfter' : '',
    ].filter(part => part !== '').join(' ')
    return (
      <div
        key={tab.order}
        className={className}
        data-tab-session={tab.sessionId}
        {...(project !== undefined ? { 'data-tab-project': project.workspaceId } : {})}
        draggable={!isEditing}
        onAuxClick={(event) => {
          // Middle click closes, the way every other tab strip behaves. Only
          // button 1: a right click opens the menu instead.
          if (event.button !== 1) return
          event.preventDefault()
          actions.close(tab.sessionId)
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          setEditing(null)
          setMenu({
            sessionId: tab.sessionId,
            // Clamp inside the viewport so a chip near the right edge does not
            // open a menu that runs off-screen.
            x: Math.min(event.clientX, window.innerWidth - 208),
            y: Math.min(event.clientY, window.innerHeight - 240),
          })
        }}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = 'move'
          event.dataTransfer.setData('text/plain', tab.sessionId)
          setDragging(tab.sessionId)
          setMenu(null)
        }}
        onDragOver={(event) => {
          if (dragging === null || dragging === tab.sessionId) return
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
          const rect = event.currentTarget.getBoundingClientRect()
          const side = event.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
          setDropTarget({ sessionId: tab.sessionId, side })
        }}
        onDrop={(event) => {
          event.preventDefault()
          if (dragging !== null && dropTarget !== null) {
            const target = dropIndexFor(dragging, dropTarget)
            if (target !== null) actions.move(dragging, target)
          }
          setDragging(null)
          setDropTarget(null)
          dragEndedAt.current = Date.now()
        }}
        onDragEnd={() => {
          setDragging(null)
          setDropTarget(null)
          dragEndedAt.current = Date.now()
        }}
      >
        {isEditing ? (
          <input
            className="wgTabRename"
            value={draft}
            placeholder={t('tabs.renamePlaceholder')}
            aria-label={t('tabs.rename')}
            autoFocus
            onFocus={(event) => { event.currentTarget.select() }}
            onChange={(event) => { setEditing({ sessionId: tab.sessionId, draft: event.target.value }) }}
            onClick={(event) => { event.stopPropagation() }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitEdit()
              } else if (event.key === 'Escape') {
                event.preventDefault()
                setEditing(null)
              }
            }}
            onBlur={() => { commitEdit() }}
          />
        ) : (
          <>
            <button
              type="button"
              role="tab"
              aria-selected={active}
              className="wgTabMain"
              title={pinned ? `${t('tabs.pinned')} · ${tip}` : tip}
              onClick={() => {
                if (Date.now() - dragEndedAt.current < 250) return
                activate(tab.sessionId)
              }}
              onDoubleClick={() => { startEdit(tab.sessionId, label) }}
            >
              <span className="wgTabStatus" data-tab-state={indicator.attention ? 'attention' : indicator.running ? 'running' : indicator.unread ? 'unread' : indicator.settled ? 'settled' : 'idle'}>
                <StateDot state={dotState(indicator)} />
              </span>
              {/* Two stacked lines, folder-style: the project (short, quiet)
                  over the session title (long, primary). The project line is
                  omitted for a session in no workspace, which lets the title
                  use the full height rather than leaving a blank row. */}
              <span className="wgTabText">
                {project !== undefined && (
                  <span className="wgTabProject" title={project.path}>{project.label}</span>
                )}
                <span className="wgTabLabel">{label}</span>
              </span>
            </button>
            {pinned && (
              <span className="wgTabPin" title={t('tabs.pinned')} aria-hidden>
                <IconPinFillMedium />
              </span>
            )}
            <Tooltip label={t('tabs.close')} side="top" delayMs={600}>
              <button
                type="button"
                className="wgTabClose"
                aria-label={`${t('tabs.close')} ${label}`}
                onClick={(event) => {
                  event.stopPropagation()
                  actions.close(tab.sessionId)
                }}
              >
                <IconCloseFillMedium />
              </button>
            </Tooltip>
          </>
        )}
      </div>
    )
  })

  // The menu's chip, resolved against the current strip: a menu opened on a chip
  // that has since disappeared renders nothing rather than acting on a stale id.
  const menuTab = menu === null ? undefined : display.find(tab => tab.sessionId === menu.sessionId)
  const menuIndex = menuTab === undefined ? -1 : at(display, menuTab)
  const menuLabel = menuTab === undefined
    ? ''
    : menuTab.title ?? list.byId[menuTab.sessionId]?.displayTitle ?? menuTab.sessionId
  const menuPinned = menuTab?.pinned === true
  const canCloseRight = menuIndex >= 0 && menuIndex < display.length - 1

  return createPortal(
    <>
      <div className="wgTabs" role="tablist" aria-label={t('tabs.aria')}>
        <div
          className="wgTabsScroll"
          ref={scrollRef}
          onWheel={(event) => {
            // A plain wheel reports only `deltaY`, and the overflow here is
            // horizontal, so without this the wheel would do nothing over the
            // strip (or scroll the transcript behind it). Redirect the dominant
            // delta to scrollLeft, and only swallow the event once there is
            // somewhere left to scroll — otherwise a wheel at either end keeps
            // propagating and the page still scrolls normally.
            const el = event.currentTarget
            if (el.scrollWidth <= el.clientWidth) return
            const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX
            if (delta === 0) return
            const atStart = el.scrollLeft <= 0 && delta < 0
            const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && delta > 0
            if (atStart || atEnd) return
            el.scrollLeft += delta
            event.preventDefault()
          }}
        >
          {chips}
        </div>
      </div>
      {menu !== null && menuTab !== undefined && createPortal(
        <div
          className="wgTabMenu"
          role="menu"
          aria-label={menuLabel}
          style={{ left: menu.x, top: menu.y }}
        >
          <MenuRow
            label={menuPinned ? t('tabs.unpin') : t('tabs.pin')}
            onSelect={() => {
              actions.pin(menu.sessionId)
              setMenu(null)
            }}
          />
          <MenuRow
            label={t('tabs.rename')}
            onSelect={() => { startEdit(menu.sessionId, menuLabel) }}
          />
          <MenuRow
            label={t('tabs.renameSession')}
            onSelect={() => {
              setMenu(null)
              rename(menu.sessionId, menuLabel)
            }}
          />
          <div className="wgTabMenuSeparator" role="separator" />
          <MenuRow
            label={t('tabs.close')}
            onSelect={() => {
              setMenu(null)
              actions.close(menu.sessionId)
            }}
          />
          <MenuRow
            label={t('tabs.closeOthers')}
            onSelect={() => {
              setMenu(null)
              actions.closeOthers(menu.sessionId)
            }}
          />
          <MenuRow
            label={t('tabs.closeRight')}
            disabled={!canCloseRight}
            onSelect={() => {
              setMenu(null)
              actions.closeAfter(menu.sessionId)
            }}
          />
        </div>,
        document.body,
      )}
    </>,
    seat,
  )
}

/** Index of one tab in the strip, used by the menu's range actions. */
function at(tabs: readonly SessionTab[], target: SessionTab): number {
  return tabs.findIndex(tab => tab.sessionId === target.sessionId)
}
