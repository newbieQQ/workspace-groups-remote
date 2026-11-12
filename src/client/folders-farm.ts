/**
 * Client side of the farm route.
 *
 * A farm is one real directory holding a link per project folder, so a session
 * can read and write all of them at once. The host owns the filesystem work;
 * this module only speaks the two requests, and never assumes success: every
 * failure comes back as an Error with the host's own message.
 */
export const FARM_ROUTE = '/workspace-groups/farm'
const FARM_TIMEOUT_MS = 20_000

export interface FarmLink {
  /** Entry name inside the farm directory. */
  readonly name: string
  /** Absolute real path of the folder it points at. */
  readonly target: string
}

export interface FarmResult {
  /** Absolute path of the farm directory. */
  readonly path: string
  readonly links: readonly FarmLink[]
}

function hostMessage(body: unknown, fallback: string): string {
  if (typeof body === 'object' && body !== null) {
    const message = (body as { error?: unknown }).error
    if (typeof message === 'string' && message !== '') return message
  }
  return fallback
}

async function failure(response: Response, action: string): Promise<Error> {
  let body: unknown
  try {
    body = await response.json()
  } catch {
    body = null
  }
  return new Error(hostMessage(body, `${action}: HTTP ${response.status}`))
}

function parseFarm(body: unknown): FarmResult | null {
  if (typeof body !== 'object' || body === null) return null
  const source = body as { path?: unknown; links?: unknown }
  if (typeof source.path !== 'string' || source.path === '') return null
  if (!Array.isArray(source.links)) return null
  const links: FarmLink[] = []
  for (const entry of source.links) {
    if (typeof entry !== 'object' || entry === null) return null
    const link = entry as { name?: unknown; target?: unknown }
    if (typeof link.name !== 'string' || link.name === '') return null
    if (typeof link.target !== 'string' || link.target === '') return null
    links.push({ name: link.name, target: link.target })
  }
  return { path: source.path, links }
}

/** Build a farm for `folders`; the host refuses to reuse an existing one. */
export async function buildFarm(
  name: string,
  folders: readonly string[],
  fetchImpl: typeof fetch = fetch,
): Promise<FarmResult> {
  const response = await fetchImpl(FARM_ROUTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, folders }),
    signal: AbortSignal.timeout(FARM_TIMEOUT_MS),
  })
  if (!response.ok) throw await failure(response, 'POST /workspace-groups/farm')
  const parsed = parseFarm(await response.json())
  if (parsed === null) throw new Error('POST /workspace-groups/farm: malformed response')
  return parsed
}

/** Remove a farm; only its links are unlinked, never a real folder. */
export async function removeFarm(
  farmPath: string,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const response = await fetchImpl(`${FARM_ROUTE}?path=${encodeURIComponent(farmPath)}`, {
    method: 'DELETE',
    signal: AbortSignal.timeout(FARM_TIMEOUT_MS),
  })
  if (!response.ok) throw await failure(response, 'DELETE /workspace-groups/farm')
}
