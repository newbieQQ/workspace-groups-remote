// @vitest-environment jsdom
/**
 * Remote-SSH settings — rendered UI behaviour.
 *
 * These mount the real `createSettingsSection` component in jsdom with a fake
 * `api` and a dictionary-backed `t`, then drive the DOM through the documented
 * `data-rsui-*` hooks. They assert behaviour (drafts survive collapsing, the
 * right workspace id is saved with GiB→bytes, dirty drafts block sync, failed
 * imports are reported per host and can be retried alone) rather than styles.
 */
import React, { act } from 'react'
import type { ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSettingsSection } from '../src/client/rssh-settings/index.tsx'
import { zh } from '../src/client/rssh-settings/i18n.ts'
import type {
  RemoteSshApi,
  RemoteSshPrefs,
  RemoteSshProfile,
  RemoteSshWorkspace,
  SavePrefsPayload,
  SaveProfilePayload,
  SshConfigHost,
  UpdateWorkspaceGuardsPayload,
  SettingsTranslate,
} from '../src/client/rssh-settings/contract.ts'

/* ------------------------------------------------------------------ */
/* Primitive mock (the face only relies on Modal/Button from primitives) */
/* ------------------------------------------------------------------ */

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Modal: (props: {
    open?: boolean
    title?: ReactNode
    closeLabel?: string
    className?: string
    children?: ReactNode
    footer?: ReactNode
    [key: string]: unknown
  }) => {
    if (props.open === false) return null
    const { open: _open, onClose: _onClose, title, closeLabel: _closeLabel, footer, ...rest } = props
    const passThrough: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(rest)) {
      if (key.startsWith('data-') || key === 'className' || key === 'role' || key === 'aria-label') {
        passThrough[key] = value
      }
    }
    return React.createElement(
      'div',
      passThrough as React.HTMLAttributes<HTMLDivElement>,
      title ? React.createElement('div', null, title) : null,
      props.children,
      footer ? React.createElement('div', null, footer) : null,
    )
  },
  Button: (props: { children?: ReactNode; variant?: unknown; size?: unknown; [key: string]: unknown }) => {
    const { children, variant: _variant, size: _size, ...rest } = props
    return React.createElement('button', rest as React.ButtonHTMLAttributes<HTMLButtonElement>, children)
  },
}))

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true })

/* ------------------------------------------------------------------ */
/* Translation dictionary                                              */
/* ------------------------------------------------------------------ */

const ZH = zh as Record<string, string>
const t: SettingsTranslate = (key, params) => {
  const template = ZH[key] ?? key
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => String(params[name] ?? ''))
}

/* ------------------------------------------------------------------ */
/* Fixtures                                                            */
/* ------------------------------------------------------------------ */

const PROFILE: RemoteSshProfile = {
  id: 'p-1',
  name: 'Alpha HPC',
  host: 'alpha.example.com',
  port: 2222,
  user: 'alice',
  authMethod: 'key',
  keyPath: '~/.ssh/alpha',
  remoteRoot: '~/project',
  passwordConfigured: false,
}

const WORKSPACES: RemoteSshWorkspace[] = [
  {
    id: 'ws-a',
    profileId: 'p-1',
    title: 'Alpha workspace',
    remotePath: '~/alpha',
    writeBack: true,
    writeBackExclude: ['_patch/', '*.log'],
    syncPaths: ['.dsh'],
    syncExclude: ['data/'],
    syncMaxBytes: 2147483648,
  },
  {
    id: 'ws-b',
    profileId: 'p-1',
    title: 'Beta workspace',
    remotePath: '~/beta',
    writeBack: false,
    writeBackExclude: [],
    syncPaths: [],
    syncExclude: [],
    syncMaxBytes: 0,
  },
]

const SSH_HOSTS: SshConfigHost[] = [
  { name: 'alpha', hostName: 'alpha.example.com', user: 'alice', identityFile: '~/.ssh/alpha' },
  { name: 'beta', hostName: 'beta.example.com', user: 'bob' },
  { name: 'gamma', hostName: 'gamma.example.com' },
]

const PREFS: RemoteSshPrefs = {
  nodePath: '',
  writeBackFailure: 'error',
  writeBackFreshness: true,
  defaultSyncPaths: [],
  defaultSyncExclude: [],
  defaultSyncMaxBytes: 0,
}

/* ------------------------------------------------------------------ */
/* Fake api                                                            */
/* ------------------------------------------------------------------ */

type Handler = (args: unknown, index: number) => unknown

interface InitialData {
  profiles?: RemoteSshProfile[]
  workspaces?: RemoteSshWorkspace[]
  prefs?: RemoteSshPrefs
  hosts?: SshConfigHost[]
}

function defaultResponse(method: string, initial: InitialData): unknown {
  switch (method) {
    case 'listProfiles':
      return { ok: true, profiles: initial.profiles ?? [PROFILE] }
    case 'listWorkspaces':
      return { ok: true, workspaces: initial.workspaces ?? WORKSPACES }
    case 'getPrefs':
      return { ok: true, prefs: initial.prefs ?? PREFS }
    case 'listSshConfigHosts':
      return { ok: true, hosts: initial.hosts ?? SSH_HOSTS }
    case 'saveProfile':
      return { ok: true, id: 'p-new', profiles: initial.profiles ?? [PROFILE] }
    case 'updateWorkspaceGuards':
      return { ok: true, workspaces: initial.workspaces ?? WORKSPACES }
    case 'savePrefs':
      return { ok: true }
    case 'testConnection':
      return { ok: true, stdout: 'connected' }
    case 'syncDown':
    case 'syncUp':
      return { ok: true }
    case 'deleteProfile':
      return { ok: true, profiles: [], workspaces: [] }
    case 'deleteWorkspace':
      return { ok: true, workspaces: [] }
    default:
      return { ok: true }
  }
}

interface Harness {
  api: RemoteSshApi
  mock: ReturnType<typeof vi.fn>
  /** Argument objects of every call to one api method (in order). */
  calls: (method: string) => unknown[]
}

function createFakeApi(options: { initial?: InitialData; handlers?: Record<string, Handler> } = {}): Harness {
  const initial = options.initial ?? {}
  const counters: Record<string, number> = {}
  const mock = vi.fn(async (method: string, args?: unknown) => {
    const index = counters[method] ?? 0
    counters[method] = index + 1
    const handler = options.handlers?.[method]
    if (handler) return await handler(args, index)
    return defaultResponse(method, initial)
  })
  return {
    api: mock as unknown as RemoteSshApi,
    mock,
    calls: (method: string) => mock.mock.calls.filter(call => call[0] === method).map(call => call[1]),
  }
}

/* ------------------------------------------------------------------ */
/* Mounting + DOM helpers                                              */
/* ------------------------------------------------------------------ */

interface Mounted {
  root: Root
  container: HTMLDivElement
}

let mounted: Mounted[] = []

afterEach(() => {
  act(() => {
    for (const entry of mounted) entry.root.unmount()
  })
  for (const entry of mounted) entry.container.remove()
  mounted = []
})

async function flush(): Promise<void> {
  await act(async () => {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  })
}

async function settle(rounds = 4): Promise<void> {
  for (let i = 0; i < rounds; i += 1) await flush()
}

async function waitFor(predicate: () => boolean, label: string): Promise<void> {
  for (let i = 0; i < 40; i += 1) {
    if (predicate()) return
    await flush()
  }
  throw new Error(`timed out waiting for ${label}`)
}

function q(container: ParentNode, selector: string): HTMLElement | null {
  return container.querySelector(selector) as HTMLElement | null
}

function need(container: ParentNode, selector: string): HTMLElement {
  const el = q(container, selector)
  if (!el) throw new Error(`missing element: ${selector}`)
  return el
}

function text(container: ParentNode): string {
  return container.textContent ?? ''
}

/** Set a controlled input/textarea/select the way a user would type. */
function setValue(el: HTMLElement, value: string): void {
  const proto = Object.getPrototypeOf(el) as object
  const descriptor = Object.getOwnPropertyDescriptor(proto, 'value')
  if (!descriptor?.set) throw new Error(`element ${el.tagName} has no value setter`)
  act(() => {
    descriptor.set!.call(el, value)
    el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  })
}

function clickSync(el: Element | null | undefined): void {
  if (!el) throw new Error('click target missing')
  act(() => {
    ;(el as HTMLElement).click()
  })
}

async function click(el: Element | null | undefined): Promise<void> {
  clickSync(el)
  await settle()
}

function value(el: HTMLElement): string {
  return (el as HTMLInputElement | HTMLTextAreaElement).value
}

function isVisiblyHidden(el: HTMLElement | null): boolean {
  if (!el) return true
  let node: HTMLElement | null = el
  while (node) {
    if (node.hasAttribute('hidden') || node.getAttribute('aria-hidden') === 'true') return true
    node = node.parentElement
  }
  return false
}

/** The labelled control inside a card/section (spec: every input has label htmlFor). */
function controlByLabel(scope: ParentNode, labelPart: string): HTMLInputElement | HTMLTextAreaElement {
  const labels = Array.from(scope.querySelectorAll('label'))
  const label = labels.find(candidate => (candidate.textContent ?? '').includes(labelPart))
  if (!label) throw new Error(`no label containing "${labelPart}"`)
  const id = label.htmlFor
  const byId = id ? (document.getElementById(id) as HTMLElement | null) : null
  if (byId) return byId as HTMLInputElement | HTMLTextAreaElement
  const sibling = label.nextElementSibling
  if (sibling && /^(INPUT|TEXTAREA|SELECT)$/.test(sibling.tagName)) {
    return sibling as HTMLInputElement | HTMLTextAreaElement
  }
  throw new Error(`label for "${labelPart}" is not associated with a control`)
}

function workspaceCard(section: ParentNode, id: string): HTMLElement {
  return need(section, `[data-rsui-workspace][data-workspace-id="${id}"]`)
}

async function expandWorkspacesSection(root: HTMLElement): Promise<void> {
  const toggle = need(root, '[data-rsui-toggle-workspaces]')
  if (toggle.getAttribute('aria-expanded') !== 'true') await click(toggle)
}

interface MountOptions {
  initial?: InitialData
  handlers?: Record<string, Handler>
}

async function mount(options: MountOptions = {}): Promise<Harness & { container: HTMLDivElement }> {
  const harness = createFakeApi(options)
  const Section = createSettingsSection({ api: harness.api })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  mounted.push({ root, container })
  await act(async () => {
    root.render(React.createElement(Section, { t }))
  })
  await settle(6)
  return { ...harness, container }
}

/* ------------------------------------------------------------------ */
/* Collapsing must never drop drafts                                   */
/* ------------------------------------------------------------------ */

describe('collapsible sections keep their drafts', () => {
  it('collapsing and re-expanding "add connection" keeps host and proxyJump', async () => {
    const { container } = await mount()
    expect(need(container, '[data-rsui-field="host"]')).toBeTruthy()

    setValue(need(container, '[data-rsui-field="host"]'), 'draft.example.com')
    await click(need(container, '[data-rsui-toggle-more]'))
    setValue(need(container, '[data-rsui-field="proxyJump"]'), 'bastion.example.com')
    await click(need(container, '[data-rsui-toggle-more]'))

    expect(isVisiblyHidden(q(container, '[data-rsui-field="host"]'))).toBe(false)
    expect(value(need(container, '[data-rsui-field="host"]'))).toBe('draft.example.com')
    expect(value(need(container, '[data-rsui-field="proxyJump"]'))).toBe('bastion.example.com')

    await click(need(container, '[data-rsui-toggle-add]'))
    expect(isVisiblyHidden(q(container, '[data-rsui-field="host"]'))).toBe(true)
    expect(value(need(container, '[data-rsui-field="host"]'))).toBe('draft.example.com')

    await click(need(container, '[data-rsui-toggle-add]'))
    expect(isVisiblyHidden(q(container, '[data-rsui-field="host"]'))).toBe(false)
    expect(value(need(container, '[data-rsui-field="host"]'))).toBe('draft.example.com')
    expect(value(need(container, '[data-rsui-field="proxyJump"]'))).toBe('bastion.example.com')
  })

  it('collapsing the remote-workspace section keeps the workspace field draft', async () => {
    const { container } = await mount()
    await expandWorkspacesSection(container)

    const card = workspaceCard(container, 'ws-a')
    if (isVisiblyHidden(q(card, '[data-rsui-ws-save]'))) await click(need(card, '[data-rsui-ws-expand]'))

    const writeBackExclude = controlByLabel(card, '写回排除')
    setValue(writeBackExclude, '_patch/, *.log, tmp/')
    const syncMaxBytes = controlByLabel(card, '同步体积上限')
    setValue(syncMaxBytes, '3')

    await click(need(container, '[data-rsui-toggle-workspaces]'))
    expect(isVisiblyHidden(q(card, '[data-rsui-ws-save]'))).toBe(true)
    expect(value(controlByLabel(card, '写回排除'))).toBe('_patch/, *.log, tmp/')
    expect(value(controlByLabel(card, '同步体积上限'))).toBe('3')

    await click(need(container, '[data-rsui-toggle-workspaces]'))
    expect(value(controlByLabel(card, '写回排除'))).toBe('_patch/, *.log, tmp/')
    expect(value(controlByLabel(card, '同步体积上限'))).toBe('3')
  })

  it('advanced settings start collapsed with the save button hidden, and keep nodePath', async () => {
    const { container } = await mount()

    const content = need(container, '[data-rsui-advanced-content]')
    expect(isVisiblyHidden(content)).toBe(true)
    const save = q(container, '[data-rsui-prefs-save]')
    expect(save).not.toBeNull()
    expect(isVisiblyHidden(save)).toBe(true)

    await click(need(container, '[data-rsui-toggle-advanced]'))
    expect(isVisiblyHidden(need(container, '[data-rsui-advanced-content]'))).toBe(false)
    expect(isVisiblyHidden(q(container, '[data-rsui-prefs-save]'))).toBe(false)

    const nodePath = need(container, '[data-rsui-field="nodePath"]')
    setValue(nodePath, '/custom/node.exe')
    await click(need(container, '[data-rsui-toggle-advanced]'))
    expect(isVisiblyHidden(need(container, '[data-rsui-advanced-content]'))).toBe(true)
    expect(value(need(container, '[data-rsui-field="nodePath"]'))).toBe('/custom/node.exe')

    await click(need(container, '[data-rsui-toggle-advanced]'))
    expect(value(need(container, '[data-rsui-field="nodePath"]'))).toBe('/custom/node.exe')
  })
})

/* ------------------------------------------------------------------ */
/* Per-workspace guards                                                */
/* ------------------------------------------------------------------ */

describe('workspace guard saving', () => {
  it('saves the right workspace id with GiB→bytes and no global fields', async () => {
    const updated = WORKSPACES.map(workspace =>
      workspace.id === 'ws-b' ? { ...workspace, syncMaxBytes: 3 * 1073741824, writeBackExclude: ['tmp/'] } : workspace,
    )
    const harness = await mount({
      handlers: {
        updateWorkspaceGuards: () => ({ ok: true, workspaces: updated }),
      },
    })
    await expandWorkspacesSection(harness.container)

    const card = workspaceCard(harness.container, 'ws-b')
    if (isVisiblyHidden(q(card, '[data-rsui-ws-save]'))) await click(need(card, '[data-rsui-ws-expand]'))
    const syncMaxBytes = controlByLabel(card, '同步体积上限')
    setValue(syncMaxBytes, '3')
    const writeBackExclude = controlByLabel(card, '写回排除')
    setValue(writeBackExclude, 'tmp/')

    expect(q(card, '[data-rsui-ws-dirty]')).not.toBeNull()

    await click(need(card, '[data-rsui-ws-save]'))
    await waitFor(() => harness.calls('updateWorkspaceGuards').length === 1, 'updateWorkspaceGuards call')

    const payload = harness.calls('updateWorkspaceGuards')[0] as UpdateWorkspaceGuardsPayload
    expect(payload).toEqual({
      id: 'ws-b',
      writeBack: false,
      writeBackExclude: ['tmp/'],
      syncPaths: [],
      syncExclude: [],
      syncMaxBytes: 3221225472,
    })
    expect(payload).not.toHaveProperty('proxyJump')
    expect(payload).not.toHaveProperty('nodePath')
    expect(harness.calls('savePrefs')).toHaveLength(0)

    // Successful save recalculates the baseline: the dirty badge disappears.
    await settle()
    expect(q(card, '[data-rsui-ws-dirty]')).toBeNull()
  })

  it('a failed save keeps the typed draft and shows the error', async () => {
    const harness = await mount({
      handlers: {
        updateWorkspaceGuards: () => ({ ok: false, error: 'guards denied' }),
      },
    })
    await expandWorkspacesSection(harness.container)

    const card = workspaceCard(harness.container, 'ws-a')
    if (isVisiblyHidden(q(card, '[data-rsui-ws-save]'))) await click(need(card, '[data-rsui-ws-expand]'))
    setValue(controlByLabel(card, '写回排除'), '_patch/, tmp/')

    await click(need(card, '[data-rsui-ws-save]'))
    await waitFor(() => text(card).includes('guards denied'), 'save error text')

    expect(value(controlByLabel(card, '写回排除'))).toBe('_patch/, tmp/')
    expect(q(card, '[data-rsui-ws-dirty]')).not.toBeNull()
    expect(value(controlByLabel(card, '同步体积上限'))).toBe('2')
  })
})

describe('pull / push gating', () => {
  it('a dirty workspace refuses pull and push and asks for a save first', async () => {
    const harness = await mount()
    await expandWorkspacesSection(harness.container)
    const card = workspaceCard(harness.container, 'ws-a')
    if (isVisiblyHidden(q(card, '[data-rsui-ws-sync]'))) await click(need(card, '[data-rsui-ws-expand]'))

    setValue(controlByLabel(card, '写回排除'), '_patch/, typed/')
    expect(q(card, '[data-rsui-ws-dirty]')).not.toBeNull()

    await click(need(card, '[data-rsui-ws-sync]'))
    expect(harness.calls('syncDown')).toHaveLength(0)
    expect(text(card)).toContain(zh['workspace.syncBlocked'])

    await click(need(card, '[data-rsui-ws-push]'))
    expect(harness.calls('syncUp')).toHaveLength(0)
    expect(text(card)).toContain(zh['workspace.syncBlocked'])
  })

  it('after saving, pull runs with the workspace id', async () => {
    const updated = WORKSPACES.map(workspace =>
      workspace.id === 'ws-a' ? { ...workspace, writeBackExclude: ['_patch/', 'typed/'] } : workspace,
    )
    const harness = await mount({
      handlers: {
        updateWorkspaceGuards: () => ({ ok: true, workspaces: updated }),
      },
    })
    await expandWorkspacesSection(harness.container)
    const card = workspaceCard(harness.container, 'ws-a')
    if (isVisiblyHidden(q(card, '[data-rsui-ws-save]'))) await click(need(card, '[data-rsui-ws-expand]'))

    setValue(controlByLabel(card, '写回排除'), '_patch/, typed/')
    await click(need(card, '[data-rsui-ws-save]'))
    await waitFor(() => harness.calls('updateWorkspaceGuards').length === 1, 'guard save')
    await settle()
    expect(q(card, '[data-rsui-ws-dirty]')).toBeNull()

    await click(need(card, '[data-rsui-ws-sync]'))
    await waitFor(() => harness.calls('syncDown').length === 1, 'syncDown')
    expect(harness.calls('syncDown')[0]).toEqual({ id: 'ws-a' })
    expect(text(card)).toContain(zh['workspace.syncDone'])
  })
})

describe('sync failure recovery', () => {
  it('clears the busy state after a failed sync so the action can be retried', async () => {
    const harness = await mount({
      handlers: {
        syncDown: (_args, index) => (index === 0 ? { ok: false, error: 'sync exploded' } : { ok: true }),
      },
    })
    await expandWorkspacesSection(harness.container)
    const card = workspaceCard(harness.container, 'ws-a')
    if (isVisiblyHidden(q(card, '[data-rsui-ws-sync]'))) await click(need(card, '[data-rsui-ws-expand]'))
    const otherCard = workspaceCard(harness.container, 'ws-b')
    if (isVisiblyHidden(q(otherCard, '[data-rsui-ws-sync]'))) await click(need(otherCard, '[data-rsui-ws-expand]'))

    const sync = need(card, '[data-rsui-ws-sync]') as HTMLButtonElement
    await click(sync)
    await waitFor(() => text(card).includes('sync exploded'), 'sync failure text')

    expect(sync.disabled).toBe(false)
    expect(sync.getAttribute('aria-busy')).not.toBe('true')
    expect(text(card)).not.toContain(zh['workspace.syncing'])
    const otherSync = need(otherCard, '[data-rsui-ws-sync]') as HTMLButtonElement
    expect(otherSync.disabled).toBe(false)

    await click(sync)
    await waitFor(() => harness.calls('syncDown').length === 2, 'second syncDown')
    expect(text(card)).toContain(zh['workspace.syncDone'])
  })
})

/* ------------------------------------------------------------------ */
/* Import dialog                                                       */
/* ------------------------------------------------------------------ */

describe('SSH config import feedback', () => {
  it('reports partial failures per host, never "all imported", and retries only failures', async () => {
    const harness = await mount({
      handlers: {
        saveProfile: (args, index) => {
          const name = (args as SaveProfilePayload).name
          if (index === 0) return { ok: true }
          if (index === 1) return { ok: false, error: 'duplicate host' }
          if (index === 2) throw new Error('network down')
          // retry calls (only the failed hosts are resubmitted)
          return { ok: true, name }
        },
      },
    })

    await click(need(harness.container, '[data-rsui-import-open]'))
    await waitFor(
      () => harness.container.querySelectorAll('[data-rsui-import-row]').length === SSH_HOSTS.length,
      'import host rows',
    )

    await click(need(harness.container, '[data-rsui-import-submit]'))
    await waitFor(() => q(harness.container, '[data-rsui-import-result]') !== null, 'import result')

    const result = need(harness.container, '[data-rsui-import-result]')
    const resultText = text(result)
    expect(resultText).toContain('成功 1 个，失败 2 个')
    expect(resultText).not.toContain('已导入')
    expect(resultText).toContain('beta')
    expect(resultText).toContain('gamma')
    expect(resultText).toContain('duplicate host')
    expect(resultText).toContain('network down')

    const retry = q(harness.container, '[data-rsui-import-retry]')
    expect(retry, 'retry-failed button').not.toBeNull()
    expect(text(retry as HTMLElement)).toContain('仅重试失败项')
    expect(text(retry as HTMLElement)).toContain('2')

    const saveCalls = () => harness.calls('saveProfile') as SaveProfilePayload[]
    expect(saveCalls().map(payload => payload.name)).toEqual(['alpha', 'beta', 'gamma'])

    await click(retry)
    await waitFor(() => saveCalls().length === 5, 'retried saves')
    expect(saveCalls().map(payload => payload.name)).toEqual(['alpha', 'beta', 'gamma', 'beta', 'gamma'])
    expect(saveCalls().filter(payload => payload.name === 'alpha')).toHaveLength(1)
  })

  it('shows a successful retry as fully imported', async () => {
    const harness = await mount({
      handlers: {
        saveProfile: (_args, index) => (index === 0 ? { ok: false, error: 'denied' } : { ok: true }),
      },
    })
    await click(need(harness.container, '[data-rsui-import-open]'))
    await waitFor(
      () => harness.container.querySelectorAll('[data-rsui-import-row]').length === SSH_HOSTS.length,
      'import host rows',
    )
    // Select a single host only, so a retry of that host fully succeeds.
    await click(need(harness.container, '[data-rsui-import-clear]'))
    const firstRow = need(harness.container, '[data-rsui-import-row]')
    const checkbox = firstRow.querySelector('input[type="checkbox"]')
    expect(checkbox).not.toBeNull()
    await click(checkbox)

    await click(need(harness.container, '[data-rsui-import-submit]'))
    await waitFor(() => q(harness.container, '[data-rsui-import-result]') !== null, 'import result')
    expect(text(need(harness.container, '[data-rsui-import-result]'))).toContain('全部失败')

    await click(need(harness.container, '[data-rsui-import-retry]'))
    await waitFor(() => harness.calls('saveProfile').length === 2, 'retry save')
    await settle()
    expect(text(need(harness.container, '[data-rsui-import-result]'))).toContain('已导入 1 个连接')
  })
})

/* ------------------------------------------------------------------ */
/* Add connection                                                      */
/* ------------------------------------------------------------------ */

describe('add connection form', () => {
  function fillConnection(container: HTMLElement, fields: Partial<Record<'name' | 'host' | 'user' | 'port', string>>): void {
    for (const [field, fieldValue] of Object.entries(fields)) {
      setValue(need(container, `[data-rsui-field="${field}"]`), fieldValue as string)
    }
  }

  it('a successful add resets the form and reports the added name', async () => {
    const harness = await mount()
    fillConnection(harness.container, { name: 'New HPC', host: 'new.example.com', user: 'alice', port: '2222' })

    await click(need(harness.container, '[data-rsui-add-submit]'))
    await waitFor(() => harness.calls('saveProfile').length === 1, 'saveProfile')
    await settle()

    const payload = harness.calls('saveProfile')[0] as SaveProfilePayload
    expect(payload).toMatchObject({
      name: 'New HPC',
      host: 'new.example.com',
      user: 'alice',
      port: 2222,
      authMethod: 'key',
    })
    expect(harness.container.textContent).toContain('已添加连接「New HPC」')

    expect(value(need(harness.container, '[data-rsui-field="host"]'))).toBe('')
    expect(value(need(harness.container, '[data-rsui-field="user"]'))).toBe('')
    expect(value(need(harness.container, '[data-rsui-field="port"]'))).toBe('22')
  })

  it('a failed add keeps the input and shows the error', async () => {
    const harness = await mount({
      handlers: { saveProfile: () => ({ ok: false, error: 'profile denied' }) },
    })
    fillConnection(harness.container, { host: 'keep.example.com', user: 'alice' })

    await click(need(harness.container, '[data-rsui-add-submit]'))
    await waitFor(() => text(harness.container).includes('profile denied'), 'add error')

    expect(value(need(harness.container, '[data-rsui-field="host"]'))).toBe('keep.example.com')
    expect(value(need(harness.container, '[data-rsui-field="user"]'))).toBe('alice')
  })

  it('an invalid port blocks submission instead of posting 22', async () => {
    const harness = await mount()
    fillConnection(harness.container, { host: 'port.example.com', user: 'alice', port: 'abc' })

    await click(need(harness.container, '[data-rsui-add-submit]'))
    await settle()

    expect(harness.calls('saveProfile')).toHaveLength(0)
    expect(text(harness.container)).toContain(zh['add.errPort'])
    expect(value(need(harness.container, '[data-rsui-field="port"]'))).toBe('abc')
  })
})

/* ------------------------------------------------------------------ */
/* Global preferences                                                  */
/* ------------------------------------------------------------------ */

describe('global preferences', () => {
  it('saving prefs posts the prefs payload and never writes workspace guards', async () => {
    const saved: RemoteSshPrefs = { ...PREFS, nodePath: '/custom/node.exe' }
    const harness = await mount({
      handlers: { savePrefs: () => ({ ok: true, prefs: saved }) },
    })

    await click(need(harness.container, '[data-rsui-toggle-advanced]'))
    setValue(need(harness.container, '[data-rsui-field="nodePath"]'), '  /custom/node.exe  ')
    await click(need(harness.container, '[data-rsui-prefs-save]'))
    await waitFor(() => harness.calls('savePrefs').length === 1, 'savePrefs')

    const payload = harness.calls('savePrefs')[0] as SavePrefsPayload
    expect(payload.nodePath).toBe('/custom/node.exe')
    expect(payload.writeBackFailure).toBe('error')
    expect(payload.writeBackFreshness).toBe(true)
    expect(payload.defaultSyncPaths).toEqual([])
    expect(payload.defaultSyncMaxBytes).toBe(0)

    expect(harness.calls('updateWorkspaceGuards')).toHaveLength(0)
    expect(text(harness.container)).toContain(zh['advanced.saved'])
    expect(q(harness.container, '[data-rsui-ws-dirty]')).toBeNull()
  })
})
