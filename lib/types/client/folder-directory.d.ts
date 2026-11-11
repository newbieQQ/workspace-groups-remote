export interface RemoteFolderWorkspace {
    mirrorPath: string;
    remotePath: string;
    profileId: string;
    /** Native DSH workspace registered for the mirror root ('' when unregistered). */
    workspaceId: string;
    /** remote-ssh's own record id ('' when it cannot be resolved). */
    recordId: string;
}
/** One SSH connection the remote plugin offers, as the picker needs it. */
export interface RemoteProfileSummary {
    id: string;
    name: string;
    host: string;
    user: string;
    /** Directory the connection opens on (`~` when the plugin leaves it empty). */
    remoteRoot: string;
}
/** One row of a remote directory listing. */
export interface RemoteDirEntry {
    name: string;
    type: 'directory' | 'file';
    size: number;
}
/** A remote directory and its children, as the cloud folder picker needs them. */
export interface RemoteDirListing {
    /** Path as requested (`~`, a relative name or an absolute path). */
    requested: string;
    /** Absolute path the remote shell resolved it to (`requested` when unknown). */
    resolved: string;
    entries: readonly RemoteDirEntry[];
}
/** Parent of a directory path, or null where going up stops (`~`, `/`, root). */
export declare function remoteDirParent(path: string): string | null;
/** Join a child directory name onto a remote directory path. */
export declare function remoteDirJoin(base: string, name: string): string;
/**
 * List one remote directory through the SSH plugin's own pooled session, so
 * password auth, ProxyJump and host-key handling stay where they already work.
 * @param profileId - SSH connection to browse.
 * @param path - directory to list; empty means the connection's remote root.
 * @param fetchImpl - fetch implementation (tests inject one).
 */
export declare function listRemoteDirectory(profileId: string, path: string, fetchImpl?: typeof fetch): Promise<RemoteDirListing>;
/** A newly registered remote (mirror-backed) folder workspace. */
export interface CreatedRemoteFolder {
    /** Absolute LOCAL mirror path — the member workspace's canonical directory. */
    path: string;
    /** Native DSH workspace id that now backs the folder row. */
    workspaceId: string;
    /** remote-ssh's own record id (used to delete the record again). */
    recordId: string;
    remotePath: string;
    profileId: string;
    title: string;
    /** True when an existing record for the same profile + remote path was taken over. */
    reused: boolean;
}
/**
 * The SSH connections available for a cloud folder, or null when the
 * `@zhangfengshun/dsh-remote-ssh` plugin does not answer at all.
 * @param fetchImpl - fetch implementation (tests inject one).
 */
export declare function listRemoteProfiles(fetchImpl?: typeof fetch): Promise<RemoteProfileSummary[] | null>;
/**
 * Register one cloud folder: the SSH plugin creates the local mirror, writes the
 * connection marker and registers a real DSH workspace for it — exactly what its
 * own "new remote workspace" flow does. The returned native workspace id backs
 * the folder row, and the workspace's own sidebar row is hidden once the entry
 * lists it (see `absorbedWorkspaceIds`).
 * @param profileId - SSH connection to use.
 * @param remotePath - remote directory (`~`, `~/proj`, `/srv/proj`).
 * @param title - optional display title; the plugin derives one from the path.
 * @param fetchImpl - fetch implementation (tests inject one).
 */
export declare function createRemoteFolder(profileId: string, remotePath: string, title?: string, fetchImpl?: typeof fetch): Promise<CreatedRemoteFolder>;
/**
 * Delete one remote workspace record through the SSH plugin: it removes the
 * record, unregisters the native workspace behind it (that workspace's
 * sessions go with it) and cleans up the mirror — the counterpart of
 * {@link createRemoteFolder}, for when a member folder is removed for good.
 * @param recordId - remote-ssh record id stored on the member.
 * @param fetchImpl - fetch implementation (tests inject one).
 */
export declare function deleteRemoteWorkspaceRecord(recordId: string, fetchImpl?: typeof fetch): Promise<void>;
/** Resolve against the SSH plugin's registered mirrors, not copied marker files. */
export declare function remoteFolderWorkspace(path: string, remoteBase: string | null, fetchImpl?: typeof fetch): Promise<RemoteFolderWorkspace | null>;
/** Single-segment names match DSH createDirectory(path, name). */
export declare function validateFolderName(raw: string): string;
export declare function createWorkspaceDirectory(parent: string, rawName: string, remoteBase: string | null, createLocal: (path: string, name: string) => Promise<string>, fetchImpl?: typeof fetch): Promise<{
    path: string;
    remote: boolean;
}>;
