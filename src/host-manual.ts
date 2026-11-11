/**
 * Runtime grouping overlay for @dsh-xhl/workspace-groups: manual groups created in
 * the sidebar UI and per-workspace category overrides. Stored in a plugin-
 * owned JSON sidecar (`$DSH_HOME/workspace-groups.manual.json`), separate from
 * the operator YAML — the YAML stays the rule source, this file only records
 * runtime decisions, and writes are atomic (temp file + fsync + rename).
 *
 * The browser PUT route writes the whole overlay (idempotent, last write
 * wins); reads tolerate hand-edited content (parse-only) while the write
 * boundary cross-validates against the current rule categories.
 */
import { mkdir, open, readFile, rename, unlink } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { ruleDisplayName } from './core/matcher.ts'
import {
  GROUP_COLORS,
  TOP_LEVEL_ORDER_KEY,
  UNCATEGORIZED_LABEL,
  type CategoryAppearance,
  type GroupColor,
  type ManualGroups,
} from './core/types.ts'

/** Default overlay location: `$DSH_HOME/workspace-groups.manual.json`. */
export function defaultManualPath(): string {
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ''
    ? process.env.DSH_HOME
    : resolve(homedir(), '.dsh')
  return resolve(home, 'workspace-groups.manual.json')
}

/**
 * Parse + shape-validate a raw overlay document into a ManualGroups.
 * Validates types only — category references are checked against the rule set
 * at the write boundary (validateManualGroups), because reads must tolerate
 * files written while the rule set was different.
 * @param raw - parsed JSON value.
 * @returns the normalized overlay.
 * @throws when the shape is malformed (non-mapping, bad names, duplicates,
 * the reserved uncategorized label, bad assignment/order values).
 */
export function parseManualGroups(raw: unknown): ManualGroups {
  if (raw === undefined || raw === null) return { categories: [], assignments: {} }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('workspace-groups.manual.json: top-level value must be a mapping')
  }
  const source = raw as Record<string, unknown>

  const categories: string[] = []
  if (source.categories !== undefined) {
    if (!Array.isArray(source.categories)) {
      throw new Error('workspace-groups.manual.json: categories must be a list')
    }
    const seen = new Set<string>()
    for (const entry of source.categories) {
      if (typeof entry !== 'string' || entry.trim() === '') {
        throw new Error('workspace-groups.manual.json: each manual category must be a non-empty string')
      }
      const name = entry.trim()
      if (name === UNCATEGORIZED_LABEL) {
        throw new Error(`workspace-groups.manual.json: manual category name "${name}" is reserved`)
      }
      if (seen.has(name)) {
        throw new Error(`workspace-groups.manual.json: duplicate manual category "${name}"`)
      }
      seen.add(name)
      categories.push(name)
    }
  }

  const assignments: Record<string, string | null> = {}
  if (source.assignments !== undefined) {
    if (typeof source.assignments !== 'object' || source.assignments === null || Array.isArray(source.assignments)) {
      throw new Error('workspace-groups.manual.json: assignments must be a mapping')
    }
    for (const [workspaceId, category] of Object.entries(source.assignments)) {
      if (workspaceId === '__proto__') continue // assigning it would mutate the record's prototype
      if (workspaceId.trim() === '') {
        throw new Error('workspace-groups.manual.json: assignment keys must be non-empty')
      }
      if (category === null) {
        assignments[workspaceId] = null // force uncategorized
        continue
      }
      if (typeof category !== 'string' || category.trim() === '') {
        throw new Error(`workspace-groups.manual.json: assignment "${workspaceId}" must be a category name or null`)
      }
      assignments[workspaceId] = category.trim()
    }
  }

  const manual: ManualGroups = { categories, assignments }
  if (typeof source.revision === 'number' && Number.isSafeInteger(source.revision) && source.revision >= 0) {
    manual.revision = source.revision
  }

  if (source.categoryOrder !== undefined) {
    manual.categoryOrder = parseStringList(source.categoryOrder, 'categoryOrder', true)
  }
  if (source.hidden !== undefined) {
    manual.hidden = parseStringList(source.hidden, 'hidden', true)
  }
  if (source.renamed !== undefined) {
    if (typeof source.renamed !== 'object' || source.renamed === null || Array.isArray(source.renamed)) {
      throw new Error('workspace-groups.manual.json: renamed must be a mapping')
    }
    const renamed: Record<string, string> = {}
    for (const [original, display] of Object.entries(source.renamed)) {
      if (original === '__proto__') continue // assigning it would mutate the record's prototype
      if (original.trim() === '') throw new Error('workspace-groups.manual.json: renamed keys must be non-empty')
      if (typeof display !== 'string' || display.trim() === '') {
        throw new Error(`workspace-groups.manual.json: renamed "${original}" must be a non-empty string`)
      }
      renamed[original] = display.trim()
    }
    manual.renamed = renamed
  }
  if (source.appearance !== undefined) {
    if (typeof source.appearance !== 'object' || source.appearance === null || Array.isArray(source.appearance)) {
      throw new Error('workspace-groups.manual.json: appearance must be a mapping')
    }
    const appearance: Record<string, CategoryAppearance> = {}
    for (const [key, value] of Object.entries(source.appearance)) {
      if (key === '__proto__') continue // assigning it would mutate the record's prototype
      if (key.trim() === '') throw new Error('workspace-groups.manual.json: appearance keys must be non-empty')
      const parsed = parseAppearance(value, key)
      if (parsed !== undefined) appearance[key.trim()] = parsed
    }
    if (Object.keys(appearance).length > 0) manual.appearance = appearance
  }
  if (source.workspaceOrder !== undefined) {
    if (typeof source.workspaceOrder !== 'object' || source.workspaceOrder === null || Array.isArray(source.workspaceOrder)) {
      throw new Error('workspace-groups.manual.json: workspaceOrder must be a mapping')
    }
    const workspaceOrder: Record<string, string[]> = {}
    for (const [categoryKey, ids] of Object.entries(source.workspaceOrder)) {
      if (categoryKey === '__proto__') continue // assigning it would mutate the record's prototype
      if (categoryKey.trim() === '') {
        throw new Error('workspace-groups.manual.json: workspaceOrder keys must be non-empty')
      }
      workspaceOrder[categoryKey] = parseStringList(ids, `workspaceOrder["${categoryKey}"]`, true)
    }
    manual.workspaceOrder = workspaceOrder
  }

  return manual
}

/** Preset icon ids are lowercase kebab-case; anything else must be a short glyph. */
const ICON_PATTERN = /^(?:[a-z][a-z0-9-]{0,23}|[^\s\u0000-\u001f\u007f]{1,4})$/u

/** Narrow an unknown value to a palette id from the shared whitelist. */
function isGroupColor(value: unknown): value is GroupColor {
  return GROUP_COLORS.some(color => color === value)
}

/**
 * Parse one appearance entry. Unknown sub-keys are dropped; an entry that ends
 * up empty is dropped entirely (returns undefined) so the file stays minimal.
 */
function parseAppearance(value: unknown, key: string): CategoryAppearance | undefined {
  const field = `appearance["${key}"]`
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`workspace-groups.manual.json: ${field} must be an object`)
  }
  const source = value as Record<string, unknown>
  const appearance: CategoryAppearance = {}
  if (source.color !== undefined) {
    if (!isGroupColor(source.color)) {
      throw new Error(
        `workspace-groups.manual.json: ${field}.color must be one of: ${GROUP_COLORS.join(', ')}`,
      )
    }
    appearance.color = source.color
  }
  if (source.icon !== undefined) {
    const icon = typeof source.icon === 'string' ? source.icon.trim() : ''
    if (icon === '' || !ICON_PATTERN.test(icon)) {
      throw new Error(`workspace-groups.manual.json: ${field}.icon must be an icon id or a 1–4 character glyph`)
    }
    appearance.icon = icon
  }
  if (source.pinned !== undefined) {
    if (typeof source.pinned !== 'boolean') {
      throw new Error(`workspace-groups.manual.json: ${field}.pinned must be a boolean`)
    }
    // Never persist `pinned: false` — an absent flag already means unpinned.
    if (source.pinned) appearance.pinned = true
  }
  return Object.keys(appearance).length === 0 ? undefined : appearance
}

/** Parse a list of non-empty strings, optionally de-duplicated. */
function parseStringList(value: unknown, field: string, unique: boolean): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`workspace-groups.manual.json: ${field} must be a list`)
  }
  const seen = new Set<string>()
  const result: string[] = []
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim() === '') {
      throw new Error(`workspace-groups.manual.json: ${field} entries must be non-empty strings`)
    }
    const trimmed = entry.trim()
    if (unique && seen.has(trimmed)) {
      throw new Error(`workspace-groups.manual.json: ${field} has duplicate entry "${trimmed}"`)
    }
    seen.add(trimmed)
    result.push(trimmed)
  }
  return result
}

/**
 * Cross-validate a parsed overlay against the current rule categories
 * (write boundary only). Every assignment value must be `null`, a rule
 * display name, a manual category name, or the uncategorized label; order
 * keys must reference existing categories; renames/hides must reference
 * actual rule categories.
 * @param manual - parsed overlay.
 * @param ruleCategoryNames - current YAML rule category original names.
 * @throws when the overlay references categories that do not exist.
 */
export function validateManualGroups(manual: ManualGroups, ruleCategoryNames: readonly string[]): void {
  const ruleNames = new Set(ruleCategoryNames)
  const allowed = new Set<string>(ruleCategoryNames.map(name => ruleDisplayName(manual, name)))
  for (const name of manual.categories) allowed.add(name)
  allowed.add(UNCATEGORIZED_LABEL)

  for (const [workspaceId, category] of Object.entries(manual.assignments)) {
    if (category === null) continue
    if (!allowed.has(category)) {
      throw new Error(`workspace-groups.manual.json: assignment "${workspaceId}" references unknown category "${category}"`)
    }
  }
  for (const key of manual.categoryOrder ?? []) {
    if (!allowed.has(key) || key === UNCATEGORIZED_LABEL) {
      throw new Error(`workspace-groups.manual.json: categoryOrder references unknown category "${key}"`)
    }
  }
  for (const key of Object.keys(manual.workspaceOrder ?? {})) {
    // The top-level order key is a reserved, non-category list.
    if (key === TOP_LEVEL_ORDER_KEY) continue
    if (!allowed.has(key) || key === UNCATEGORIZED_LABEL) {
      throw new Error(`workspace-groups.manual.json: workspaceOrder references unknown category "${key}"`)
    }
  }
  for (const original of Object.keys(manual.renamed ?? {})) {
    if (!ruleNames.has(original)) {
      throw new Error(`workspace-groups.manual.json: renamed references unknown rule category "${original}"`)
    }
  }
  for (const original of manual.hidden ?? []) {
    if (!ruleNames.has(original)) {
      throw new Error(`workspace-groups.manual.json: hidden references unknown rule category "${original}"`)
    }
  }
  // `appearance` is deliberately NOT cross-validated against existing
  // categories: a presentation entry for a temporarily removed YAML category
  // must survive, otherwise removing one category from the YAML would make
  // every subsequent overlay save fail with 400 and freeze the whole tree.
}

/** Read + parse the overlay file. A missing file yields an empty overlay. */
export async function readManualGroups(path: string): Promise<ManualGroups> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { categories: [], assignments: {} }
    throw error
  }
  return parseManualGroups(JSON.parse(text))
}

/**
 * Atomically replace the overlay file: write a same-directory temp file,
 * fsync it, then rename over the target. A crash never leaves a torn JSON at
 * the real path (readers see either the old or the new file).
 * @param path - target file path.
 * @param manual - overlay to persist.
 */
export async function writeManualGroups(path: string, manual: ManualGroups): Promise<void> {
  const json = `${JSON.stringify(manual, null, 2)}\n`
  await mkdir(dirname(path), { recursive: true })
  const tmp = `${path}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  const handle = await open(tmp, 'w')
  try {
    await handle.writeFile(json, 'utf8')
    await handle.sync()
  } catch (error) {
    await handle.close().catch(() => {})
    await unlink(tmp).catch(() => {})
    throw error
  }
  await handle.close()
  try {
    await rename(tmp, path)
  } catch (error) {
    await unlink(tmp).catch(() => {})
    throw error
  }
}
