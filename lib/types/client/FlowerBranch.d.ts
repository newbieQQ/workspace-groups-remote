/**
 * Attribute the tree puts on every row the branch should connect. */
export declare const BRANCH_ROW_ATTRIBUTE = "data-wg-branch-row";
/**
 * Attribute marking the row the stem should grow to.
 *
 * Only the DEEPEST row gets this (the session). Its ancestors — the project and
 * the category that contain it — deliberately do NOT, because a session belongs
 * to both and marking all three would make "which row is active?" ambiguous.
 * When several rows do carry it, the deepest (last in document order) wins.
 */
export declare const BRANCH_ACTIVE_ATTRIBUTE = "data-wg-branch-active";
/** Row kind marker: a group boundary kinks the stem. */
export declare const BRANCH_GROUP_ATTRIBUTE = "data-wg-branch-group";
/**
 * The bloom at the branch's endpoint.
 *
 * Anchoring is done entirely by these transforms, in this order:
 *
 *   1. `translate(cx cy)` — put the origin on the stem's tip (the endpoint of
 *      the grown stroke).
 *   2. `scale(FLOWER_SCALE)` — shrink the 1024-unit artwork about that origin.
 *   3. `translate(-512 -512)` — bring the glyph's own centre (512, 512) onto the
 *      origin, so the flower is centred on the tip.
 *
 * The spin is applied by `wgFlowerArt` in CSS as a `rotate()` composed AFTER
 * that recentring (`translate(-512 -512) rotate(...)`), so the bloom turns about
 * its own centre and the recentring never drifts as it rotates.
 *
 * Note what is deliberately NOT used here: a percentage `translate(-50%, -50%)`
 * or `transform-box: fill-box` + percentage `transform-origin`. Measured on the
 * live page, the percentage form resolved against the SVG VIEWPORT rather than
 * the path's box, translating by (-24, -409.5) instead of (-373, -409.6) and
 * parking the bloom well right of the stem. Explicit user units remove the
 * question: 512 is the measured centre, not an inferred one.
 *
 * The flower rests while the session is idle and turns while it works: one
 * animation, paused rather than removed, so a state flip resumes the turn
 * instead of snapping the petals back to 0deg.
 *
 * @param props - endpoint coordinates and whether the session is working.
 * @returns the bloom group.
 */
/** In-flow session marker: its position follows the row, including disclosure animations. */
export declare function SessionFlower({ spinning }: {
    spinning: boolean;
}): import("react").JSX.Element;
/**
 * Render the branch for the rows currently inside `scope`.
 * @param props - the element to measure, and whether the open session is working.
 * @returns the SVG overlay, or null until at least one row is measured.
 */
export declare function FlowerBranch({ scope, spinning }: {
    scope: HTMLElement | null;
    spinning: boolean;
}): import("react").JSX.Element | null;
