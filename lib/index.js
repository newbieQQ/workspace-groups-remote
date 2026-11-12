/**
 * workspace-groups-remote — merged bundle host entry (composition only).
 *
 * Applies the two co-resident plugins on this bundle's fiber so a single
 * install row loads both:
 *
 * - workspace-groups (./groups.js): the grouped workspace browser's host
 *   half — serves /workspace-groups/* config routes. Built from src/ by
 *   tsdown; its code is unchanged from the standalone package.
 * - dsh-remote-ssh (./remote-ssh/index.js): the SSH remote-development
 *   host half, vendored byte-identical from vendor/dsh-remote-ssh. It is
 *   deliberately NOT bundled: it must resolve @deepseek-ai/schemastery
 *   (and dsh-tools) from the host's module table — its Config schema
 *   relies on the DSH-branch schemastery `.volatile()` marker, which a
 *   bundled private copy would not share with the Loader.
 *
 * The bundle row's config IS the remote-ssh prefs object: the composed
 * plugin exports remote-ssh's Config schema (below), so this row owns the
 * settings entry the remote-ssh settings face reads and writes (its entry
 * id resolves to this bundle's row — see the settings patch in
 * scripts/patch-remote-ssh.mjs). The groups half takes no row config.
 * (Pre-1.0.2 the row config nested under a `remoteSsh` key and the face
 * looked for a `dsh-remote-ssh` entry that a merged install does not
 * have, so saving any connection failed with "No configurable plugin
 * entry". No bundle-era data was ever stored in the nested shape —
 * saving was impossible — so flattening loses nothing.)
 */
import * as groups from './groups.js'
import * as remoteSsh from './remote-ssh/index.js'

const groupsPlugin = { name: groups.name, inject: groups.inject, apply: groups.apply }
const remoteSshPlugin = { name: remoteSsh.name, inject: remoteSsh.inject, Config: remoteSsh.Config, apply: remoteSsh.apply }

/** Plugin identity for cordis.yml rows. */
export const name = 'workspace-groups-remote'

/** Services required before mounting (union of both halves). */
export const inject = ['webServer', 'subprocess', 'tools', 'workspaceRegistry']

/** The row's settings schema: remote-ssh's own Config (prefs object). */
export const Config = remoteSsh.Config

/** Plugin body: mount both halves on this fiber. */
export function apply(ctx, config = {}) {
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new Error('workspace-groups-remote: the row config must be an object (it is the @zhangfengshun/dsh-remote-ssh prefs object)')
  }
  ctx.plugin(groupsPlugin)
  ctx.plugin(remoteSshPlugin, config)
}
