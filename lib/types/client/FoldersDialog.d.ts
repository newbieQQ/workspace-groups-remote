import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client';
import { type WorkspaceFolderEntry } from '../core/folders.ts';
import type { GroupsBrowserProps } from './contract.ts';
import { type RemoteProfileSummary } from './folder-directory.ts';
export declare function FoldersDialog({ workspace, entry, t, busy, canOpen, remote, ownerRemotePath, profiles, profilesError, knownWorkspaceIds, onClose, onAddFolder, onAddRemote, onAddSubpath, onSetRoot, onRemove, onOpenFolder }: {
    workspace: WorkspaceView;
    entry: WorkspaceFolderEntry | undefined;
    t: GroupsBrowserProps['t'];
    busy: boolean;
    canOpen: boolean;
    /** Remote (mirror-backed) workspace: extra folders can also be typed subpaths. */
    remote: boolean;
    /** Remote root of a cloud owner, so a browsed subdirectory joins as a subfolder. */
    ownerRemotePath: string | null;
    /** SSH connections, `null` while loading or when the remote-ssh plugin is absent. */
    profiles: readonly RemoteProfileSummary[] | null;
    profilesError: string | null;
    /** Live workspace ids, so a member whose workspace is gone can say so. */
    knownWorkspaceIds: readonly string[];
    onClose: () => void;
    /** Pick any directory (local or an already-mirrored cloud folder). */
    onAddFolder: () => void;
    /** Register one cloud folder: returns true once it is stored. */
    onAddRemote: (profileId: string, remotePath: string) => Promise<boolean>;
    onAddSubpath: (relative: string) => Promise<boolean>;
    onSetRoot: (path: string) => void;
    onRemove: (path: string, deleteRecord: boolean) => void;
    onOpenFolder: (path: string) => void;
}): import("react").JSX.Element;
