/**
 * CDP 真机验证脚本（dsh-workspace-groups v0.2/v0.3）。
 *
 * 用法：
 *   node scripts/verify-groups.mjs [baseUrl] [cdpPort] [chromeBin]
 *
 * 行为：
 *   - 启动独立 headless Chrome（独立 user-data-dir），打开 baseUrl 的 GUI；
 *   - v0.2：新建分组弹窗 → 空分组渲染 → 拖拽项目进分组 → PUT 落盘 →
 *     刷新持久化 → 非法 PUT 400；
 *   - v0.3：拖拽项目组内排序 + 拖动时其他分组项目收起、规则分类行出现
 *     「⋯」菜单 → 重命名（renamed 落盘）→ 删除（成员回顶层 + hidden 落盘）、
 *     树中不存在「未分类」桶；
 *   - v0.4：拖拽插入位置指示线（上半=插到行前 / 下半=插到行后）：项目
 *     拖到目标行下半 → 插到目标之后；分组向下拖 → 移到目标分组之后、
 *     向上拖 → 移到目标分组之前；
 *   - v0.4.1：从分组拖出到顶层（拖拽中顶层落点区显示、拖出落盘 null、
 *     顶层行渲染、分组内项目菜单「移出分组」）；
 *   - v0.6：按级别收起 + 结束后恢复 —— 拖项目只折叠项目行（分组内+顶层）、
 *     分组行不收；拖分组只折叠分组行、项目行不收；dragend 还原拖动前快照；
 *   - v0.7：顶层区域改为**插入横线落点**（不再整块高亮）——顶层行之间排序、
 *     顶层空白（最后一行下方）追加末尾；顶层为空时在最后一个分组行下方显示
 *     独立横线；顶层顺序持久化 `workspaceOrder[__topLevel__]`；
 *   - 现场恢复：还原原 overlay（原无文件则删除），不留测试数据；
 *   - 依赖 host 已重启（PUT /workspace-groups/manual 可用）；
 *   - 以 0/1 退出码供质量门调用。
 */
import { spawn } from 'node:child_process'
import { mkdtemp, rm, unlink, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const BASE = process.argv[2] ?? 'http://127.0.0.1:3080'
const CDP_PORT = Number(process.argv[3] ?? 9333)
const CHROME = process.argv[4] ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const results = []
function report(name, ok, detail = '') {
  results.push({ name, ok })
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`)
}

/** Minimal CDP client over one WebSocket. */
class CDP {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl)
    this.nextId = 1
    this.pending = new Map()
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.ws.addEventListener('open', resolve, { once: true })
      this.ws.addEventListener('error', reject, { once: true })
    })
    this.ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      }
    })
  }
  send(method, params = {}) {
    const id = this.nextId++
    this.ws.send(JSON.stringify({ id, method, params }))
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }))
  }
  close() { this.ws.close() }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

async function main() {
  const profileDir = await mkdtemp(join(tmpdir(), 'wg-cdp-'))
  let chrome
  let page
  // Hoisted for the finally-block scene restore (runs even when steps throw).
  let originalManual = null
  let overlayPath = ''
  let overlayExistedBefore = false
  try {
    chrome = spawn(CHROME, [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${profileDir}`,
      '--headless=new',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1440,900',
      'about:blank',
    ], { stdio: 'ignore' })

    // Wait for the DevTools endpoint.
    let targets
    for (let i = 0; i < 60; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
        if (res.ok) break
      } catch { /* not up yet */ }
      await sleep(250)
    }
    if (chrome.exitCode !== null) throw new Error('chrome exited early')

    // Open the GUI page.
    const newRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent(BASE)}`, { method: 'PUT' })
    const target = await newRes.json()
    page = new CDP(target.webSocketDebuggerUrl)
    await page.open()

    const evaluate = async (expression) => {
      const result = await page.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
      if (result.exceptionDetails) throw new Error(`page evaluate failed: ${JSON.stringify(result.exceptionDetails)}`)
      return result.result.value
    }
    const waitFor = async (expression, timeoutMs = 15000) => {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        if (await evaluate(expression)) return true
        await sleep(250)
      }
      return false
    }

    // ---- 0. host 面就绪（GET 含 manual；PUT 可用） ----
    let snapshot
    try {
      const res = await fetch(`${BASE}/workspace-groups/config`, { cache: 'no-store' })
      snapshot = await res.json()
      report('host GET /workspace-groups/config 返回 manual 字段', res.ok && 'manual' in snapshot, `manual=${JSON.stringify(snapshot.manual)}`)
    } catch (error) {
      report('host GET /workspace-groups/config 可访问', false, String(error))
      return 1
    }
    originalManual = snapshot.manual ?? { categories: [], assignments: {} }
    try {
      overlayPath = join(process.env.DSH_HOME ?? join(process.env.HOME ?? '.', '.dsh'), 'workspace-groups.manual.json')
      overlayExistedBefore = await access(overlayPath).then(() => true, () => false)
    } catch { /* non-fatal */ }

    // ---- 1. GUI 树就绪 ----
    report('GUI 三层树渲染（.wgRoot + 项目行）', await waitFor(`document.querySelectorAll('.wgProjectRow').length > 0`))
    report('区头存在「新建分组」按钮', await evaluate(`!!document.querySelector('button[aria-label="新建分组"]')`))
    report('分组行与项目行图标可区分（文件夹 vs 项目符号）', await evaluate(`(() => {
      const g = document.querySelector('.wgCategoryRow [data-wg-row-icon="group"] svg')?.outerHTML ?? ''
      const p = document.querySelector('.wgProjectRow [data-wg-row-icon="project"] svg')?.outerHTML ?? ''
      return g !== '' && p !== '' && g !== p
    })()`))

    // ---- 2. 新建分组 ----
    // Pick a group name that doesn't collide with the live environment (the
    // user may already have a "验证分组" from their own use or a prior run).
    const takenNames = new Set([
      ...(snapshot.categories ?? []).map(c => c.name),
      ...(snapshot.manual?.categories ?? []),
      ...(snapshot.manual?.renamed ? Object.values(snapshot.manual.renamed) : []),
      '未分类', '插件',
    ])
    let groupName = '验证分组'
    for (let i = 2; takenNames.has(groupName); i++) groupName = `验证分组${i}`
    await evaluate(`document.querySelector('button[aria-label="新建分组"]').click()`)
    report('新建分组弹窗出现', await waitFor(`!!document.querySelector('.wgRenameInput')`))
    await evaluate(`(() => {
      const input = document.querySelector('.wgRenameInput')
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, ${JSON.stringify(groupName)})
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })()`)
    await evaluate(`(() => {
      const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '创建')
      if (btn) btn.click()
    })()`)
    report('空分组立即渲染', await waitFor(`!!document.querySelector('.wgCategoryRow[data-wg-category="${groupName}"]')`))

    // ---- 3. 拖拽项目进分组 ----
    const wsid = await evaluate(`document.querySelector('.wgProjectRow')?.getAttribute('data-wsid') ?? ''`)
    if (wsid === '') { report('取到待拖拽项目行', false); return 1 }
    const dragStart = await evaluate(`(() => {
      const source = document.querySelector('.wgProjectRow[data-wsid="${wsid}"]')
      const target = document.querySelector('.wgCategoryRow[data-wg-category="${groupName}"]')
      if (!source || !target) return { error: 'missing source/target' }
      const dt = new DataTransfer()
      source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
      const types = Array.prototype.slice.call(dt.types || [])
      target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
      target.__wgDt = dt // reuse the same DataTransfer for the drop step
      return { types }
    })()`)
    report('dragstart 携带自定义类型', dragStart.types?.includes('application/x-dsh-workspace-groups') === true, `types=${JSON.stringify(dragStart.types)}`)
    // React commits the drop-highlight on the next render — wait for the class.
    report('dragover 目标行高亮', await waitFor(`document.querySelector('.wgCategoryRow[data-wg-category="${groupName}"]')?.classList.contains('wgDropTarget') === true`, 5000))
    const dropped = await evaluate(`(() => {
      const target = document.querySelector('.wgCategoryRow[data-wg-category="${groupName}"]')
      if (!target?.__wgDt) return false
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: target.__wgDt }))
      return true
    })()`)
    report('drop 事件派发', dropped === true)
    // A workspace sits under a group when the group's section contains its row.
    const movedUnderGroup = `(() => {
      const section = document.querySelector('.wgCategoryRow[data-wg-category="${groupName}"]')?.parentElement
      return !!section && !!section.querySelector('.wgProjectRow[data-wsid="${wsid}"]')
    })()`
    report('drop 后项目移入新分组', await waitFor(movedUnderGroup))

    // ---- 4. 落盘 + 持久化 ----
    await sleep(500)
    const afterDrop = await fetch(`${BASE}/workspace-groups/config`, { cache: 'no-store' }).then(r => r.json())
    const persisted = afterDrop.manual?.assignments?.[wsid] === groupName
    report('PUT 落盘：assignments 包含拖入记录', persisted)
    await page.send('Page.reload')
    // Assert persistence via the overlay (the 验证分组 may render collapsed
    // after refresh, so a DOM row check would be environment-dependent).
    report('刷新后分组与归类保留（overlay 持久化）', await waitFor(`fetch(${JSON.stringify(BASE)} + '/workspace-groups/config', { cache: 'no-store' }).then(r => r.json()).then(d => d.manual?.assignments?.[${JSON.stringify(wsid)}] === ${JSON.stringify(groupName)})`))

    // ---- 5. 非法 PUT 被拒 ----
    const bad = await fetch(`${BASE}/workspace-groups/manual`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ categories: [], assignments: { [wsid]: '幽灵分组' } }),
    })
    report('非法 PUT（未知分类）返回 400', bad.status === 400, `status=${bad.status}`)

    // ---- 5.5 v0.3：组内排序 + 拖动时其他分组项目收起 ------------------------
    // cat1 = the first VISIBLE group with >=2 held projects (rule categories
    // preferred, manual groups qualify too — the live environment may leave
    // every rule category empty because the user moved their members into a
    // manual group); cat2 = the manual 验证分组 created in the v0.2 flow.
    const hiddenSet = new Set(snapshot.manual?.hidden ?? [])
    const ruleKeys = (snapshot.categories ?? []).map(c => c.name).filter(n => !hiddenSet.has(n))
    const cat2 = groupName
    const expandCat = (key) => evaluate(`(() => {
      const row = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(key)}]')
      if (!row) return false
      if (row.getAttribute('aria-expanded') === 'false') row.click()
      return true
    })()`)
    const expandProject = (key) => evaluate(`(() => {
      const section = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(key)}]')?.parentElement
      if (!section) return false
      for (const row of section.querySelectorAll('.wgProjectRow')) {
        if (row.getAttribute('aria-expanded') === 'false') row.click()
      }
      return true
    })()`)
    // Expand every visible group first so project rows render, then pick cat1
    // = the first group (not 验证分组) holding >=2 project rows by DOM count.
    // Wait for the re-render before counting (a click expands async).
    await evaluate(`(() => {
      for (const row of document.querySelectorAll('.wgCategoryRow')) {
        if (row.getAttribute('aria-expanded') !== 'true') row.click()
      }
      return true
    })()`)
    const cat1 = await evaluate(`(() => {
      return new Promise(resolve => {
        let tries = 0
        const tick = () => {
          for (const row of document.querySelectorAll('.wgCategoryRow')) {
            const key = row.getAttribute('data-wg-category')
            if (!key || key === ${JSON.stringify(cat2)}) continue
            const section = row.parentElement
            if (section && section.querySelectorAll('.wgProjectRow').length >= 2) return resolve(key)
            // The config may still be loading after the refresh; keep trying to
            // expand a collapsed group so its rows eventually render.
            if (row.getAttribute('aria-expanded') !== 'true') row.click()
          }
          if (++tries > 60) return resolve(undefined)
          setTimeout(tick, 250)
        }
        tick()
      })
    })()`)
    const cat1IsRule = cat1 !== undefined && ruleKeys.includes(cat1)
    if (cat1 === undefined) {
      const diag = JSON.stringify(await evaluate(`(() => ({
        groups: [...document.querySelectorAll('.wgCategoryRow')].map(r => ({ key: r.getAttribute('data-wg-category'), rows: r.parentElement?.querySelectorAll('.wgProjectRow').length ?? 0 })),
        flat: document.querySelectorAll('.wgProjectRow.wgProjectFlat').length,
      }))()`))
      report('v0.3/0.7 需至少一个非空分组（跳过排序/收起断言）', false, `categories=${JSON.stringify(ruleKeys)} diag=${diag}`)
    } else {
      // Expand both working categories so their project rows are visible, then
      // expand every project row (the v0.6 fold/restore assertions need them
      // expanded before the drag starts).
      await expandCat(cat1)
      await expandCat(cat2)
      const rowsVisible = await waitFor(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        return !!s1 && !!s2 && s1.querySelectorAll('.wgProjectRow').length >= 2 && s2.querySelectorAll('.wgProjectRow').length >= 1
      })()`)
      report('两个分组展开且项目行可见', rowsVisible)
      await expandProject(cat1)
      await expandProject(cat2)
      report('项目行展开（会话可见，供折叠断言用）', await waitFor(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        const rows1 = s1 ? [...s1.querySelectorAll('.wgProjectRow')] : []
        const rows2 = s2 ? [...s2.querySelectorAll('.wgProjectRow')] : []
        return rows1.length >= 2 && rows1.every(r => r.getAttribute('aria-expanded') === 'true')
          && rows2.length >= 1 && rows2.every(r => r.getAttribute('aria-expanded') === 'true')
      })()`))

      // ---- 排序前置：从顶层拖一个项目进 cat2（组内排序需要 2 个成员） ----
      // cat1 只剩 1 个成员，不能再消耗它；顶层项目（null 覆盖）是安全来源。
      const seedTop = await evaluate(`(() => {
        const source = document.querySelector('.wgProjectRow.wgProjectFlat')
        const target = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')
        if (!source || !target) return { error: 'no top-level row or cat2' }
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
        window.__wgDt = dt
        window.__wgSource = source
        return { wsid: source.getAttribute('data-wsid') }
      })()`)
      await evaluate(`(() => {
        const target = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: window.__wgDt }))
        window.__wgSource?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
        return true
      })()`)
      report('排序前置：顶层项目拖入验证分组（凑 2 个成员）', !!seedTop.wsid && await waitFor(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        return !!s2 && s2.querySelectorAll('.wgProjectRow').length >= 2
      })()`))
      await expandProject(cat2)

      // ---- v0.4：分组拖动（在项目消耗测试之前，保证两分组行都在） ----
      // 下半 = 移到目标分组之后
      const groupDown = await evaluate(`(() => {
        const source = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')
        const target = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')
        if (!source || !target) return false
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        const rect = target.getBoundingClientRect()
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: rect.top + rect.height - 1, dataTransfer: dt }))
        window.__wgCatDt = dt
        window.__wgCatSource = source // dragend fires on the dragged source
        return true
      })()`)
      report('拖分组悬停目标行下半 → 下方插入指示线', groupDown && await waitFor(`!!document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}].wgInsertAfter')`, 5000))
      await evaluate(`(() => {
        const target = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')
        if (!target || !window.__wgCatDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientY: target.getBoundingClientRect().top + target.getBoundingClientRect().height - 1, dataTransfer: window.__wgCatDt }))
        window.__wgCatSource?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
        return true
      })()`)
      report('分组向下拖 → 移到目标分组之后', await waitFor(`fetch(${JSON.stringify(BASE)} + '/workspace-groups/config', { cache: 'no-store' }).then(r => r.json()).then(d => {
        const o = d.manual?.categoryOrder ?? []
        return o.indexOf(${JSON.stringify(cat2)}) > o.indexOf(${JSON.stringify(cat1)})
      })`))

      // 上半 = 移到目标分组之前
      const groupUp = await evaluate(`(() => {
        const source = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')
        const target = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')
        if (!source || !target) return false
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        const rect = target.getBoundingClientRect()
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: rect.top + 1, dataTransfer: dt }))
        window.__wgCatDt = dt
        window.__wgCatSource = source // dragend fires on the dragged source
        return true
      })()`)
      report('拖分组悬停目标行上半 → 上方插入指示线', groupUp && await waitFor(`!!document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}].wgInsertBefore')`, 5000))
      await evaluate(`(() => {
        const target = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')
        if (!target || !window.__wgCatDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientY: target.getBoundingClientRect().top + 1, dataTransfer: window.__wgCatDt }))
        window.__wgCatSource?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
        return true
      })()`)
      report('分组向上拖 → 移到目标分组之前', await waitFor(`fetch(${JSON.stringify(BASE)} + '/workspace-groups/config', { cache: 'no-store' }).then(r => r.json()).then(d => {
        const o = d.manual?.categoryOrder ?? []
        return o.indexOf(${JSON.stringify(cat1)}) < o.indexOf(${JSON.stringify(cat2)})
      })`))
      // Let the group-reorder PUT settle before the next drag (manualSaving
      // rejects concurrent writes).
      await sleep(1000)

      // Group drags folded every group — dragend must restore the snapshot
      // automatically (no manual re-expand needed). cat1 has 1 member, cat2
      // has 2 (v0.2 drag-in + top-level seed).
      const autoRestored = await waitFor(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        return !!s1 && !!s2 && s1.querySelectorAll('.wgProjectRow').length >= 1 && s2.querySelectorAll('.wgProjectRow').length >= 2
      })()`)
      report('分组拖动后自动恢复展开（dragend 还原快照）', autoRestored)

      // ---- v0.3：组内排序（在 cat2 内；cat1 只剩 1 个成员不够排序） ----
      const reorder = await evaluate(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return { error: 'no section' }
        const rows = s2.querySelectorAll('.wgProjectRow')
        const source = rows[1] // drag the second project
        const target = rows[0] // drop before the first
        if (!source || !target) return { error: 'rows missing' }
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        window.__wgDt = dt // stash for the drop step (React re-renders may recreate rows)
        window.__wgSource = source // dragend fires on the dragged source
        return { wsid: source.getAttribute('data-wsid'), targetWsid: target.getAttribute('data-wsid') }
      })()`)
      // v0.6: dragging a PROJECT folds every project row (grouped AND
      // top-level) but leaves group rows expanded.
      report('拖动项目时分组行不收起', await waitFor(`(() => {
        const r1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')
        const r2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')
        return !!r1 && !!r2 && r1.getAttribute('aria-expanded') === 'true' && r2.getAttribute('aria-expanded') === 'true'
      })()`, 5000))
      report('拖动项目时分组内项目行折叠', await waitFor(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return false
        const rows = [...s2.querySelectorAll('.wgProjectRow')]
        return rows.length >= 2 && rows.every(r => r.getAttribute('aria-expanded') === 'false')
      })()`, 5000))
      report('拖动项目时其他分组项目行也折叠', await waitFor(`(() => {
        const s1 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')?.parentElement
        if (!s1) return false
        const rows = [...s1.querySelectorAll('.wgProjectRow')]
        return rows.length >= 1 && rows.every(r => r.getAttribute('aria-expanded') === 'false')
      })()`, 5000))
      await evaluate(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return false
        const target = s2.querySelector('.wgProjectRow')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: window.__wgDt }))
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: window.__wgDt }))
        window.__wgSource?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
        return true
      })()`)
      report('拖项目 dragend 后恢复项目行展开（快照还原）', await waitFor(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return false
        const rows = [...s2.querySelectorAll('.wgProjectRow')]
        return rows.length >= 2 && rows.every(r => r.getAttribute('aria-expanded') === 'true')
      })()`, 5000))
      // The user-visible contract: the dragged project now renders first in the group.
      report('组内拖拽排序（第二个项目移到第一个之前）', await waitFor(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return false
        const first = s2.querySelector('.wgProjectRow')
        return !!first && first.getAttribute('data-wsid') === ${JSON.stringify(reorder.wsid)}
      })()`))

      // ---- v0.4：拖到目标行下半 → 插到目标之后（指示线可见，cat2 内） ----
      const reorderAfter = await evaluate(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return { error: 'no section' }
        const rows = s2.querySelectorAll('.wgProjectRow')
        const source = rows[0] // currently the first project
        const target = rows[1] // drop on the BOTTOM half of the second
        if (!source || !target) return { error: 'rows missing' }
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        const rect = target.getBoundingClientRect()
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: rect.top + rect.height - 1, dataTransfer: dt }))
        window.__wgDt = dt // stash for the drop step
        window.__wgSource = source // dragend fires on the dragged source
        return { sourceWsid: source.getAttribute('data-wsid'), targetWsid: target.getAttribute('data-wsid') }
      })()`)
      report('拖项目悬停行下半 → 下方插入指示线', await waitFor(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        return !!s2 && !!s2.querySelector('.wgProjectRow.wgInsertAfter')
      })()`, 5000))
      await evaluate(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return false
        const target = s2.querySelector('.wgProjectRow[data-wsid="${reorderAfter.targetWsid}"]')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientY: target.getBoundingClientRect().top + target.getBoundingClientRect().height - 1, dataTransfer: window.__wgDt }))
        window.__wgSource?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
        return true
      })()`)
      report('项目拖到目标行下半 → 插入到目标之后', await waitFor(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return false
        const first = s2.querySelector('.wgProjectRow')
        return !!first && first.getAttribute('data-wsid') === ${JSON.stringify(reorderAfter.targetWsid)}
      })()`))

      // ---- v0.4.1：从分组拖出（用 cat2 的项目；cat1 只剩 1 个成员留给删除流程） ----
      const dragOut = await evaluate(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        if (!s2) return { error: 'no section' }
        const source = s2.querySelector('.wgProjectRow')
        if (!source) return { error: 'no project row' }
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        window.__wgDt = dt // stash for the drop step
        window.__wgSource = source // dragend fires on the dragged source
        return { wsid: source.getAttribute('data-wsid') }
      })()`)
      report('拖拽中顶层移出目标可见（顶层行或空落点区）', !!dragOut.wsid && await waitFor(`!!(document.querySelector('.wgProjectRow.wgProjectFlat') || document.querySelector('.wgTopLevelEmpty'))`, 5000))
      // Top-level landing is shown with an insertion LINE now: dragging over the
      // empty space below the last top-level row puts an insert-after line on
      // that row (end of the list).
      const overTopArea = await evaluate(`(() => {
        const target = document.querySelector('.wgTopLevelArea')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: window.__wgDt }))
        return true
      })()`)
      report('拖拽中顶层落点用插入横线指示（末尾行下方）', overTopArea && await waitFor(`!!(document.querySelector('.wgProjectRow.wgProjectFlat.wgInsertAfter') || document.querySelector('.wgTopLevelEmpty'))`, 5000))
      // Let the previous inline reorder PUT settle: moveWorkspaceTo rejects
      // while manualSaving, and the prior PUT's finally clears it a tick after
      // the ordering assertion above passes.
      await sleep(1000)
      const droppedOut = await evaluate(`(() => {
        const target = document.querySelector('.wgTopLevelArea')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: window.__wgDt }))
        window.__wgSource?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
        return true
      })()`)
      report('拖到顶层区域空白 = 从分组拖出（assignments=null 落盘）', droppedOut && !!dragOut.wsid && await waitFor(`fetch(${JSON.stringify(BASE)} + '/workspace-groups/config', { cache: 'no-store' }).then(r => r.json()).then(d => d.manual?.assignments?.[${JSON.stringify(dragOut.wsid)}] === null)`), `wsid=${dragOut.wsid} droppedOut=${droppedOut}`)
      report('拖出的项目出现在顶层（无分组行）', !!dragOut.wsid && await waitFor(`!!document.querySelector('.wgProjectRow.wgProjectFlat[data-wsid=${JSON.stringify(dragOut.wsid)}]')`))

      // ---- v0.7：顶层项目之间拖拽排序（横线落点） ----
      // Drag the first top-level row before the second; the top-level order is
      // persisted under workspaceOrder[__topLevel__].
      const topReorder = await evaluate(`(() => {
        const flat = document.querySelectorAll('.wgProjectRow.wgProjectFlat')
        if (flat.length < 2) return { error: 'need >=2 top-level rows' }
        const source = flat[1]
        const target = flat[0]
        if (!source || !target) return { error: 'rows missing' }
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        const rect = target.getBoundingClientRect()
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: rect.top + 1, dataTransfer: dt }))
        window.__wgDt = dt
        window.__wgSource = source
        return { wsid: source.getAttribute('data-wsid'), targetWsid: target.getAttribute('data-wsid') }
      })()`)
      report('顶层行拖拽悬停上半 → 上方插入横线', topReorder.wsid && await waitFor(`!!document.querySelector('.wgProjectRow.wgProjectFlat.wgInsertBefore')`, 5000))
      await evaluate(`(() => {
        const target = document.querySelector('.wgProjectRow.wgProjectFlat[data-wsid="${topReorder.targetWsid}"]')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientY: target.getBoundingClientRect().top + 1, dataTransfer: window.__wgDt }))
        window.__wgSource?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
        return true
      })()`)
      report('顶层项目排序落盘（workspaceOrder[__topLevel__]）', topReorder.wsid && await waitFor(`fetch(${JSON.stringify(BASE)} + '/workspace-groups/config', { cache: 'no-store' }).then(r => r.json()).then(d => {
        const o = d.manual?.workspaceOrder?.['__topLevel__'] ?? []
        const idx = (id) => o.indexOf(id)
        return idx(${JSON.stringify(topReorder.wsid)}) !== -1 && idx(${JSON.stringify(topReorder.wsid)}) < idx(${JSON.stringify(topReorder.targetWsid)})
      })`))

      // ---- v0.7：复现「两者之间落点 → 却插到目标之前」bug（拖到行下半应=after） ----
      const topAfter = await evaluate(`(() => {
        const flat = document.querySelectorAll('.wgProjectRow.wgProjectFlat')
        if (flat.length < 2) return { error: 'need >=2 top-level rows' }
        const source = flat[0]
        const target = flat[1]
        const dt = new DataTransfer()
        source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }))
        const rect = target.getBoundingClientRect()
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, clientY: rect.top + rect.height - 1, dataTransfer: dt }))
        window.__wgDt = dt
        window.__wgSource = source
        return { wsid: source.getAttribute('data-wsid'), targetWsid: target.getAttribute('data-wsid') }
      })()`)
      report('拖到顶层行下半 → 下方插入横线（after 落点提示）', topAfter.wsid && await waitFor(`!!document.querySelector('.wgProjectRow.wgProjectFlat.wgInsertAfter')`, 5000))
      await evaluate(`(() => {
        const target = document.querySelector('.wgProjectRow.wgProjectFlat[data-wsid="${topAfter.targetWsid}"]')
        if (!target || !window.__wgDt) return false
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, clientY: target.getBoundingClientRect().top + target.getBoundingClientRect().height - 1, dataTransfer: window.__wgDt }))
        window.__wgSource?.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
        return true
      })()`)
      report('拖到目标行下半 → 应插到目标之后（after）', topAfter.wsid && await waitFor(`fetch(${JSON.stringify(BASE)} + '/workspace-groups/config', { cache: 'no-store' }).then(r => r.json()).then(d => {
        const o = d.manual?.workspaceOrder?.['__topLevel__'] ?? []
        return o.indexOf(${JSON.stringify(topAfter.wsid)}) > o.indexOf(${JSON.stringify(topAfter.targetWsid)})
      })`))

      // ---- v0.4.1b：分组内项目行菜单提供「移出分组」 ----
      // cat2 还剩 1 个项目（v0.2 拖入 + 排序前置种子 - 拖出 1）；移出后
      // 手动分组变空（仍渲染），cat1 的成员留给删除流程。
      await expandCat(cat2)
      const menuMoveOut = await evaluate(`(() => {
        const s2 = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat2)}]')?.parentElement
        const row = s2?.querySelector('.wgProjectRow')
        if (!row) return false
        row.querySelector('button[aria-label^="重命名 "]')?.click()
        return true
      })()`)
      report('分组内项目行菜单出现「移出分组」', menuMoveOut && await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === '移出分组')`, 4000))
      // Close the menu (performs the move-out PUT) and let the async write
      // settle before the delete flow (manualSaving guards concurrent writes).
      await evaluate(`(() => {
        const item = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '移出分组')
        if (item) { item.click(); return true }
        return false
      })()`)
      await sleep(1000)

      // ---- v0.3：分组行出现菜单 → 重命名 → 删除回顶层 --------------------
      const hasMenu = await evaluate(`(() => {
        const row = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(cat1)}]')
        if (!row) return false
        row.querySelector('button[aria-label*="重命名分组"]')?.click()
        return !!row.querySelector('button[aria-label*="重命名分组"]')
      })()`)
      report('分组行出现「⋯」菜单（重命名/删除入口）', hasMenu)
      const renamed = `${cat1}·改`
      const renameFlow = await evaluate(`(() => {
        const item = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '重命名分组')
        if (!item) return false
        item.click()
        return true
      })()`)
      report('菜单点击「重命名分组」打开弹窗', renameFlow && await waitFor(`!!document.querySelector('.wgRenameInput')`, 4000))
      await evaluate(`(() => {
        const input = document.querySelector('.wgRenameInput')
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(input, ${JSON.stringify(renamed)})
        input.dispatchEvent(new Event('input', { bubbles: true }))
      })()`)
      await evaluate(`(() => {
        const btn = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '重命名' && !b.textContent.includes('分组'))
        if (btn) btn.click()
      })()`)
      report('重命名分组后以新名渲染', await waitFor(`!!document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(renamed)}]')`))
      report('重命名落盘（规则 renamed / 手动 categories）', await fetch(`${BASE}/workspace-groups/config`, { cache: 'no-store' })
        .then(r => r.json()).then(d => cat1IsRule
          ? d.manual?.renamed?.[cat1] === renamed
          : (d.manual?.categories ?? []).includes(renamed)))

      // Delete the renamed rule group: its projects must go top-level (null).
      // Capture the group's members first (expand the group if collapsed),
      // then drive the delete flow.
      await evaluate(`(() => {
        const row = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(renamed)}]')
        if (row && row.getAttribute('aria-expanded') === 'false') row.click()
        return true
      })()`)
      const memberIds = await evaluate(`(() => {
        const s = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(renamed)}]')?.parentElement
        return s ? [...s.querySelectorAll('.wgProjectRow')].map(r => r.getAttribute('data-wsid')) : []
      })()`)
      await evaluate(`(() => {
        const row = document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(renamed)}]')
        row?.querySelector('button[aria-label*="重命名分组"]')?.click()
        return true
      })()`)
      await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent.trim() === '删除分组')`, 4000)
      await evaluate(`(() => {
        const item = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === '删除分组')
        if (item) item.click()
        return true
      })()`)
      // The confirm button lives in the delete dialog (also labelled 删除分组).
      await waitFor(`(() => {
        const modal = [...document.querySelectorAll('[role="dialog"]')].at(-1)
        return !!modal && [...modal.querySelectorAll('button')].some(b => b.textContent.trim() === '删除分组')
      })()`, 4000)
      await evaluate(`(() => {
        const modal = [...document.querySelectorAll('[role="dialog"]')].at(-1)
        const btn = modal ? [...modal.querySelectorAll('button')].find(b => b.textContent.trim() === '删除分组') : undefined
        if (btn) btn.click()
        return true
      })()`)
      report('删除分组后分组消失', await waitFor(`!document.querySelector('.wgCategoryRow[data-wg-category=${JSON.stringify(renamed)}]')`))
      // Every former member must now render as a top-level (ungrouped) row.
      report('删除后成员回顶层（DOM）', await waitFor(`(() => {
        const ids = new Set([...document.querySelectorAll('.wgProjectRow.wgProjectFlat')].map(r => r.getAttribute('data-wsid')))
        return ${JSON.stringify(memberIds)}.every(id => ids.has(id))
      })()`), `members=${JSON.stringify(memberIds)}`)
      const deleted = await fetch(`${BASE}/workspace-groups/config`, { cache: 'no-store' }).then(r => r.json())
      const assignments = deleted.manual?.assignments ?? {}
      report('删除后落盘清理（规则 hidden / 手动 categories）', !Object.values(assignments).includes(renamed)
        && !Object.keys(deleted.manual?.workspaceOrder ?? {}).includes(renamed)
        && !(deleted.manual?.categoryOrder ?? []).includes(renamed)
        && (cat1IsRule
          ? deleted.manual?.hidden?.includes(cat1) === true
          : !(deleted.manual?.categories ?? []).includes(cat1)))
      // No 未分类 bucket exists anywhere in the tree.
      report('树中不存在「未分类」桶', await waitFor(`(() => {
        const rows = [...document.querySelectorAll('.wgCategoryRow')]
        return rows.every(r => r.getAttribute('data-wg-category') !== ${JSON.stringify('未分类')})
      })()`))
    }
  } catch (error) {
    console.error('验证脚本异常:', error)
  } finally {
    // 现场恢复必须在 finally 执行：任何异常/中断都不能把测试数据留在
    // 用户 overlay 里（此前恢复代码在 try 内，异常时会污染真实环境）。
    let restored = false
    if (page) {
      try {
        if (originalManual !== null) {
          await fetch(`${BASE}/workspace-groups/manual`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(originalManual),
          })
          if (!overlayExistedBefore && overlayPath !== '') {
            // The original environment had no overlay file — remove the one we created.
            await unlink(overlayPath).catch(() => {})
          }
          restored = true
        }
      } catch { /* best-effort restore */ }
      if (restored) {
        try {
          const cleaned = await fetch(`${BASE}/workspace-groups/config`, { cache: 'no-store' }).then(r => r.json())
          const backToOriginal = JSON.stringify(cleaned.manual ?? { categories: [], assignments: {} }) === JSON.stringify(originalManual)
          report('现场恢复：overlay 还原为原始内容', backToOriginal)
        } catch { report('现场恢复：overlay 还原为原始内容', false, '恢复校验请求失败') }
      } else {
        report('现场恢复：overlay 还原为原始内容', false, '恢复请求失败')
      }
      page.close()
    }
    if (chrome) chrome.kill('SIGKILL')
    await rm(profileDir, { recursive: true, force: true })
  }

  const failed = results.filter(r => !r.ok)
  console.log(`\n结果: ${results.length - failed.length}/${results.length} 通过`)
  return failed.length === 0 ? 0 : 1
}

process.exit(await main())
