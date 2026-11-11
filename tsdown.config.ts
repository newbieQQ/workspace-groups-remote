/**
 * tsdown build for dsh-workspace-groups: the host-half lib (lib/index.js, ESM
 * node) plus one browser client bundle (lib/client.js, CJS closure factory).
 *
 * The client bundle replicates the official DSH client-bundle preset
 * (packages/client/tsdown.client.ts, same shape as dsh-better-sidebar and the
 * official ui-* client packages):
 * - externals resolve through the loader module table at runtime (the
 *   PLATFORM_MODULES seed list from packages/client/web/src/platform.ts,
 *   plus the runtime/client exemption),
 * - everything else is inlined into the bundle,
 * - the purity gate rejects any other @deepseek-ai value import: cross-plugin
 *   collaboration goes through cordis services / slots, never value imports,
 * - CSS Modules compile to hashed class maps and inject <style data-plugin>
 *   tags at factory execution,
 * - the artifact registers itself via window.__ModuleLoader__.load({id,
 *   factory}) with the (require) => exports CJS closure shape.
 *
 * Types ship from lib/types (tsc -p tsconfig.build.json), not from tsdown.
 */
import { existsSync, readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, resolve as resolvePath, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { builtinModules } from 'node:module'
import type { UserConfig } from 'tsdown'
import { transform } from 'lightningcss'

/**
 * The client bundle banner MUST register under the package name: client-modules
 * keys its graph rows by package name, so a banner id that differs makes the
 * row look unregistered (the row is then re-fetched, hits `register()` a second
 * time and throws "duplicate factory registration", failing the whole boot).
 * Read the name instead of hardcoding it — the package has been renamed once
 * already (`@dsh-xhl/workspace-groups` -> `workspace-groups-local`).
 */
const PACKAGE_NAME: string = (
  JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')) as { name: string }
).name

/** Node builtins must never survive into the browser module-loader factory. */
const NODE_BUILTINS = new Set([
  ...builtinModules,
  ...builtinModules.map(id => `node:${id}`),
])

/** Module specifiers the web shell shares into the frozen module table (the official PLATFORM_MODULES list, plus the runtime/client exemption). */
const CLIENT_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  // `defineStore` / store handle types. In the current shell the store runtime is
  // the module-table row `@deepseek-ai/dsh-client-store`: official plugins load it
  // exactly this way (e.g. `@deepseek-ai/dsh-api-job-controller/lib/client.js`
  // does `require("@deepseek-ai/dsh-client-store")`). The older
  // `@deepseek-ai/dsh-client-runtime/client` row is kept for compatibility with
  // plugins built before the rename.
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-runtime/client',
] as const

/** Requested-from-module-table specifiers (kept as imports, never inlined). */
function isRequested(specifier: string): boolean {
  return (CLIENT_EXTERNALS as readonly string[]).includes(specifier)
}

const INLINE_CSS_QUERY = '?inline'
const CSS_VIRTUAL_PREFIX = '\0dsh-workspace-groups-inline-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** Resolve a relative import to a physical stylesheet (tsdown consumes src/ sources). */
function sourceAssetPath(source: string, importer: string): string {
  const abs = resolvePath(dirname(importer), source)
  if (existsSync(abs)) return abs
  return source
}

/** Node half: host plugin (reads the sidecar YAML, serves /workspace-groups config). */
function nodeConfig(): UserConfig {
  return {
    name: 'dsh-workspace-groups',
    // The composition wrapper (bundle/index.js) ships as lib/index.js;
    // the groups host half builds to lib/groups.js beside it.
    entry: { groups: 'src/index.ts' },
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2022',
    fixedExtension: false,
    dts: false,
    clean: false,
    deps: {
      alwaysBundle: (specifier: string) => {
        // js-yaml is the one runtime dependency; bundle it so the artifact is
        // self-contained (link installs carry no node_modules guarantees).
        return !NODE_BUILTINS.has(specifier)
      },
    },
  }
}

/** Browser half: client bundle, wrapped as __ModuleLoader__.load. */
function clientConfig(): UserConfig {
  return {
    name: 'dsh-workspace-groups/client',
    entry: { client: 'src/client/index.ts' },
    // Shares lib/ with the node half (entryFileNames pins lib/client.js;
    // clean is off so the node output survives).
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2022',
    sourcemap: true,
    dts: false,
    clean: false,
    deps: {
      neverBundle: isRequested,
      alwaysBundle: (specifier: string) => !isRequested(specifier),
    },
    plugins: [
      {
        // Build-time purity gate (mirror of the module-table boundary):
        // @deepseek-ai/* value imports only through the module-table rows;
        // cross-plugin value imports are build errors (type-only imports are
        // erased and never reach this gate).
        name: 'dsh-workspace-groups-client-purity',
        resolveId(source: string) {
          if (!source.startsWith('@deepseek-ai/')) return null
          if (isRequested(source)) return null
          throw new Error(
            `client bundle purity: "${source}" is not a platform module — `
            + 'cross-plugin value imports are forbidden (type-only imports are erased)',
          )
        },
      },
      {
        // `*.css?inline` -> compiled CSS text; the plugin injects/cleans it via ctx.effect.
        name: 'dsh-workspace-groups-css-inline',
        resolveId(source: string, importer: string | undefined) {
          if (!source.endsWith(`.css${INLINE_CSS_QUERY}`)) return null
          const stylesheet = source.slice(0, -INLINE_CSS_QUERY.length)
          const abs = importer !== undefined && isAbsolute(stylesheet)
            ? stylesheet
            : importer !== undefined
              ? sourceAssetPath(stylesheet, importer)
              : stylesheet
          return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
        },
        async load(virtualId: string) {
          if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
          const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
          this.addWatchFile(fileId)
          const source = await readFile(fileId)
          const { code } = transform({ filename: fileId, code: source, minify: true })
          return `export default ${JSON.stringify(code.toString())};`
        },
      },
    ],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PACKAGE_NAME)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  }
}

export default [nodeConfig(), clientConfig()]
