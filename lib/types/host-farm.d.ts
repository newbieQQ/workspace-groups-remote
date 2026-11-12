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
/** Root that holds every farm: `$DSH_HOME/workspace-groups/farms`. */
export declare function defaultFarmRoot(): string;
/** One directory-safe name for a farm, derived from a workspace title. */
export declare function farmDirectoryName(title: string): string;
/**
 * Build a farm for `folders` under `defaultFarmRoot()`.
 *
 * Refuses to reuse an existing farm directory: a silent merge into a directory
 * that already holds links would hide which entries this call owns.
 */
export declare function buildFarm(input: {
    name: string;
    folders: readonly unknown[];
}): Promise<FarmResult>;
/**
 * Remove a farm this module built. Only entries under `defaultFarmRoot()` are
 * accepted, and only links are unlinked: a real directory aborts the removal.
 */
export declare function removeFarm(farmPath: string): Promise<void>;
