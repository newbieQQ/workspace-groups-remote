/**
 * Row components for the workspace-groups tree. Kept dependency-light: they
 * consume only React, primitives (StateDot/Menu/icons), and the shared CSS
 * string. Each row owns its hover actions menu; dialogs live in the browser
 * root so they survive row unmounts during collapse.
 *
 * Drag & drop: workspace rows are draggable sources; category rows (and
 * workspace rows, standing for their containing category) are drop targets.
 * The payload is a custom dataTransfer type so only in-plugin drags land.
 */
import { useEffect, useRef, useState, type AnimationEvent, type DragEvent, type ReactNode } from 'react'
import {
  IconNewChatOutlineMedium,
  IconSearchOutlineMedium,
  IconSettingsOutlineMedium,
  IconDeliverDocMedium,
  IconEditOutlineMedium,
  IconThinkOutlineMedium,
  IconAgentPresetOutlineMedium,
  IconBrowseOutlineMedium,
  IconContextInjectionOutlineMedium,
  IconLinkOutlineMedium,
  IconShareOutlineMedium,
  IconUserOutlineMedium,
  IconPaperPlaneOutlineMedium,
  IconPaperclipOutlineMedium,
  IconDownloadOutlineMedium,
  IconPlayOutlineMedium,
  IconPersonalizationOutlineMedium,
  IconDarkOutlineMedium,
  IconFollowsystemOutlineMedium,
  IconGaugeOutlineMedium,
  IconQueueOutlineMedium,
  IconListPenOutlineMedium,
  IconInspectOutlineMedium,
  IconQuestionOutlineMedium,
  IconInfoOutlineMedium,
  IconAlarmClockOutlineMedium,
  IconCompareSplitOutlineMedium,
  IconCheckCircleOutlineMedium,
  IconPinOutlineMedium,
  IconMicrophoneOutlineMedium,
  IconApiOutlineMedium,
  IconArchiveOutlineRegular,
  IconArchiveOutlineMedium,
  IconBranchOutlineMedium,
  IconBranchOutlineRegular,
  IconChecklistOutlineMedium,
  IconClockOutlineMedium,
  IconCodeOutlineMedium,
  IconCordisPluginOutlineMedium,
  IconDataOutlineMedium,
  IconDatabaseOutlineMedium,
  IconEditOutlineRegular,
  IconEllipsisOutlineRegular,
  IconFolderCloseMedium,
  IconFolderOpenMedium,
  IconFolderOpenOutlineRegular,
  IconGlobeOutlineMedium,
  IconGoalOutlineMedium,
  IconLightOutlineMedium,
  IconPinFillMedium,
  IconPinOutlineRegular,
  IconPlanOutlineMedium,
  IconPlusOutlineRegular,
  IconProjectAddOutlineRegular,
  IconRightUpOutlineRegular,
  IconShieldOutlineMedium,
  IconSkillOutlineMedium,
  IconSlidersTwoOutlineRegular,
  IconSparkleMedium,
  IconTreeCornerMedium,
  IconTriangleRightFillMedium,
  IconTrashOutlineRegular,
  IconUsersOutlineMedium,
  IconWorkspaceTreeOutlineMedium,
  Menu,
  StateDot,
  type MenuEntry,
  type StateDotState,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type { WorkspaceGroupsKey } from './locales.ts'
import { SessionFlower } from './FlowerBranch.tsx'
import { scienceIconNodes, type ScienceIconId } from './group-icons-science.tsx'
import type { GroupIconId } from '../core/types.ts'
import type { CategoryNode, FolderNode, SessionNode, WorkspaceGroupNode } from './tree.ts'

type T = TranslateNS<'workspaceGroups'>

/** dataTransfer type carrying the dragged workspace id (in-plugin drags only). */
export const DND_WORKSPACE_TYPE = 'application/x-dsh-workspace-groups'
/** dataTransfer type carrying the dragged category key (group reorder). */
export const DND_CATEGORY_TYPE = 'application/x-dsh-workspace-groups-category'

/** Whether a drag carries any of the plugin's payloads (drop targets accept both). */
export function hasPluginDragType(types: DOMStringList | readonly string[]): boolean {
  const list = Array.from(types as Iterable<string>)
  return list.includes(DND_WORKSPACE_TYPE) || list.includes(DND_CATEGORY_TYPE)
}

/** Pending interaction status → primitives StateDot state. */
function pendingState(status: SessionNode['pendingInteraction']): StateDotState | undefined {
  switch (status) {
    case 'approval':
    case 'plan-review':
    case 'question':
      return 'warning'
    default:
      return undefined
  }
}

/** Primary status dot state for a session row. */
export function sessionDotState(node: Pick<SessionNode, 'pendingInteraction' | 'running' | 'runningSubagentCount' | 'completed'>): StateDotState {
  if (pendingState(node.pendingInteraction) !== undefined) return 'warning'
  if (node.running || node.runningSubagentCount > 0) return 'ongoing'
  return node.completed ? 'done' : 'done'
}

/** Compact relative time ("now"/"5min"/"3h"/"2d"/"4mo"/"1y"). */
export function relativeTimeLabel(updatedAt: number, now: number): string {
  const diff = Math.max(0, now - updatedAt)
  const MIN = 60_000
  const HOUR = 3_600_000
  const DAY = 86_400_000
  if (diff < MIN) return 'now'
  if (diff < HOUR) return `${Math.floor(diff / MIN)}min`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h`
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)}d`
  if (diff < 365 * DAY) return `${Math.floor(diff / (30 * DAY))}mo`
  return `${Math.floor(diff / (365 * DAY))}y`
}

/** Drop-target props shared by category and workspace rows (all optional). */
export interface RowDropProps {
  /** Row is under the dragged workspace — show the drop highlight. */
  dropActive?: boolean
  /** Insertion indicator: a line above (before) or below (after) this row. */
  insertLine?: 'before' | 'after'
  /** Accept a drag over this row (must preventDefault to allow the drop). */
  onRowDragOver?: (event: DragEvent) => void
  /** Clear the highlight when the pointer leaves the row. */
  onRowDragLeave?: (event: DragEvent) => void
  /** Drop a workspace onto this row. */
  onRowDrop?: (event: DragEvent) => void
}

/**
 * Preset group icon ids → primitives artwork. Medium stroke to match the
 * folder glyph used by unprefixed groups. Keyed by plain string so an id from
 * a newer host (or a hand-edited JSON file) degrades instead of throwing.
 */
const HOST_CATEGORY_ICONS = {
  folder: <IconFolderCloseMedium />,
  workspace: <IconWorkspaceTreeOutlineMedium />,
  code: <IconCodeOutlineMedium />,
  plugin: <IconCordisPluginOutlineMedium />,
  skill: <IconSkillOutlineMedium />,
  data: <IconDataOutlineMedium />,
  database: <IconDatabaseOutlineMedium />,
  api: <IconApiOutlineMedium />,
  plan: <IconPlanOutlineMedium />,
  goal: <IconGoalOutlineMedium />,
  light: <IconLightOutlineMedium />,
  globe: <IconGlobeOutlineMedium />,
  archive: <IconArchiveOutlineMedium />,
  branch: <IconBranchOutlineMedium />,
  users: <IconUsersOutlineMedium />,
  clock: <IconClockOutlineMedium />,
  shield: <IconShieldOutlineMedium />,
  checklist: <IconChecklistOutlineMedium />,
  sparkle: <IconSparkleMedium />,
  tree: <IconTreeCornerMedium />,
  chat: <IconNewChatOutlineMedium />,
  search: <IconSearchOutlineMedium />,
  settings: <IconSettingsOutlineMedium />,
  document: <IconDeliverDocMedium />,
  edit: <IconEditOutlineMedium />,
  think: <IconThinkOutlineMedium />,
  agent: <IconAgentPresetOutlineMedium />,
  browse: <IconBrowseOutlineMedium />,
  context: <IconContextInjectionOutlineMedium />,
  link: <IconLinkOutlineMedium />,
  share: <IconShareOutlineMedium />,
  user: <IconUserOutlineMedium />,
  send: <IconPaperPlaneOutlineMedium />,
  attachment: <IconPaperclipOutlineMedium />,
  download: <IconDownloadOutlineMedium />,
  play: <IconPlayOutlineMedium />,
  design: <IconPersonalizationOutlineMedium />,
  moon: <IconDarkOutlineMedium />,
  monitor: <IconFollowsystemOutlineMedium />,
  gauge: <IconGaugeOutlineMedium />,
  queue: <IconQueueOutlineMedium />,
  notes: <IconListPenOutlineMedium />,
  inspect: <IconInspectOutlineMedium />,
  help: <IconQuestionOutlineMedium />,
  info: <IconInfoOutlineMedium />,
  alarm: <IconAlarmClockOutlineMedium />,
  compare: <IconCompareSplitOutlineMedium />,
  done: <IconCheckCircleOutlineMedium />,
  pin: <IconPinOutlineMedium />,
  microphone: <IconMicrophoneOutlineMedium />,
} satisfies Record<Exclude<GroupIconId, ScienceIconId>, ReactNode>

/**
 * Registered icon id → rendered artwork. The research family is merged in from
 * its own module: those glyphs are drawn locally (the Host primitive package
 * ships no lab/material icons) but must render through the very same path.
 */
const CATEGORY_ICONS: Record<string, ReactNode> = {
  ...HOST_CATEGORY_ICONS,
  ...scienceIconNodes(),
}

/**
 * Resolve a stored `appearance.icon` value: a preset id renders the artwork,
 * a 1–4 character glyph renders as text, and anything else returns null so the
 * caller keeps the default folder icon.
 */
function resolveCategoryIcon(icon: string | undefined): ReactNode | null {
  if (icon === undefined || icon === '') return null
  const preset = Object.prototype.hasOwnProperty.call(CATEGORY_ICONS, icon) ? CATEGORY_ICONS[icon] : undefined
  if (preset !== undefined) return preset
  return Array.from(icon).length <= 4 ? <span className="wgCategoryGlyph">{icon}</span> : null
}

/**
 * Render one stored icon value (preset artwork or a short glyph). Shared by the
 * category row's icon slot and the appearance picker grid, so both show exactly
 * the same artwork. `fallback` renders when the value is empty or unknown.
 */
export function CategoryGlyph({ icon, fallback = null }: { icon: string | undefined; fallback?: ReactNode }): JSX.Element {
  return <>{resolveCategoryIcon(icon) ?? fallback}</>
}

/**
 * One category folder row: toggle, rename/delete menu (every group — rule
 * groups via overlay renames/hides), draggable source for group reorder and
 * drop target for both workspace moves and group reorders.
 */
export function CategoryRow({ node, t, onToggle, onAddWorkspace, addingWorkspace = false, onRename, onDelete, onTogglePin, onEditAppearance, dropActive = false, insertLine, onRowDragOver, onRowDragLeave, onRowDrop, onDragStartCategory }: {
  node: CategoryNode
  t: T
  onToggle: () => void
  /** Create and assign a workspace directly to this category. */
  onAddWorkspace?: () => void
  addingWorkspace?: boolean
  /** Rename/delete actions; the hover menu renders only when both provided. */
  onRename?: () => void
  onDelete?: () => void
  /** Pin/unpin this group (menu row). */
  onTogglePin?: () => void
  /** Open the appearance dialog (menu row). */
  onEditAppearance?: () => void
  /** Group reorder source; the row becomes draggable only when provided. */
  onDragStartCategory?: (event: DragEvent) => void
} & RowDropProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const count = node.workspaces.length
  const manageable = onRename !== undefined && onDelete !== undefined
  const pinned = node.appearance?.pinned === true
  const menuItems: MenuEntry[] = [
    ...(onTogglePin === undefined
      ? []
      : [{
        id: 'pin',
        label: pinned ? t('group.unpin') : t('group.pin'),
        icon: pinned ? <IconPinFillMedium /> : <IconPinOutlineRegular />,
      }]),
    ...(onEditAppearance === undefined
      ? []
      : [{ id: 'appearance', label: t('group.appearance'), icon: <IconSlidersTwoOutlineRegular /> }]),
    { type: 'separator', id: 'group-menu-separator' },
    { id: 'rename', label: t('group.rename'), icon: <IconEditOutlineRegular /> },
    { id: 'delete', label: t('group.delete'), icon: <IconTrashOutlineRegular />, danger: true },
  ]
  return (
    <div
      className={`wgCategoryRow${dropActive ? ' wgDropTarget' : ''}${insertLine === 'before' ? ' wgInsertBefore' : insertLine === 'after' ? ' wgInsertAfter' : ''}`}
      role="treeitem"
      aria-expanded={node.expanded}
      aria-label={pinned ? `${t('section.workspaces')} · ${t('group.pinned')}` : t('section.workspaces')}
      data-wg-category={node.key}
      data-wg-color={node.appearance?.color}
      /* Flower-branch hooks: a category row starts a group, so the stem kinks
         here. Deliberately NOT marked active even when it contains the open
         session — the session row below it carries that marker, and only one
         row may claim it (see BRANCH_ACTIVE_ATTRIBUTE). */
      data-wg-branch-row=""
      data-wg-branch-group=""
      draggable={onDragStartCategory !== undefined}
      onClick={onToggle}
      onDragStart={onDragStartCategory}
      onDragOver={onRowDragOver}
      onDragLeave={onRowDragLeave}
      onDrop={onRowDrop}
    >
      <span className={`wgChevron${node.expanded ? ' wgChevronOpen' : ''}`}>
        <IconTriangleRightFillMedium />
      </span>
      <span className="wgCategoryIcon" data-wg-row-icon="group">
        <CategoryGlyph
          icon={node.appearance?.icon}
          fallback={node.expanded ? <IconFolderOpenMedium /> : <IconFolderCloseMedium />}
        />
      </span>
      <span className="wgCategoryLabel">{node.label}</span>
      {pinned && (
        <span className="wgCategoryPin" aria-hidden>
          <IconPinFillMedium />
        </span>
      )}
      {/* One trailing slot for both states: the count and the hover buttons are
          stacked in the same grid cell pinned to the row's right edge, so the
          count is right-aligned exactly where the buttons appear and the swap
          never moves a box (see .wgRowTrail in styles.css). */}
      <span className="wgRowTrail">
        <span className="wgCategoryCount">{count}</span>
        <span className="wgRowActions">
          {onAddWorkspace !== undefined && (
            <button type="button" className="wgIconButton" draggable={false}
              disabled={addingWorkspace}
              title={t('workspace.add')} aria-label={`${t('workspace.add')} · ${node.label}`}
              onClick={event => { event.stopPropagation(); onAddWorkspace() }}>
              <IconPlusOutlineRegular />
            </button>
          )}
          {manageable && (
            <Menu
              open={menuOpen}
              onClose={() => { setMenuOpen(false) }}
              items={menuItems}
              onSelect={(id) => {
                setMenuOpen(false)
                if (id === 'pin') onTogglePin?.()
                if (id === 'appearance') onEditAppearance?.()
                if (id === 'rename') onRename()
                if (id === 'delete') onDelete()
              }}
              portal
              closeOnPointerLeave
              anchor={(
                <button
                  type="button"
                  className="wgIconButton"
                  draggable={false}
                  aria-label={`${t('group.rename')} ${node.label}`}
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
                >
                  <IconEllipsisOutlineRegular />
                </button>
              )}
            />
          )}
        </span>
      </span>
    </div>
  )
}

/** One workspace folder row inside a category: draggable source + drop target. */
export function WorkspaceRow({ node, t, onToggle, onNewSession, onRename, onDelete, canMoveOut = false, onMoveOut, onManageFolders, onOpenInFolder, flat = false, dropActive = false, insertLine, onRowDragOver, onRowDragLeave, onRowDrop, onDragStartExtra }: {
  node: WorkspaceGroupNode
  t: T
  onToggle: () => void
  onNewSession: () => void
  onRename: () => void
  onDelete: () => void
  /** Project currently sits inside a group — offer "move out of group". */
  canMoveOut?: boolean
  onMoveOut?: () => void
  /** Open the folder-management dialog (extra folders + root). */
  onManageFolders?: () => void
  /**
   * Open the project directory in the host's file manager. Omitted when the
   * host resolved no folder application (no capability, or a remote launch),
   * which keeps the entry out of the menu entirely.
   */
  onOpenInFolder?: () => void
  /** Render as a top-level row (no folder indentation). */
  flat?: boolean
  /** Extra dragstart hook (e.g. collapse all expanded projects while dragging). */
  onDragStartExtra?: () => void
} & RowDropProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuItems: MenuEntry[] = [
    ...(onOpenInFolder !== undefined
      ? [{ id: 'openInFolder', label: t('workspace.openInFolder'), icon: <IconFolderOpenOutlineRegular size={16} /> }]
      : []),
    ...(canMoveOut && onMoveOut !== undefined
      ? [{ id: 'moveOut', label: t('workspace.moveOutOfGroup'), icon: <IconRightUpOutlineRegular size={16} /> }]
      : []),
    ...(onManageFolders !== undefined
      ? [{ id: 'folders', label: t('folder.manage'), icon: <IconFolderOpenOutlineRegular size={16} /> }]
      : []),
    { id: 'rename', label: t('workspace.rename'), icon: <IconEditOutlineRegular /> },
    { id: 'delete', label: t('workspace.delete'), icon: <IconTrashOutlineRegular />, danger: true },
  ]
  const onDragStart = (event: DragEvent): void => {
    event.dataTransfer.setData(DND_WORKSPACE_TYPE, node.workspaceId)
    event.dataTransfer.effectAllowed = 'move'
    onDragStartExtra?.()
  }
  return (
    <div
      className={`wgProjectRow${node.containsCurrent ? ' wgProjectActive' : ''}${flat ? ' wgProjectFlat' : ''}${dropActive ? ' wgDropTarget' : ''}${insertLine === 'before' ? ' wgInsertBefore' : insertLine === 'after' ? ' wgInsertAfter' : ''}`}
      role="treeitem"
      aria-expanded={node.expanded}
      data-wsid={node.workspaceId}
      /* Branch hooks. A project row IS a branch point: it heads its own run of
         session rows, so the stem kinks here and curves back in on the first
         session beneath it. That gives the branch one kink per project, which is
         the readable rhythm — a single top-level category would otherwise never
         produce a kink at all.
         Active is NOT set here: when this project holds the open session, the
         session row itself carries the marker. */
      data-wg-branch-row=""
      data-wg-branch-group=""
      draggable
      onClick={onToggle}
      onDragStart={onDragStart}
      onDragOver={onRowDragOver}
      onDragLeave={onRowDragLeave}
      onDrop={onRowDrop}
    >
      <span className={`wgChevron${node.expanded ? ' wgChevronOpen' : ''}`}>
        <IconTriangleRightFillMedium />
      </span>
      <span className="wgCategoryIcon" data-wg-row-icon="project">
        {/* Project rows use the project glyph (same as the official workspace
            browser) so groups (folder glyph) and projects stay distinguishable. */}
        <IconProjectAddOutlineRegular />
      </span>
      <span className="wgProjectLabel" title={node.path}>{node.label}</span>
      {/* Same trailing-slot contract as groups and folders: the count and the
          hover buttons share one right-aligned grid cell, so the count sits where
          the buttons appear and the swap never moves either box. */}
      <span className="wgRowTrail">
        <span className="wgProjectCount">{node.sessionCount}</span>
        {/* Action order is uniform across every row kind: new-session ＋ first,
            menu ⋯ second (see CategoryRow). */}
        <span className="wgRowActions">
          <button
            type="button"
            className="wgIconButton"
            draggable={false}
            aria-label={`${t('session.new')} ${node.label}`}
            onClick={(e) => { e.stopPropagation(); onNewSession() }}
          >
            <IconPlusOutlineRegular />
          </button>
          <Menu
            open={menuOpen}
            onClose={() => { setMenuOpen(false) }}
            items={menuItems}
            onSelect={(id) => {
              setMenuOpen(false)
              if (id === 'openInFolder') onOpenInFolder?.()
              if (id === 'moveOut') onMoveOut?.()
              if (id === 'folders') onManageFolders?.()
              if (id === 'rename') onRename()
              if (id === 'delete') onDelete()
            }}
            portal
            closeOnPointerLeave
            anchor={(
              <button
                type="button"
                className="wgIconButton"
                draggable={false}
                aria-label={`${t('workspace.rename')} ${node.label}`}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
              >
                <IconEllipsisOutlineRegular />
              </button>
            )}
          />
        </span>
      </span>
    </div>
  )
}

/**
 * One folder row under a project: the base directory (folder #0) plus every
 * extra folder of that workspace. Sits at the session indent level so the
 * 42/58/74 ladder is preserved, and its own session rows indent one step
 * deeper (see `.wgSessionNested`).
 *
 * Deliberately NOT a drag source or drop target: folders are a fixed,
 * host-ordered list; reordering them would need a write path this feature does
 * not have.
 */
export function FolderRow({ node, t, onToggle, onNewSession, onSetRoot, onRemove, onOpenInFolder, creating = false }: {
  node: FolderNode
  t: T
  onToggle: () => void
  onNewSession: () => void
  onSetRoot: () => void
  onRemove: () => void
  /** Absent when the host resolved no folder application. */
  onOpenInFolder?: () => void
  /** A session is being created here: the hover ＋ stays disabled. */
  creating?: boolean
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuItems: MenuEntry[] = [
    { id: 'newSession', label: t('session.new'), icon: <IconPlusOutlineRegular /> },
    ...(onOpenInFolder !== undefined
      ? [{ id: 'openInFolder', label: t('workspace.openInFolder'), icon: <IconFolderOpenOutlineRegular size={16} /> }]
      : []),
    ...(node.isRoot
      ? []
      : [{ id: 'setRoot', label: t('folder.setRoot'), icon: <IconPinOutlineRegular /> }]),
    ...(node.isBase
      ? []
      : [
          { type: 'separator' as const, id: 'folder-menu-separator' },
          { id: 'remove', label: t('folder.remove'), icon: <IconTrashOutlineRegular />, danger: true },
        ]),
  ]
  return (
    <div
      className={`wgFolderRow${node.isRoot ? ' wgFolderRooted' : ''}${node.isBase ? ' wgFolderBase' : ''}`}
      role="treeitem"
      aria-expanded={node.expanded}
      aria-label={node.label}
      data-wg-row-folder=""
      data-wg-folder={node.path}
      {...(node.isRoot ? { 'data-wg-folder-root': '' } : {})}
      /* Branch hook only (no group): a folder is a leaf branch point, its
         sessions hang off it like a project's do. */
      data-wg-branch-row=""
      onClick={onToggle}
    >
      <span className={`wgChevron${node.expanded ? ' wgChevronOpen' : ''}`}>
        <IconTriangleRightFillMedium />
      </span>
      <span className="wgCategoryIcon" data-wg-row-icon="folder">
        {node.expanded ? <IconFolderOpenMedium /> : <IconFolderCloseMedium />}
      </span>
      <span className="wgFolderLabel" title={node.path}>{node.label}</span>
      {node.isRoot && (
        <span className="wgFolderRoot" title={t('folder.rootBadge')} aria-label={t('folder.rootBadge')}>★</span>
      )}
      {/* Count and hover buttons share the same right-aligned cell (as on every
          other row): the count is flush with the row's right edge and yields to
          the buttons without any reflow. */}
      <span className="wgRowTrail">
        <span className="wgFolderCount">{node.sessions.length}</span>
        {/* Same ＋ then ⋯ order as groups and workspaces. */}
        <span className="wgRowActions">
          <button
            type="button"
            className="wgIconButton"
            draggable={false}
            disabled={creating}
            aria-label={`${t('session.new')} ${node.label}`}
            onClick={(e) => { e.stopPropagation(); onNewSession() }}
          >
            <IconPlusOutlineRegular />
          </button>
          <Menu
            open={menuOpen}
            onClose={() => { setMenuOpen(false) }}
            items={menuItems}
            onSelect={(id) => {
              setMenuOpen(false)
              if (id === 'newSession') onNewSession()
              if (id === 'openInFolder') onOpenInFolder?.()
              if (id === 'setRoot') onSetRoot()
              if (id === 'remove') onRemove()
            }}
            portal
            closeOnPointerLeave
            anchor={(
              <button
                type="button"
                className="wgIconButton"
                draggable={false}
                aria-label={`${t('folder.title')} ${node.label}`}
                onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
              >
                <IconEllipsisOutlineRegular />
              </button>
            )}
          />
        </span>
      </span>
    </div>
  )
}

/**
 * Children container for one folder's rows.
 *
 * Keeps the tree's `role="group"` semantics and gives the rows a single
 * positioned ancestor. It used to draw a per-folder guide rail; that is now the
 * flower branch's job (one continuous stem for the whole tree, see
 * `FlowerBranch.tsx`), so this is structure only.
 */
export function TreeChildren({ children }: { children: ReactNode }) {
  return (
    <div className="wgTreeChildren" role="group">
      {children}
    </div>
  )
}

/** Keyframe names the disclosure animation relies on (styles.css). */
const ROW_GROUP_OPEN_ANIMATION = 'wg-rows-in'
const ROW_GROUP_CLOSE_ANIMATION = 'wg-rows-out'

/** Upper bound for one disclosure animation (180ms open / 160ms close). */
const ROW_GROUP_ANIMATION_FALLBACK_MS = 400

/** Lifecycle of one animated disclosure body. */
type RowGroupPhase = 'opening' | 'open' | 'closing' | 'closed'

/** Whether the user asked the OS to reduce motion (no sync unmount without it). */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Animated disclosure body shared by the category and project levels.
 *
 * Collapsed state renders nothing at all (same DOM as the old
 * `{expanded && …}`), so hidden subtrees cost no layout. Expanding plays a
 * 0fr→1fr grid animation; collapsing keeps the rows mounted for one closing
 * animation and unmounts on its `animationend`. `prefers-reduced-motion`
 * unmounts synchronously instead — waiting for an `animationend` that CSS
 * disabled would leave the group stuck half-closed.
 *
 * The flower-branch overlay cannot follow a moving row box, so the animation
 * phase exposes `data-wg-animating` (styles.css fades the vine while it is
 * present).
 */
export function RowGroup({ expanded, className, animate = true, children }: {
  expanded: boolean
  className?: string
  /** Disable the animation for huge subtrees or during drag folding. */
  animate?: boolean
  children: ReactNode
}): JSX.Element | null {
  const [phase, setPhase] = useState<RowGroupPhase>(expanded ? 'open' : 'closed')
  const previousExpanded = useRef(expanded)
  // Adjust state while rendering (React's documented prop-change pattern) so a
  // reduced-motion collapse unmounts in the same commit instead of flashing
  // the old rows for a frame.
  if (previousExpanded.current !== expanded) {
    previousExpanded.current = expanded
    if (expanded) setPhase(animate && !prefersReducedMotion() ? 'opening' : 'open')
    else setPhase(animate && !prefersReducedMotion() ? 'closing' : 'closed')
  }
  // Insurance against a missing `animationend` (interrupted or skipped
  // animation): the animating phase holds `pointer-events:none` and keeps a
  // collapsed body mounted, so it must always settle on its own.
  useEffect(() => {
    if (phase !== 'opening' && phase !== 'closing') return undefined
    const timer = window.setTimeout(() => {
      setPhase(phase === 'opening' ? 'open' : 'closed')
    }, ROW_GROUP_ANIMATION_FALLBACK_MS)
    return () => { window.clearTimeout(timer) }
  }, [phase])
  if (phase === 'closed') return null
  const animating = phase === 'opening' || phase === 'closing'
  const classes = `wgRows${className === undefined ? '' : ` ${className}`}${phase === 'opening' ? ' wgRowsOpening' : ''}${phase === 'closing' ? ' wgRowsClosing' : ''}`
  const onAnimationEnd = (event: AnimationEvent<HTMLDivElement>): void => {
    if (event.target !== event.currentTarget) return
    if (phase === 'opening' && event.animationName === ROW_GROUP_OPEN_ANIMATION) setPhase('open')
    if (phase === 'closing' && event.animationName === ROW_GROUP_CLOSE_ANIMATION) setPhase('closed')
  }
  return (
    <div
      role="group"
      className={classes}
      aria-hidden={!expanded}
      {...(animating ? { 'data-wg-animating': '' } : {})}
      style={animating ? { pointerEvents: 'none' } : undefined}
      onAnimationEnd={onAnimationEnd}
    >
      <div className="wgRowsInner">{children}</div>
    </div>
  )
}

/** One session leaf row. */
export function SessionRow({ node, currentId, now, t, onOpen, onRename, onFork, onArchive, nested = false }: {
  node: SessionNode
  currentId: string | undefined
  now: number
  t: T
  onOpen: (id: SessionNode['id']) => void
  onRename: (id: SessionNode['id'], currentTitle: string) => void
  onFork: (id: SessionNode['id']) => void
  onArchive: (id: SessionNode['id']) => void
  /** Rendered under a folder row: one indent step deeper than a plain session. */
  nested?: boolean
}) {
  const selected = node.id === currentId
  const [menuOpen, setMenuOpen] = useState(false)
  // Keep the active flower inside its own status slot, never in a measured
  // overlay: scrolling and expanding ancestors must move it with this row.
  const menuItems = [
    { id: 'rename', label: t('session.rename'), icon: <IconEditOutlineRegular /> },
    { id: 'fork', label: t('session.fork'), icon: <IconBranchOutlineRegular /> },
    { id: 'archive', label: t('session.archive'), icon: <IconArchiveOutlineRegular size={16} /> },
  ]
  return (
    <div
      className={`wgSessionRow${nested ? ' wgSessionNested' : ''}${selected ? ' wgSelected' : ''}${node.matched === true ? ' wgMatched' : ''}`}
      role="treeitem"
      aria-selected={selected}
      data-wg-branch-row=""
      {...(selected ? { 'data-wg-branch-active': '' } : {})}
      onClick={() => { onOpen(node.id) }}
    >
      <span className="wgStatusSlot">
        {selected
          ? <SessionFlower spinning={node.running || node.runningSubagentCount > 0} />
          : <StateDot state={sessionDotState(node)} />}
      </span>
      <span className="wgSessionTitle">{node.title}</span>
      {node.snippet !== undefined && (
        <span className="wgSessionSnippet" title={node.snippet}>{node.snippet}</span>
      )}
      {/* Same trailing slot as groups, workspaces and folders: the time is
          right-aligned on the row's right edge and yields to the ⋯ button on
          hover/focus without moving either box (see .wgRowTrail in styles.css). */}
      {!node.blank && (
        <span className="wgRowTrail">
          <span className="wgSessionTime">{relativeTimeLabel(node.updatedAt, now)}</span>
          <span className="wgRowActions">
            <Menu
              open={menuOpen}
              onClose={() => { setMenuOpen(false) }}
              items={menuItems}
              onSelect={(id) => {
                setMenuOpen(false)
                if (id === 'rename') onRename(node.id, node.title)
                if (id === 'fork') onFork(node.id)
                if (id === 'archive') onArchive(node.id)
              }}
              portal
              closeOnPointerLeave
              anchor={(
                <button
                  type="button"
                  className="wgIconButton"
                  aria-label={`${t('session.rename')} ${node.title}`}
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
                >
                  <IconEllipsisOutlineRegular />
                </button>
              )}
            />
          </span>
        </span>
      )}
    </div>
  )
}

export type { T }
