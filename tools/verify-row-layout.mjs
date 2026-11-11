// Static CSS contract checks; browser geometry requires visual verification.
// Vitest cannot start in this checkout (missing @vitest/utils, std-env), so the
// stylesheet's invariants are asserted here instead:
//   node --input-type=module tools/verify-row-layout.mjs   (NODE_PATH -> lightningcss)
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { transform } from 'lightningcss'
const source = readFileSync(new URL('../src/client/styles.css', import.meta.url), 'utf8')
transform({ filename: 'styles.css', code: Buffer.from(source) })
const rule = selector => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  // Anchor at a line start so a selector that also appears inside a compound
  // rule (".wgDockBucket + .wgDefaultWorkspaceBar") never shadows its own block.
  const result = source.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, 'm'))
  assert.ok(result, `missing rule: ${selector}`)
  return result[1].replace(/\s/g, '')
}

// A. Rows cannot overflow the rail: the actions slot stays at the row's right
// edge and every nested box is allowed to shrink below its content.
assert.ok(rule('.wgRoot').includes('min-width:0;'))
assert.ok(rule('.wgTreeBody').includes('overflow-x:hidden;'))
assert.ok(rule('.wgRows').includes('grid-template-columns:minmax(0,1fr);'))
assert.ok(rule('.wgTreeWrap,.wgList,.wgRows,.wgRowsInner,.wgTreeChildren').includes('min-width:0;'))
const rows = rule('.wgCategoryRow,.wgProjectRow,.wgFolderRow,.wgSessionRow')
assert.ok(rows.includes('width:100%;') && rows.includes('box-sizing:border-box;'))
assert.ok(rule('.wgSessionTitle').includes('text-overflow:ellipsis;'))
assert.ok(rule('.wgRowActions:last-child').includes('margin-left:auto;'))

// B. The member count and the hover buttons share one right-aligned trailing
// slot: same grid cell, same right edge, both keep their boxes — so the count is
// flush with the row's right edge and the swap never moves or reflows anything.
assert.ok(rule('.wgCategoryCount,\n.wgProjectCount').includes('flex:none;'), 'project count must share the group count style')
const trail = rule('.wgRowTrail')
assert.ok(trail.includes('margin-left:auto;'), 'the trailing slot is pinned to the right edge')
assert.ok(trail.includes('justify-items:end;') && trail.includes('display:grid;'), 'count and buttons must overlap right-aligned')
assert.ok(rule('.wgRowTrail > *').includes('grid-area:1/1;'), 'both states must occupy the same cell')
const swap = rule('.wgCategoryCount,.wgFolderCount,.wgProjectCount,.wgSessionTime')
assert.ok(swap.includes('transition:opacity'), 'count and time fade instead of popping')
const hide = source.match(/\.wgCategoryRow:hover \.wgCategoryCount,[\s\S]*?\{([^}]*)\}/)?.[1]?.replace(/\s/g, '') ?? ''
assert.ok(hide.includes('opacity:0;') && hide.includes('visibility:hidden;'), 'hover/focus must hide every count and the session time')
const swapSelectors = (source.match(/\.wgCategoryRow:hover \.wgCategoryCount,[\s\S]*?\{/)?.[0] ?? '').replace(/\s+/g, ' ')
for (const selector of ['.wgProjectRow:hover .wgProjectCount,', '.wgProjectRow:focus-within .wgProjectCount,', '.wgFolderRow:focus-within .wgFolderCount,']) {
  assert.ok(swapSelectors.includes(selector), `count swap missing ${selector}`)
}
for (const selector of ['.wgSessionRow:hover .wgSessionTime,', '.wgSessionRow:focus-within .wgSessionTime {']) {
  assert.ok(swapSelectors.includes(selector), `session time swap missing ${selector}`)
}

// C. The appearance dialog scrolls inside the host Modal's padding box, so the
// icon picker can grow without pushing the footer out of reach.
assert.ok(rule('.wgAppearanceBody').includes('gap:16px;'), 'field and pin button need real spacing')
assert.ok(rule('.wgAppearanceDialog').includes('max-height:100%;'))
const content = rule('.wgAppearanceContent')
assert.ok(content.includes('overflow-y:auto;') && content.includes('min-height:0;'))
const sticky = rule('.wgAppearanceContent > :first-child')
assert.ok(sticky.includes('position:sticky;') && sticky.includes('top:0;'), 'dialog header must stay reachable while scrolling')
const sections = rule('.wgIconSections')
assert.ok(sections.includes('max-height:') && sections.includes('overflow-y:auto;'), 'icon picker is bounded, footer stays visible')
assert.ok(!rule('.wgIconGrid').includes('max-height:'), 'the scroll box moved from the grid to the section list')

// D. The bottom dock (not-classified bucket + pinned default workspace) is a
// sibling of the scrolling tree, so a long session list can never scroll it
// away. The dock is bounded and clips its own overflow; the bucket and the
// expanded default-workspace list scroll inside it.
const dock = rule('.wgDock')
assert.ok(dock.includes('border-top:'), 'the dock is separated from the tree')
assert.ok(dock.includes('max-height:') && dock.includes('overflow:hidden;'), 'the dock is capped and clips its own overflow')
const bucket = rule('.wgDockBucket')
assert.ok(bucket.includes('flex:00auto;'), 'the bucket keeps its height so it can open its own children')
assert.ok(bucket.includes('overflow-y:auto;') && bucket.includes('max-height:'), 'a long bucket scrolls on its own')
assert.ok(rule('.wgDock').includes('min-height:84px;'), 'the dock keeps a pixel floor and a real cap')
assert.ok(!rule('.wgDock').includes('min-content'), 'a min-content floor would defeat the dock cap')
assert.ok(rule('.wgDefaultWorkspaceBar').includes('overflow:hidden;'), 'the bar clips its own content')
assert.ok(rule('.wgDockSessions').includes('overflow-y:auto;'), 'an expanded default workspace scrolls inside the dock')
assert.ok(rule('.wgDefaultWorkspaceBar .wgProjectRow').includes('flex:none;'), 'the default-workspace row itself never shrinks or scrolls')

// E. The markup backs the CSS: every row hands its rest-state label (member
// count or session time) AND its buttons to the one trailing slot, so both right
// edges are the same box edge.
const rowsSource = readFileSync(new URL('../src/client/rows.tsx', import.meta.url), 'utf8')
const trailStarts = [...rowsSource.matchAll(/<span className="wgRowTrail">/g)].map(match => match.index ?? -1)
assert.equal(trailStarts.length, 4, 'category, workspace, folder and session rows each get one trailing slot')
const restStateClasses = ['wgCategoryCount', 'wgProjectCount', 'wgFolderCount', 'wgSessionTime']
for (const [index, start] of trailStarts.entries()) {
  // Bound the slot to its own row component, so a neighbouring row's buttons can
  // never satisfy the assertions below.
  const nextRow = rowsSource.indexOf('\nexport function ', start)
  const slot = rowsSource.slice(start, nextRow === -1 ? rowsSource.length : nextRow)
  const restAt = slot.indexOf(`className="${restStateClasses[index]}"`)
  const actionsAt = slot.indexOf('className="wgRowActions"')
  assert.ok(restAt > 0, `trailing slot ${index + 1} lost ${restStateClasses[index]}`)
  assert.ok(actionsAt > restAt, `trailing slot ${index + 1} must sit after ${restStateClasses[index]}`)
  assert.equal(slot.match(/className="wgRowActions"/g)?.length, 1, `trailing slot ${index + 1} must hold exactly one action box`)
  const ellipsisAt = slot.indexOf('<IconEllipsisOutlineRegular />')
  assert.ok(ellipsisAt > restAt, `trailing slot ${index + 1} must end with the ⋯ button`)
  const plusAt = slot.indexOf('<IconPlusOutlineRegular />')
  const actionBox = slot.slice(actionsAt)
  if (index === 3) {
    assert.ok(!actionBox.includes('<IconPlusOutlineRegular'), 'session rows offer only ⋯ in the trailing slot')
  } else {
    assert.ok(plusAt > 0 && ellipsisAt > plusAt, `trailing slot ${index + 1} must order the actions ＋ then ⋯`)
  }
}
const allActionBoxes = [...rowsSource.matchAll(/className="wgRowActions"/g)].map(match => match.index ?? -1)
assert.equal(allActionBoxes.length, 4, 'exactly one action box per row kind, none duplicated')
const sessionRow = rowsSource.slice(rowsSource.indexOf('export function SessionRow'))
assert.ok(sessionRow.includes('className="wgRowTrail"'), 'session rows use the same trailing slot')
assert.ok(!/wg(Category|Project|Folder)Count/.test(sessionRow), 'session rows have no member count')

console.log('Row layout CSS contracts passed (not a browser geometry test).')
