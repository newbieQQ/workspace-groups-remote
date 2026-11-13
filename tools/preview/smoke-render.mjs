#!/usr/bin/env node
/**
 * tools/preview/smoke-render.mjs
 *
 * Headless DOM smoke test for the isolated preview WITHOUT a browser: builds
 * the same preview bundle (IIFE) and mounts the REAL
 * `createSettingsSection({ api })` component inside jsdom, then replays the
 * same interactions the screenshot script drives (expand, import, dirty badge,
 * password auth, test failure). This catches React/render/selector breakage in
 * environments where Chromium cannot start (Low-integrity sandbox job).
 *
 * Usage: node tools/preview/smoke-render.mjs
 * Exit 0 when every scene renders and every assertion passes.
 */
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const COMPONENT = path.join(ROOT, 'src', 'client', 'rssh-settings', 'index.tsx')
const MODAL_STUB = path.join(HERE, 'modal-stub.tsx')
const TEMP = path.join(os.tmpdir(), `rssh-preview-jsdom-${process.pid}`)
const BUNDLE = path.join(TEMP, 'preview.iife.js')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
const log = message => console.log(`[jsdom-smoke] ${message}`)

async function buildBundle() {
  if (!existsSync(COMPONENT)) throw new Error(`component missing: ${COMPONENT}`)
  await fs.mkdir(TEMP, { recursive: true })
  const { build } = await import('vite')
  await build({
    configFile: false,
    root: HERE,
    mode: 'production',
    logLevel: 'error',
    publicDir: false,
    resolve: {
      alias: [
        { find: /^#rssh-settings$/, replacement: COMPONENT },
        { find: /^@deepseek-ai\/dsh-client-ui-primitives$/, replacement: MODAL_STUB },
      ],
    },
    esbuild: { jsx: 'automatic' },
    build: {
      outDir: TEMP,
      emptyOutDir: true,
      target: 'chrome120',
      minify: false,
      write: true,
      lib: {
        entry: path.join(HERE, 'main.tsx'),
        formats: ['iife'],
        name: 'RsshPreview',
        fileName: () => 'preview.iife.js',
      },
      rollupOptions: { output: { inlineDynamicImports: true } },
    },
  })
  const code = await fs.readFile(BUNDLE, 'utf8')
  return code
}

async function mountScene(code, query) {
  const { JSDOM } = await import('jsdom')
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="preview-root"></div></body></html>', {
    url: `http://127.0.0.1/index.html?${new URLSearchParams(query).toString()}`,
    runScripts: 'dangerously',
    pretendToBeVisual: true,
  })
  const errors = []
  dom.window.addEventListener('error', event => errors.push(String(event.error || event.message)))
  // Vite's production React bundle may still reference process.env when it is
  // evaluated outside a bundler-tooled module; give the jsdom window a shim.
  dom.window.process = { env: { NODE_ENV: 'production' } }
  dom.window.eval(code)
  return { dom, window: dom.window, document: dom.window.document, errors }
}

async function waitFor(window, predicate, label, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if (predicate(window)) return true
    } catch {
      /* DOM not ready yet */
    }
    await sleep(40)
  }
  throw new Error(`timeout waiting for ${label}`)
}

const queryOf = scene => `scene=${encodeURIComponent(scene)}&theme=light&width=wide`

const mountAndSettle = async (code, scene) => {
  const mounted = await mountScene(code, { scene, theme: 'light', width: 'wide' })
  await waitFor(mounted.window, w => w.__RSH_PREVIEW_READY__ === true, `${scene}: ready flag`)
  await waitFor(mounted.window, w => !!w.document.querySelector('[data-rsui-root]'), `${scene}: root mounted`)
  await waitFor(mounted.window, w => w.__RSH_PREVIEW_IDLE__ !== false, `${scene}: fake api idle`)
  await sleep(400)
  await waitFor(mounted.window, w => w.document.body.textContent.includes('我的连接'), `${scene}: section title`)
  return mounted
}

const click = async (mounted, selector) => {
  const element = mounted.document.querySelector(selector)
  if (!element) throw new Error(`missing click target ${selector}`)
  element.click()
  await sleep(120)
}

const setValue = async (mounted, selector, value) => {
  const element = mounted.document.querySelector(selector)
  if (!element) throw new Error(`missing value target ${selector}`)
  const control = element.matches('input,textarea,select') ? element : element.querySelector('input,textarea,select')
  if (!control) throw new Error(`no control inside ${selector}`)
  const proto =
    control.tagName === 'SELECT'
      ? mounted.window.HTMLSelectElement.prototype
      : control.tagName === 'TEXTAREA'
        ? mounted.window.HTMLTextAreaElement.prototype
        : mounted.window.HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
  setter.call(control, value)
  control.dispatchEvent(new mounted.window.Event('input', { bubbles: true }))
  control.dispatchEvent(new mounted.window.Event('change', { bubbles: true }))
  await sleep(120)
  return control
}

const assert = (condition, label) => {
  if (!condition) throw new Error(`assertion failed: ${label}`)
  log(`  ok: ${label}`)
}

async function runDefault(code) {
  const mounted = await mountAndSettle(code, 'default')
  try {
    const root = mounted.document.querySelector('[data-rsui-root]')
    assert(root, 'root has data-rsui-root')
    assert(mounted.document.querySelectorAll('[data-rsui-connection]').length === 3, '3 connection cards')
    assert(mounted.document.querySelectorAll('[data-rsui-workspace]').length === 2, '2 workspace cards')
    const advanced = mounted.document.querySelector('[data-rsui-advanced-content]')
    assert(advanced, 'advanced content mounted')
    assert(advanced.hidden === true, 'advanced content collapsed (hidden)')
    const addRegion = mounted.document.querySelector('[data-rsui-toggle-add]')?.getAttribute('aria-expanded')
    assert(addRegion === 'true', 'add section initially expanded')
    assert(mounted.document.querySelector('[data-rsui-field="port"]')?.value === '22', 'port defaults to 22')
    assert(!mounted.document.querySelector('[data-rsui-import-dialog]'), 'import dialog closed')
  } finally {
    mounted.dom.window.close()
  }
}

async function runExpanded(code) {
  const mounted = await mountAndSettle(code, 'expanded')
  try {
    await click(mounted, '[data-rsui-toggle-advanced]')
    const advanced = mounted.document.querySelector('[data-rsui-advanced-content]')
    assert(advanced.hidden === false, 'advanced content expanded')
    await click(mounted, '[data-rsui-toggle-workspaces]')
    assert(mounted.document.querySelector('[data-rsui-toggle-workspaces]').getAttribute('aria-expanded') === 'true', 'workspaces expanded')
    const expandButtons = [...mounted.document.querySelectorAll('[data-rsui-ws-expand]')]
    assert(expandButtons.length === 2, 'two workspace expand buttons')
    for (const button of expandButtons) {
      button.click()
      await sleep(120)
    }
    assert([...mounted.document.querySelectorAll('[data-rsui-ws-expand]')].every(button => button.getAttribute('aria-expanded') === 'true'), 'all workspace settings expanded')
    await click(mounted, '[data-rsui-toggle-more]')
    assert(mounted.document.querySelector('[data-rsui-field="proxyJump"]'), 'proxyJump field mounted')
    await setValue(mounted, '[data-rsui-field="name"]', '超算集群（测试）')
    await setValue(mounted, '[data-rsui-field="host"]', 'login.hpc.example.com')
    await setValue(mounted, '[data-rsui-field="user"]', 'demo-user')
    assert(mounted.document.querySelector('[data-rsui-field="host"]').value === 'login.hpc.example.com', 'host field controlled value updated')
    assert(mounted.document.body.textContent.includes('高级设置'), 'advanced copy rendered')
  } finally {
    mounted.dom.window.close()
  }
}

async function runImport(code, scene) {
  const mounted = await mountAndSettle(code, scene)
  try {
    await click(mounted, '[data-rsui-import-open]')
    await waitFor(mounted.window, w => w.document.querySelectorAll('[data-rsui-import-row]').length === 5, `${scene}: 5 import rows`)
    assert(mounted.document.querySelector('[data-rsui-import-dialog]'), 'import dialog rendered')
    assert(/已选\s*5\s*\/\s*5/.test(mounted.document.body.textContent), 'selected count 5/5')
    if (scene === 'import-partial') {
      await click(mounted, '[data-rsui-import-submit]')
      await waitFor(mounted.window, w => !!w.document.querySelector('[data-rsui-import-result]'), 'import result', 15000)
      await waitFor(mounted.window, w => !!w.document.querySelector('[data-rsui-import-retry]'), 'retry button', 15000)
      const text = mounted.document.querySelector('[data-rsui-import-result]').textContent
      assert(/成功\s*3\s*个/.test(text), 'partial result reports 3 succeeded')
      assert(/失败\s*2\s*个/.test(text), 'partial result reports 2 failed')
      assert(text.includes('mirror.example.org') && text.includes('broken.example.net'), 'failed hosts listed with hostnames')
      assert(mounted.document.querySelector('[data-rsui-import-retry]').textContent.includes('重试失败项'), 'retry-only button present')
    }
  } finally {
    mounted.dom.window.close()
  }
}

async function runWorkspaces(code) {
  const mounted = await mountAndSettle(code, 'workspaces')
  try {
    await click(mounted, '[data-rsui-toggle-workspaces]')
    for (const button of [...mounted.document.querySelectorAll('[data-rsui-ws-expand]')]) {
      button.click()
      await sleep(120)
    }
    const card = mounted.document.querySelector('[data-rsui-workspace]')
    const textarea = card.querySelector('textarea')
    assert(textarea, 'workspace textarea mounted')
    const proto = mounted.window.HTMLTextAreaElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
    setter.call(textarea, `${textarea.value}\n_patch/`)
    textarea.dispatchEvent(new mounted.window.Event('input', { bubbles: true }))
    textarea.dispatchEvent(new mounted.window.Event('change', { bubbles: true }))
    await waitFor(mounted.window, w => !!w.document.querySelector('[data-rsui-ws-dirty]'), 'unsaved badge')
    assert(mounted.document.querySelector('[data-rsui-ws-dirty]').textContent.includes('未保存'), 'unsaved badge copy')
    const bodyText = mounted.document.body.textContent
    assert(bodyText.includes('与写回排除用途不同'), 'sync-exclude hint explains the difference from write-back exclude')
  } finally {
    mounted.dom.window.close()
  }
}

async function runPassword(code) {
  const mounted = await mountAndSettle(code, 'password')
  try {
    const select = await setValue(mounted, '[data-rsui-field="authMethod"]', 'password')
    assert(select.value === 'password', 'auth method switched to password')
    await waitFor(mounted.window, w => !!w.document.querySelector('[data-rsui-field="password"]'), 'password field')
    const password = mounted.document.querySelector('[data-rsui-field="password"]')
    assert(password.type === 'password', 'password input is masked')
    assert(password.getAttribute('autocomplete') === 'new-password', 'password autocomplete=new-password')
    await setValue(mounted, '[data-rsui-field="name"]', '实验室工作站（测试）')
    assert(mounted.document.body.textContent.includes('已保存密码'), 'configured password badge rendered')
  } finally {
    mounted.dom.window.close()
  }
}

async function runTestFailure(code) {
  const mounted = await mountAndSettle(code, 'test-failure')
  try {
    await click(mounted, '[data-rsui-test]')
    await waitFor(mounted.window, w => !!w.document.querySelector('[data-rsui-test-result][data-status="error"]'), 'error test result', 8000)
    const result = mounted.document.querySelector('[data-rsui-test-result]')
    assert(result.getAttribute('data-status') === 'error', 'test result status=error')
    const text = result.textContent
    assert(text.includes('连接失败'), 'failure title shown')
    assert(text.includes('Connection timed out'), 'diagnostic stderr shown')
  } finally {
    mounted.dom.window.close()
  }
}

async function main() {
  await fs.rm(TEMP, { recursive: true, force: true })
  log('building IIFE preview bundle with vite')
  const code = await buildBundle()
  log(`bundle: ${BUNDLE} (${(code.length / 1024).toFixed(0)} KiB)`)

  const cases = [
    ['01-default', runDefault],
    ['02-expanded', runExpanded],
    ['03-import-dialog', mountedCode => runImport(mountedCode, 'import-ready')],
    ['04-import-partial', mountedCode => runImport(mountedCode, 'import-partial')],
    ['05-workspaces', runWorkspaces],
    ['06-password-auth', runPassword],
    ['09-test-failure', runTestFailure],
  ]
  const failures = []
  for (const [name, runner] of cases) {
    log(`scene ${name}`)
    try {
      await runner(code)
      log(`scene ${name}: PASS`)
    } catch (error) {
      failures.push(`${name}: ${error.message}`)
      log(`scene ${name}: FAIL — ${error.message}`)
    }
  }
  log(failures.length ? `${failures.length} scene(s) failed` : 'all scenes passed')
  return failures.length ? 1 : 0
}

let exitCode = 1
try {
  exitCode = await main()
} catch (error) {
  console.error(`[jsdom-smoke][error] ${error && error.stack ? error.stack : error}`)
  exitCode = 1
} finally {
  await fs.rm(TEMP, { recursive: true, force: true }).catch(() => {})
}
process.exit(exitCode)
