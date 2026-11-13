// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps, ReactNode } from 'react'
import { FoldersDialog } from '../src/client/FoldersDialog.tsx'
import { zh } from '../src/client/locales.ts'

vi.mock('@deepseek-ai/dsh-client-ui-primitives', () => ({
  Button: ({ children, variant: _variant, ...props }: any) => React.createElement('button', props, children),
  Modal: ({ children, footer }: { children: ReactNode; footer: ReactNode }) => React.createElement('div', null, children, footer),
  IconFolderOpenOutlineRegular: () => null,
  IconTrashOutlineRegular: () => null,
}))

Object.assign(globalThis, { React, IS_REACT_ACT_ENVIRONMENT: true })
let root: Root | undefined
let container: HTMLDivElement
const memberPath = 'C:\\other'
function mount(overrides: Partial<ComponentProps<typeof FoldersDialog>> = {}) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  const props = {
    workspace: { workspaceId: 'owner', title: 'Owner', path: 'C:\\owner' },
    entry: { folders: [], members: [{ path: memberPath, workspaceId: 'member', kind: 'local' }] },
    t: (key: keyof typeof zh) => zh[key], busy: false, canOpen: false, remote: false,
    ownerRemotePath: null, profiles: null, profilesError: null, knownWorkspaceIds: ['owner', 'member'],
    onClose: vi.fn(), onBuildFarm: vi.fn(), onAddFolder: vi.fn(), onAddRemote: vi.fn(),
    onAddSubpath: vi.fn(), onSetRoot: vi.fn(), onRemove: vi.fn(), onOpenFolder: vi.fn(),
    ...overrides,
  } as unknown as ComponentProps<typeof FoldersDialog>
  act(() => { root!.render(React.createElement(FoldersDialog, props)) })
  return props
}
function button(text: string, parent: ParentNode = container): HTMLButtonElement {
  const found = [...parent.querySelectorAll('button')].find(b => b.textContent?.endsWith(text))
  expect(found, text).toBeDefined()
  return found!
}
function click(element: HTMLElement) { act(() => { element.click() }) }
function removeButton() { return container.querySelector<HTMLButtonElement>('button[aria-label^="从工作区移除"]')! }
afterEach(() => { act(() => { root?.unmount() }); container?.remove(); root = undefined })

describe('folder lifecycle decisions', () => {
  it('farm preview and cancel perform no creation or removal', () => {
    const props = mount()
    click(button(zh['folder.mergeAction']))
    expect(container.textContent).toContain(zh['folder.mergeConfirm'])
    expect(container.textContent).toContain(memberPath)
    expect(props.onBuildFarm).not.toHaveBeenCalled()
    click(button(zh.cancel, container.querySelector('[role="alert"]')!))
    expect(props.onBuildFarm).not.toHaveBeenCalled()
    expect(props.onRemove).not.toHaveBeenCalled()
    expect(container.querySelector('[role="alert"]')).toBeNull()
  })

  it('double confirmation in the same render creates only once', () => {
    const props = mount()
    click(button(zh['folder.mergeAction']))
    const confirm = button(zh['folder.mergeAction'], container.querySelector('[role="alert"]')!)
    act(() => { confirm.click(); confirm.click() })
    expect(props.onBuildFarm).toHaveBeenCalledTimes(1)
    expect(props.onRemove).not.toHaveBeenCalled()
  })

  it('local member cancellation keeps the association, confirmation only detaches', () => {
    const props = mount()
    click(removeButton())
    expect(container.textContent).toContain(zh['folder.removeMemberPrompt'])
    expect(container.textContent).not.toContain(zh['folder.removeRemoteDelete'])
    click(button(zh.cancel))
    expect(props.onRemove).not.toHaveBeenCalled()
    click(removeButton())
    click(button(zh['folder.removeRemoteOnly']))
    expect(props.onRemove).toHaveBeenCalledExactlyOnceWith(memberPath, false)
  })

  it('sidebar initial removal uses the same confirmation and preserves remote workspace by default', () => {
    const props = mount({ initialRemovePath: memberPath, entry: { folders: [], members: [{
      path: memberPath, workspaceId: 'member', kind: 'remote', remotePath: '/srv/project',
      profileId: 'ssh', recordId: 'record',
    }] } })
    expect(container.textContent).toContain(zh['folder.removeMemberPrompt'])
    expect(container.textContent).toContain(zh['folder.removeRemotePrompt'])
    expect(props.onRemove).not.toHaveBeenCalled()
    click(button(zh['folder.removeRemoteOnly']))
    expect(props.onRemove).toHaveBeenCalledExactlyOnceWith(memberPath, false)
  })

  it('missing member does not promise a recreated independent entry', () => {
    const props = mount({ initialRemovePath: memberPath, knownWorkspaceIds: ['owner'] })
    expect(container.textContent).toContain(zh['folder.removeMissingPrompt'])
    expect(container.textContent).not.toContain(zh['folder.removeMemberPrompt'])
    click(button(zh['folder.removeRemoteOnly']))
    expect(props.onRemove).toHaveBeenCalledExactlyOnceWith(memberPath, false)
  })

  it('plain subfolder removal needs no workspace decision', () => {
    const props = mount({ entry: { folders: ['C:\\owner\\child'] } })
    click(removeButton())
    expect(props.onRemove).toHaveBeenCalledExactlyOnceWith('C:\\owner\\child', false)
  })
})
