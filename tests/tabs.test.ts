import { describe, expect, it } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  appendTab,
  closeOtherTabs,
  closeTabsAfter,
  moveTab,
  normalizeTabs,
  pinnedCount,
  removeTab,
  renameTab,
  restoreTabsImpl,
  togglePinTab,
  type SessionTab,
  type SessionTabsState,
} from '../src/client/tabs.ts'

const id = (name: string): SessionId => name as SessionId

function strip(...names: string[]): SessionTab[] {
  return names.map((name, at) => ({ sessionId: id(name), order: at + 1 }))
}

function pinnedStrip(...names: string[]): SessionTab[] {
  return names.map((name, at) => ({ sessionId: id(name), order: at + 1, pinned: true }))
}

const names = (tabs: readonly SessionTab[]): string[] => tabs.map(tab => tab.sessionId as string)

describe('appendTab', () => {
  it('appends a new session at the end of the unpinned block', () => {
    expect(names(appendTab(strip('a', 'b'), id('c'), 3))).toEqual(['a', 'b', 'c'])
  })

  it('is a no-op (same array) for a session that already has a tab', () => {
    const tabs = strip('a', 'b')
    expect(appendTab(tabs, id('a'), 3)).toBe(tabs)
  })

  it('appends behind pinned tabs so the pinned-first invariant holds', () => {
    // New tabs are unpinned, so appending preserves "pinned block first" — the
    // invariant is a property of the placement rule, not an extra sort.
    const tabs = [...pinnedStrip('p'), ...strip('u')]
    expect(names(appendTab(tabs, id('n'), 9))).toEqual(['p', 'u', 'n'])
    expect(pinnedCount(appendTab(tabs, id('n'), 9))).toBe(1)
  })
})

describe('removeTab', () => {
  it('drops exactly the one session', () => {
    expect(names(removeTab(strip('a', 'b', 'c'), id('b')))).toEqual(['a', 'c'])
  })
})

describe('moveTab', () => {
  const tabs = ['a', 'b', 'c', 'd'].map((name, at) => ({ sessionId: id(name), order: at + 1 }))

  it('moves a chip forward', () => {
    expect(names(moveTab(tabs, id('a'), 2))).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves a chip backward', () => {
    expect(names(moveTab(tabs, id('d'), 1))).toEqual(['a', 'd', 'b', 'c'])
  })

  it('is a no-op (same array) when the index does not change', () => {
    expect(moveTab(tabs, id('b'), 1)).toBe(tabs)
  })

  it('unknown session is a no-op', () => {
    expect(moveTab(tabs, id('zz'), 1)).toBe(tabs)
  })

  it('clamps inside the unpinned block and never crosses into the pinned one', () => {
    const mixed = [...pinnedStrip('p1', 'p2'), ...tabs]
    // Target 0 is inside the pinned block; an unpinned chip may not go there.
    expect(names(moveTab(mixed, id('c'), 0))).toEqual(['p1', 'p2', 'c', 'a', 'b', 'd'])
    expect(pinnedCount(moveTab(mixed, id('c'), 0))).toBe(2)
  })

  it('clamps a pinned chip inside the pinned block', () => {
    const mixed = [...pinnedStrip('p1', 'p2'), ...tabs]
    expect(names(moveTab(mixed, id('p1'), 5))).toEqual(['p2', 'p1', 'a', 'b', 'c', 'd'])
    expect(pinnedCount(moveTab(mixed, id('p1'), 5))).toBe(2)
  })
})

describe('togglePinTab', () => {
  const tabs = ['a', 'b', 'c'].map((name, at) => ({ sessionId: id(name), order: at + 1 }))

  it('pins to the end of the pinned block', () => {
    const once = togglePinTab(tabs, id('b'))
    expect(names(once)).toEqual(['b', 'a', 'c'])
    const twice = togglePinTab(once, id('c'))
    expect(names(twice)).toEqual(['b', 'c', 'a'])
    expect(pinnedCount(twice)).toBe(2)
  })

  it('unpins to the start of the unpinned block', () => {
    const mixed = togglePinTab(tabs, id('a'))
    const unpinned = togglePinTab(mixed, id('a'))
    expect(names(unpinned)).toEqual(['a', 'b', 'c'])
    expect(pinnedCount(unpinned)).toBe(0)
    expect(unpinned[0]?.pinned).toBeUndefined()
  })

  it('keeps a custom label through the toggle', () => {
    const relabelled = renameTab(tabs, id('a'), 'alpha')
    const mixed = togglePinTab(relabelled, id('a'))
    expect(mixed[0]?.title).toBe('alpha')
    expect(togglePinTab(mixed, id('a'))[0]?.title).toBe('alpha')
  })

  it('unknown session is a no-op', () => {
    expect(togglePinTab(tabs, id('zz'))).toBe(tabs)
  })
})

describe('renameTab', () => {
  const tabs = strip('a', 'b')

  it('sets a trimmed label', () => {
    expect(renameTab(tabs, id('a'), '  alpha  ')[0]?.title).toBe('alpha')
  })

  it('clears the override when the label is blank', () => {
    const relabelled = renameTab(tabs, id('a'), 'alpha')
    const cleared = renameTab(relabelled, id('a'), '   ')
    expect(cleared[0]?.title).toBeUndefined()
  })

  it('is a no-op (same array) when the label does not change', () => {
    expect(renameTab(tabs, id('a'), undefined)).toBe(tabs)
  })

  it('leaves the other tabs alone', () => {
    const relabelled = renameTab(tabs, id('a'), 'alpha')
    expect(relabelled[1]).toBe(tabs[1])
  })
})

describe('closeOtherTabs', () => {
  it('keeps the named tab plus every pinned one', () => {
    const mixed = [...togglePinTab(strip('a', 'b', 'c', 'd'), id('a')), { sessionId: id('e'), order: 9 }]
    expect(names(closeOtherTabs(mixed, id('c')))).toEqual(['a', 'c'])
  })

  it('unknown keep id is a no-op', () => {
    const tabs = strip('a')
    expect(closeOtherTabs(tabs, id('zz'))).toBe(tabs)
  })
})

describe('closeTabsAfter', () => {
  it('keeps the prefix through the named tab', () => {
    expect(names(closeTabsAfter(strip('a', 'b', 'c'), id('b')))).toEqual(['a', 'b'])
  })

  it('never drops the pinned block under an unpinned anchor', () => {
    const mixed = [...pinnedStrip('p'), { sessionId: id('u'), order: 2 }]
    expect(names(closeTabsAfter(mixed, id('u')))).toEqual(['p', 'u'])
  })
})

describe('normalizeTabs', () => {
  it('partitions pinned before unpinned, stably', () => {
    const messy: SessionTab[] = [
      { sessionId: id('u1'), order: 1 },
      { sessionId: id('p1'), order: 2, pinned: true },
      { sessionId: id('u2'), order: 3 },
      { sessionId: id('p2'), order: 4, pinned: true },
    ]
    expect(names(normalizeTabs(messy))).toEqual(['p1', 'p2', 'u1', 'u2'])
  })

  it('returns a copy of an already-normalized strip', () => {
    const tabs = strip('a')
    const normalized = normalizeTabs(tabs)
    expect(normalized).toEqual(tabs)
    expect(normalized).not.toBe(tabs)
  })
})

describe('restoreTabsImpl', () => {
  it('merges stored tabs without duplicating or re-keying a live one', () => {
    const state: SessionTabsState = {
      tabs: [{ sessionId: id('live'), order: 7 }],
      order: 7,
    }
    restoreTabsImpl(state, [
      { sessionId: id('stored'), order: 2 },
      { sessionId: id('live'), order: 3 },
    ])
    expect(names(state.tabs)).toEqual(['live', 'stored'])
    // Every restored key is lifted above the counter so a later append cannot
    // reuse one (a reused key makes React move a chip's DOM node).
    expect(state.tabs.every(tab => tab.order <= state.order)).toBe(true)
    expect(state.order).toBe(8)
  })

  it('restores a pinned tab into the pinned block, not at the end', () => {
    const state: SessionTabsState = {
      tabs: [{ sessionId: id('live'), order: 4 }],
      order: 4,
    }
    restoreTabsImpl(state, [{ sessionId: id('kept'), order: 1, pinned: true }])
    expect(names(state.tabs)).toEqual(['kept', 'live'])
    expect(state.tabs[0]?.pinned).toBe(true)
  })

  it('empty stored strip writes nothing', () => {
    const state: SessionTabsState = { tabs: [], order: 0 }
    restoreTabsImpl(state, [])
    expect(state).toEqual({ tabs: [], order: 0 })
  })
})
