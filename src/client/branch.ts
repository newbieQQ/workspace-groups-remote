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
export const STEM_X = 30

/** Default vertical pitch between two rows. */
export const ROW_PITCH = 32

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
  readonly key: string
  /** Row centre y, in the SVG's coordinate space. */
  readonly y: number
  /**
   * Row anchor x, in the SVG's coordinate space.
   *
   * A folder row's anchor is its CHEVRON centre — the triangle the user already
   * reads as "this row opens" — so the stem visually hangs off the marker rather
   * than floating beside it. A session row's anchor is the indent its text sits
   * on.
   */
  readonly x: number
  /**
   * Row kind. A `'group'` row starts a new group and makes the stem kink;
   * an `'item'` row runs straight (or curves back in right after a group).
   */
  readonly kind: 'group' | 'item'
  /** Whether this is the row the user is currently on (the bloomed dot). */
  readonly active: boolean
}

/** A dot on the branch: one per row, positioned on the curve. */
export interface BranchDot {
  /** The row this dot belongs to. */
  readonly key: string
  readonly cx: number
  readonly cy: number
  readonly active: boolean
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
  readonly key: string
  /** Endpoint x: the last dot's centre, i.e. exactly where the grown path stops. */
  readonly cx: number
  /** Endpoint y, on the measured row centre. */
  readonly cy: number
}

/** The branch: one path for the ghost, its total length, and the dots. */
export interface Branch {
  /** Full route, drawn as the faded dashed ghost. */
  readonly ghostPath: string
  /** Path up to and including the active row (the "grown" part). */
  readonly grownPath: string
  /** Drawn length of the full route. */
  readonly ghostLength: number
  /** Drawn length of the grown part. */
  readonly grownLength: number
  /** Dots, in row order. */
  readonly dots: readonly BranchDot[]
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
  readonly flower: BranchFlower | null
  /** Total vertical extent, so the SVG box can be sized. */
  readonly height: number
}

/**
 * Internal: one move of the route, kept as STRUCTURE rather than only as a path
 * string. The endpoint trim below has to shorten the final move along its own
 * direction, which is only sound if the segment still knows where it goes.
 */
interface Segment {
  /** SVG path command for the full move. */
  readonly d: string
  /** Length the move contributes to the run. */
  readonly length: number
  /** Where the move starts. */
  readonly from: { readonly x: number; readonly y: number }
  /** Where the move ends. */
  readonly to: { readonly x: number; readonly y: number }
  /** Bulge x for a curved move (the curve is vertical-tangent at both ends). */
  readonly controlX?: number
}

/**
 * Plan the route: one segment per row after the first, plus the dot positions.
 *
 * Kept separate from the string assembly so the length walk and the SVG `d`
 * always describe the same geometry — measuring one path against another is how
 * a grown/ghost pair drifts out of sync.
 *
 * The stem lands on each row's OWN anchor (x) and centre (y), so uneven row
 * heights and the tree's per-row indents both stay exact. A group row's anchor
 * is pushed out by `BULGE_OFFSET`, which is what creates the kink.
 *
 * @param rows - visible rows in render order, carrying measured anchors.
 * @returns the per-row segments and dot x positions.
 */
function plan(rows: readonly BranchRow[]): { segments: Segment[]; dotX: number[] } {
  const segments: Segment[] = []
  const first = rows[0] as BranchRow
  const dotX: number[] = [first.x]
  let x = first.x

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] as BranchRow
    const prev = rows[i - 1] as BranchRow
    const startY = prev.y
    const endY = row.y
    const midY = startY + (endY - startY) / 2

    // Every dot lands on its OWN anchor; the stem simply travels between them.
    // When two consecutive rows share an anchor (sessions under one project) the
    // travel is a straight run; when it changes (a folder's chevron sits left of
    // its children's dots) the stem swings out through an S-curve, which is what
    // reads as the branch stepping around the folder marker.
    const target = row.x

    if (target === x) {
      segments.push({
        d: `L ${x} ${endY}`,
        length: Math.abs(endY - startY),
        from: { x, y: startY },
        to: { x, y: endY },
      })
    } else {
      // Two halves so the tangent is vertical at both ends, matching the
      // reference's curve rhythm.
      segments.push({
        d: `C ${x} ${midY}, ${target} ${midY}, ${target} ${endY}`,
        length: Math.hypot(target - x, endY - midY),
        from: { x, y: startY },
        to: { x: target, y: endY },
        controlX: x,
      })
      x = target
    }
    dotX.push(x)
  }

  return { segments, dotX }
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
export const STEM_END_CLEARANCE = 7

/**
 * Shorten a move so it stops `clearance` short of its end point.
 *
 * Used only on the LAST move of the grown run, which is what hides the stroke
 * behind the bloom. A straight move is trimmed along its axis; a curved move is
 * trimmed by moving its end and its control point together, which shortens the
 * curve while keeping its vertical tangents (so the kink's shape is preserved
 * rather than being flattened into a line).
 *
 * Returns the move unchanged when it is too short to trim (the stem would
 * invert), so a cramped layout degrades to "line meets flower" rather than
 * producing a backwards path.
 *
 * @param segment - the move to shorten.
 * @param clearance - distance to stop short of the end.
 * @returns the shortened move.
 */
function trimEnd(segment: Segment, clearance: number): Segment {
  const { from, to } = segment
  const span = Math.hypot(to.x - from.x, to.y - from.y)
  if (span <= clearance) return segment

  if (segment.controlX === undefined) {
    // Straight: retreat along the axis by the clearance.
    const ratio = (span - clearance) / span
    const endX = from.x + (to.x - from.x) * ratio
    const endY = from.y + (to.y - from.y) * ratio
    return { ...segment, d: `L ${endX} ${endY}`, to: { x: endX, y: endY }, length: span - clearance }
  }

  // Curved: the move is two mirrored halves, so retreating the END by half the
  // clearance and the control point by the full one shortens it symmetrically
  // while keeping both tangents vertical.
  const endY = to.y - clearance
  const controlY = from.y + (to.y - from.y) / 2 - clearance
  const endX = to.x
  return {
    ...segment,
    d: `C ${segment.controlX} ${controlY}, ${endX} ${controlY}, ${endX} ${endY}`,
    to: { x: endX, y: endY },
    length: Math.max(0, segment.length - clearance),
  }
}

/**
 * Build the branch for a list of rows.
 *
 * @param rows - visible rows in render order, each carrying its MEASURED centre.
 * @returns the branch geometry; empty strings when there are no rows.
 */
export function buildBranch(rows: readonly BranchRow[]): Branch {
  const first = rows[0]
  if (first === undefined) {
    return { ghostPath: '', grownPath: '', ghostLength: 0, grownLength: 0, dots: [], flower: null, height: 0 }
  }

  const { segments, dotX } = plan(rows)
  const head = `M ${first.x} ${first.y}`

  const dots: BranchDot[] = rows.map((row, index) => ({
    key: row.key,
    cx: dotX[index] ?? row.x,
    cy: row.y,
    active: row.active,
  }))

  // The grown stroke stops AT the active row, so its path contains every
  // segment before that row and none after. An active first row grows nothing
  // beyond the origin, which is correct (the dot sits on the stem origin).
  //
  // `activeIndex < 0` is the NO-ACTIVE-ROW case: the open session's folder was
  // collapsed, or the catalog has not resolved yet. The stem then collapses to
  // the bare origin (drawing nothing), and — crucially — `hasActive` stays false
  // so no flower is produced. Conflating this with "the first row is active" is
  // what used to sprout the blossom on a top-level folder row.
  const activeIndex = rows.findIndex(row => row.active)
  const hasActive = activeIndex >= 0
  const grownTo = hasActive ? activeIndex : 0

  // The bloom sits on the endpoint of `grownPath`, which `join` puts at the
  // active row. It therefore uses the SAME index as the grown stroke, so the
  // flower and the stem can never disagree about where the branch ends — and it
  // exists ONLY when a row actually claimed the marker.
  const flowerAt = dots[grownTo] as BranchDot | undefined
  const flower: BranchFlower | null = hasActive && flowerAt !== undefined
    ? { key: flowerAt.key, cx: flowerAt.cx, cy: flowerAt.cy }
    : null

  const join = (list: readonly Segment[]): string =>
    list.length === 0 ? head : [head, ...list.map(s => s.d)].join(' ')

  // The grown run: every move before the active row, plus the move INTO it —
  // which is the one trimmed so the stroke stops at the bloom's edge instead of
  // crossing the flower. The GHOST keeps its full length: it is a faint dashed
  // route at 28% opacity, and shortening it too would leave the last row's
  // guide visibly detached from that row.
  const grownSegments = segments.slice(0, grownTo)
  const lastGrown = grownSegments[grownSegments.length - 1]
  const grownStroke = lastGrown === undefined
    ? grownSegments
    : [...grownSegments.slice(0, -1), trimEnd(lastGrown, STEM_END_CLEARANCE)]

  const lengthOf = (count: number): number =>
    segments.slice(0, count).reduce((sum, s) => sum + s.length, 0)

  const last = rows[rows.length - 1] as BranchRow
  // Half a row height of breathing room below the last dot, so the stem does not
  // stop dead on the final row.
  const tail = rows.length > 1 ? Math.abs(last.y - (rows[rows.length - 2] as BranchRow).y) / 2 : 0

  return {
    ghostPath: join(segments),
    grownPath: join(grownStroke),
    ghostLength: lengthOf(segments.length),
    // The grown length follows the TRIMMED run, so a consumer measuring the
    // stroke (a dash animation, say) stays consistent with what is drawn.
    grownLength: Math.max(0, lengthOf(grownTo) - (lastGrown === undefined ? 0 : STEM_END_CLEARANCE)),
    dots,
    flower,
    height: last.y + tail,
  }
}
