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
 * Row config nests per plugin: { remoteSsh: { ... } } reaches the
 * remote-ssh plugin; the groups half takes no row config. (Remote-ssh
 * connection profiles live in the DSH settings namespace `dsh-remote-ssh`
 * either way — merging changes nothing about stored data.)
 */
import * as groups from './groups.js'
import * as remoteSsh from './remote-ssh/index.js'

const groupsPlugin = { name: groups.name, inject: groups.inject, apply: groups.apply }
const remoteSshPlugin = { name: remoteSsh.name, inject: remoteSsh.inject, Config: remoteSsh.Config, apply: remoteSsh.apply }

/** Plugin identity for cordis.yml rows. */
export const name = 'workspace-groups-remote'

/** Services required before mounting (union of both halves). */
export const inject = ['webServer', 'subprocess', 'tools', 'workspaceRegistry']

/** Plugin body: mount both halves on this fiber. */
export function apply(ctx, config = {}) {
  const remoteSshConfig = config?.remoteSsh ?? {}
  if (typeof remoteSshConfig !== 'object' || remoteSshConfig === null || Array.isArray(remoteSshConfig)) {
    throw new Error('workspace-groups-remote: the remoteSsh row config must be an object (it is passed through to @zhangfengshun/dsh-remote-ssh)')
  }
  ctx.plugin(groupsPlugin)
  ctx.plugin(remoteSshPlugin, remoteSshConfig)
}
