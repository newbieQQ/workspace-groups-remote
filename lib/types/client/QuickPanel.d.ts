import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { SessionListState } from '@deepseek-ai/dsh-api-session-controller/client';
import type { WorkspaceId, WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
/** Which surface of the quick panel is active. */
export type QuickTab = 'workspaces' | 'sessions';
/** The locale seat's translate function (same shape GroupsBrowser receives). */
type Translate = PropsLocale<'workspaceGroups'>['t'];
/** Quick panel props: hooks snapshots + the two injected verbs + shared CSS context. */
export type QuickPanelProps = {
    /** Close request (Escape, mask click, action completed, or parent Ctrl+R toggle). */
    onClose: () => void;
    /** Sessions list snapshot (drives running detection). */
    list: SessionListState;
    /** Real workspaces in stable Host order. */
    workspaces: readonly WorkspaceView[];
    /** Registry-global archive set. */
    archivedSessionIds: readonly SessionId[];
    /** Category label per grouped workspace id (badge column; top-level absent). */
    categoryByWorkspace: ReadonlyMap<string, string>;
    /** The Session the Conversation currently shows (mainView retention), if any. */
    current: SessionId | undefined;
    /** Start a New Session in a workspace (injected share verb). */
    startSession: (workspaceId?: WorkspaceId) => void;
    /** Open a real Session (injected share verb). */
    openSession: (sessionId: SessionId) => void;
    /** Render clock for relative times (parent refreshes per render). */
    now: number;
    /** Dictionary accessor (workspaceGroups namespace). */
    t: Translate;
};
/**
 * Render the quick switch panel (portaled overlay).
 * @param props - hooks snapshots + injected verbs.
 * @returns the panel element tree.
 */
export declare function QuickPanel({ onClose, list, workspaces, archivedSessionIds, categoryByWorkspace, current: currentSessionId, startSession, openSession, now, t, }: QuickPanelProps): import("react").ReactPortal;
export {};
