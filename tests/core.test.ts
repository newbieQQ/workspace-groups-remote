/**
 * Pure-logic tests: classification rules (the matcher v2: display names,
 * ordering, force-uncategorized) and config parsing.
 * These are the plugin's business rules — no DOM, no cordis runtime.
 */
import { describe, expect, it } from 'vitest'
import {
  displayCategoryKeys,
  effectiveCategories,
  isCategoryPinned,
  isManualOnlyCategory,
  moveAfter,
  moveBefore,
  orderedWorkspaceIds,
  originalRuleNameForDisplay,
  pruneAppearance,
  resolveCategory,
  ruleDisplayName,
  takenCategoryNames,
} from '../src/core/matcher.ts'
import { parseGroupsConfig } from '../src/host-config.ts'
import { UNCATEGORIZED_LABEL, type GroupsConfig, type ManualGroups } from '../src/core/types.ts'

const CONFIG: GroupsConfig = {
  categories: [
    {
      name: 'DSH 插件',
      rules: [
        { pathPrefix: '/Users/zcol/Project/SkillsManagePlugins' },
        { nameContains: '峰谷' },
      ],
    },
    {
      name: '文档',
      rules: [{ basenameContains: 'docs' }],
    },
  ],
}

describe('classify', () => {
  it('matches by path prefix', () => {
    expect(resolveCategory(CONFIG, undefined, 'ws', '/Users/zcol/Project/SkillsManagePlugins', 'SkillsManagePlugins')).toBe('DSH 插件')
  })

  it('matches by name substring', () => {
    expect(resolveCategory(CONFIG, undefined, 'ws', '/Users/zcol/Project/DeepSeek峰谷小组件', 'DeepSeek峰谷小组件')).toBe('DSH 插件')
  })

  it('matches by basename substring', () => {
    expect(resolveCategory(CONFIG, undefined, 'ws', '/Users/zcol/Project/SomeDocs', 'SomeDocs')).toBe('文档')
  })

  it('first match wins across categories', () => {
    const config: GroupsConfig = {
      categories: [
        { name: 'A', rules: [{ nameContains: 'common' }] },
        { name: 'B', rules: [{ nameContains: 'common' }] },
      ],
    }
    expect(resolveCategory(config, undefined, 'ws', '/p/x', 'common-project')).toBe('A')
  })

  it('returns undefined when nothing matches', () => {
    expect(resolveCategory(CONFIG, undefined, 'ws', '/tmp/random', 'Random')).toBeUndefined()
  })
})

describe('resolveCategory (v2 overlay semantics)', () => {
  it('a manual override wins over rules', () => {
    const manual: ManualGroups = { categories: ['临时'], assignments: { 'ws-manual': '临时' } }
    expect(resolveCategory(CONFIG, manual, 'ws-manual', '/Users/zcol/Project/SomeDocs', 'SomeDocs')).toBe('临时')
  })

  it('a null override forces the uncategorized bucket even when a rule matches', () => {
    const manual: ManualGroups = { categories: [], assignments: { 'ws-null': null } }
    expect(resolveCategory(CONFIG, manual, 'ws-null', '/Users/zcol/Project/SkillsManagePlugins', 'SkillsManagePlugins')).toBeUndefined()
  })

  it('falls back to rules without an override', () => {
    const manual: ManualGroups = { categories: ['临时'], assignments: { 'ws-other': '临时' } }
    expect(resolveCategory(CONFIG, manual, 'ws-x', '/Users/zcol/Project/SkillsManagePlugins', 'SkillsManagePlugins')).toBe('DSH 插件')
  })

  it('a renamed rule category resolves to its display name', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, renamed: { 'DSH 插件': '插件集' } }
    expect(ruleDisplayName(manual, 'DSH 插件')).toBe('插件集')
    expect(resolveCategory(CONFIG, manual, 'ws-x', '/Users/zcol/Project/SkillsManagePlugins', 'SkillsManagePlugins')).toBe('插件集')
    expect(originalRuleNameForDisplay(CONFIG.categories, manual, '插件集')).toBe('DSH 插件')
  })

  it('a hidden rule category is inert — matches fall to uncategorized', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, hidden: ['DSH 插件'] }
    expect(resolveCategory(CONFIG, manual, 'ws-x', '/Users/zcol/Project/SkillsManagePlugins', 'SkillsManagePlugins')).toBeUndefined()
  })
})

describe('displayCategoryKeys / effectiveCategories', () => {
  it('rule categories first, manual ones appended', () => {
    const manual: ManualGroups = { categories: ['临时', '归档'], assignments: {} }
    expect(displayCategoryKeys(CONFIG, manual)).toEqual(['DSH 插件', '文档', '临时', '归档'])
  })

  it('categoryOrder overrides the sequence; unknown entries keep default order', () => {
    const manual: ManualGroups = {
      categories: ['临时'],
      assignments: {},
      categoryOrder: ['临时', '文档', 'DSH 插件'],
    }
    expect(displayCategoryKeys(CONFIG, manual)).toEqual(['临时', '文档', 'DSH 插件'])
  })

  it('hidden rules drop out; renamed rules appear under the new name', () => {
    const manual: ManualGroups = {
      categories: [],
      assignments: {},
      hidden: ['文档'],
      renamed: { 'DSH 插件': '插件集' },
    }
    const keys = displayCategoryKeys(CONFIG, manual)
    expect(keys).toEqual(['插件集'])
    expect(effectiveCategories(CONFIG, manual)[0]).toEqual({ key: '插件集', source: 'rule' })
  })

  it('uncategorized is never part of the key list', () => {
    expect(displayCategoryKeys(CONFIG, undefined).includes(UNCATEGORIZED_LABEL)).toBe(false)
  })
})

describe('isManualOnlyCategory', () => {
  const manual: ManualGroups = { categories: ['临时'], assignments: {} }

  it('true for a manual-only category', () => {
    expect(isManualOnlyCategory(CONFIG, manual, '临时')).toBe(true)
  })

  it('false for a rule category', () => {
    expect(isManualOnlyCategory(CONFIG, manual, 'DSH 插件')).toBe(false)
  })

  it('false for an unknown name', () => {
    expect(isManualOnlyCategory(CONFIG, manual, '不存在')).toBe(false)
  })

  it('false when the overlay is absent', () => {
    expect(isManualOnlyCategory(CONFIG, undefined, '临时')).toBe(false)
  })
})

describe('category appearance (pin partition)', () => {
  it('pinned groups sort first, each partition keeping the default order', () => {
    const manual: ManualGroups = {
      categories: ['临时', '归档'],
      assignments: {},
      appearance: { '归档': { pinned: true } },
    }
    expect(isCategoryPinned(manual, '归档')).toBe(true)
    expect(isCategoryPinned(manual, '临时')).toBe(false)
    expect(displayCategoryKeys(CONFIG, manual)).toEqual(['归档', 'DSH 插件', '文档', '临时'])
    expect(effectiveCategories(CONFIG, manual).map(entry => entry.key)).toEqual(['归档', 'DSH 插件', '文档', '临时'])
  })

  it('pin partition applies after categoryOrder (composite display order)', () => {
    const manual: ManualGroups = {
      categories: ['临时'],
      assignments: {},
      categoryOrder: ['临时', '文档', 'DSH 插件'],
      appearance: { '文档': { pinned: true } },
    }
    expect(displayCategoryKeys(CONFIG, manual)).toEqual(['文档', '临时', 'DSH 插件'])
  })

  it('no appearance means the untouched default order', () => {
    expect(displayCategoryKeys(CONFIG, { categories: [], assignments: {} })).toEqual(['DSH 插件', '文档'])
  })

  it('pruneAppearance drops empty fields and returns undefined when nothing is left', () => {
    expect(pruneAppearance({})).toBeUndefined()
    expect(pruneAppearance({ color: undefined, icon: '  ', pinned: false })).toBeUndefined()
    expect(pruneAppearance({ color: 'blue', pinned: false })).toEqual({ color: 'blue' })
    expect(pruneAppearance({ icon: 'code', pinned: false })).toEqual({ icon: 'code' })
    expect(pruneAppearance({ color: 'blue', icon: 'code', pinned: true })).toEqual({
      color: 'blue',
      icon: 'code',
      pinned: true,
    })
  })
})

describe('takenCategoryNames', () => {
  it('covers rule display names, manual groups and the reserved label', () => {
    const manual: ManualGroups = {
      categories: ['临时'],
      assignments: {},
      renamed: { 'DSH 插件': '插件集' },
    }
    const taken = takenCategoryNames(CONFIG, manual)
    expect(taken.has('插件集')).toBe(true)
    expect(taken.has('文档')).toBe(true)
    expect(taken.has('临时')).toBe(true)
    expect(taken.has(UNCATEGORIZED_LABEL)).toBe(true)
    expect(taken.has('新分组')).toBe(false)
  })
})

describe('orderedWorkspaceIds / moveBefore / moveAfter', () => {
  it('stored order wins, missing members appended in fallback order', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, workspaceOrder: { 'DSH 插件': ['b', 'a'] } }
    expect(orderedWorkspaceIds(manual, 'DSH 插件', ['a', 'b', 'c'])).toEqual(['b', 'a', 'c'])
  })

  it('falls back to host order without a stored order', () => {
    expect(orderedWorkspaceIds(undefined, 'DSH 插件', ['a', 'b'])).toEqual(['a', 'b'])
  })

  it('moveBefore moves an id before a target (or appends)', () => {
    expect(moveBefore(['a', 'b', 'c'], 'c', 'a')).toEqual(['c', 'a', 'b'])
    expect(moveBefore(['a', 'b', 'c'], 'a', undefined)).toEqual(['b', 'c', 'a'])
    expect(moveBefore(['a', 'b', 'c'], 'c', 'zzz')).toEqual(['a', 'b', 'c'])
  })

  it('moveAfter moves an id after a target (or appends)', () => {
    expect(moveAfter(['a', 'b', 'c'], 'a', 'c')).toEqual(['b', 'c', 'a'])
    expect(moveAfter(['a', 'b', 'c'], 'c', undefined)).toEqual(['a', 'b', 'c'])
    expect(moveAfter(['a', 'b', 'c'], 'a', 'zzz')).toEqual(['b', 'c', 'a'])
  })
})

describe('parseGroupsConfig', () => {
  it('parses a valid document', () => {
    const parsed = parseGroupsConfig({
      categories: [
        { name: 'X', rules: [{ pathPrefix: '/a' }] },
      ],
    })
    expect(parsed.categories).toHaveLength(1)
    expect(parsed.categories[0]?.name).toBe('X')
  })

  it('empty document yields empty categories', () => {
    expect(parseGroupsConfig(undefined).categories).toEqual([])
    expect(parseGroupsConfig({}).categories).toEqual([])
  })

  it('rejects a category without a name', () => {
    expect(() => parseGroupsConfig({ categories: [{ rules: [] }] })).toThrow(/name/)
  })

  it('rejects a rule with no matchers', () => {
    expect(() => parseGroupsConfig({ categories: [{ name: 'X', rules: [{}] }] })).toThrow(/no matchers/)
  })

  it('rejects a non-list categories value', () => {
    expect(() => parseGroupsConfig({ categories: 'nope' })).toThrow(/list/)
  })

  it('trims category names', () => {
    const parsed = parseGroupsConfig({ categories: [{ name: '  X  ', rules: [{ pathPrefix: '/a' }] }] })
    expect(parsed.categories[0]?.name).toBe('X')
  })
})
