/**
 * Client side of the farm route.
 *
 * A farm is one real directory holding a link per project folder, so a session
 * can read and write all of them at once. The host owns the filesystem work;
 * this module only speaks the two requests, and never assumes success: every
 * failure comes back as an Error with the host's own message.
 */
export declare const FARM_ROUTE = "/workspace-groups/farm";
export interface FarmLink {
    /** Entry name inside the farm directory. */
    readonly name: string;
    /** Absolute real path of the folder it points at. */
    readonly target: string;
}
export interface FarmResult {
    /** Absolute path of the farm directory. */
    readonly path: string;
    readonly links: readonly FarmLink[];
}
/** Build a farm for `folders`; the host refuses to reuse an existing one. */
export declare function buildFarm(name: string, folders: readonly string[], fetchImpl?: typeof fetch): Promise<FarmResult>;
/** Remove a farm; only its links are unlinked, never a real folder. */
export declare function removeFarm(farmPath: string, fetchImpl?: typeof fetch): Promise<void>;
