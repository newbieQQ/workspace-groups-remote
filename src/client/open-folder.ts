/**
 * Transport for the official open-in-app host routes served by
 * `@deepseek-ai/dsh-host-open-in-app`. The project row offers "open this
 * project's folder" by asking that host half for the applications it verified
 * as installed, then POSTing the launcher it already resolved — this plugin
 * never probes or spawns a launcher itself, and a host without the capability
 * (no resolved application, e.g. an SSH launch) simply yields no menu entry.
 */

/** GET route serving the probed application ids (host-owned constant). */
export const OPEN_IN_APP_APPS_ROUTE = '/open-in-app/apps'

/** POST route launching one resolved application on one absolute directory. */
export const OPEN_IN_APP_OPEN_ROUTE = '/open-in-app/open'

/**
 * Catalog ids that open a directory in the platform file manager, most
 * specific first (the official catalog names one per platform: `explorer` on
 * Windows, `finder` on macOS, `filemanager` on Linux).
 */
const FOLDER_APP_IDS = ['explorer', 'finder', 'filemanager'] as const

/**
 * The installed file-manager id for this host, or undefined when the host
 * resolved none (the row then offers no "open in folder" entry).
 * @param apps - installed catalog ids from the apps route.
 * @returns the preferred available id.
 */
export function folderAppId(apps: readonly string[]): string | undefined {
  for (const id of FOLDER_APP_IDS) {
    if (apps.includes(id)) return id
  }
  return undefined
}

/**
 * Resolve the browser's Host base with the connection carrier's null-origin
 * fallback (same rule the official button uses): a sandboxed document reports
 * the literal origin "null", which cannot address the host.
 * @returns the absolute base URL of the current Host.
 */
function hostBase(): string {
  const origin = globalThis.location?.origin
  return origin !== undefined && origin !== 'null' ? origin : 'http://dsh.internal'
}

/**
 * Read the host's installed-application ids. A host without the capability
 * (or one that refuses) reads as an empty list rather than an error, so the
 * caller can treat "no apps" and "no route" identically.
 * @param signal - aborts the read when the browser half unmounts.
 * @returns installed catalog ids, in host menu order.
 */
export async function fetchOpenInApps(signal?: AbortSignal): Promise<readonly string[]> {
  const response = await fetch(new URL(OPEN_IN_APP_APPS_ROUTE, hostBase()), {
    headers: { accept: 'application/json' },
    cache: 'no-store',
    ...(signal === undefined ? {} : { signal }),
  })
  if (!response.ok) throw new Error(`open-in-app apps request failed: ${response.status}`)
  const payload: unknown = await response.json()
  const apps = (payload as { apps?: unknown }).apps
  return Array.isArray(apps) ? apps.filter((id): id is string => typeof id === 'string') : []
}

/**
 * Launch one installed application on one absolute directory.
 * @param appId - catalog id from the apps route.
 * @param path - the project's absolute directory.
 * @returns after the host acknowledged the launch; rejects on any refusal.
 */
export async function openPathInApp(appId: string, path: string): Promise<void> {
  const response = await fetch(new URL(OPEN_IN_APP_OPEN_ROUTE, hostBase()), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app: appId, path }),
  })
  if (!response.ok) throw new Error(`open-in-app launch failed: ${response.status}`)
}
