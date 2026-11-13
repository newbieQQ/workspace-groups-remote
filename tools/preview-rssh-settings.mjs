#!/usr/bin/env node
/**
 * tools/preview-rssh-settings.mjs
 *
 * One command: build the isolated preview bundle → serve it locally → drive a
 * headless Chrome over CDP → save real rendered screenshots.
 *
 * It renders the REAL section component (`src/client/rssh-settings/index.tsx`)
 * bundled by Vite, mounted with the fake `/remote-ssh/api` layer. Screenshots
 * are therefore real renders of the built component, NOT mockups, and the page
 * is clearly labelled 隔离预览.
 *
 * Usage:
 *   node tools/preview-rssh-settings.mjs                  # requires the real component
 *   node tools/preview-rssh-settings.mjs --smoke          # pipeline smoke test (mock component)
 *   node tools/preview-rssh-settings.mjs --only=01-default,07-dark
 *
 * Exit code 0 only when every requested screenshot was produced.
 *
 * What it never does: touch the running DSH GUI, the daily profile, an
 * installed plugin directory or package.json. Chrome runs with its own
 * throwaway user-data-dir and is killed before exit; the local HTTP server is
 * closed too.
 */
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const PREVIEW_DIR = path.join(ROOT, 'tools', 'preview')
const REAL_COMPONENT = path.join(ROOT, 'src', 'client', 'rssh-settings', 'index.tsx')
const MODAL_STUB = path.join(PREVIEW_DIR, 'modal-stub.tsx')
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const OUT_DIR = path.join(ROOT, 'screenshots', 'remote-ssh-settings')
const TEMP_ROOT = path.join(os.tmpdir(), `rssh-settings-preview-${process.pid}`)

const args = process.argv.slice(2)
const BUILD_ONLY = args.includes('--build-only')
const KEEP_TEMP = args.includes('--keep-temp')
const onlyArg = args.find(item => item.startsWith('--only='))
const ONLY = onlyArg ? onlyArg.slice('--only='.length).split(',').map(item => item.trim()).filter(Boolean) : null

const log = (message) => console.log(`[preview] ${message}`)
const warn = (message) => console.warn(`[preview][warn] ${message}`)
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/* ------------------------------------------------------------------ */
/* Scene table                                                         */
/* ------------------------------------------------------------------ */

const fillAddForm = async ctx => {
  await ctx.setValue('[data-rsui-field="name"]', '超算集群（测试）')
  await ctx.setValue('[data-rsui-field="host"]', 'login.hpc.example.com')
  await ctx.setValue('[data-rsui-field="user"]', 'demo-user')
  await ctx.setValue('[data-rsui-field="keyPath"]', '~/.ssh/id_ed25519')
  await ctx.setValue('[data-rsui-field="remoteRoot"]', '~/project')
}

const expandAll = async ctx => {
  await ctx.click('[data-rsui-toggle-advanced]')
  await ctx.waitVisible('[data-rsui-advanced-content]', '高级设置内容展开')
  await ctx.waitAttr('[data-rsui-toggle-advanced]', 'aria-expanded', 'true', '高级设置 aria-expanded')

  await ctx.click('[data-rsui-toggle-workspaces]')
  await ctx.waitExists('[data-rsui-workspace]', '远程工作区卡片')
  await ctx.waitAttr('[data-rsui-toggle-workspaces]', 'aria-expanded', 'true', '远程工作区 aria-expanded')
  await ctx.clickAll('[data-rsui-ws-expand]')
  await ctx.waitAttr('[data-rsui-ws-expand]', 'aria-expanded', 'true', '工作区配置展开')

  await ctx.click('[data-rsui-toggle-more]')
  await ctx.waitAttr('[data-rsui-toggle-more]', 'aria-expanded', 'true', '更多连接选项展开')
  await ctx.waitVisible('[data-rsui-field="proxyJump"]', 'ProxyJump 字段')
}

const openImportDialog = async ctx => {
  await ctx.click('[data-rsui-import-open]')
  await ctx.waitExists('[data-rsui-import-dialog]', '导入弹窗')
  await ctx.waitAtLeast('[data-rsui-import-row]', 1, '导入主机行')
  await ctx.waitText(/已选\s+\d+\s*\/\s*\d+/, '已选数量')
}

const scenes = [
  {
    name: '01-default',
    title: '默认（高级设置收起）',
    query: { scene: 'default', theme: 'light' },
    viewport: { width: 1280, height: 900 },
    capture: 'full',
    actions: [],
    checks: [
      {
        label: '高级设置内容已挂载且处于收起（不可见）状态',
        expression: `(() => {
          const el = document.querySelector('[data-rsui-advanced-content]');
          if (!el) return 'missing data-rsui-advanced-content';
          const visible = typeof el.checkVisibility === 'function'
            ? el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })
            : el.offsetParent !== null;
          const expanded = document.querySelector('[data-rsui-toggle-advanced]')?.getAttribute('aria-expanded');
          return visible === false && expanded === 'false';
        })()`,
      },
      {
        label: '高级设置内没有出现保存按钮（收起时不显示内部按钮）',
        expression: `(() => {
          const content = document.querySelector('[data-rsui-advanced-content]');
          const save = document.querySelector('[data-rsui-prefs-save]');
          if (!content || !save) return 'missing content or save button';
          const visible = typeof save.checkVisibility === 'function'
            ? save.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })
            : save.offsetParent !== null;
          return visible === false;
        })()`,
      },
      {
        label: '添加连接表单初始展开',
        expression: `(() => {
          const el = document.querySelector('[data-rsui-field="host"]');
          return !!el && (typeof el.checkVisibility !== 'function' || el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }));
        })()`,
      },
    ],
  },
  {
    name: '02-expanded',
    title: '全部展开（字段可核对）',
    query: { scene: 'expanded', theme: 'light' },
    viewport: { width: 1280, height: 900 },
    capture: 'full',
    actions: async ctx => {
      await expandAll(ctx)
      await fillAddForm(ctx)
      await ctx.settle('填写添加连接表单')
    },
    checks: [
      {
        label: '高级设置内容可见',
        expression: `(() => {
          const el = document.querySelector('[data-rsui-advanced-content]');
          return !!el && el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
        })()`,
      },
      {
        label: 'ProxyJump 字段可见',
        expression: `(() => {
          const el = document.querySelector('[data-rsui-field="proxyJump"]');
          return !!el && el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true });
        })()`,
      },
      {
        label: '添加表单已填入示例值',
        expression: `(() => {
          const host = document.querySelector('[data-rsui-field="host"]');
          const user = document.querySelector('[data-rsui-field="user"]');
          return !!host && !!user && host.value === 'login.hpc.example.com' && user.value === 'demo-user';
        })()`,
      },
    ],
  },
  {
    name: '03-import-dialog',
    title: 'SSH 导入弹窗（列表 / 已选数量）',
    query: { scene: 'import-ready', theme: 'light' },
    viewport: { width: 1280, height: 900 },
    capture: 'viewport',
    actions: async ctx => {
      await openImportDialog(ctx)
      // Best effort: uncheck one row so the selected counter is visibly dynamic.
      const toggled = await ctx.evaluate(`(() => {
        const row = document.querySelector('[data-rsui-import-row]');
        if (!row) return 'no-row';
        const checkbox = row.querySelector('input[type="checkbox"]');
        if (!checkbox) return 'no-checkbox';
        checkbox.click();
        return 'ok';
      })()`)
      await sleep(250)
      if (toggled !== 'ok') warn(`03-import-dialog: could not toggle a row (${toggled}); keeping default selection`)
    },
    checks: [
      {
        label: '导入行数量 >= 1',
        expression: `document.querySelectorAll('[data-rsui-import-row]').length >= 1`,
      },
      {
        label: '已选数量文案存在',
        expression: `(/已选\\s*\\d+\\s*\\/\\s*\\d+/.test(document.body.innerText))`,
      },
    ],
  },
  {
    name: '04-import-partial',
    title: '导入部分失败结果 + 仅重试失败项',
    query: { scene: 'import-partial', theme: 'light' },
    viewport: { width: 1280, height: 900 },
    capture: 'viewport',
    actions: async ctx => {
      await openImportDialog(ctx)
      await ctx.click('[data-rsui-import-submit]')
      await ctx.waitExists('[data-rsui-import-result]', '导入结果块', 15000)
      await ctx.waitExists('[data-rsui-import-retry]', '仅重试失败项按钮', 15000)
      await ctx.settle('导入结果渲染')
    },
    checks: [
      {
        label: '结果显示部分失败',
        expression: `(() => { const block = document.querySelector('[data-rsui-import-result]'); return !!block && /成功\\s*\\d+\\s*个/.test(block.innerText) && /失败\\s*\\d+\\s*个/.test(block.innerText); })()`,
      },
      {
        label: '存在重试按钮且只针对失败项',
        expression: `(() => { const btn = document.querySelector('[data-rsui-import-retry]'); return !!btn && btn.innerText.includes('重试失败项'); })()`,
      },
      {
        label: '失败主机逐项列出',
        expression: `(() => { const block = document.querySelector('[data-rsui-import-result]'); return !!block && block.innerText.includes('mirror.example.org') && block.innerText.includes('broken.example.net'); })()`,
      },
    ],
  },
  {
    name: '05-workspaces',
    title: '远程工作区独立配置展开 + 未保存徽标',
    query: { scene: 'workspaces', theme: 'light' },
    viewport: { width: 1280, height: 900 },
    capture: 'full',
    actions: async ctx => {
      await ctx.click('[data-rsui-toggle-workspaces]')
      await ctx.waitExists('[data-rsui-workspace]', '工作区卡片')
      await ctx.clickAll('[data-rsui-ws-expand]')
      await ctx.waitAttr('[data-rsui-ws-expand]', 'aria-expanded', 'true', '工作区配置展开')
      const edited = await ctx.evaluate(`(() => {
        const card = document.querySelector('[data-rsui-workspace]');
        if (!card) return 'no-card';
        const textarea = card.querySelector('textarea');
        if (!textarea) return 'no-textarea';
        const proto = HTMLTextAreaElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(textarea, textarea.value + (textarea.value ? '\\n' : '') + '_patch/');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
        return 'ok';
      })()`)
      if (edited !== 'ok') throw new Error(`05-workspaces: could not edit a workspace textarea (${edited})`)
      await ctx.waitExists('[data-rsui-ws-dirty]', '未保存徽标', 4000)
      await ctx.settle('未保存徽标渲染')
    },
    checks: [
      {
        label: '工作区设置已展开',
        expression: `(() => { const btn = document.querySelector('[data-rsui-ws-expand]'); return !!btn && btn.getAttribute('aria-expanded') === 'true'; })()`,
      },
      {
        label: '未保存徽标存在',
        expression: `!!document.querySelector('[data-rsui-ws-dirty]')`,
      },
      {
        label: '工作区说明文案（写回排除 / 同步排除用途区分）存在',
        expression: `(() => { const text = document.body.innerText; return text.includes('写回排除') && text.includes('同步排除') && text.includes('与写回排除用途不同'); })()`,
      },
    ],
  },
  {
    name: '06-password-auth',
    title: '密码认证表单',
    query: { scene: 'password', theme: 'light' },
    viewport: { width: 1280, height: 900 },
    capture: 'full',
    actions: async ctx => {
      await ctx.setValue('[data-rsui-field="authMethod"]', 'password')
      await ctx.waitVisible('[data-rsui-field="password"]', '密码输入框')
      await ctx.setValue('[data-rsui-field="name"]', '实验室工作站（测试）')
      await ctx.setValue('[data-rsui-field="host"]', 'workstation.lab.example.com')
      await ctx.setValue('[data-rsui-field="user"]', 'lab-user')
      // Sample secret, masked by type=password: never rendered as plain text.
      await ctx.setValue('[data-rsui-field="password"]', 'example-masked-secret')
      await ctx.settle('密码表单渲染')
      await ctx.evaluate(`(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return true; })()`)
    },
    checks: [
      {
        label: '密码输入框可见且 type=password',
        expression: `(() => {
          const el = document.querySelector('[data-rsui-field="password"]');
          const input = el && (el.matches('input') ? el : el.querySelector('input'));
          return !!input && input.type === 'password' && input.getAttribute('autocomplete') === 'new-password';
        })()`,
      },
      {
        label: '明文示例密码未出现在页面文本中',
        expression: `!document.body.innerText.includes('example-masked-secret')`,
      },
      {
        label: '密码认证卡片（已保存密码）可见',
        expression: `document.body.innerText.includes('已保存密码')`,
      },
    ],
  },
  {
    name: '07-dark',
    title: '深色模式（全部展开）',
    query: { scene: 'expanded', theme: 'dark' },
    viewport: { width: 1280, height: 900 },
    capture: 'full',
    actions: async ctx => {
      await expandAll(ctx)
      await fillAddForm(ctx)
      await ctx.settle('深色模式渲染')
    },
    checks: [
      {
        label: '深色主题已生效',
        expression: `document.documentElement.dataset.theme === 'dark'`,
      },
      {
        label: '深色模式页面背景为暗色',
        expression: `(() => { const bg = getComputedStyle(document.body).backgroundColor; const m = bg.match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)/); return !!m && (Number(m[1]) + Number(m[2]) + Number(m[3])) / 3 < 80; })()`,
      },
      {
        label: '高级设置内容可见',
        expression: `(() => { const el = document.querySelector('[data-rsui-advanced-content]'); return !!el && el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true }); })()`,
      },
    ],
  },
  {
    name: '08-narrow',
    title: '窄屏约 480px 单列',
    query: { scene: 'default', theme: 'light' },
    viewport: { width: 480, height: 900 },
    capture: 'full',
    actions: async ctx => {
      await ctx.setValue('[data-rsui-field="host"]', 'login.hpc.example.com')
      await ctx.setValue('[data-rsui-field="user"]', 'demo-user')
      await ctx.settle('窄屏渲染')
    },
    checks: [
      {
        label: '视口宽度约 480px',
        expression: `Math.abs(window.innerWidth - 480) <= 8`,
      },
      {
        label: '表单在窄屏下单列排布（端口与用户名不再并排）',
        expression: `(() => {
          const port = document.querySelector('[data-rsui-field="port"]');
          const user = document.querySelector('[data-rsui-field="user"]');
          if (!port || !user) return 'missing fields';
          const portInput = port.matches('input') ? port : port.querySelector('input');
          const userInput = user.matches('input') ? user : user.querySelector('input');
          if (!portInput || !userInput) return 'missing inputs';
          const a = portInput.getBoundingClientRect();
          const b = userInput.getBoundingClientRect();
          if (!a.width || !b.width) return 'zero width';
          return Math.abs(a.top - b.top) > 8;
        })()`,
      },
      {
        label: '页面无横向溢出',
        expression: `document.documentElement.scrollWidth <= window.innerWidth + 2`,
      },
    ],
  },
  {
    name: '09-test-failure',
    title: '连接测试失败诊断',
    query: { scene: 'test-failure', theme: 'light' },
    viewport: { width: 1280, height: 900 },
    capture: 'full',
    actions: async ctx => {
      await ctx.click('[data-rsui-test]')
      await ctx.waitExists('[data-rsui-test-result][data-status="error"]', '连接失败结果块', 6000)
      await ctx.settle('诊断输出渲染')
      await ctx.evaluate(`(() => { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return true; })()`)
    },
    checks: [
      {
        label: '失败结果块状态为 error',
        expression: `document.querySelector('[data-rsui-test-result]').getAttribute('data-status') === 'error'`,
      },
      {
        label: '显示连接失败与诊断输出',
        expression: `(() => { const block = document.querySelector('[data-rsui-test-result]'); return !!block && block.innerText.includes('连接失败') && (block.innerText.includes('Connection timed out') || block.innerText.includes('诊断输出')); })()`,
      },
    ],
  },
]

/* ------------------------------------------------------------------ */
/* Vite build                                                          */
/* ------------------------------------------------------------------ */

async function walkFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  const results = []
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) results.push(...(await walkFiles(entryPath)))
    else results.push(entryPath)
  }
  return results
}

function htmlDocument(cssFiles) {
  const cssLinks = cssFiles
    .map(file => `<link rel="stylesheet" href="./${path.basename(file)}">`)
    .join('\n    ')
  return `<!doctype html>
<html lang="zh-CN" data-theme="light">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Remote SSH 设置 · 隔离预览</title>
    ${cssLinks}
  </head>
  <body>
    <div id="preview-root"></div>
    <script type="module" src="./preview.js"></script>
  </body>
</html>
`
}

async function buildPreview() {
  const componentTarget = REAL_COMPONENT
  if (!existsSync(REAL_COMPONENT)) {
    throw new Error(`real component is missing: ${REAL_COMPONENT}`)
  }
  const distDir = path.join(TEMP_ROOT, 'dist')
  await fs.rm(distDir, { recursive: true, force: true })
  await fs.mkdir(TEMP_ROOT, { recursive: true })

  log('building preview bundle with vite (real component)')
  const { build } = await import('vite')
  await build({
    configFile: false,
    root: PREVIEW_DIR,
    mode: 'production',
    logLevel: 'warn',
    publicDir: false,
    define: {
      __PREVIEW_ISOLATED__: 'true',
      // React DOM / scheduler ship CJS branches guarded by
      // `process.env.NODE_ENV`. Vite's lib-mode build did not inline the
      // browser define here, so the module threw "process is not defined" at
      // startup (blank page, ready flag never set). Pin the production branch.
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
    resolve: {
      alias: [
        { find: /^#rssh-settings$/, replacement: componentTarget },
        { find: /^@deepseek-ai\/dsh-client-ui-primitives$/, replacement: MODAL_STUB },
      ],
    },
    esbuild: { jsx: 'automatic' },
    build: {
      outDir: distDir,
      emptyOutDir: true,
      target: 'chrome120',
      minify: false,
      write: true,
      cssCodeSplit: false,
      lib: {
        entry: path.join(PREVIEW_DIR, 'main.tsx'),
        formats: ['es'],
        fileName: () => 'preview.js',
      },
      rollupOptions: {
        output: { inlineDynamicImports: true },
      },
    },
  })

  const files = await walkFiles(distDir)
  const cssFiles = files.filter(file => file.endsWith('.css'))
  const jsFiles = files.filter(file => file.endsWith('.js'))
  if (!jsFiles.length) throw new Error('vite build produced no JS bundle')
  await fs.writeFile(path.join(distDir, 'index.html'), htmlDocument(cssFiles), 'utf8')
  log(`bundle ready: ${jsFiles.map(file => path.basename(file)).join(', ')}${cssFiles.length ? ` + ${cssFiles.map(file => path.basename(file)).join(', ')}` : ''}`)
  return distDir
}

/* ------------------------------------------------------------------ */
/* Static server                                                       */
/* ------------------------------------------------------------------ */

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

function startStaticServer(distDir) {
  const server = http.createServer((request, response) => {
    try {
      const requestUrl = new URL(request.url || '/', 'http://127.0.0.1')
      const relativePath = requestUrl.pathname === '/' ? 'index.html' : decodeURIComponent(requestUrl.pathname.replace(/^\//, ''))
      const filePath = path.join(distDir, relativePath)
      if (!filePath.startsWith(distDir)) {
        response.writeHead(403).end('forbidden')
        return
      }
      const body = readFileSyncSafe(filePath)
      if (body === null) {
        response.writeHead(404).end('not found')
        return
      }
      const type = MIME_TYPES[path.extname(filePath)] || 'application/octet-stream'
      response.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' })
      response.end(body)
    } catch (error) {
      response.writeHead(500).end(String(error && error.message ? error.message : error))
    }
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve({ server, port: address.port })
    })
  })
}

// Sync read keeps the tiny handler simple (all files are local and small).
function readFileSyncSafe(filePath) {
  try {
    return readFileSync(filePath)
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* CDP client                                                          */
/* ------------------------------------------------------------------ */

class CdpClient {
  constructor(webSocket) {
    this.webSocket = webSocket
    this.nextId = 1
    this.pending = new Map()
    this.consoleErrors = []
    this.pageErrors = []
    this.closed = false
    webSocket.addEventListener('message', event => {
      let message
      try {
        message = JSON.parse(event.data)
      } catch {
        return
      }
      if (message.id && this.pending.has(message.id)) {
        const pending = this.pending.get(message.id)
        this.pending.delete(message.id)
        if (message.error) pending.reject(new Error(`${message.error.message}${message.error.data ? ` (${message.error.data})` : ''}`))
        else pending.resolve(message.result)
        return
      }
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
        this.consoleErrors.push(message.params.args.map(arg => arg.value ?? arg.description ?? '').join(' '))
      }
      if (message.method === 'Runtime.exceptionThrown') {
        const details = message.params.exceptionDetails
        this.pageErrors.push(details.exception?.description || details.text || 'page exception')
      }
    })
    webSocket.addEventListener('close', () => {
      this.closed = true
      for (const pending of this.pending.values()) pending.reject(new Error('CDP connection closed'))
      this.pending.clear()
    })
  }

  static async connect(url) {
    const webSocket = new WebSocket(url)
    await new Promise((resolve, reject) => {
      const onOpen = () => {
        webSocket.removeEventListener('error', onError)
        resolve()
      }
      const onError = () => {
        webSocket.removeEventListener('open', onOpen)
        reject(new Error(`could not connect CDP websocket ${url}`))
      }
      webSocket.addEventListener('open', onOpen, { once: true })
      webSocket.addEventListener('error', onError, { once: true })
    })
    return new CdpClient(webSocket)
  }

  send(method, params = {}, { timeout = 45000 } = {}) {
    if (this.closed) return Promise.reject(new Error('CDP connection already closed'))
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`CDP ${method} timed out after ${timeout}ms`))
      }, timeout)
      this.pending.set(id, {
        resolve: value => {
          clearTimeout(timer)
          resolve(value)
        },
        reject: error => {
          clearTimeout(timer)
          reject(error)
        },
      })
      this.webSocket.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression, options = {}) {
    const response = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: options.awaitPromise !== false,
    })
    if (response.exceptionDetails) {
      const description = response.exceptionDetails.exception?.description || response.exceptionDetails.text || 'evaluate threw'
      throw new Error(`page evaluate failed: ${description}`)
    }
    return response.result?.value
  }

  close() {
    try {
      this.webSocket.close()
    } catch {
      /* ignore */
    }
  }
}

/* ------------------------------------------------------------------ */
/* Chrome                                                              */
/* ------------------------------------------------------------------ */

async function waitForFile(filePath, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (existsSync(filePath)) return true
    await sleep(60)
  }
  return false
}

async function launchChrome(profileDir) {
  await fs.mkdir(profileDir, { recursive: true })
  const chromeProcess = spawn(
    CHROME_PATH,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-sync',
      '--mute-audio',
      '--hide-scrollbars',
      '--window-size=1280,900',
      'about:blank',
    ],
    { stdio: 'ignore' },
  )

  const portFile = path.join(profileDir, 'DevToolsActivePort')
  const ready = await waitForFile(portFile, 20000)
  if (!ready) {
    throw new Error(`Chrome did not expose DevToolsActivePort (profile: ${profileDir})`)
  }
  let port
  for (let attempt = 0; attempt < 20 && !port; attempt += 1) {
    try {
      const content = await fs.readFile(portFile, 'utf8')
      const firstLine = content.split(/\r?\n/)[0]
      if (firstLine) port = Number(firstLine)
    } catch {
      /* keep retrying while Chrome finishes writing */
    }
    if (!port) await sleep(100)
  }
  if (!port) throw new Error('DevToolsActivePort did not contain a port')
  log(`chrome devtools port: ${port}`)

  const deadline = Date.now() + 20000
  let pageTarget = null
  while (Date.now() < deadline && !pageTarget) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      pageTarget = list.find(target => target.type === 'page' && target.webSocketDebuggerUrl)
    } catch {
      /* Chrome HTTP endpoint may not be up yet */
    }
    if (!pageTarget) await sleep(100)
  }
  if (!pageTarget) throw new Error('no page target in Chrome')
  return { chromeProcess, port, pageTarget }
}

function killChrome(chromeProcess) {
  if (!chromeProcess || chromeProcess.exitCode !== null) return
  spawnSync('taskkill', ['/PID', String(chromeProcess.pid), '/T', '/F'], { stdio: 'ignore' })
  try {
    chromeProcess.kill('SIGKILL')
  } catch {
    /* ignore */
  }
}

/* ------------------------------------------------------------------ */
/* Page context helpers                                                */
/* ------------------------------------------------------------------ */

class SceneContext {
  constructor(cdp, sceneName, { strict }) {
    this.cdp = cdp
    this.sceneName = sceneName
    this.strict = strict
  }

  async evaluate(expression) {
    return this.cdp.evaluate(expression)
  }

  async sleep(ms) {
    await sleep(ms)
  }

  async click(selector) {
    const result = await this.evaluate(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return 'missing'; el.click(); return 'ok'; })()`,
    )
    if (result !== 'ok') throw new Error(`${this.sceneName}: click ${selector} -> ${result}`)
    await sleep(80)
  }

  async clickAll(selector) {
    let count = await this.evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`)
    if (count <= 0) {
      if (this.strict) throw new Error(`${this.sceneName}: no elements for ${selector}`)
      return
    }
    for (let index = 0; index < count; index += 1) {
      const result = await this.evaluate(
        `(() => { const els = document.querySelectorAll(${JSON.stringify(selector)}); const el = els[${index}]; if (!el) return 'missing'; el.click(); return 'ok'; })()`,
      )
      if (result !== 'ok') {
        if (this.strict) throw new Error(`${this.sceneName}: clickAll(${selector})[${index}] -> ${result}`)
        return
      }
      await sleep(120)
      count = await this.evaluate(`document.querySelectorAll(${JSON.stringify(selector)}).length`)
    }
  }

  async setValue(selector, value) {
    const result = await this.evaluate(
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return 'missing';
        const control = el.matches('input,textarea,select')
          ? el
          : el.querySelector('input,textarea,select') || (el.parentElement && el.parentElement.querySelector('input,textarea,select'));
        if (!control) return 'no-control';
        const proto = control instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : control instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(control, ${JSON.stringify(value)});
        control.dispatchEvent(new Event('input', { bubbles: true }));
        control.dispatchEvent(new Event('change', { bubbles: true }));
        return 'ok';
      })()`,
    )
    if (result !== 'ok') throw new Error(`${this.sceneName}: setValue(${selector}) -> ${result}`)
    await sleep(60)
  }

  async waitExpr(expression, label, timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs
    let lastError = null
    while (Date.now() < deadline) {
      try {
        const value = await this.evaluate(expression)
        if (value) return value
      } catch (error) {
        lastError = error
      }
      await sleep(100)
    }
    const suffix = lastError ? ` (last error: ${lastError.message})` : ''
    if (this.strict) throw new Error(`${this.sceneName}: timeout waiting for ${label}${suffix}`)
    warn(`${this.sceneName}: timeout waiting for ${label}; continuing (smoke mode)`)
    return null
  }

  async waitExists(selector, label, timeoutMs = 8000) {
    await this.waitExpr(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return !!el; })()`,
      label,
      timeoutMs,
    )
  }

  async waitVisible(selector, label, timeoutMs = 8000) {
    await this.waitExpr(
      `(() => {
        const el = document.querySelector(${JSON.stringify(selector)});
        if (!el) return false;
        return typeof el.checkVisibility === 'function'
          ? el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })
          : el.offsetParent !== null;
      })()`,
      label,
      timeoutMs,
    )
  }

  async waitAtLeast(selector, minimum, label, timeoutMs = 8000) {
    await this.waitExpr(
      `document.querySelectorAll(${JSON.stringify(selector)}).length >= ${Number(minimum)}`,
      label,
      timeoutMs,
    )
  }

  async waitAttr(selector, attribute, expected, label, timeoutMs = 8000) {
    await this.waitExpr(
      `(() => { const el = document.querySelector(${JSON.stringify(selector)}); return !!el && el.getAttribute(${JSON.stringify(attribute)}) === ${JSON.stringify(expected)}; })()`,
      label,
      timeoutMs,
    )
  }

  async waitText(regex, label, timeoutMs = 8000) {
    await this.waitExpr(`(${regex.toString()}).test(document.body.innerText)`, label, timeoutMs)
  }

  async settle(label = 'page settle') {
    await sleep(220)
    await this.waitExpr('window.__RSH_PREVIEW_IDLE__ !== false', `${label} / API idle`, 6000)
    await sleep(120)
  }
}

/* ------------------------------------------------------------------ */
/* Main per-scene flow                                                 */
/* ------------------------------------------------------------------ */

async function captureScreenshot(cdp, filePath, { fullPage, width, height }) {
  let clip
  let captureBeyondViewport = false
  if (fullPage) {
    const metrics = await cdp.send('Page.getLayoutMetrics')
    const contentSize = metrics.cssContentSize || metrics.contentSize
    const fullWidth = Math.max(Math.ceil(contentSize.width), width)
    const fullHeight = Math.max(Math.ceil(contentSize.height), height)
    clip = { x: 0, y: 0, width: fullWidth, height: fullHeight, scale: 1 }
    captureBeyondViewport = true
  }
  const params = { format: 'png', fromSurface: true, captureBeyondViewport }
  if (clip) params.clip = clip
  const result = await cdp.send('Page.captureScreenshot', params)
  const data = result.data
  if (!data) throw new Error('Page.captureScreenshot returned no data')
  await fs.writeFile(filePath, Buffer.from(data, 'base64'))
  return clip ? `${clip.width}x${clip.height}` : `${width}x${height}`
}

async function waitPageReady(cdp, sceneName) {
  const ctx = new SceneContext(cdp, sceneName, { strict: true })
  await ctx.waitExpr(
    `window.__RSH_PREVIEW_READY__ === true && document.documentElement.dataset.previewReady === '1'`,
    'preview ready flag',
    20000,
  )
  await ctx.waitExists('[data-rsui-root]', 'settings root (data-rsui-root)', 20000)
  await ctx.waitExpr(
    `typeof window.__RSH_PREVIEW_EXPECTED_TEXT__ === 'string' && document.body.innerText.includes(window.__RSH_PREVIEW_EXPECTED_TEXT__)`,
    'settings section title rendered',
    20000,
  )
  await ctx.settle('initial load')
  await ctx.waitExpr(
    `!document.body.innerText.includes('加载中…') && !document.body.innerText.includes('正在读取 ~/.ssh/config…')`,
    'no loading copy',
    8000,
  )
}

async function runScene(cdp, scene, { outDir }) {
  const startedAt = Date.now()
  const targetUrl = `http://127.0.0.1:${serverPort}/index.html?${new URLSearchParams(
    Object.entries(scene.query).map(([key, value]) => [key, String(value)]),
  ).toString()}`
  const ctx = new SceneContext(cdp, scene.name, { strict: true })
  const errorsBefore = cdp.pageErrors.length + cdp.consoleErrors.length

  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: scene.viewport.width,
    height: scene.viewport.height,
    deviceScaleFactor: 1,
    mobile: false,
    screenWidth: scene.viewport.width,
    screenHeight: scene.viewport.height,
  })
  await cdp.send('Page.navigate', { url: targetUrl })
  await waitPageReady(cdp, scene.name)

  if (typeof scene.actions === 'function') {
    await scene.actions(ctx)
  }

  // Capture BEFORE the acceptance checks: a failed assertion must never throw
  // away an otherwise valid render of the scene.
  // Reset transient UI state (focus, scroll) before the shot.
  await ctx.evaluate(`(() => {
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    window.scrollTo(0, 0);
    return true;
  })()`)
  await sleep(120)
  const pageErrors = cdp.pageErrors.slice(errorsBefore)
  const consoleErrors = cdp.consoleErrors.slice(errorsBefore)

  const filePath = path.join(outDir, `${scene.name}.png`)
  const size = await captureScreenshot(cdp, filePath, {
    fullPage: scene.capture === 'full',
    width: scene.viewport.width,
    height: scene.viewport.height,
  })
  const durationMs = Date.now() - startedAt
  log(`captured ${path.basename(filePath)} (${size}, ${durationMs}ms)`)

  const failures = []
  for (const check of scene.checks || []) {
    try {
      const value = await ctx.evaluate(check.expression)
      if (!value) failures.push(check.label)
    } catch (error) {
      failures.push(`${check.label} (evaluate error: ${error.message})`)
    }
  }
  if (failures.length) warn(`${scene.name}: checks failed: ${failures.join('; ')}`)
  if (pageErrors.length) warn(`${scene.name}: page exceptions: ${pageErrors.join(' | ')}`)
  if (consoleErrors.length) warn(`${scene.name}: console errors: ${consoleErrors.slice(0, 3).join(' | ')}`)

  return { filePath, size, durationMs, pageErrors, consoleErrors, failures }
}

/* ------------------------------------------------------------------ */
/* Entry                                                               */
/* ------------------------------------------------------------------ */

let server
let serverPort
let chrome

async function main() {
  const outDir = OUT_DIR

  if (ONLY && ONLY.some(name => !scenes.some(scene => scene.name === name))) {
    throw new Error(`unknown --only value(s): ${ONLY.join(', ')}`)
  }

  await fs.mkdir(TEMP_ROOT, { recursive: true })
  const distDir = await buildPreview()
  if (BUILD_ONLY) {
    log(`build-only done: ${distDir}`)
    return 0
  }

  if (!existsSync(CHROME_PATH)) throw new Error(`Chrome not found at ${CHROME_PATH}`)
  await fs.mkdir(outDir, { recursive: true })

  const startedServer = await startStaticServer(distDir)
  server = startedServer.server
  serverPort = startedServer.port
  log(`static server: http://127.0.0.1:${serverPort}/index.html`)

  const profileDir = path.join(TEMP_ROOT, 'chrome-profile')
  let launched
  try {
    launched = await launchChrome(profileDir)
  } catch (error) {
    throw new Error(
      `${error.message}\n` +
        'Chromium cannot start its IPC toward child processes in this environment. ' +
        'If the command runs inside a constrained/Low-integrity sandbox job, run the same command ' +
        'from a normal user terminal instead.',
    )
  }
  chrome = launched.chromeProcess
  log(`chrome pid: ${chrome.pid}`)

  const cdp = await CdpClient.connect(launched.pageTarget.webSocketDebuggerUrl)
  try {
    await cdp.send('Page.enable')
    await cdp.send('Runtime.enable')
    await cdp.send('Log.enable')
    await cdp.send('Emulation.setEmulatedMedia', { features: [] })

    const selectedScenes = ONLY ? scenes.filter(scene => ONLY.includes(scene.name)) : scenes
    const results = []
    const failures = []
    const runLog = [`run at ${new Date().toISOString()}`, `component: src/client/rssh-settings/index.tsx`]
    for (const scene of selectedScenes) {
      try {
        const result = await runScene(cdp, scene, { outDir })
        results.push(result)
        runLog.push(`${scene.name}: captured (${result.size})`)
        if (result.failures.length) {
          failures.push({ scene: scene.name, error: new Error(`checks failed: ${result.failures.join('; ')}`) })
          runLog.push(`  checks failed: ${result.failures.join('; ')}`)
        }
        if (result.pageErrors.length) {
          failures.push({ scene: scene.name, error: new Error(`page exceptions: ${result.pageErrors.join(' | ')}`) })
          runLog.push(`  page exceptions: ${result.pageErrors.join(' | ')}`)
        }
      } catch (error) {
        failures.push({ scene: scene.name, error })
        runLog.push(`${scene.name}: FAILED: ${error.message}`)
        warn(`${scene.name} failed: ${error.message}`)
      }
    }

    const manifest = {
      isolatedPreview: true,
      note: '真实组件 + 假 /remote-ssh/api 数据，在 headless Chrome 中渲染截图；不是 AI 效果图，未修改 DSH GUI / daily profile / node_modules。',
      component: 'src/client/rssh-settings/index.tsx',
      builtAt: new Date().toISOString(),
      screenshots: results.map(result => {
        const scene = scenes.find(item => item.name === path.basename(result.filePath, '.png'))
        return {
          file: path.relative(ROOT, result.filePath).replaceAll('\\', '/'),
          absolutePath: result.filePath,
          scene: scene?.query.scene,
          theme: scene?.query.theme,
          viewportWidth: scene?.viewport.width,
          capture: scene?.capture,
          size: result.size,
          durationMs: result.durationMs,
          description: scene?.title,
        }
      }),
    }

    // A partial `--only=` run must never drop the other captured scenes from
    // the manifest: merge with the previous entries that were not re-shot.
    if (ONLY) {
      try {
        const previous = JSON.parse(await fs.readFile(path.join(outDir, 'manifest.json'), 'utf8'))
        const currentFiles = new Set(manifest.screenshots.map(entry => entry.file))
        for (const entry of previous.screenshots || []) {
          if (!currentFiles.has(entry.file)) manifest.screenshots.push(entry)
        }
        manifest.screenshots.sort((a, b) => String(a.file).localeCompare(String(b.file)))
      } catch {
        /* first run or unreadable previous manifest: keep the current list */
      }
    }

    await fs.writeFile(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8')
    await fs.writeFile(path.join(outDir, 'last-run.log'), runLog.join('\n') + '\n', 'utf8')

    log(`done: ${results.length}/${selectedScenes.length} screenshots in ${outDir}`)
    for (const result of results) log(`  - ${result.filePath}`)
    if (failures.length) {
      for (const failure of failures) log(`  FAILED ${failure.scene}: ${failure.error.message}`)
      return 1
    }
    return 0
  } finally {
    cdp.close()
  }
}

async function cleanup() {
  try {
    if (chrome) killChrome(chrome)
  } catch (error) {
    warn(`cleanup chrome failed: ${error.message}`)
  }
  try {
    if (server) await new Promise(resolve => server.close(resolve))
  } catch (error) {
    warn(`cleanup server failed: ${error.message}`)
  }
  if (!KEEP_TEMP) {
    await sleep(250)
    try {
      await fs.rm(TEMP_ROOT, { recursive: true, force: true })
    } catch (error) {
      warn(`cleanup temp failed (${TEMP_ROOT}): ${error.message}`)
    }
  } else {
    log(`temp kept at ${TEMP_ROOT}`)
  }
}

let exitCode = 1
try {
  exitCode = await main()
} catch (error) {
  console.error(`[preview][error] ${error && error.stack ? error.stack : error}`)
  exitCode = 1
} finally {
  await cleanup()
}
process.exit(exitCode)
