/**
 * The "flower branch" geometry for the sidebar tree.
 *
 * Reproduces the RewampUI *Flower Sidebar* mechanism: a single curly branch runs
 * down the left of the nav list, drawn as SVG so it can be *grown* — a faded
 * dashed ghost shows the whole route, and a solid stroke is drawn only as far as
 * the row you are on. Each row gets a dot sitting exactly on the curve, and the
 * active row's dot blooms.
 *
 * How it maps onto OUR tree (three levels: 分组 folder → 项目 folder → 会话 row):
 *
 *   - The branch is **one continuous path** through every visible row, not one
 *     rail per folder. That is what makes it read as a plant rather than as the
 *     per-folder rail it replaces.
 *   - The stem runs at `STEM_X`; at each **group boundary** it kinks outward to
 *     `BULGE_X` and back — a half-pitch out plus a half-pitch back, which is
 *     exactly the reference's 32px rhythm.
 *   - Rows that are not group boundaries sit on a straight run, one row pitch
 *     apart, each carrying a dot at its own y.
 *
 * Runtime-free on purpose (same discipline as `tabs.ts` / `store-core.ts`): the
 * component measures the DOM and hands plain numbers here, so the geometry is
 * unit-testable without a browser.
 */
/** Horizontal position of the stem's straight runs. */
/**
 * Default x for a row's anchor, in SVG coordinates.
 *
 * A fallback only: rows carry their OWN measured `x`, because the tree indents
 * with per-row padding rather than one shared origin. A folder's chevron and a
 * session's text sit at different x, and no single constant lands on both.
 */
export declare const STEM_X = 30;
/** Default vertical pitch between two rows. */
export declare const ROW_PITCH = 32;
/**
 * One row the branch must pass through.
 *
 * Both coordinates are MEASURED, not derived:
 * - `y` because the tree mixes row heights and inter-row gaps (deriving one
 *   pitch from a single gap drifted the dots up to 15px off their rows);
 * - `x` because the tree indents per row via padding, so a folder's chevron and
 *   a session's text are at different x.
 */
export interface BranchRow {
    /** Stable key, used to match a row to its dot. */
    readonly key: string;
    /** Row centre y, in the SVG's coordinate space. */
    readonly y: number;
    /**
     * Row anchor x, in the SVG's coordinate space.
     *
     * A folder row's anchor is its CHEVRON centre — the triangle the user already
     * reads as "this row opens" — so the stem visually hangs off the marker rather
     * than floating beside it. A session row's anchor is the indent its text sits
     * on.
     */
    readonly x: number;
    /**
     * Row kind. A `'group'` row starts a new group and makes the stem kink;
     * an `'item'` row runs straight (or curves back in right after a group).
     */
    readonly kind: 'group' | 'item';
    /** Whether this is the row the user is currently on (the bloomed dot). */
    readonly active: boolean;
}
/** A dot on the branch: one per row, positioned on the curve. */
export interface BranchDot {
    /** The row this dot belongs to. */
    readonly key: string;
    readonly cx: number;
    readonly cy: number;
    readonly active: boolean;
}
/**
 * The bloom that flowers at the branch's endpoint.
 *
 * The endpoint is where the GROWN stroke stops — the row the user is on — not
 * the last visible row: the stem is drawn to the active row, so that is where
 * the plant has visibly reached, whether the tree is folded above it or not.
 *
 * This is deliberately the ONE row an active marker names, so the flower can
 * never disagree with the stem about where the branch ends.
 */
export interface BranchFlower {
    /** Row whose endpoint carries the bloom (the active row's key). */
    readonly key: string;
    /** Endpoint x: the last dot's centre, i.e. exactly where the grown path stops. */
    readonly cx: number;
    /** Endpoint y, on the measured row centre. */
    readonly cy: number;
}
/** The branch: one path for the ghost, its total length, and the dots. */
export interface Branch {
    /** Full route, drawn as the faded dashed ghost. */
    readonly ghostPath: string;
    /** Path up to and including the active row (the "grown" part). */
    readonly grownPath: string;
    /** Drawn length of the full route. */
    readonly ghostLength: number;
    /** Drawn length of the grown part. */
    readonly grownLength: number;
    /** Dots, in row order. */
    readonly dots: readonly BranchDot[];
    /**
     * Bloom at the grown path's endpoint, or NULL when no row carries the active
     * marker.
     *
     * Deliberately stricter than `grownPath`: the stem has to be *some* path even
     * when nothing is active (it collapses to the bare origin, drawing nothing),
     * but a bloom with no active row has nothing to be the flower OF. Falling back
     * to the first dot — the earlier rule — put the blossom on a folder row at the
     * top of the tree as soon as the open session's folder was collapsed, because
     * folding removes the only row carrying the marker. No active row means no
     * flower.
     */
    readonly flower: BranchFlower | null;
    /** Total vertical extent, so the SVG box can be sized. */
    readonly height: number;
}
/**
 * How far short of the flower's centre the stem stops, in SVG user units.
 *
 * The bloom is drawn ON the endpoint, so a stem that runs all the way to the
 * centre is visible through the petal notches and reads as a line crossing the
 * flower. Stopping the stroke at (a little over) the bloom's radius keeps the
 * stem ending cleanly at the flower's edge, where it reads as a stalk holding
 * the bloom.
 *
 * 7 units ≈ the 6.2-unit flower radius plus a hair, so the stroke's round cap
 * tucks just under the outer petals without a visible gap.
 */
export declare const STEM_END_CLEARANCE = 7;
/**
 * Build the branch for a list of rows.
 *
 * @param rows - visible rows in render order, each carrying its MEASURED centre.
 * @returns the branch geometry; empty strings when there are no rows.
 */
export declare function buildBranch(rows: readonly BranchRow[]): Branch;
