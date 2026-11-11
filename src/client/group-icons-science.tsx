/**
 * Self-drawn monochrome artwork for the "Materials & Lab" icon family.
 *
 * The Host primitive package only ships product/generic glyphs, so the 28
 * research icons are drawn here in the exact same visual language as the Host
 * ones: a 16x16 viewBox, `currentColor` stroke, 1.3 stroke width (Host
 * `ICON_MEDIUM_STROKE`), round caps/joins and no fill. Keeping the artwork as
 * primitive data (instead of one opaque `<path>` per icon) lets the icon test
 * assert every coordinate stays inside the viewBox and that each id has
 * artwork — a hand-tuned path string could silently drift out of frame.
 */
import type { ReactElement } from 'react'

/** One drawable primitive of a 16x16 icon; coordinates are in viewBox units. */
export type SciencePrimitive =
  | { readonly kind: 'line'; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number }
  | {
    readonly kind: 'rect'
    readonly x: number
    readonly y: number
    readonly width: number
    readonly height: number
    readonly radius?: number
  }
  | { readonly kind: 'circle'; readonly cx: number; readonly cy: number; readonly radius: number; readonly filled?: boolean }
  | {
    readonly kind: 'ellipse'
    readonly cx: number
    readonly cy: number
    readonly rx: number
    readonly ry: number
    /** Rotation around the icon centre (8,8), in degrees. */
    readonly rotate?: number
  }
  | { readonly kind: 'path'; readonly d: string }

/** Ids appended to the shared registry; order is the picker's section order. */
export const SCIENCE_ICON_IDS = [
  // Lab operations
  'test-tube', 'flask', 'pipette', 'dropper', 'stirrer', 'hotplate', 'centrifuge', 'balance',
  // Material structures
  'atom', 'molecule', 'lattice', 'layered', 'framework', 'thin-film', 'fiber', 'hydrogel',
  // Characterization
  'microscope', 'xrd', 'spectrum', 'tensile', 'electrode', 'iv-curve',
  // Functional devices
  'illumination', 'temperature', 'humidity', 'actuator', 'flex-sensor', 'battery',
] as const

/** Union of the research icon ids (a subset of the shared `GroupIconId`). */
export type ScienceIconId = (typeof SCIENCE_ICON_IDS)[number]

/** The picker's section split of the research family. */
export const SCIENCE_ICON_SECTIONS = [
  { key: 'lab', ids: ['test-tube', 'flask', 'pipette', 'dropper', 'stirrer', 'hotplate', 'centrifuge', 'balance'] },
  { key: 'materials', ids: ['atom', 'molecule', 'lattice', 'layered', 'framework', 'thin-film', 'fiber', 'hydrogel'] },
  { key: 'characterization', ids: ['microscope', 'xrd', 'spectrum', 'tensile', 'electrode', 'iv-curve'] },
  { key: 'devices', ids: ['illumination', 'temperature', 'humidity', 'actuator', 'flex-sensor', 'battery'] },
] as const satisfies readonly { readonly key: string; readonly ids: readonly ScienceIconId[] }[]

/** Primitive artwork per research icon. */
export const SCIENCE_ICON_ART: Record<ScienceIconId, readonly SciencePrimitive[]> = {
  // ---- Lab operations ------------------------------------------------------
  'test-tube': [
    { kind: 'path', d: 'M5.2 2.8v7.6a2.8 2.8 0 0 0 5.6 0V2.8' },
    { kind: 'line', x1: 4.5, y1: 2.8, x2: 11.5, y2: 2.8 },
    { kind: 'line', x1: 5.2, y1: 8.4, x2: 10.8, y2: 8.4 },
  ],
  flask: [
    { kind: 'path', d: 'M6.2 2.4v3.4L3 11.6a1.6 1.6 0 0 0 1.4 2.4h7.2a1.6 1.6 0 0 0 1.4-2.4L9.8 5.8V2.4' },
    { kind: 'line', x1: 5.2, y1: 2.4, x2: 10.8, y2: 2.4 },
    { kind: 'line', x1: 5.2, y1: 9.8, x2: 10.8, y2: 9.8 },
  ],
  pipette: [
    { kind: 'line', x1: 8, y1: 1.5, x2: 8, y2: 2.4 },
    { kind: 'rect', x: 6.1, y: 2.5, width: 3.8, height: 6.4, radius: 1.1 },
    { kind: 'line', x1: 6.1, y1: 4.6, x2: 7.2, y2: 4.6 },
    { kind: 'line', x1: 6.1, y1: 6.1, x2: 7.2, y2: 6.1 },
    { kind: 'path', d: 'M7.3 8.9L8 13.2L8.7 8.9' },
  ],
  dropper: [
    { kind: 'rect', x: 5.1, y: 2.1, width: 5.8, height: 4.2, radius: 2.1 },
    { kind: 'line', x1: 6.6, y1: 6.3, x2: 6.6, y2: 10.3 },
    { kind: 'line', x1: 9.4, y1: 6.3, x2: 9.4, y2: 10.3 },
    { kind: 'path', d: 'M6.6 10.3L8 13.4L9.4 10.3' },
    { kind: 'circle', cx: 11.9, cy: 12.2, radius: 0.95, filled: true },
  ],
  stirrer: [
    { kind: 'circle', cx: 8, cy: 6.1, radius: 2.5 },
    { kind: 'path', d: 'M6.4 6.1c1-.9 2.2-.9 3.2 0' },
    { kind: 'rect', x: 2, y: 9.6, width: 12, height: 4.2, radius: 1.2 },
    { kind: 'circle', cx: 11.4, cy: 11.7, radius: 0.85, filled: true },
  ],
  hotplate: [
    { kind: 'path', d: 'M5.4 8.4c1.2-.9 1.2-2.1 0-3' },
    { kind: 'path', d: 'M8 8.4c1.2-.9 1.2-2.1 0-3' },
    { kind: 'path', d: 'M10.6 8.4c1.2-.9 1.2-2.1 0-3' },
    { kind: 'rect', x: 2, y: 9.6, width: 12, height: 4.2, radius: 1.2 },
    { kind: 'circle', cx: 11.4, cy: 11.7, radius: 0.85, filled: true },
  ],
  centrifuge: [
    { kind: 'circle', cx: 8, cy: 5.6, radius: 3.4 },
    { kind: 'line', x1: 8, y1: 5.6, x2: 8, y2: 2.3 },
    { kind: 'line', x1: 8, y1: 5.6, x2: 5.1, y2: 7.3 },
    { kind: 'line', x1: 8, y1: 5.6, x2: 10.9, y2: 7.3 },
    { kind: 'circle', cx: 8, cy: 5.6, radius: 0.9, filled: true },
    { kind: 'line', x1: 8, y1: 9, x2: 8, y2: 9.8 },
    { kind: 'rect', x: 2.6, y: 9.8, width: 10.8, height: 3.4, radius: 1 },
  ],
  balance: [
    { kind: 'path', d: 'M4.1 7.8h7.8' },
    { kind: 'path', d: 'M5 7.8a3 3 0 0 0 6 0' },
    { kind: 'line', x1: 8, y1: 9.3, x2: 8, y2: 10.4 },
    { kind: 'rect', x: 2.2, y: 10.4, width: 11.6, height: 3.2, radius: 1 },
    { kind: 'rect', x: 9.6, y: 11.2, width: 2.6, height: 1.5, radius: 0.3 },
  ],

  // ---- Material structures -------------------------------------------------
  atom: [
    { kind: 'ellipse', cx: 8, cy: 8, rx: 6.2, ry: 2.5 },
    { kind: 'ellipse', cx: 8, cy: 8, rx: 6.2, ry: 2.5, rotate: 60 },
    { kind: 'ellipse', cx: 8, cy: 8, rx: 6.2, ry: 2.5, rotate: -60 },
    { kind: 'circle', cx: 8, cy: 8, radius: 1.05, filled: true },
  ],
  molecule: [
    { kind: 'line', x1: 5, y1: 4.2, x2: 11, y2: 4.2 },
    { kind: 'line', x1: 4.5, y1: 5.4, x2: 6.9, y2: 9.7 },
    { kind: 'line', x1: 11.5, y1: 5.4, x2: 9.1, y2: 9.7 },
    { kind: 'circle', cx: 3.6, cy: 4.2, radius: 1.35 },
    { kind: 'circle', cx: 12.4, cy: 4.2, radius: 1.35 },
    { kind: 'circle', cx: 8, cy: 11.6, radius: 1.35 },
  ],
  lattice: [
    { kind: 'line', x1: 3.6, y1: 3.6, x2: 3.6, y2: 12.4 },
    { kind: 'line', x1: 8, y1: 3.6, x2: 8, y2: 12.4 },
    { kind: 'line', x1: 12.4, y1: 3.6, x2: 12.4, y2: 12.4 },
    { kind: 'line', x1: 3.6, y1: 3.6, x2: 12.4, y2: 3.6 },
    { kind: 'line', x1: 3.6, y1: 8, x2: 12.4, y2: 8 },
    { kind: 'line', x1: 3.6, y1: 12.4, x2: 12.4, y2: 12.4 },
    { kind: 'circle', cx: 3.6, cy: 3.6, radius: 0.85, filled: true },
    { kind: 'circle', cx: 8, cy: 3.6, radius: 0.85, filled: true },
    { kind: 'circle', cx: 12.4, cy: 3.6, radius: 0.85, filled: true },
    { kind: 'circle', cx: 3.6, cy: 8, radius: 0.85, filled: true },
    { kind: 'circle', cx: 8, cy: 8, radius: 0.85, filled: true },
    { kind: 'circle', cx: 12.4, cy: 8, radius: 0.85, filled: true },
    { kind: 'circle', cx: 3.6, cy: 12.4, radius: 0.85, filled: true },
    { kind: 'circle', cx: 8, cy: 12.4, radius: 0.85, filled: true },
    { kind: 'circle', cx: 12.4, cy: 12.4, radius: 0.85, filled: true },
  ],
  layered: [
    { kind: 'rect', x: 2.6, y: 3, width: 10.8, height: 2.3, radius: 0.6 },
    { kind: 'rect', x: 3.6, y: 6.85, width: 10.8, height: 2.3, radius: 0.6 },
    { kind: 'rect', x: 2.6, y: 10.7, width: 10.8, height: 2.3, radius: 0.6 },
  ],
  framework: [
    { kind: 'rect', x: 2.6, y: 2.8, width: 10.8, height: 10.4, radius: 0.8 },
    { kind: 'line', x1: 8, y1: 2.8, x2: 8, y2: 13.2 },
    { kind: 'line', x1: 2.6, y1: 8, x2: 13.4, y2: 8 },
    { kind: 'circle', cx: 5.3, cy: 5.3, radius: 0.8, filled: true },
    { kind: 'circle', cx: 10.7, cy: 5.3, radius: 0.8, filled: true },
    { kind: 'circle', cx: 5.3, cy: 10.7, radius: 0.8, filled: true },
    { kind: 'circle', cx: 10.7, cy: 10.7, radius: 0.8, filled: true },
  ],
  'thin-film': [
    { kind: 'path', d: 'M2.6 7.6q1.35-1.6 2.7 0t2.7 0t2.7 0t2.7 0' },
    { kind: 'line', x1: 2.6, y1: 9.4, x2: 13.4, y2: 9.4 },
    { kind: 'rect', x: 2.6, y: 10.6, width: 10.8, height: 2.6, radius: 0.6 },
  ],
  fiber: [
    { kind: 'path', d: 'M5 2.4c1 1.6-1 2.4 0 4s-1 2.4 0 4 0 1.6 0 3.2' },
    { kind: 'path', d: 'M8 2.4c1 1.6-1 2.4 0 4s-1 2.4 0 4 0 1.6 0 3.2' },
    { kind: 'path', d: 'M11 2.4c1 1.6-1 2.4 0 4s-1 2.4 0 4 0 1.6 0 3.2' },
    { kind: 'rect', x: 2.9, y: 7.2, width: 10.2, height: 1.8, radius: 0.9 },
  ],
  hydrogel: [
    { kind: 'rect', x: 2.4, y: 4.4, width: 11.2, height: 8.4, radius: 4.2 },
    { kind: 'path', d: 'M5.4 7.3L8 9.4L10.6 6.9L5.4 7.3' },
    { kind: 'circle', cx: 5.4, cy: 7.3, radius: 0.8, filled: true },
    { kind: 'circle', cx: 8, cy: 9.4, radius: 0.8, filled: true },
    { kind: 'circle', cx: 10.6, cy: 6.9, radius: 0.8, filled: true },
  ],

  // ---- Characterization ----------------------------------------------------
  microscope: [
    { kind: 'line', x1: 5.9, y1: 2.1, x2: 8.9, y2: 5.1 },
    { kind: 'circle', cx: 5.4, cy: 1.9, radius: 0.9 },
    { kind: 'circle', cx: 9.5, cy: 7.4, radius: 1.1 },
    { kind: 'path', d: 'M11 6.6c1.5 1.5 1.5 3.8 0 5.3' },
    { kind: 'line', x1: 4.2, y1: 10.4, x2: 11.6, y2: 10.4 },
    { kind: 'line', x1: 9.9, y1: 10.4, x2: 9.9, y2: 13.2 },
    { kind: 'line', x1: 3, y1: 13.2, x2: 12.6, y2: 13.2 },
  ],
  xrd: [
    { kind: 'path', d: 'M2.6 13.2V2.9h11' },
    {
      kind: 'path',
      d: 'M3.4 12.4h1.9l.6-4.6.6 4.6h1.9l.7-2.6.6 2.6h1.9l.9-6.1.7 6.1h1.3',
    },
  ],
  spectrum: [
    { kind: 'path', d: 'M6.6 4.4L9.8 10.6H3.4z' },
    { kind: 'line', x1: 1.2, y1: 8.4, x2: 4.4, y2: 8.4 },
    { kind: 'line', x1: 9.2, y1: 9.2, x2: 13.4, y2: 4.8 },
    { kind: 'line', x1: 9.6, y1: 10, x2: 13.7, y2: 6.4 },
    { kind: 'line', x1: 9.8, y1: 10.6, x2: 13.8, y2: 8.6 },
  ],
  tensile: [
    { kind: 'rect', x: 5.8, y: 7.2, width: 4.4, height: 1.6, radius: 0.4 },
    { kind: 'line', x1: 4.4, y1: 5.8, x2: 4.4, y2: 10.2 },
    { kind: 'line', x1: 11.6, y1: 5.8, x2: 11.6, y2: 10.2 },
    { kind: 'path', d: 'M2.4 8h1.7' },
    { kind: 'path', d: 'M3.3 7.2l.8.8-.8.8' },
    { kind: 'path', d: 'M13.6 8h-1.7' },
    { kind: 'path', d: 'M12.7 7.2l-.8.8.8.8' },
    { kind: 'line', x1: 8, y1: 4.9, x2: 8, y2: 3.2 },
    { kind: 'path', d: 'M7.2 4l.8-.8.8.8' },
    { kind: 'line', x1: 8, y1: 11.1, x2: 8, y2: 12.8 },
    { kind: 'path', d: 'M7.2 12l.8.8.8-.8' },
  ],
  electrode: [
    { kind: 'path', d: 'M3.2 8.6v4.4a1.2 1.2 0 0 0 1.2 1.2h7.2a1.2 1.2 0 0 0 1.2-1.2V8.6' },
    { kind: 'line', x1: 3.2, y1: 10.6, x2: 12.8, y2: 10.6 },
    { kind: 'line', x1: 6, y1: 2.4, x2: 6, y2: 10.6 },
    { kind: 'line', x1: 10, y1: 2.4, x2: 10, y2: 10.6 },
    { kind: 'line', x1: 5.2, y1: 2.4, x2: 6.8, y2: 2.4 },
    { kind: 'line', x1: 9.2, y1: 2.4, x2: 10.8, y2: 2.4 },
  ],
  'iv-curve': [
    { kind: 'path', d: 'M2.8 13.2V3.2h10.4' },
    { kind: 'path', d: 'M3.6 12.4c2.6 0 2.7-4.6 5-5.6s3.4-2.6 4.3-3.4' },
    { kind: 'circle', cx: 8.6, cy: 6.8, radius: 0.8, filled: true },
  ],

  // ---- Functional devices --------------------------------------------------
  illumination: [
    { kind: 'rect', x: 4.6, y: 1.8, width: 6.8, height: 2.6, radius: 0.7 },
    { kind: 'line', x1: 6.2, y1: 4.9, x2: 4.6, y2: 8.4 },
    { kind: 'line', x1: 8, y1: 4.9, x2: 8, y2: 9 },
    { kind: 'line', x1: 9.8, y1: 4.9, x2: 11.4, y2: 8.4 },
    { kind: 'line', x1: 2.6, y1: 12.6, x2: 13.4, y2: 12.6 },
  ],
  temperature: [
    { kind: 'rect', x: 6.9, y: 2.4, width: 2.2, height: 8.2, radius: 1.1 },
    { kind: 'circle', cx: 8, cy: 12.2, radius: 1.9 },
    { kind: 'line', x1: 8, y1: 6.4, x2: 8, y2: 11.4 },
    { kind: 'line', x1: 9.1, y1: 4.8, x2: 10, y2: 4.8 },
    { kind: 'line', x1: 9.1, y1: 7, x2: 10, y2: 7 },
    { kind: 'line', x1: 9.1, y1: 9.2, x2: 10, y2: 9.2 },
  ],
  humidity: [
    { kind: 'path', d: 'M8 2.1c0 0-4.2 5-4.2 7.9a4.2 4.2 0 0 0 8.4 0C12.2 7.1 8 2.1 8 2.1z' },
    { kind: 'path', d: 'M6 10.2c1.3-1 2.7-1 4 0' },
  ],
  actuator: [
    { kind: 'path', d: 'M2.6 12.6c6 .4 9.2-1.8 10.2-6.4' },
    { kind: 'path', d: 'M2.6 10.6c5.2.3 7.8-1.6 8.6-5.2' },
    { kind: 'line', x1: 2.6, y1: 9.6, x2: 2.6, y2: 14 },
  ],
  'flex-sensor': [
    { kind: 'path', d: 'M2.8 4.2v8.2h3.4V4.2h3.4v8.2h3.4V4.2' },
    { kind: 'circle', cx: 2.8, cy: 3.2, radius: 0.8, filled: true },
    { kind: 'circle', cx: 13, cy: 3.2, radius: 0.8, filled: true },
    { kind: 'circle', cx: 8, cy: 8.2, radius: 1.1 },
  ],
  battery: [
    { kind: 'rect', x: 1.8, y: 5.4, width: 11, height: 5.4, radius: 1 },
    { kind: 'rect', x: 12.8, y: 7.1, width: 1.6, height: 2, radius: 0.4 },
    { kind: 'path', d: 'M8.8 6.3L6.8 8.8h2.2l-1.4 2.5' },
  ],
}

/** Research icon id → picker section key. */
export const SCIENCE_ICON_SECTION_OF: Record<ScienceIconId, (typeof SCIENCE_ICON_SECTIONS)[number]['key']> = {
  'test-tube': 'lab', flask: 'lab', pipette: 'lab', dropper: 'lab',
  stirrer: 'lab', hotplate: 'lab', centrifuge: 'lab', balance: 'lab',
  atom: 'materials', molecule: 'materials', lattice: 'materials', layered: 'materials',
  framework: 'materials', 'thin-film': 'materials', fiber: 'materials', hydrogel: 'materials',
  microscope: 'characterization', xrd: 'characterization', spectrum: 'characterization',
  tensile: 'characterization', electrode: 'characterization', 'iv-curve': 'characterization',
  illumination: 'devices', temperature: 'devices', humidity: 'devices',
  actuator: 'devices', 'flex-sensor': 'devices', battery: 'devices',
}

function Primitive({ primitive }: { primitive: SciencePrimitive }): ReactElement {
  switch (primitive.kind) {
    case 'line':
      return <line x1={primitive.x1} y1={primitive.y1} x2={primitive.x2} y2={primitive.y2} />
    case 'rect':
      return (
        <rect
          x={primitive.x}
          y={primitive.y}
          width={primitive.width}
          height={primitive.height}
          rx={primitive.radius ?? 0}
        />
      )
    case 'circle':
      return (
        <circle
          cx={primitive.cx}
          cy={primitive.cy}
          r={primitive.radius}
          fill={primitive.filled === true ? 'currentColor' : 'none'}
        />
      )
    case 'ellipse':
      return (
        <ellipse
          cx={primitive.cx}
          cy={primitive.cy}
          rx={primitive.rx}
          ry={primitive.ry}
          {...(primitive.rotate === undefined ? {} : { transform: `rotate(${primitive.rotate} 8 8)` })}
        />
      )
    case 'path':
      return <path d={primitive.d} />
  }
}

/**
 * Render one research icon in the Host glyph's visual language: 16x16,
 * `currentColor` stroke, 1.3px, round joins, decorative for screen readers (the
 * row/picker button already carries the bilingual name).
 * @param props.icon - research icon id.
 * @param props.size - rendered square size in CSS pixels (default 16, like Host glyphs).
 */
export function ScienceGlyph({ icon, size = 16 }: { icon: ScienceIconId; size?: number }): ReactElement {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {SCIENCE_ICON_ART[icon].map((primitive, index) => (
        <Primitive key={index} primitive={primitive} />
      ))}
    </svg>
  )
}

/** Research icon id → rendered node, merged into the row icon registry. */
export function scienceIconNodes(): Record<ScienceIconId, ReactElement> {
  const nodes: Partial<Record<ScienceIconId, ReactElement>> = {}
  for (const id of SCIENCE_ICON_IDS) nodes[id] = <ScienceGlyph icon={id} />
  return nodes as Record<ScienceIconId, ReactElement>
}
