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
import type { Context } from '@deepseek-ai/cordis';
/** Services required before mounting (union of both client halves). */
export declare const inject: string[];
/** Plugin body: apply both client halves on this bundle's fiber. */
export declare function apply(ctx: Context): void;
