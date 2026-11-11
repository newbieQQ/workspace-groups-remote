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
import { type DragEvent, type ReactNode } from 'react';
import { type StateDotState } from '@deepseek-ai/dsh-client-ui-primitives';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { CategoryNode, FolderNode, SessionNode, WorkspaceGroupNode } from './tree.ts';
type T = TranslateNS<'workspaceGroups'>;
/** dataTransfer type carrying the dragged workspace id (in-plugin drags only). */
export declare const DND_WORKSPACE_TYPE = "application/x-dsh-workspace-groups";
/** dataTransfer type carrying the dragged category key (group reorder). */
export declare const DND_CATEGORY_TYPE = "application/x-dsh-workspace-groups-category";
/** Whether a drag carries any of the plugin's payloads (drop targets accept both). */
export declare function hasPluginDragType(types: DOMStringList | readonly string[]): boolean;
/** Primary status dot state for a session row. */
export declare function sessionDotState(node: Pick<SessionNode, 'pendingInteraction' | 'running' | 'runningSubagentCount' | 'completed'>): StateDotState;
/** Compact relative time ("now"/"5min"/"3h"/"2d"/"4mo"/"1y"). */
export declare function relativeTimeLabel(updatedAt: number, now: number): string;
/** Drop-target props shared by category and workspace rows (all optional). */
export interface RowDropProps {
    /** Row is under the dragged workspace — show the drop highlight. */
    dropActive?: boolean;
    /** Insertion indicator: a line above (before) or below (after) this row. */
    insertLine?: 'before' | 'after';
    /** Accept a drag over this row (must preventDefault to allow the drop). */
    onRowDragOver?: (event: DragEvent) => void;
    /** Clear the highlight when the pointer leaves the row. */
    onRowDragLeave?: (event: DragEvent) => void;
    /** Drop a workspace onto this row. */
    onRowDrop?: (event: DragEvent) => void;
}
/**
 * Render one stored icon value (preset artwork or a short glyph). Shared by the
 * category row's icon slot and the appearance picker grid, so both show exactly
 * the same artwork. `fallback` renders when the value is empty or unknown.
 */
export declare function CategoryGlyph({ icon, fallback }: {
    icon: string | undefined;
    fallback?: ReactNode;
}): JSX.Element;
/**
 * One category folder row: toggle, rename/delete menu (every group — rule
 * groups via overlay renames/hides), draggable source for group reorder and
 * drop target for both workspace moves and group reorders.
 */
export declare function CategoryRow({ node, t, onToggle, onAddWorkspace, addingWorkspace, onRename, onDelete, onTogglePin, onEditAppearance, dropActive, insertLine, onRowDragOver, onRowDragLeave, onRowDrop, onDragStartCategory }: {
    node: CategoryNode;
    t: T;
    onToggle: () => void;
    /** Create and assign a workspace directly to this category. */
    onAddWorkspace?: () => void;
    addingWorkspace?: boolean;
    /** Rename/delete actions; the hover menu renders only when both provided. */
    onRename?: () => void;
    onDelete?: () => void;
    /** Pin/unpin this group (menu row). */
    onTogglePin?: () => void;
    /** Open the appearance dialog (menu row). */
    onEditAppearance?: () => void;
    /** Group reorder source; the row becomes draggable only when provided. */
    onDragStartCategory?: (event: DragEvent) => void;
} & RowDropProps): import("react").JSX.Element;
/** One workspace folder row inside a category: draggable source + drop target. */
export declare function WorkspaceRow({ node, t, onToggle, onNewSession, onRename, onDelete, canMoveOut, onMoveOut, onManageFolders, onOpenInFolder, flat, dropActive, insertLine, onRowDragOver, onRowDragLeave, onRowDrop, onDragStartExtra }: {
    node: WorkspaceGroupNode;
    t: T;
    onToggle: () => void;
    onNewSession: () => void;
    onRename: () => void;
    onDelete: () => void;
    /** Project currently sits inside a group — offer "move out of group". */
    canMoveOut?: boolean;
    onMoveOut?: () => void;
    /** Open the folder-management dialog (extra folders + root). */
    onManageFolders?: () => void;
    /**
     * Open the project directory in the host's file manager. Omitted when the
     * host resolved no folder application (no capability, or a remote launch),
     * which keeps the entry out of the menu entirely.
     */
    onOpenInFolder?: () => void;
    /** Render as a top-level row (no folder indentation). */
    flat?: boolean;
    /** Extra dragstart hook (e.g. collapse all expanded projects while dragging). */
    onDragStartExtra?: () => void;
} & RowDropProps): import("react").JSX.Element;
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
export declare function FolderRow({ node, t, onToggle, onNewSession, onSetRoot, onRemove, onOpenInFolder, creating }: {
    node: FolderNode;
    t: T;
    onToggle: () => void;
    onNewSession: () => void;
    onSetRoot: () => void;
    onRemove: () => void;
    /** Absent when the host resolved no folder application. */
    onOpenInFolder?: () => void;
    /** A session is being created here: the hover ＋ stays disabled. */
    creating?: boolean;
}): import("react").JSX.Element;
/**
 * Children container for one folder's rows.
 *
 * Keeps the tree's `role="group"` semantics and gives the rows a single
 * positioned ancestor. It used to draw a per-folder guide rail; that is now the
 * flower branch's job (one continuous stem for the whole tree, see
 * `FlowerBranch.tsx`), so this is structure only.
 */
export declare function TreeChildren({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
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
export declare function RowGroup({ expanded, className, animate, children }: {
    expanded: boolean;
    className?: string;
    /** Disable the animation for huge subtrees or during drag folding. */
    animate?: boolean;
    children: ReactNode;
}): JSX.Element | null;
/** One session leaf row. */
export declare function SessionRow({ node, currentId, now, t, onOpen, onRename, onFork, onArchive, nested }: {
    node: SessionNode;
    currentId: string | undefined;
    now: number;
    t: T;
    onOpen: (id: SessionNode['id']) => void;
    onRename: (id: SessionNode['id'], currentTitle: string) => void;
    onFork: (id: SessionNode['id']) => void;
    onArchive: (id: SessionNode['id']) => void;
    /** Rendered under a folder row: one indent step deeper than a plain session. */
    nested?: boolean;
}): import("react").JSX.Element;
export type { T };
