/**
 * Zero-dependency checks for the bottom dock (the "not classified yet" bucket
 * and the pinned default workspace).
 *
 * Vitest cannot start in this checkout (missing @vitest/utils, std-env), so the
 * equivalent assertions run here instead:
 *   1. the dock predicate accepts the bucket names users actually type and
 *      rejects ordinary group names;
 *   2. the browser component takes the bucket out of the tree and out of the
 *      search results, and paints it in the dock instead;
 *   3. the stylesheet keeps the dock out of the tree's scroll area and caps the
 *      bucket height.
 *
 * Run from the package root: `node tools/verify-dock.mjs`.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (relative) => readFileSync(join(root, relative), 'utf8')

// Node ≥ 22.18 strips TypeScript types on import, which lets the shared
// predicate be tested directly instead of copied into this script.
const { isDockedCategoryKey } = await import('../src/client/tree.ts')

// 1. predicate ---------------------------------------------------------------
const docked = ['未归类', '未分类', '未分组', '未排序', '待归类', 'ungrouped', 'Uncategorized', 'UNSORTED', ' 未归类 ']
for (const key of docked) {
  assert.equal(isDockedCategoryKey(key), true, `${JSON.stringify(key)} must dock`)
}
const notDocked = ['开发', '实验', '人生大事', '画图', 'default-workspace', '未归类的项目', 'grouping', '未', 'Uncategorized work']
for (const key of notDocked) {
  assert.equal(isDockedCategoryKey(key), false, `${JSON.stringify(key)} must stay in the tree`)
}

// 2. render wiring -----------------------------------------------------------
const browser = read('src/client/GroupsBrowser.tsx')
assert.match(browser, /splitDockedCategory\(groups\)/, 'the docked bucket is split out of the derived groups')
assert.match(browser, /\{treeGroups\.map\(categorySectionNode\)\}/, 'the tree renders the categories without the bucket')
assert.match(browser, /className="wgDock"/, 'the bottom dock container is rendered')
assert.match(browser, /className="wgDockBucket"/, 'the docked bucket has its own capped container')
assert.match(browser, /categorySectionNode\(dockCategory\)/, 'the docked bucket reuses the category section component')
assert.match(
  browser,
  /categories: searchTree\.categories\.filter\(category => !isDockedCategoryKey\(category\.key\)\)/,
  'search results never repeat the docked bucket',
)
assert.match(browser, /tree=\{searchTreeForBody\}/, 'search results use the bucket-free tree')
assert.match(browser, /dockCategory === undefined && \(/, 'an empty tree that only holds the dock is not "no workspaces"')

// 3. stylesheet --------------------------------------------------------------
const css = read('src/client/styles.css')
const block = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)(${escaped} \\{)`).exec(css)
  assert.ok(match !== null, `${selector} rule exists`)
  const start = match.index + match[0].length - match[1].length
  return css.slice(start, css.indexOf('}', start))
}
assert.match(block('.wgDock'), /border-top:1px solid/, 'the dock draws the divider against the tree')
assert.match(block('.wgDock'), /max-height:min\(62vh,560px\)/, 'the dock is capped so the tree always keeps room')
assert.match(block('.wgDock'), /overflow:hidden/, 'the dock clips its own overflow instead of painting over the tree')
assert.match(block('.wgDock'), /flex:0 1 auto/, 'the dock gives way to the tree but never grows past its cap')
assert.match(block('.wgDock'), /min-height:84px/, 'the dock has a pixel floor so its rows always fit')
assert.doesNotMatch(block('.wgDock'), /min-height:min-content/, 'a min-content floor would beat max-height and swallow the tree')
assert.match(block('.wgDefaultWorkspaceBar'), /overflow:hidden/, 'the bar clips its own content instead of painting over the bucket')
assert.match(block('.wgDockBucket'), /flex:0 0 auto/, 'the bucket keeps its height so it can open its own children')
assert.match(block('.wgDockSessions'), /flex:1 1 auto/, 'only the session list gives up height')
assert.match(block('.wgDockBucket'), /overflow-y:auto/, 'a long bucket scrolls on its own')
assert.match(block('.wgDockBucket'), /max-height:min\(26vh,200px\)/, 'the bucket has its own share and scrolls past it')
assert.match(block('.wgDockSessions'), /overflow-y:auto/, 'an expanded default workspace scrolls inside the dock')
assert.match(block('.wgDockSessions'), /max-height:min\(26vh,400px\)/, 'the session list keeps its own share instead of taking what is left')
assert.match(block('.wgDockSessions'), /min-height:0/, 'the session list may shrink so nothing is cut off mid-row')
assert.match(css, /\.wgDockBucket \+ \.wgDefaultWorkspaceBar \{[^}]*border-top:1px solid/, 'a separator sits between the bucket and the default-workspace row')
assert.match(css, /\.wgRail \.wgDock \{\s*display:none;/, 'the rail never shows the dock')
assert.doesNotMatch(block('.wgDefaultWorkspaceBar'), /border-top/, 'the bar itself no longer draws a duplicate divider')
assert.match(browser, /className="wgDockSessions"/, 'the expanded sessions are wrapped in the dock scroll area')

console.log('Dock contracts passed: bucket predicate, render wiring and stylesheet.')
