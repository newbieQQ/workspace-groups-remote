/**
 * The flower marker: an SVG overlay that draws a single bloom on the row you are
 * currently on.
 *
 * Originally ported from the RewampUI *Flower Sidebar* reference, which drew a
 * continuous curly stem down the whole tree — a dashed "ghost" route plus a
 * solid stroke "grown" to the active row — with a dot on every row and the bloom
 * at its tip. **The stem and the dots are gone**: they read as a stray black line
 * down the sidebar, and depth is already carried by the row indentation. Only the
 * bloom remains, still spinning while the current session works and resting when
 * it is idle.
 *
 * The SVG is `pointer-events: none` and `overflow: visible`, so it is pure
 * decoration over the real rows and never intercepts a click.
 *
 * Measurement, not layout: the rows are rendered by the tree itself (they carry
 * drag handlers, menus and hover state), so this component reads each row's
 * vertical centre and anchor from the DOM and feeds plain numbers to
 * `buildBranch`. That keeps the geometry unit-tested (`branch.ts`) while the SVG
 * stays a dumb renderer of it — and leaves the branch math intact should the stem
 * ever come back.
 *
 * Re-measured on: row count changes (expand/collapse, new session), the active
 * row changing, and container resize. A `ResizeObserver` on the scroll body
 * covers the last one without a window listener.
 *
 * The bloom's spin is NOT re-measured here: it arrives as the `spinning` prop
 * and is applied as a class, so a status flip never re-runs the DOM measurement
 * above (the tree is the expensive part, not the class swap).
 */
import { useEffect, useRef, useState } from 'react'
import { buildBranch, type Branch, type BranchRow } from './branch.ts'

/**
 * Attribute the tree puts on every row the branch should connect. */
export const BRANCH_ROW_ATTRIBUTE = 'data-wg-branch-row'

/**
 * Attribute marking the row the stem should grow to.
 *
 * Only the DEEPEST row gets this (the session). Its ancestors — the project and
 * the category that contain it — deliberately do NOT, because a session belongs
 * to both and marking all three would make "which row is active?" ambiguous.
 * When several rows do carry it, the deepest (last in document order) wins.
 */
export const BRANCH_ACTIVE_ATTRIBUTE = 'data-wg-branch-active'

/** Row kind marker: a group boundary kinks the stem. */
export const BRANCH_GROUP_ATTRIBUTE = 'data-wg-branch-group'

/**
 * The bloom's petal outline, in the 1024-unit box the artwork was drawn in.
 *
 * This is the user's own flower glyph verbatim: an eight-petal bloom around a
 * ringed center. Kept as a path (not a component) because it is a constant.
 */
const FLOWER_PATH = 'M375.3728 841.8432c92.96-12.5184 203.8784-71.264 299.5456-166.9248 22.6112-22.6112 43.1616-46.08 61.5232-69.952C712.7616 786.3936 621.2608 921.6 512 921.6c-51.1488 0-98.4-29.632-136.6272-79.7568z m-87.808-422.8096C311.2384 237.6064 402.7328 102.4 512 102.4c51.1488 0 98.4 29.632 136.6272 79.7568-92.96 12.5184-203.8784 71.264-299.5456 166.9248a719.1232 719.1232 0 0 0-61.5232 69.952z m-129.536 139.5648c57.3248 74.2464 163.6608 140.9344 294.336 175.9488a719.1232 719.1232 0 0 0 91.3472 18.304c-168.9664 70.208-331.808 58.5728-386.432-36.0512-25.5744-44.288-23.5456-100.032 0.7552-158.2016z m322.2592-287.4496c168.9664-70.208 331.808-58.5728 386.432 36.0512 25.5744 44.288 23.5456 100.032-0.7552 158.2016-57.3184-74.2464-163.648-140.9344-294.336-175.9488a719.1232 719.1232 0 0 0-91.3408-18.304zM294.656 228.7552c-35.6352 86.7648-40.224 212.1984-5.2032 342.8736a719.1232 719.1232 0 0 0 29.8176 88.256C173.9904 548.6592 102.6432 401.824 157.2736 307.2c25.5744-44.288 74.8608-70.4 137.3824-78.4448z m410.0736 135.36c145.28 111.2256 216.6272 258.0608 161.9968 352.6848-25.5744 44.288-74.8608 70.4-137.3824 78.4448 35.6352-86.7648 40.224-212.1984 5.2032-342.8736a719.1232 719.1232 0 0 0-29.8176-88.256zM512 678.4c-88.3648 0-160-71.6352-160-160s71.6352-160 160-160 160 71.6352 160 160-71.6352 160-160 160z m0-83.2c42.4128 0 76.8-34.3872 76.8-76.8s-34.3872-76.8-76.8-76.8-76.8 34.3872-76.8 76.8 34.3872 76.8 76.8 76.8z'

/** Petal colour: the accent the glyph was drawn in. */
const FLOWER_PETAL = '#fa541c'

/**
 * Rendered size of the bloom, as a scale factor over the authored 1024 box.
 *
 * 17 / 1024 ≈ 0.0166 puts the flower at ~17px: clear of neighbouring rows (rows
 * are 28px tall) while still reading as a flower rather than a dot at the end of
 * the stem.
 */
const FLOWER_SCALE = 17 / 1024

/**
 * Centre of the artwork inside its own 1024-unit box, measured from the path.
 *
 * Both the recentring AND the rotation are expressed with this ONE pair of user
 * units, so neither depends on a percentage or on a reference box. Verified
 * against the live DOM: the path's own `getBBox()` centre is exactly (512, 512).
 */
const FLOWER_CENTRE = 512

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
export function SessionFlower({ spinning }: { spinning: boolean }) {
  return (
    <svg width={17} height={17} viewBox="0 0 1024 1024"
      className={spinning ? 'wgSessionFlower wgFlowerSpinning' : 'wgSessionFlower'}
      aria-hidden="true" focusable="false" style={{ flex: 'none', overflow: 'visible' }}>
      <path className="wgFlowerArt" d={FLOWER_PATH} fill={FLOWER_PETAL} />
    </svg>
  )
}

function Flower({ cx, cy, spinning }: { cx: number; cy: number; spinning: boolean }) {
  return (
    <g
      className={spinning ? 'wgFlower wgFlowerSpinning' : 'wgFlower'}
      transform={`translate(${cx} ${cy}) scale(${FLOWER_SCALE}) translate(${-FLOWER_CENTRE} ${-FLOWER_CENTRE})`}
    >
      <path className="wgFlowerArt" d={FLOWER_PATH} fill={FLOWER_PETAL} />
    </g>
  )
}

/**
 * Render the branch for the rows currently inside `scope`.
 * @param props - the element to measure, and whether the open session is working.
 * @returns the SVG overlay, or null until at least one row is measured.
 */
export function FlowerBranch({ scope, spinning }: { scope: HTMLElement | null; spinning: boolean }) {
  const [rows, setRows] = useState<BranchRow[]>([])

  // A cheap change key: the caller cannot tell us when a row expanded, so we
  // watch the attribute count and the active row instead of diffing every node.
  const measureKey = useRef('')
  // The measured pixel pitch is per-list, not the module default: our rows are
  // 28/30px tall in places, and assuming 32 would drift the dots off the rows.
  const [branch, setBranch] = useState<Branch | null>(null)

  useEffect(() => {
    if (scope === null) {
      setRows([])
      setBranch(null)
      return
    }

    const measure = (): void => {
      const nodes = Array.from(scope.querySelectorAll<HTMLElement>(`[${BRANCH_ROW_ATTRIBUTE}]`))
      const first = nodes[0]
      if (first === undefined) {
        if (measureKey.current !== '') {
          measureKey.current = ''
          setRows([])
          setBranch(null)
        }
        return
      }

      // Exactly one row carries the marker (the session); if a caller ever marks
      // several, the deepest wins so the stem still lands on a real leaf.
      const activeIndex = nodes.reduce(
        (found, node, index) => (node.hasAttribute(BRANCH_ACTIVE_ATTRIBUTE) ? index : found),
        -1,
      )
      const kinds = nodes.map(n => (n.hasAttribute(BRANCH_GROUP_ATTRIBUTE) ? 'group' : 'item')).join('')
      const key = `${nodes.length}|${activeIndex}|${kinds}|${Math.round(scope.clientWidth)}`
      if (key === measureKey.current) return
      measureKey.current = key

      // Each row carries its OWN measured anchor: y because the tree mixes row
      // heights, x because it indents per row via padding (a folder's chevron and
      // a session's text do not share an x).
      const measured: BranchRow[] = nodes.map((node, index) => ({
        key: `${index}`,
        y: center(node),
        x: anchorX(node),
        kind: node.hasAttribute(BRANCH_GROUP_ATTRIBUTE) ? 'group' : 'item',
        active: index === activeIndex,
      }))

      setRows(measured)
      setBranch(buildBranch(measured))
    }

    /** Vertical centre of a node, relative to the scope box. */
    function center(node: HTMLElement): number {
      const r = node.getBoundingClientRect()
      const s = (scope as HTMLElement).getBoundingClientRect()
      return r.top - s.top + r.height / 2
    }

    /**
     * Horizontal anchor of a row, relative to the scope box.
     *
     * A row with a chevron anchors to that triangle's CENTRE: it is the marker
     * the user already reads as "this row opens", so the stem hangs off it
     * instead of floating beside it. A chevron-less row (a session) has no
     * marker, so it anchors to where its own content starts — the status dot's
     * centre, which is the first thing in the row.
     */
    function anchorX(node: HTMLElement): number {
      const s = (scope as HTMLElement).getBoundingClientRect()
      const marker = node.querySelector('.wgChevron')
        ?? node.querySelector('[class*="wgStatusSlot"]')
        ?? node.querySelector('[class*="wgCategoryIcon"]')
        ?? node.querySelector('[class*="wgRowIcon"]')
      const box = (marker ?? node).getBoundingClientRect()
      return box.left - s.left + box.width / 2
    }

    measure()

    // Row set changes (expand/collapse/new session) arrive as childList edits.
    const observer = new MutationObserver(measure)
    observer.observe(scope, { childList: true, subtree: true, attributes: true, attributeFilter: [BRANCH_ACTIVE_ATTRIBUTE] })

    // Width changes reflow row heights in the rail/wide layouts.
    const resizer = new ResizeObserver(measure)
    resizer.observe(scope)

    return () => {
      observer.disconnect()
      resizer.disconnect()
    }
  }, [scope])

  if (branch === null || rows.length === 0) return null

  // Only the bloom is drawn. The stem (ghost + grown stroke) and the per-row
  // dots were removed on request: they read as a stray black line down the
  // sidebar and the depth is already carried by the indentation, so the flower
  // alone marks the row you are on. `branch` is still BUILT from the measured
  // rows — it is what gives the bloom its position — but its path geometry is
  // no longer rendered.
  if (branch.flower === null) return null

  return (
    <svg
      className="wgBranch"
      width={48}
      height={Math.max(1, Math.ceil(branch.height))}
      viewBox={`0 0 48 ${Math.max(1, Math.ceil(branch.height))}`}
      aria-hidden="true"
      focusable="false"
    >
      <Flower cx={branch.flower.cx} cy={branch.flower.cy} spinning={spinning} />
    </svg>
  )
}
