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
import {
  normalizePath,
  UNCATEGORIZED_LABEL,
  type CategoryAppearance,
  type GroupCategory,
  type GroupRule,
  type GroupsConfig,
  type ManualGroups,
} from './types.ts'

/** One rule match against a workspace's path and title. */
function ruleMatches(rule: GroupRule, path: string, title: string): boolean {
  const normalized = normalizePath(path)
  if (rule.pathPrefix !== undefined && normalized.startsWith(normalizePath(rule.pathPrefix))) return true
  if (rule.pathExact !== undefined && normalized === normalizePath(rule.pathExact)) return true
  if (rule.nameContains !== undefined && title.toLowerCase().includes(rule.nameContains.toLowerCase())) return true
  if (rule.basenameContains !== undefined) {
    const base = path.replace(/[/\\]+$/, '').split(/[/\\]/).pop() ?? ''
    if (base.toLowerCase().includes(rule.basenameContains.toLowerCase())) return true
  }
  return false
}

/** Classify a workspace by rules only; hidden categories are inert. */
export function classify(categories: readonly GroupCategory[], path: string, title: string): GroupCategory | undefined {
  for (const category of categories) {
    if (category.rules.some(rule => ruleMatches(rule, path, title))) return category
  }
  return undefined
}

/** Display name of a rule category: the rename override when present. */
export function ruleDisplayName(manual: ManualGroups | undefined, originalName: string): string {
  return manual?.renamed?.[originalName] ?? originalName
}

/** Whether a rule category has been hidden by a UI delete. */
export function isHiddenRule(manual: ManualGroups | undefined, originalName: string): boolean {
  return manual?.hidden?.includes(originalName) ?? false
}

/** Presentation for a category display key, or undefined when unset. */
export function categoryAppearance(
  manual: ManualGroups | undefined,
  key: string,
): CategoryAppearance | undefined {
  return manual?.appearance?.[key]
}

/** Whether a category display key is pinned. */
export function isCategoryPinned(manual: ManualGroups | undefined, key: string): boolean {
  return categoryAppearance(manual, key)?.pinned === true
}

/**
 * Drop empty presentation fields: `undefined` values, `pinned: false`, `icon: ''`.
 * Returns undefined when nothing is left, so callers can delete the whole entry.
 */
export function pruneAppearance(value: CategoryAppearance): CategoryAppearance | undefined {
  const result: CategoryAppearance = {}
  if (value.color !== undefined) result.color = value.color
  if (value.icon !== undefined && value.icon.trim() !== '') result.icon = value.icon
  if (value.pinned === true) result.pinned = true
  return Object.keys(result).length === 0 ? undefined : result
}

/** Rule category display names, in YAML render order (hidden ones excluded). */
export function ruleDisplayNames(categories: readonly GroupCategory[], manual: ManualGroups | undefined): string[] {
  const names: string[] = []
  for (const category of categories) {
    if (isHiddenRule(manual, category.name)) continue
    names.push(ruleDisplayName(manual, category.name))
  }
  return names
}

/** Original YAML rule name whose display name equals `key` (undefined when none). */
export function originalRuleNameForDisplay(
  categories: readonly GroupCategory[],
  manual: ManualGroups | undefined,
  key: string,
): string | undefined {
  return categories.find(c => ruleDisplayName(manual, c.name) === key)?.name
}

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
  key: string
  /** Origin: a YAML rule category or a manual group. */
  source: 'rule' | 'manual'
}

/** Apply `manual.categoryOrder` to the default sequence (stable). */
function orderByCategoryOrder(
  entries: EffectiveCategory[],
  order: readonly string[] | undefined,
): EffectiveCategory[] {
  if (order === undefined || order.length === 0) return entries
  // Stable sort by position in categoryOrder; entries absent from the order
  // keep their relative default position after all ordered ones.
  const position = new Map(order.map((key, index) => [key, index]))
  return [...entries].sort((a, b) => {
    const pa = position.get(a.key)
    const pb = position.get(b.key)
    if (pa !== undefined && pb !== undefined) return pa - pb
    if (pa !== undefined) return -1
    if (pb !== undefined) return 1
    return 0
  })
}

/** Stable partition: pinned groups first, unpinned ones keep their order. */
function pinnedFirst(entries: EffectiveCategory[], manual: ManualGroups | undefined): EffectiveCategory[] {
  if (manual?.appearance === undefined) return entries
  const pinned = (entry: EffectiveCategory): number => Number(isCategoryPinned(manual, entry.key))
  return [...entries].sort((a, b) => pinned(b) - pinned(a))
}

export function effectiveCategories(
  config: GroupsConfig,
  manual: ManualGroups | undefined,
): EffectiveCategory[] {
  const entries: EffectiveCategory[] = []
  const seen = new Set<string>()
  for (const category of config.categories) {
    if (isHiddenRule(manual, category.name)) continue
    const key = ruleDisplayName(manual, category.name)
    if (seen.has(key)) continue
    seen.add(key)
    entries.push({ key, source: 'rule' })
  }
  for (const name of manual?.categories ?? []) {
    if (seen.has(name)) continue
    seen.add(name)
    entries.push({ key: name, source: 'manual' })
  }
  return pinnedFirst(orderByCategoryOrder(entries, manual?.categoryOrder), manual)
}

/** Display keys of all effective categories (top-level workspaces excluded). */
export function displayCategoryKeys(config: GroupsConfig, manual: ManualGroups | undefined): string[] {
  return effectiveCategories(config, manual).map(e => e.key)
}

/**
 * Resolve the category key a workspace renders under, or `undefined` when it
 * is top-level (ungrouped). Precedence: manual override (`null` = forced
 * top-level) → rule classification (hidden rules inert) → top-level.
 */
export function resolveCategory(
  config: GroupsConfig,
  manual: ManualGroups | undefined,
  workspaceId: string,
  path: string,
  title: string,
): string | undefined {
  const override = manual?.assignments[workspaceId]
  if (override !== undefined) return override ?? undefined // null forces top-level
  const matched = classify(config.categories, path, title)
  if (matched === undefined) return undefined
  if (isHiddenRule(manual, matched.name)) return undefined
  return ruleDisplayName(manual, matched.name)
}

/** Whether a category key is a manual-only group (manageable via list). */
export function isManualOnlyCategory(
  config: GroupsConfig,
  manual: ManualGroups | undefined,
  key: string,
): boolean {
  return (manual?.categories.includes(key) ?? false) && !ruleDisplayNames(config.categories, manual).includes(key)
}

/**
 * Names that may not be used for a new/renamed group: the legacy reserved
 * label plus every current display key.
 */
export function takenCategoryNames(config: GroupsConfig, manual: ManualGroups | undefined): Set<string> {
  const taken = new Set<string>(displayCategoryKeys(config, manual))
  taken.add(UNCATEGORIZED_LABEL)
  return taken
}

/**
 * Order a bucket of workspace ids: the stored per-category order first
 * (filtered to actual members), then any remaining members in `fallback`
 * (host) order. Deterministic; the renderer never re-sorts on its own.
 */
export function orderedWorkspaceIds(
  manual: ManualGroups | undefined,
  categoryKey: string,
  members: readonly string[],
): string[] {
  const stored = manual?.workspaceOrder?.[categoryKey]
  if (stored === undefined || stored.length === 0) return [...members]
  const memberSet = new Set(members)
  const ordered: string[] = []
  const seen = new Set<string>()
  for (const id of stored) {
    if (!memberSet.has(id) || seen.has(id)) continue
    seen.add(id)
    ordered.push(id)
  }
  for (const id of members) {
    if (seen.has(id)) continue
    ordered.push(id)
  }
  return ordered
}

/** Move `id` before `beforeId` (undefined = append) within an ordered list. */
export function moveBefore(list: readonly string[], id: string, beforeId: string | undefined): string[] {
  const rest = list.filter(x => x !== id)
  if (beforeId === undefined) return [...rest, id]
  const index = rest.indexOf(beforeId)
  if (index === -1) return [...rest, id]
  rest.splice(index, 0, id)
  return rest
}

/** Move `id` after `afterId` (undefined = append) within an ordered list. */
export function moveAfter(list: readonly string[], id: string, afterId: string | undefined): string[] {
  const rest = list.filter(x => x !== id)
  if (afterId === undefined) return [...rest, id]
  const index = rest.indexOf(afterId)
  if (index === -1) return [...rest, id]
  rest.splice(index + 1, 0, id)
  return rest
}
