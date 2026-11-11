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
import type { ReactElement } from 'react';
/** One drawable primitive of a 16x16 icon; coordinates are in viewBox units. */
export type SciencePrimitive = {
    readonly kind: 'line';
    readonly x1: number;
    readonly y1: number;
    readonly x2: number;
    readonly y2: number;
} | {
    readonly kind: 'rect';
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly radius?: number;
} | {
    readonly kind: 'circle';
    readonly cx: number;
    readonly cy: number;
    readonly radius: number;
    readonly filled?: boolean;
} | {
    readonly kind: 'ellipse';
    readonly cx: number;
    readonly cy: number;
    readonly rx: number;
    readonly ry: number;
    /** Rotation around the icon centre (8,8), in degrees. */
    readonly rotate?: number;
} | {
    readonly kind: 'path';
    readonly d: string;
};
/** Ids appended to the shared registry; order is the picker's section order. */
export declare const SCIENCE_ICON_IDS: readonly ["test-tube", "flask", "pipette", "dropper", "stirrer", "hotplate", "centrifuge", "balance", "atom", "molecule", "lattice", "layered", "framework", "thin-film", "fiber", "hydrogel", "microscope", "xrd", "spectrum", "tensile", "electrode", "iv-curve", "illumination", "temperature", "humidity", "actuator", "flex-sensor", "battery"];
/** Union of the research icon ids (a subset of the shared `GroupIconId`). */
export type ScienceIconId = (typeof SCIENCE_ICON_IDS)[number];
/** The picker's section split of the research family. */
export declare const SCIENCE_ICON_SECTIONS: readonly [{
    readonly key: "lab";
    readonly ids: readonly ["test-tube", "flask", "pipette", "dropper", "stirrer", "hotplate", "centrifuge", "balance"];
}, {
    readonly key: "materials";
    readonly ids: readonly ["atom", "molecule", "lattice", "layered", "framework", "thin-film", "fiber", "hydrogel"];
}, {
    readonly key: "characterization";
    readonly ids: readonly ["microscope", "xrd", "spectrum", "tensile", "electrode", "iv-curve"];
}, {
    readonly key: "devices";
    readonly ids: readonly ["illumination", "temperature", "humidity", "actuator", "flex-sensor", "battery"];
}];
/** Primitive artwork per research icon. */
export declare const SCIENCE_ICON_ART: Record<ScienceIconId, readonly SciencePrimitive[]>;
/** Research icon id → picker section key. */
export declare const SCIENCE_ICON_SECTION_OF: Record<ScienceIconId, (typeof SCIENCE_ICON_SECTIONS)[number]['key']>;
/**
 * Render one research icon in the Host glyph's visual language: 16x16,
 * `currentColor` stroke, 1.3px, round joins, decorative for screen readers (the
 * row/picker button already carries the bilingual name).
 * @param props.icon - research icon id.
 * @param props.size - rendered square size in CSS pixels (default 16, like Host glyphs).
 */
export declare function ScienceGlyph({ icon, size }: {
    icon: ScienceIconId;
    size?: number;
}): ReactElement;
/** Research icon id → rendered node, merged into the row icon registry. */
export declare function scienceIconNodes(): Record<ScienceIconId, ReactElement>;
