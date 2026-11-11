/**
 * Sidecar config reading for @dsh-xhl/workspace-groups. The classification rules
 * live in a user-editable YAML file (default `~/.dsh/workspace-groups.yaml`),
 * read and validated on the host, served to the browser half as JSON. The
 * core workspace.json and session storage are never touched.
 */
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { homedir } from 'node:os'
import { load as parseYaml } from 'js-yaml'
import { classify } from './core/matcher.ts'
import type { GroupsConfig, GroupCategory } from './core/types.ts'

/** Default sidecar location: `$DSH_HOME/workspace-groups.yaml` (DSH_HOME falls back to ~/.dsh). */
export function defaultConfigPath(): string {
  const home = process.env.DSH_HOME !== undefined && process.env.DSH_HOME !== ''
    ? process.env.DSH_HOME
    : resolve(homedir(), '.dsh')
  return resolve(home, 'workspace-groups.yaml')
}

/** Parse + validate a raw sidecar document into a GroupsConfig (throws on malformed input). */
export function parseGroupsConfig(raw: unknown): GroupsConfig {
  if (raw === undefined || raw === null) return { categories: [] }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('workspace-groups.yaml: top-level value must be a mapping')
  }
  const categoriesValue = (raw as { categories?: unknown }).categories
  const categories: GroupCategory[] = []
  if (categoriesValue === undefined) return { categories: [] }
  if (!Array.isArray(categoriesValue)) {
    throw new Error('workspace-groups.yaml: categories must be a list')
  }
  for (const entry of categoriesValue) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      throw new Error('workspace-groups.yaml: each category must be a mapping')
    }
    const name = (entry as { name?: unknown }).name
    if (typeof name !== 'string' || name.trim() === '') {
      throw new Error('workspace-groups.yaml: each category needs a non-empty name')
    }
    const rulesValue = (entry as { rules?: unknown }).rules
    if (rulesValue === undefined) {
      throw new Error(`workspace-groups.yaml: category "${name}" needs a rules list`)
    }
    if (!Array.isArray(rulesValue)) {
      throw new Error(`workspace-groups.yaml: category "${name}" rules must be a list`)
    }
    const rules: GroupCategory['rules'] = []
    for (const rule of rulesValue) {
      if (typeof rule !== 'object' || rule === null || Array.isArray(rule)) {
        throw new Error(`workspace-groups.yaml: category "${name}" rule must be a mapping`)
      }
      const r = rule as Record<string, unknown>
      const normalized: GroupCategory['rules'][number] = {}
      for (const key of ['pathPrefix', 'nameContains', 'basenameContains', 'pathExact'] as const) {
        const value = r[key]
        if (value !== undefined) {
          if (typeof value !== 'string' || value === '') {
            throw new Error(`workspace-groups.yaml: category "${name}" rule ${key} must be a non-empty string`)
          }
          normalized[key] = value
        }
      }
      if (Object.keys(normalized).length === 0) {
        throw new Error(`workspace-groups.yaml: category "${name}" has a rule with no matchers`)
      }
      rules.push(normalized)
    }
    if (rules.length === 0) {
      throw new Error(`workspace-groups.yaml: category "${name}" needs at least one rule`)
    }
    categories.push({ name: name.trim(), rules })
  }
  return { categories }
}

/**
 * Read + parse the sidecar config file. A missing file yields an empty config
 * (all workspaces fall into the uncategorized bucket); malformed YAML throws
 * so the operator sees the problem instead of silently ungrouping everything.
 */
export async function readGroupsConfig(path: string): Promise<GroupsConfig> {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { categories: [] }
    throw error
  }
  const raw = parseYaml(text)
  return parseGroupsConfig(raw)
}

export { classify }
export type { GroupsConfig, GroupCategory, GroupRule } from './core/types.ts'
