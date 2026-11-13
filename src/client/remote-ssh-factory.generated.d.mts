import type { Context } from '@deepseek-ai/cordis'
import type { RemoteSshClientCompose } from './rssh-settings/contract.ts'

/** The plugin object the vendored dsh-remote-ssh client factory returns. */
export interface RemoteSshClientPlugin {
  apply(ctx: Context): void
  inject?: string[]
}

/**
 * Merged-bundle factory shape: the module-loader factory from
 * vendor/dsh-remote-ssh/lib/client.js, re-exported by
 * scripts/build-remote-ssh-client.mjs as remote-ssh-factory.generated.mjs.
 *
 * `compose` is the merged entry's seam (settings namespace + settings section
 * component factory). Omit it and the factory falls back to the vendored
 * settings face — the transform keeps that path for harnesses and old entries.
 */
export default function remoteSshClientFactory(
  require: (id: string) => unknown,
  compose?: RemoteSshClientCompose,
): RemoteSshClientPlugin
