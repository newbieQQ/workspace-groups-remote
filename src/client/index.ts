/**
 * workspace-groups-remote — merged client entry.
 *
 * One package gets exactly one client row in the DSH web shell (the module
 * loader keys graph rows by package name), so this entry composes the two
 * client halves on one fiber:
 *
 * - groupsClient: the workspace-groups browser + session tab strip
 *   (groups-client.ts, formerly this file).
 * - remoteSshClient: the dsh-remote-ssh client, vendored from
 *   vendor/dsh-remote-ssh/lib/client.js. Upstream ships it as a
 *   self-registering module-loader bundle; scripts/build-remote-ssh-client.mjs
 *   strips that registration wrapper, re-exports the bare factory and applies
 *   two anchor-asserted transforms (root label, settings face). The factory
 *   is invoked here with this bundle's own require (its only requires are
 *   `react` and `@deepseek-ai/dsh-client-ui-primitives`, both platform
 *   modules) and applied alongside the groups client.
 *
 * The settings page itself is NOT the vendored compiled component: the factory
 * receives `remoteSshCompose`, whose `createSettingsSection` builds the
 * maintainable React section from src/client/rssh-settings. Its dictionary
 * namespace and CSS live in this entry because the merged package owns them
 * (the vendored half only knows its upstream keys/styles).
 *
 * The inject list is the union of both halves (remote-ssh's `slots`/`locale`
 * are a subset of the groups list).
 */
import type { Context } from '@deepseek-ai/cordis'
import * as groupsClient from './groups-client.ts'
import remoteSshFactory from './remote-ssh-factory.generated.mjs'
import { SETTINGS_NS, registerSettingsLocale } from './rssh-settings/i18n.ts'
import { createSettingsSection } from './rssh-settings/index.tsx'
import { SETTINGS_CSS } from './rssh-settings/styles.ts'
import type { RemoteSshClientCompose } from './rssh-settings/contract.ts'

/** Services required before mounting (union of both client halves). */
export const inject = ['slots', 'sessions', 'workspaces', 'uiWorkspace', 'locale']

/** Seam handed to the extracted vendored factory (settings face replacement). */
const remoteSshCompose: RemoteSshClientCompose = {
  settingsNamespace: SETTINGS_NS,
  createSettingsSection: (deps) => createSettingsSection({ api: deps.api }),
}

/** Instantiate the vendored remote-ssh client plugin exactly once. */
const remoteSshClient = remoteSshFactory(id => require(id), remoteSshCompose)

/** Plugin body: apply both client halves on this bundle's fiber. */
export function apply(ctx: Context): void {
  // The settings section declares `locale: SETTINGS_NS`, so the dictionary
  // face must be installed before the vendored half registers that slot entry.
  // (Slot rendering requires an installed locale face; registration also bumps
  // the revision so an already-mounted settings page picks the texts up.)
  ctx.effect(
    () => registerSettingsLocale(ctx.locale),
    'workspace-groups-remote: remote-ssh settings dictionaries',
  )

  // Section styles: injected once, scoped under `.rsui-root` (no global
  // selectors), removed with the fiber. `?inline` is compiled by tsdown.
  ctx.effect(() => {
    if (SETTINGS_CSS.trim() === '') return () => {}
    const style = document.createElement('style')
    style.setAttribute('data-plugin', 'workspace-groups-remote/remote-ssh-settings')
    style.textContent = SETTINGS_CSS
    document.head.appendChild(style)
    return () => { style.remove() }
  }, 'workspace-groups-remote: remote-ssh settings styles')

  groupsClient.apply(ctx)
  remoteSshClient.apply(ctx)
}
