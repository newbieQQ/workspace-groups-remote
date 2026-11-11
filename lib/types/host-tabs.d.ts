/** One persisted tab. */
export interface PersistedTab {
    /** Session id the tab points at. */
    readonly sessionId: string;
    /** Arrival key (React list identity). */
    readonly order: number;
    /** Pinned tabs are restored at the front of the strip. */
    readonly pinned?: boolean;
    /** A label the user typed for the tab itself (absent = follow the session). */
    readonly title?: string;
}
/** The persisted document. */
export interface TabsDocument {
    /**
     * Shape version.
     *
     * 1 = `{sessionId, order}` only (what the shipped build writes); 2 adds the
     * optional `pinned` / `title` per tab. A version-1 file is READ as version 2
     * with every tab unpinned and untitled — that is exactly what it meant — and
     * the next write upgrades it. The two shapes are field-compatible, so no
     * conversion step exists: an older build reading a version-2 file would drop
     * the extra flags and keep working, which is why this stayed a tolerance
     * instead of a hard rejection.
     */
    readonly version: 2;
    /** Arrival counter, kept ahead of every tab's own order. */
    readonly order: number;
    readonly tabs: readonly PersistedTab[];
}
/** Default location: `$DSH_HOME/workspace-groups.tabs.json`. */
export declare function defaultTabsPath(): string;
/**
 * Normalize one tab row (used by both the file reader and the PUT body check, so
 * the two can never drift).
 *
 * @param entry - one element of a stored/`posted` `tabs` array.
 * @returns the tab, or null when the row is unusable.
 */
export declare function parsePersistedTab(entry: unknown): PersistedTab | null;
/**
 * Parse + shape-validate a tabs document.
 *
 * Tolerant on purpose: this file is a display cache, so a malformed one must
 * read as "no tabs" rather than break the strip. Individual bad rows are dropped
 * and the rest kept. Unknown fields (such as the `sessionKey` an older build
 * wrote) are ignored, so an existing file keeps working across the change.
 *
 * @param raw - parsed JSON value.
 * @returns the normalized document, or null when it is unusable.
 */
export declare function parseTabsDocument(raw: unknown): TabsDocument | null;
/**
 * Read the tabs document.
 *
 * A missing file is not an error (first run). A corrupt one is reported as null
 * so the caller starts empty, and the next write repairs the file.
 *
 * @param path - sidecar path.
 * @returns the document, or null when absent/unusable.
 */
export declare function readTabsDocument(path: string): Promise<TabsDocument | null>;
/**
 * Write the tabs document atomically.
 * @param path - sidecar path.
 * @param document - document to store.
 */
export declare function writeTabsDocument(path: string, document: TabsDocument): Promise<void>;
/**
 * Build the document to persist.
 * @param state - the client's current strip and its arrival counter.
 * @returns the document to write.
 */
export declare function documentForTabs(state: {
    order: number;
    tabs: readonly PersistedTab[];
}): TabsDocument;
