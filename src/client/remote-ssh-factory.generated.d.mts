import type { Context } from '@deepseek-ai/cordis'

/** The plugin object the vendored dsh-remote-ssh client factory returns. */
export interface RemoteSshClientPlugin {
  apply(ctx: Context): void
  inject?: string[]
}

/**
 * Upstream factory shape: the module-loader factory from
 * vendor/dsh-remote-ssh/lib/client.js, re-exported by
 * scripts/build-remote-ssh-client.mjs as remote-ssh-factory.generated.mjs.
 */
export default function remoteSshClientFactory(
  require: (id: string) => unknown,
): RemoteSshClientPlugin
