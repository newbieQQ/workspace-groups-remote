/**
 * dsh-workspace-groups host half: serves the sidecar grouping config to the
 * browser half and persists the runtime grouping overlay.
 *
 * Routes:
 * - `GET /workspace-groups/config` — snapshot of the YAML rule categories
 *   merged with the runtime manual overlay (groups + assignments). Read-only
 *   for the rules; the overlay is attached so one fetch boots the browser.
 * - `GET /workspace-groups/tabs` — the persisted session-tab strip (host-side
 *   sidecar; see host-tabs.ts for why it cannot live in the browser).
 * - `PUT /workspace-groups/tabs` — replace the stored strip whole.
 * - `PUT /workspace-groups/manual` — replace the whole manual overlay
 *   (manual groups + per-workspace overrides). Validated against the current
 *   rule categories, written atomically to the plugin-owned JSON sidecar.
 * - `GET /workspace-groups/folders` — the per-workspace extra-folder overlay
 *   plus each workspace's root folder.
 * - `PUT /workspace-groups/folders` — replace the folder overlay whole.
 *   Strictly validated (absolute paths, no duplicates, root membership) and
 *   written atomically; the saved document is echoed back.
 * - `POST /workspace-groups/folders` — deprecated; returns 410 without reading
 *   the payload or touching remote-ssh records.
 *
 * - `GET /workspace-groups/remote-hint?path=...` — presence-only marker hint
 *   at the requested absolute path or ancestors; never returns marker content.
 *
 * Core workspace.json / session storage is never touched.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { GroupsContext } from './context-types.ts'
import { defaultConfigPath, readGroupsConfig } from './host-config.ts'
import {
  defaultManualPath,
  parseManualGroups,
  readManualGroups,
  validateManualGroups,
  writeManualGroups,
} from './host-manual.ts'
import {
  defaultTabsPath,
  documentForTabs,
  parsePersistedTab,
  readTabsDocument,
  writeTabsDocument,
  type PersistedTab,
  type TabsDocument,
} from './host-tabs.ts'
import {
  defaultFoldersPath,
  defaultRemoteMirrorBase,
  hasRemoteMarkerHint,
  readFoldersDocument,
  validateFoldersDocument,
  validateRemoteHintPath,
  writeFoldersDocument,
} from './host-folders.ts'

/** Plugin identity for cordis.yml rows. */
export const name = 'workspace-groups-local'

/** Services required before mounting: the webserver route. */
export const inject = ['webServer']

/** Cap on the PUT body: the overlay is tiny; anything bigger is a client bug. */
const MAX_MANUAL_BODY_BYTES = 64 * 1024

/** Error with an HTTP status, mapped to a plain-text 4xx/5xx response. */
class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message)
  }
}

/**
 * Shape-validate a PUT /tabs body.
 *
 * Returns null on a malformed payload rather than throwing, so the route can
 * answer 400 without a try/catch around the parse. Individual bad tab rows are
 * dropped (the strip is a display cache; one bad row must not reject a whole
 * write), and duplicate session ids are collapsed to the first.
 *
 * @param raw - parsed request body.
 * @returns the payload, or null when the envelope is unusable.
 */
function parseTabsPayload(raw: unknown): { order: number; tabs: PersistedTab[] } | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null
  const source = raw as Record<string, unknown>
  if (typeof source.order !== 'number' || !Number.isFinite(source.order)) return null
  if (!Array.isArray(source.tabs)) return null
  const tabs: PersistedTab[] = []
  const seen = new Set<string>()
  for (const entry of source.tabs) {
    const tab = parsePersistedTab(entry)
    if (tab === null) continue
    if (seen.has(tab.sessionId)) continue
    seen.add(tab.sessionId)
    tabs.push(tab)
  }
  return { order: source.order, tabs }
}

/** Write a plain-text error response with the given status. */
function writeError(res: ServerResponse, status: number, message: string): void {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' })
  res.end(message)
}

/** Collect the request body as UTF-8 text, rejecting oversized bodies. */
async function readBody(req: IncomingMessage, limit: number): Promise<string> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > limit) throw new HttpError(413, 'request body too large')
    chunks.push(buffer)
  }
  if (chunks.length === 0) throw new HttpError(400, 'empty request body')
  return Buffer.concat(chunks).toString('utf8')
}

/** Plugin body: mount the config snapshot route and the overlay write route. */
export function apply(ctx: GroupsContext): void {
  const configPath = defaultConfigPath()
  const manualPath = defaultManualPath()
  const tabsPath = defaultTabsPath()
  const foldersPath = defaultFoldersPath()

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/workspace-groups/config',
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        writeError(res, 405, 'method not allowed')
        return
      }
      let config
      let manual
      try {
        ;[config, manual] = await Promise.all([
          readGroupsConfig(configPath),
          readManualGroups(manualPath),
        ])
      } catch (error) {
        writeError(res, 500, `workspace-groups: failed to read config: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      const body = JSON.stringify({ ...config, manual })
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Content-Length': Buffer.byteLength(body),
      })
      res.end(req.method === 'HEAD' ? undefined : body)
    },
  }), '@dsh-xhl/workspace-groups: /workspace-groups/config route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/workspace-groups/tabs',
    handler: async (req, res) => {
      if (req.method === 'GET' || req.method === 'HEAD') {
        let stored: TabsDocument | null
        try {
          stored = await readTabsDocument(tabsPath)
        } catch (error) {
          writeError(res, 500, `workspace-groups: failed to read tabs: ${error instanceof Error ? error.message : String(error)}`)
          return
        }
        const body = JSON.stringify({ tabs: stored?.tabs ?? [] })
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Length': Buffer.byteLength(body),
        })
        res.end(req.method === 'HEAD' ? undefined : body)
        return
      }
      if (req.method !== 'PUT') {
        writeError(res, 405, 'method not allowed')
        return
      }
      let raw: unknown
      try {
        raw = JSON.parse(await readBody(req, MAX_MANUAL_BODY_BYTES))
      } catch (error) {
        const status = error instanceof HttpError ? error.status : 400
        writeError(res, status, `workspace-groups: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      const parsed = parseTabsPayload(raw)
      if (parsed === null) {
        writeError(res, 400, 'workspace-groups: malformed tabs payload')
        return
      }
      try {
        await writeTabsDocument(tabsPath, documentForTabs(parsed))
      } catch (error) {
        writeError(res, 500, `workspace-groups: failed to write tabs: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      const body = JSON.stringify({ ok: true })
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(body),
      })
      res.end(body)
    },
  }), '@dsh-xhl/workspace-groups: /workspace-groups/tabs route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/workspace-groups/manual',
    handler: async (req, res) => {
      if (req.method !== 'PUT') {
        writeError(res, 405, 'method not allowed')
        return
      }
      let raw: unknown
      try {
        raw = JSON.parse(await readBody(req, MAX_MANUAL_BODY_BYTES))
      } catch (error) {
        const status = error instanceof HttpError ? error.status : 400
        writeError(res, status, `workspace-groups: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      let manual
      try {
        manual = parseManualGroups(raw)
        // The write boundary knows the current rule set; reject assignments
        // into categories that exist nowhere (catches stale client state).
        const ruleConfig = (await readGroupsConfig(configPath)).categories
        validateManualGroups(manual, ruleConfig.map(category => category.name))
      } catch (error) {
        writeError(res, 400, `workspace-groups: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      // Optimistic concurrency, same contract as the folder overlay: a stale
      // writer gets the current overlay back with 409 instead of silently
      // overwriting another window's edits.
      let current
      try {
        current = await readManualGroups(manualPath)
      } catch {
        current = { categories: [], assignments: {} }
      }
      if ((manual.revision ?? 0) !== (current.revision ?? 0)) {
        const body = JSON.stringify({ manual: current })
        res.writeHead(409, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Length': Buffer.byteLength(body),
        })
        res.end(body)
        return
      }
      const stored = { ...manual, revision: (current.revision ?? 0) + 1 }
      try {
        await writeManualGroups(manualPath, stored)
      } catch (error) {
        writeError(res, 500, `workspace-groups: failed to write manual overlay: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      const body = JSON.stringify({ ok: true, manual: stored })
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(body),
      })
      res.end(body)
    },
  }), '@dsh-xhl/workspace-groups: /workspace-groups/manual route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/workspace-groups/remote-hint',
    handler: async (req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        writeError(res, 405, 'method not allowed')
        return
      }
      let path: string
      try {
        const url = new URL(req.url ?? '', 'http://localhost')
        path = validateRemoteHintPath(url.searchParams.get('path'))
      } catch {
        writeError(res, 400, 'workspace-groups: invalid remote hint path')
        return
      }
      let remoteHint: boolean
      try {
        remoteHint = await hasRemoteMarkerHint(path)
      } catch {
        writeError(res, 500, 'workspace-groups: failed to inspect remote hint; local fallback is unsafe')
        return
      }
      const body = JSON.stringify({ remoteHint })
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(body),
      })
      res.end(req.method === 'HEAD' ? undefined : body)
    },
  }), '@dsh-xhl/workspace-groups: /workspace-groups/remote-hint route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/workspace-groups/folders',
    handler: async (req, res) => {
      if (req.method === 'GET' || req.method === 'HEAD') {
        // The reader is tolerant by construction (a missing or torn sidecar is
        // the empty document), so it cannot fail a GET. `remoteBase` rides along
        // so the browser knows which projects are remote-ssh mirrors and must
        // only accept subdirectories of their own mirror as extra folders.
        const document = await readFoldersDocument(foldersPath)
        const body = JSON.stringify({ ...document, remoteBase: defaultRemoteMirrorBase() })
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Length': Buffer.byteLength(body),
        })
        res.end(req.method === 'HEAD' ? undefined : body)
        return
      }
      if (req.method === 'POST') {
        // Child markers neither register model-tool context nor preserve the
        // parent's writeBack guard. Never read, write or remove any marker.
        writeError(res, 410, 'workspace-groups: remote marker creation is deprecated; use the registered remote workspace root')
        return
      }
      if (req.method !== 'PUT') {
        writeError(res, 405, 'method not allowed')
        return
      }
      let raw: unknown
      try {
        raw = JSON.parse(await readBody(req, MAX_MANUAL_BODY_BYTES))
      } catch (error) {
        const status = error instanceof HttpError ? error.status : 400
        writeError(res, status, `workspace-groups: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      let document
      try {
        document = validateFoldersDocument(raw)
      } catch (error) {
        writeError(res, 400, `workspace-groups: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      // Optimistic concurrency: the write must build on the current stored
      // revision. A stale writer (a second window holding an older document)
      // gets the current document back with 409 instead of silently
      // overwriting the other window's edits.
      const current = await readFoldersDocument(foldersPath)
      if ((document.revision ?? 0) !== (current.revision ?? 0)) {
        const body = JSON.stringify(current)
        res.writeHead(409, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Content-Length': Buffer.byteLength(body),
        })
        res.end(body)
        return
      }
      const stored = { ...document, revision: (current.revision ?? 0) + 1 }
      try {
        await writeFoldersDocument(foldersPath, stored)
      } catch (error) {
        writeError(res, 500, `workspace-groups: failed to write folder overlay: ${error instanceof Error ? error.message : String(error)}`)
        return
      }
      // Echo the normalized document: the client renders exactly what the host
      // accepted, not its own (possibly trimmed) guess.
      const body = JSON.stringify(stored)
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Content-Length': Buffer.byteLength(body),
      })
      res.end(body)
    },
  }), '@dsh-xhl/workspace-groups: /workspace-groups/folders route')
}
