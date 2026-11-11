/**
 * Manual-overlay tests: shape validation, cross-validation against rule
 * categories, and the atomic file round-trip (temp dir, no host needed).
 */
import { describe, expect, it } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  parseManualGroups,
  readManualGroups,
  validateManualGroups,
  writeManualGroups,
} from '../src/host-manual.ts'
import { UNCATEGORIZED_LABEL, type ManualGroups } from '../src/core/types.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import { apply } from '../src/index.ts'
import type { GroupsContext, GroupsWebRoute } from '../src/context-types.ts'

const RULE_NAMES = ['DSH 插件', '个人项目']

describe('parseManualGroups', () => {
  it('parses a valid overlay', () => {
    const parsed = parseManualGroups({
      categories: ['临时'],
      assignments: { 'ws-1': '临时', 'ws-2': 'DSH 插件' },
    })
    expect(parsed).toEqual({
      categories: ['临时'],
      assignments: { 'ws-1': '临时', 'ws-2': 'DSH 插件' },
    })
  })

  it('empty / undefined input yields an empty overlay', () => {
    expect(parseManualGroups(undefined)).toEqual({ categories: [], assignments: {} })
    expect(parseManualGroups({})).toEqual({ categories: [], assignments: {} })
  })

  it('rejects a non-mapping top level', () => {
    expect(() => parseManualGroups([])).toThrow(/mapping/)
    expect(() => parseManualGroups('nope')).toThrow(/mapping/)
  })

  it('rejects non-string / empty category names and trims them', () => {
    expect(() => parseManualGroups({ categories: [42] })).toThrow(/non-empty string/)
    expect(() => parseManualGroups({ categories: [''] })).toThrow(/non-empty string/)
    expect(parseManualGroups({ categories: [' 临时 '] }).categories).toEqual(['临时'])
  })

  it('rejects the reserved uncategorized label as a manual category', () => {
    expect(() => parseManualGroups({ categories: [UNCATEGORIZED_LABEL] })).toThrow(/reserved/)
  })

  it('rejects duplicate category names', () => {
    expect(() => parseManualGroups({ categories: ['临时', '临时'] })).toThrow(/duplicate/)
  })

  it('rejects a non-mapping assignments value', () => {
    expect(() => parseManualGroups({ assignments: [] })).toThrow(/assignments/)
  })

  it('rejects empty assignment keys and non-string assignment values', () => {
    expect(() => parseManualGroups({ assignments: { '': '临时' } })).toThrow(/non-empty/)
    expect(() => parseManualGroups({ assignments: { 'ws-1': 42 } })).toThrow(/category name/)
  })

  it('accepts null assignment values (force uncategorized)', () => {
    const parsed = parseManualGroups({ assignments: { 'ws-1': null } })
    expect(parsed.assignments['ws-1']).toBeNull()
  })

  it('parses the v2 ordering/rename/hidden fields', () => {
    const parsed = parseManualGroups({
      categories: ['临时'],
      assignments: { 'ws-1': '临时' },
      categoryOrder: ['临时', 'DSH 插件'],
      workspaceOrder: { '临时': ['ws-1'] },
      renamed: { 'DSH 插件': '插件集' },
      hidden: ['文档'],
    })
    expect(parsed.categoryOrder).toEqual(['临时', 'DSH 插件'])
    expect(parsed.workspaceOrder).toEqual({ '临时': ['ws-1'] })
    expect(parsed.renamed).toEqual({ 'DSH 插件': '插件集' })
    expect(parsed.hidden).toEqual(['文档'])
  })

  it('rejects duplicate categoryOrder / hidden entries', () => {
    expect(() => parseManualGroups({ categoryOrder: ['A', 'A'] })).toThrow(/duplicate/)
    expect(() => parseManualGroups({ hidden: ['A', 'A'] })).toThrow(/duplicate/)
  })

  it('rejects non-string renamed values', () => {
    expect(() => parseManualGroups({ renamed: { 'DSH 插件': 42 } })).toThrow(/non-empty string/)
  })
})

describe('appearance (host parsing)', () => {
  it('parses a valid appearance block', () => {
    const parsed = parseManualGroups({
      categories: ['临时'],
      assignments: {},
      appearance: {
        '临时': { color: 'blue', icon: 'code', pinned: true },
        'DSH 插件': { color: 'red', icon: '🔥' },
      },
    })
    expect(parsed.appearance).toEqual({
      '临时': { color: 'blue', icon: 'code', pinned: true },
      'DSH 插件': { color: 'red', icon: '🔥' },
    })
  })

  it('an absent / empty appearance block stays absent', () => {
    expect(parseManualGroups({}).appearance).toBeUndefined()
    expect(parseManualGroups({ appearance: {} }).appearance).toBeUndefined()
    expect(parseManualGroups({ appearance: { '临时': {} } }).appearance).toBeUndefined()
  })

  it('rejects a non-mapping appearance value', () => {
    expect(() => parseManualGroups({ appearance: [] })).toThrow(/appearance must be a mapping/)
  })

  it('rejects an empty appearance key', () => {
    expect(() => parseManualGroups({ appearance: { '  ': {} } })).toThrow(/appearance keys must be non-empty/)
  })

  it('rejects a colour outside the palette', () => {
    expect(() => parseManualGroups({ appearance: { A: { color: 'chartreuse' } } })).toThrow(/\.color must be one of/)
  })

  it('rejects an illegal icon', () => {
    expect(() => parseManualGroups({ appearance: { A: { icon: 'has space' } } })).toThrow(/icon/)
    expect(() => parseManualGroups({ appearance: { A: { icon: 'a'.repeat(25) } } })).toThrow(/icon/)
    expect(() => parseManualGroups({ appearance: { A: { icon: '' } } })).toThrow(/icon/)
  })

  it('rejects a non-boolean pinned', () => {
    expect(() => parseManualGroups({ appearance: { A: { pinned: 'yes' } } })).toThrow(/pinned must be a boolean/)
  })

  it('drops empty entries and never persists pinned: false', () => {
    const parsed = parseManualGroups({
      appearance: { A: { pinned: false, color: 'teal' }, B: { color: undefined } },
    })
    expect(parsed.appearance).toEqual({ A: { color: 'teal' } })
  })
})

describe('appearance (write boundary tolerance)', () => {
  it('does not reject a dangling appearance key', () => {
    const manual: ManualGroups = {
      categories: [],
      assignments: {},
      appearance: { '幽灵分组': { color: 'blue', pinned: true } },
    }
    expect(() => validateManualGroups(manual, RULE_NAMES)).not.toThrow()
  })
})

describe('validateManualGroups v2 (write boundary)', () => {
  it('accepts null assignments and renamed-display targets', () => {
    const manual: ManualGroups = {
      categories: ['临时'],
      assignments: { 'ws-1': null, 'ws-2': '插件集' },
      renamed: { 'DSH 插件': '插件集' },
    }
    expect(() => validateManualGroups(manual, RULE_NAMES)).not.toThrow()
  })

  it('rejects renamed keys that are not rule categories', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, renamed: { '幽灵规则': 'X' } }
    expect(() => validateManualGroups(manual, RULE_NAMES)).toThrow(/renamed/)
  })

  it('rejects hidden entries that are not rule categories', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, hidden: ['幽灵规则'] }
    expect(() => validateManualGroups(manual, RULE_NAMES)).toThrow(/hidden/)
  })

  it('rejects categoryOrder / workspaceOrder keys that exist nowhere', () => {
    const manual1: ManualGroups = { categories: [], assignments: {}, categoryOrder: ['幽灵'] }
    expect(() => validateManualGroups(manual1, RULE_NAMES)).toThrow(/categoryOrder/)
    const manual2: ManualGroups = { categories: [], assignments: {}, workspaceOrder: { '幽灵': [] } }
    expect(() => validateManualGroups(manual2, RULE_NAMES)).toThrow(/workspaceOrder/)
  })

  it('accepts the reserved top-level order key in workspaceOrder', () => {
    const manual: ManualGroups = { categories: [], assignments: {}, workspaceOrder: { __topLevel__: ['ws-1', 'ws-2'] } }
    expect(() => validateManualGroups(manual, RULE_NAMES)).not.toThrow()
  })
})

describe('validateManualGroups (write boundary)', () => {
  it('accepts assignments into rule, manual, and uncategorized categories', () => {
    const manual: ManualGroups = {
      categories: ['临时'],
      assignments: { 'ws-1': '临时', 'ws-2': 'DSH 插件', 'ws-3': UNCATEGORIZED_LABEL },
    }
    expect(() => validateManualGroups(manual, RULE_NAMES)).not.toThrow()
  })

  it('rejects an assignment into a category that exists nowhere', () => {
    const manual: ManualGroups = { categories: [], assignments: { 'ws-1': '幽灵分组' } }
    expect(() => validateManualGroups(manual, RULE_NAMES)).toThrow(/unknown category/)
  })
})

describe('manual file round-trip', () => {
  it('a missing file yields an empty overlay', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wg-manual-'))
    try {
      expect(await readManualGroups(join(dir, 'missing.json'))).toEqual({ categories: [], assignments: {} })
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('write then read returns the same overlay (atomic publish)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'wg-manual-'))
    const path = join(dir, 'workspace-groups.manual.json')
    try {
      const overlay: ManualGroups = {
        categories: ['临时'],
        assignments: { 'ws-1': '临时', 'ws-2': 'DSH 插件' },
      }
      await writeManualGroups(path, overlay)
      expect(await readManualGroups(path)).toEqual(overlay)
      // The persisted file is valid JSON with a trailing newline.
      const text = await readFile(path, 'utf8')
      expect(JSON.parse(text)).toEqual(overlay)
      expect(text.endsWith('\n')).toBe(true)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})

describe('manual revision guard (route)', () => {
  it('bumps on write, rejects a stale writer with the current overlay', async () => {
    const home = await mkdtemp(join(tmpdir(), 'wg-manual-revision-'))
    const previousHome = process.env.DSH_HOME
    process.env.DSH_HOME = home
    try {
      const routes: GroupsWebRoute[] = []
      apply({
        effect: (callback: () => unknown) => callback(),
        webServer: { register: (route: GroupsWebRoute) => { routes.push(route); return () => {} } },
      } as unknown as GroupsContext)
      const route = routes.find(item => item.path === '/workspace-groups/manual')!
      const request = async (body: unknown) => {
        const req = Readable.from([JSON.stringify(body)]) as IncomingMessage
        req.method = 'PUT'
        let status = 0
        let text: string | undefined
        await route.handler(req, {
          writeHead: (code: number) => { status = code },
          end: (value?: string) => { text = value },
        } as unknown as ServerResponse)
        return { status, text }
      }
      const first = { categories: ['项目组'], assignments: {} }
      const accepted = await request(first)
      expect(accepted.status).toBe(200)
      expect(JSON.parse(accepted.text!)).toEqual({ ok: true, manual: { ...first, revision: 1 } })
      const stale = await request(first)
      expect(stale.status).toBe(409)
      expect(JSON.parse(stale.text!)).toEqual({ manual: { ...first, revision: 1 } })
      const second = { categories: ['项目组'], assignments: {}, revision: 1 }
      const accepted2 = await request(second)
      expect(accepted2.status).toBe(200)
      expect(JSON.parse(accepted2.text!).manual.revision).toBe(2)
    } finally {
      if (previousHome === undefined) delete process.env.DSH_HOME
      else process.env.DSH_HOME = previousHome
      await rm(home, { recursive: true, force: true })
    }
  })
  it('parseManualGroups carries a valid revision and drops a bad one', () => {
    expect(parseManualGroups({ categories: [], assignments: {}, revision: 4 }).revision).toBe(4)
    expect(parseManualGroups({ categories: [], assignments: {}, revision: -2 }).revision).toBeUndefined()
    expect(parseManualGroups({ categories: [], assignments: {} }).revision).toBeUndefined()
  })
})

describe('parseManualGroups __proto__ keys', () => {
  it('skips __proto__ keys instead of mutating record prototypes', () => {
    const parsed = parseManualGroups({
      categories: [],
      assignments: { ['__proto__']: 'x', ws1: null },
      renamed: { ['__proto__']: 'y', a: 'b' },
    })
    expect(Object.keys(parsed.assignments)).toEqual(['ws1'])
    expect(Object.keys(parsed.renamed ?? {})).toEqual(['a'])
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})
