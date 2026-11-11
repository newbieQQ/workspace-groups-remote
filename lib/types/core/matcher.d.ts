/**
 * Pure classification + ordering logic: decides which category a workspace
 * belongs to and how categories/workspaces are ordered. Shared by the host
 * half (validation) and the client half (tree derivation), so the semantics
 * can never drift between the config surface and the rendered tree.
 *
 * Category identity: a category's STABLE origin is its YAML rule category
 * name (or a manual-group name). Its DISPLAY key is what the tree renders and
 * what assignments reference — for rule categories that is the rename
 * override when present. Hidden rule categories are inert: workspaces that
 * would match them become top-level (ungrouped).
 */
import { type CategoryAppearance, type GroupCategory, type GroupsConfig, type ManualGroups } from './types.ts';
/** Classify a workspace by rules only; hidden categories are inert. */
export declare function classify(categories: readonly GroupCategory[], path: string, title: string): GroupCategory | undefined;
/** Display name of a rule category: the rename override when present. */
export declare function ruleDisplayName(manual: ManualGroups | undefined, originalName: string): string;
/** Whether a rule category has been hidden by a UI delete. */
export declare function isHiddenRule(manual: ManualGroups | undefined, originalName: string): boolean;
/** Presentation for a category display key, or undefined when unset. */
export declare function categoryAppearance(manual: ManualGroups | undefined, key: string): CategoryAppearance | undefined;
/** Whether a category display key is pinned. */
export declare function isCategoryPinned(manual: ManualGroups | undefined, key: string): boolean;
/**
 * Drop empty presentation fields: `undefined` values, `pinned: false`, `icon: ''`.
 * Returns undefined when nothing is left, so callers can delete the whole entry.
 */
export declare function pruneAppearance(value: CategoryAppearance): CategoryAppearance | undefined;
/** Rule category display names, in YAML render order (hidden ones excluded). */
export declare function ruleDisplayNames(categories: readonly GroupCategory[], manual: ManualGroups | undefined): string[];
/** Original YAML rule name whose display name equals `key` (undefined when none). */
export declare function originalRuleNameForDisplay(categories: readonly GroupCategory[], manual: ManualGroups | undefined, key: string): string | undefined;
/**
 * Effective category entries in display order: rule categories (YAML order,
 * hidden skipped, renamed applied) first, then manual-only groups in
 * creation order — unless `manual.categoryOrder` overrides the sequence.
 * Top-level (ungrouped) workspaces are never included; they render as
 * separate top-level rows after the group folders.
 *
 * The pin partition is part of DISPLAY ORDER, not a render-time concern:
 * pinned groups sort before unpinned ones *within* the manual order, and both
 * the tree and the drag-drop landing neighbours read this list, so they can
 * never disagree about what sits next to what.
 */
export interface EffectiveCategory {
    /** Display key (what the tree renders and assignments reference). */
    key: string;
    /** Origin: a YAML rule category or a manual group. */
    source: 'rule' | 'manual';
}
export declare function effectiveCategories(config: GroupsConfig, manual: ManualGroups | undefined): EffectiveCategory[];
/** Display keys of all effective categories (top-level workspaces excluded). */
export declare function displayCategoryKeys(config: GroupsConfig, manual: ManualGroups | undefined): string[];
/**
 * Resolve the category key a workspace renders under, or `undefined` when it
 * is top-level (ungrouped). Precedence: manual override (`null` = forced
 * top-level) → rule classification (hidden rules inert) → top-level.
 */
export declare function resolveCategory(config: GroupsConfig, manual: ManualGroups | undefined, workspaceId: string, path: string, title: string): string | undefined;
/** Whether a category key is a manual-only group (manageable via list). */
export declare function isManualOnlyCategory(config: GroupsConfig, manual: ManualGroups | undefined, key: string): boolean;
/**
 * Names that may not be used for a new/renamed group: the legacy reserved
 * label plus every current display key.
 */
export declare function takenCategoryNames(config: GroupsConfig, manual: ManualGroups | undefined): Set<string>;
/**
 * Order a bucket of workspace ids: the stored per-category order first
 * (filtered to actual members), then any remaining members in `fallback`
 * (host) order. Deterministic; the renderer never re-sorts on its own.
 */
export declare function orderedWorkspaceIds(manual: ManualGroups | undefined, categoryKey: string, members: readonly string[]): string[];
/** Move `id` before `beforeId` (undefined = append) within an ordered list. */
export declare function moveBefore(list: readonly string[], id: string, beforeId: string | undefined): string[];
/** Move `id` after `afterId` (undefined = append) within an ordered list. */
export declare function moveAfter(list: readonly string[], id: string, afterId: string | undefined): string[];
