/**
 * Client side of the per-workspace folder list, talking to
 * `GET|PUT /workspace-groups/folders` on the host.
 *
 * The document is the host's JSON sidecar verbatim (`version` + `workspaces`),
 * so the client and the host agree on one shape: `folders` holds EXTRA folders
 * only — the workspace's canonical directory is implicit folder #0 — and
 * `root` names one of those extras (absent means "the workspace itself").
 *
 * Reads are best-effort, like the manual overlay and the tab strip: a failed
 * read means "no extra folders". A failed write, however, rejects so the caller
 * can say so — a folder row that silently forgot its edit would be worse than
 * the toast.
 */
import { type FoldersDocument } from '../core/folders.ts';
/** Host route holding the folder overlay. */
export declare const FOLDERS_ROUTE = "/workspace-groups/folders";
/** One successful read: the overlay plus the mirror base the host reported. */
export interface FoldersSnapshot {
    readonly document: FoldersDocument;
    /**
     * Local mirror root of the remote-ssh plugin, when the host named one.
     * Workspaces whose directory lives below it are remote mirrors, so their extra
     * folders must be subdirectories of that same mirror.
     */
    readonly remoteBase?: string;
}
/**
 * Fetch the stored folder overlay.
 * @param fetchImpl - fetch implementation (injectable for tests).
 * @returns the overlay plus the reported mirror base; the empty document on any
 * failure.
 */
export declare function loadFolders(fetchImpl?: typeof fetch): Promise<FoldersSnapshot>;
/**
 * Read a whole folder document off the wire (GET response, PUT echo or the
 * 409 conflict body), or null when it is not a version-1 document.
 * @param source - parsed JSON body.
 */
export declare function parseWireDocument(source: Record<string, unknown>): FoldersDocument | null;
/**
 * A save rejected because another window wrote first (HTTP 409). Carries the
 * host's current document so the caller can adopt it and resync its state
 * instead of leaving the user looking at a phantom edit.
 */
export declare class FoldersConflictError extends Error {
    readonly current: FoldersDocument;
    constructor(current: FoldersDocument);
}
/**
 * Store the whole folder overlay.
 *
 * Unlike the tab strip this does NOT swallow failures: folder edits are explicit
 * row/dialog actions, so the caller turns a rejection into a toast instead of
 * leaving the user with a row that silently forgot its folder.
 * @param document - the client's current document.
 * @param fetchImpl - fetch implementation (injectable for tests).
 */
export declare function saveFolders(document: FoldersDocument, fetchImpl?: typeof fetch): Promise<FoldersDocument>;
