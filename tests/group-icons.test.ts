import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { GROUP_ICON_IDS } from '../src/core/types.ts'
import { GROUP_EMOJI_ICONS, GROUP_ICON_LABELS } from '../src/client/group-icon-labels.ts'
import { SCIENCE_ICON_ART, SCIENCE_ICON_IDS, SCIENCE_ICON_SECTIONS } from '../src/client/group-icons-science.tsx'
import { parseManualGroups } from '../src/host-manual.ts'

const legacy = ['folder', 'workspace', 'code', 'plugin', 'skill', 'data', 'database', 'api', 'plan', 'goal', 'light', 'globe', 'archive', 'branch', 'users', 'clock', 'shield', 'checklist', 'sparkle', 'tree']

const scienceIds: readonly string[] = SCIENCE_ICON_IDS

describe('group icon catalog', () => {
  it('preserves every legacy id and provides the 50 native presets ahead of the research family', () => {
    expect(GROUP_ICON_IDS.slice(0, legacy.length)).toEqual(legacy)
    expect(GROUP_ICON_IDS).toHaveLength(50 + scienceIds.length)
    expect(GROUP_ICON_IDS.slice(0, 50)).not.toContain('test-tube')
    expect(GROUP_ICON_IDS.slice(50)).toEqual([...scienceIds])
    expect(new Set(GROUP_ICON_IDS).size).toBe(GROUP_ICON_IDS.length)
    expect(Object.keys(GROUP_ICON_LABELS).sort()).toEqual([...GROUP_ICON_IDS].sort())
    for (const label of Object.values(GROUP_ICON_LABELS)) {
      expect(label).toMatch(/[\u4e00-\u9fff]+.*\/.*[A-Za-z]+/u)
    }
  })

  it('gives every research id a unique, fully-allocated, in-bounds artwork', () => {
    expect(new Set(scienceIds).size).toBe(scienceIds.length)
    const sectioned = SCIENCE_ICON_SECTIONS.flatMap(section => [...section.ids])
    expect([...sectioned].sort()).toEqual([...scienceIds].sort())
    expect(Object.keys(SCIENCE_ICON_ART).sort()).toEqual([...scienceIds].sort())
    for (const id of scienceIds) {
      const artwork = SCIENCE_ICON_ART[id as keyof typeof SCIENCE_ICON_ART]
      expect(artwork.length, id).toBeGreaterThan(0)
      for (const primitive of artwork) {
        for (const [key, value] of Object.entries(primitive)) {
          /* `rotate` is an angle, not a coordinate: skip it. */
          if (key === 'rotate' || typeof value !== 'number') continue
          /* Every primitive is authored in the 16x16 box the host icons use. */
          expect(Math.abs(value), `${id}: ${key}`).toBeLessThanOrEqual(16)
        }
      }
    }
  })

  it('maps every native preset to artwork actually exported by the installed host primitives', () => {
    const rows = readFileSync(new URL('../src/client/rows.tsx', import.meta.url), 'utf8')
    const declarations = readFileSync(new URL('../node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/types/icons/index.d.ts', import.meta.url), 'utf8')
    for (const id of GROUP_ICON_IDS.slice(0, 50)) {
      const match = rows.match(new RegExp(`\\b${id}: <(Icon\\w+) />`))
      expect(match, id).not.toBeNull()
      expect(declarations).toContain(`export declare const ${match![1]}:`)
    }
  })

  it('merges the self-drawn research artwork into the same preset map', () => {
    const rows = readFileSync(new URL('../src/client/rows.tsx', import.meta.url), 'utf8')
    expect(rows).toContain('scienceIconNodes()')
    /* The research ids must not be claimed by the host-artwork table: the host
       primitives export no lab/science glyph, so they are self-drawn. */
    for (const id of scienceIds) {
      expect(rows).not.toMatch(new RegExp(`\\b${id}: <Icon\\w+`))
    }
  })

  it.each([...GROUP_ICON_IDS, ...GROUP_EMOJI_ICONS.map(entry => entry.icon), '研', 'AB', '🧑‍💻', 'future-icon'])('round-trips %s through unchanged host validation', (icon) => {
    const parsed = parseManualGroups({ categories: ['Icons'], assignments: {}, appearance: { Icons: { icon, color: 'blue', pinned: true } } })
    expect(parsed.appearance?.Icons).toEqual({ icon, color: 'blue', pinned: true })
  })

  it('gives each emoji a unique value and bilingual name', () => {
    expect(new Set(GROUP_EMOJI_ICONS.map(entry => entry.icon)).size).toBe(GROUP_EMOJI_ICONS.length)
    for (const { icon, label } of GROUP_EMOJI_ICONS) {
      expect(Array.from(icon).length).toBeLessThanOrEqual(4)
      expect(label).toMatch(/[\u4e00-\u9fff]+.*\/.*[A-Za-z]+/u)
    }
  })
})
