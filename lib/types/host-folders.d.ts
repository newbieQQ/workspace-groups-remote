import { type FoldersDocument } from './core/folders.ts';
/** File name of the folder sidecar (also the stable error-text prefix). */
export declare const FOLDERS_FILE_NAME = "workspace-groups.folders.json";
/** Hard limits enforced at the write boundary. */
export declare const FOLDERS_PER_WORKSPACE_LIMIT = 32;
export declare const MEMBERS_PER_WORKSPACE_LIMIT = 16;
export declare const WORKSPACE_ID_LIMIT = 200;
export declare const FOLDER_PATH_LIMIT = 1024;
export declare const REMOTE_PATH_LIMIT = 1024;
/** Default overlay location: `$DSH_HOME/workspace-groups.folders.json`. */
export declare function defaultFoldersPath(): string;
/**
 * Local mirror root of `@zhangfengshun/dsh-remote-ssh`.
 *
 * That plugin registers every remote workspace as an ordinary DSH workspace
 * whose canonical directory is a LOCAL mirror (`<homedir>/.dsh/remote-workspaces/
 * <workspaceId>`) and keeps the real remote path in its own records. Telling the
 * browser this base lets it treat such workspaces differently: their extra
 * folders must be subdirectories of the mirror, because only those also exist on
 * the remote side.
 *
 * The path is hardcoded there (not read from `DSH_HOME`), so it is hardcoded
 * here too — a mismatch would silently disable the distinction.
 */
export declare function defaultRemoteMirrorBase(): string;
/**
 * True when `path` is absolute in the host platform's spelling: a drive
 * letter or UNC prefix on Windows, a leading slash elsewhere.
 * @param path - candidate path.
 */
export declare function isAbsoluteFolderPath(path: string): boolean;
/** Validate a local path for the read-only remote hint endpoint. */
export declare function validateRemoteHintPath(path: unknown): string;
/**
 * Presence-only safety hint, never a trusted SSH connection or registration.
 * lstat also treats dangling symlinks as hints without reading their targets.
 * Only ENOENT is ignored: permissions and all other inspection failures must
 * prevent callers from silently falling back to local operations.
 */
export declare function hasRemoteMarkerHint(path: string): Promise<boolean>;
/**
 * Tolerant reader: shape-normalizes whatever was on disk and drops unusable
 * workspaces, folders and roots instead of throwing. A missing, non-mapping or
 * unknown-version document yields the empty document.
 * @param raw - parsed JSON value.
 */
export declare function parseFoldersDocument(raw: unknown): FoldersDocument;
/**
 * The document's write counter: a non-negative safe integer, else 0. Tolerant
 * on purpose — reads must survive hand-edited sidecars; the strict writer
 * below rejects bad values instead of letting them through.
 * @param value - the raw `revision` field.
 */
export declare function readRevision(value: unknown): number;
/**
 * Strict writer-side validation. Every rule is enforced and the first problem
 * throws, so the PUT route rejects instead of persisting a half-valid file.
 * @param raw - parsed JSON value from the request body.
 * @returns the normalized document to save.
 * @throws when version, workspace ids, folder paths, duplicates or the root
 * membership are wrong.
 */
export declare function validateFoldersDocument(raw: unknown): FoldersDocument;
/**
 * Read + tolerate the overlay file. A missing or unreadable file yields the
 * empty document: folders are a convenience, and a broken sidecar must not take
 * the tree down with it.
 * @param path - overlay file path.
 */
export declare function readFoldersDocument(path: string): Promise<FoldersDocument>;
/**
 * Atomically replace the overlay file: write a same-directory temp file,
 * fsync it, then rename over the target. A crash never leaves a torn JSON at
 * the real path (readers see either the old or the new file).
 * @param path - target file path.
 * @param document - validated document to persist.
 */
export declare function writeFoldersDocument(path: string, document: FoldersDocument): Promise<void>;
/**
 * Join a remote path with a mirror-relative subpath.
 *
 * The remote path is POSIX (the server's), so this never uses `node:path`:
 * a Windows host would otherwise hand `/home/me/proj\data` to the remote shell.
 * @param remotePath - the workspace's remote root (`~`, `~/proj`, `/srv/proj`).
 * @param relativePath - subpath inside the mirror, either separator style.
 * @returns the remote counterpart, or null for an empty or escaping subpath.
 */
export declare function remoteSubpath(remotePath: string, relativePath: string): string | null;
