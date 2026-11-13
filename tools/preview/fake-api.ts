/**
 * Fake `/remote-ssh/api/*` data layer for the ISOLATED preview.
 *
 * This never talks to the real Host. Every response is local, deterministic
 * and in-memory, so the preview screenshots show the real component rendered
 * against controlled data (including the failure states the real API can
 * produce). No real password or private key ever exists here: password
 * profiles only carry `passwordConfigured: true` (the redacted projection the
 * Host actually returns).
 */
import type {
  DeleteProfileResponse,
  DeleteWorkspaceResponse,
  GetPrefsResponse,
  ListProfilesResponse,
  ListSshConfigHostsResponse,
  ListWorkspacesResponse,
  RemoteSshApi,
  RemoteSshPrefs,
  RemoteSshProfile,
  RemoteSshWorkspace,
  SavePrefsPayload,
  SavePrefsResponse,
  SaveProfilePayload,
  SaveProfileResponse,
  SshConfigHost,
  SyncResponse,
  TestConnectionResponse,
  UpdateWorkspaceGuardsPayload,
  UpdateWorkspaceGuardsResponse,
} from '../../src/client/rssh-settings/contract.ts'

export type PreviewScene =
  | 'default'
  | 'expanded'
  | 'import-ready'
  | 'import-partial'
  | 'workspaces'
  | 'password'
  | 'test-failure'

export const PREVIEW_SCENES: readonly PreviewScene[] = [
  'default',
  'expanded',
  'import-ready',
  'import-partial',
  'workspaces',
  'password',
  'test-failure',
] as const

export function isPreviewScene(value: string): value is PreviewScene {
  return (PREVIEW_SCENES as readonly string[]).includes(value)
}

/** Deterministic latency so busy states appear, then settle (no polling of a clock). */
const API_LATENCY_MS = 130

const delay = (ms: number): Promise<void> =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms)
  })

/** Approximates the Host's redacted profile projection (no secrets). */
const BASE_PROFILES: RemoteSshProfile[] = [
  {
    id: 'conn-hpc',
    name: '超算集群',
    host: 'login.hpc.example.com',
    port: 22,
    user: 'demo-user',
    authMethod: 'key',
    keyPath: '~/.ssh/id_ed25519',
    remoteRoot: '~/project',
  },
  {
    id: 'conn-lab',
    name: '实验室工作站',
    host: 'workstation.lab.example.com',
    port: 22,
    user: 'lab-user',
    authMethod: 'password',
    passwordConfigured: true,
    remoteRoot: '/home/lab-user/work',
  },
  {
    id: 'conn-gpu',
    name: 'GPU 节点',
    host: 'gpu-node-01.cluster.internal.example.com',
    port: 2222,
    user: 'gpu-user',
    authMethod: 'key',
    keyPath: '~/.ssh/id_ed25519_gpu',
    remoteRoot: '~/scratch',
    proxyJump: 'bastion.example.com',
  },
]

const BASE_WORKSPACES: RemoteSshWorkspace[] = [
  {
    id: 'ws-hpc',
    profileId: 'conn-hpc',
    title: '项目 A',
    remotePath: '/home/demo-user/project-a',
    mirrorPath: 'C:\\Users\\demo\\remote-mirrors\\project-a',
    writeBack: true,
    writeBackExclude: ['data/', '*.log', '_patch/'],
    syncPaths: ['.dsh', 'src'],
    syncExclude: ['data/', 'node_modules/'],
    syncMaxBytes: 2 * 1024 * 1024 * 1024,
  },
  {
    id: 'ws-gpu',
    profileId: 'conn-gpu',
    title: '训练任务',
    remotePath: '/home/gpu-user/scratch/long-experiment-directory-name-for-wrapping-check',
    mirrorPath: 'C:\\Users\\demo\\remote-mirrors\\gpu-run',
    writeBack: false,
    writeBackExclude: ['runs/'],
    syncPaths: ['.dsh', 'configs'],
    syncExclude: ['runs/', '*.pt'],
    syncMaxBytes: 4 * 1024 * 1024 * 1024,
  },
]

const BASE_PREFS: RemoteSshPrefs = {
  nodePath: '',
  writeBackFailure: 'error',
  writeBackFreshness: true,
  defaultSyncPaths: ['.dsh'],
  defaultSyncExclude: ['node_modules/', '*.log'],
  defaultSyncMaxBytes: 0,
}

/** `~/.ssh/config` entries used by the import dialog scenarios. */
const SSH_CONFIG_HOSTS: SshConfigHost[] = [
  {
    name: 'hpc-login',
    hostName: 'login.hpc.example.com',
    port: 22,
    user: 'demo-user',
    identityFile: '~/.ssh/id_ed25519',
  },
  {
    name: 'gpu-lab',
    hostName: 'gpu-node-01.cluster.internal.example.com',
    port: 2222,
    user: 'gpu-user',
    identityFile: '~/.ssh/id_ed25519_gpu',
    proxyJump: 'bastion.example.com',
  },
  {
    name: 'bastion',
    hostName: 'bastion.example.com',
    user: 'jump-user',
    identityFile: '~/.ssh/id_ed25519',
  },
  {
    name: 'mirror',
    hostName: 'mirror.example.org',
    port: 2222,
    user: 'mirror-user',
    identityFile: '',
  },
  {
    name: 'broken-host',
    hostName: 'broken.example.net',
    user: '',
    identityFile: '',
  },
]

/** Hosts the `import-partial` scenario refuses to save on the first attempt. */
const PARTIAL_IMPORT_FAILURES: Record<string, string> = {
  'mirror.example.org': '保存失败：设置表写入被拒绝（示例错误）',
  'broken.example.net': '保存失败：主机条目缺少有效用户，Host 拒绝该配置（示例错误）',
}

const cloneProfiles = (profiles: RemoteSshProfile[]): RemoteSshProfile[] =>
  profiles.map(profile => ({ ...profile }))

const cloneWorkspaces = (workspaces: RemoteSshWorkspace[]): RemoteSshWorkspace[] =>
  workspaces.map(workspace => ({
    ...workspace,
    writeBackExclude: workspace.writeBackExclude ? [...workspace.writeBackExclude] : undefined,
    syncPaths: workspace.syncPaths ? [...workspace.syncPaths] : undefined,
    syncExclude: workspace.syncExclude ? [...workspace.syncExclude] : undefined,
  }))

/** Expose scenario/step counters for the screenshot script's assertions. */
interface FakeApiState {
  scene: PreviewScene
  calls: string[]
  mutations: number
}

declare global {
  interface Window {
    __RSH_PREVIEW_API__?: FakeApiState
    __RSH_PREVIEW_IDLE__?: boolean
    __RSH_PREVIEW_READY__?: boolean
  }
}

/**
 * Build the fake typed API. Individual endpoints behave like the Host:
 * `ok` flags, redacted profiles, per-item import failures, tests that can fail
 * with diagnostics, and preference/workspace mutations that persist in memory.
 */
export function createFakeApi(scene: PreviewScene): RemoteSshApi {
  const state: FakeApiState = { scene, calls: [], mutations: 0 }
  if (typeof window !== 'undefined') {
    window.__RSH_PREVIEW_API__ = state
    window.__RSH_PREVIEW_IDLE__ = true
  }

  let profiles = cloneProfiles(BASE_PROFILES)
  let workspaces = cloneWorkspaces(BASE_WORKSPACES)
  let prefs: RemoteSshPrefs = { ...BASE_PREFS }
  /** First attempt of each imported host (used by partial-import + retry). */
  const importAttempts = new Map<string, number>()

  let pending = 0
  let idleTimer: ReturnType<typeof setTimeout> | undefined

  const markBusy = (): void => {
    pending += 1
    if (typeof window !== 'undefined') window.__RSH_PREVIEW_IDLE__ = false
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = undefined
  }

  const markSettled = (): void => {
    pending = Math.max(0, pending - 1)
    if (pending > 0) return
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      idleTimer = undefined
      if (pending === 0 && typeof window !== 'undefined') window.__RSH_PREVIEW_IDLE__ = true
    }, 260)
  }

  const handle = async (method: string, args?: unknown): Promise<unknown> => {
    state.calls.push(method)
    markBusy()
    try {
      await delay(API_LATENCY_MS)
      switch (method) {
        case 'listProfiles': {
          const response: ListProfilesResponse = { ok: true, profiles: cloneProfiles(profiles) }
          return response
        }
        case 'saveProfile': {
          const payload = args as SaveProfilePayload
          const failingReason =
            scene === 'import-partial' && PARTIAL_IMPORT_FAILURES[payload.host] !== undefined
              ? PARTIAL_IMPORT_FAILURES[payload.host]
              : undefined
          if (payload.host in PARTIAL_IMPORT_FAILURES) {
            const attempts = (importAttempts.get(payload.host) || 0) + 1
            importAttempts.set(payload.host, attempts)
            if (attempts === 1 && failingReason) {
              const failed: SaveProfileResponse = { ok: false, error: failingReason }
              return failed
            }
          }
          state.mutations += 1
          const saved: RemoteSshProfile = {
            id: `import-${profiles.length + 1}`,
            name: payload.name || payload.host,
            host: payload.host,
            port: payload.port,
            user: payload.user,
            authMethod: payload.authMethod,
            keyPath: payload.keyPath || undefined,
            remoteRoot: payload.remoteRoot || undefined,
            proxyJump: payload.proxyJump || undefined,
            passwordConfigured: payload.authMethod === 'password' ? Boolean(payload.password) : undefined,
          }
          profiles = [...profiles, saved]
          const response: SaveProfileResponse = {
            ok: true,
            id: saved.id,
            profiles: cloneProfiles(profiles),
          }
          return response
        }
        case 'testConnection': {
          const id = String((args as { id?: string } | undefined)?.id || '')
          const profile = profiles.find(item => item.id === id) || profiles[0]
          if (scene === 'test-failure') {
            const failed: TestConnectionResponse = {
              ok: false,
              error: `ssh: connect to host ${profile?.host || 'login.hpc.example.com'} port ${
                profile?.port || 22
              }: Connection timed out`,
              stderr:
                `ssh: connect to host ${profile?.host || 'login.hpc.example.com'} port ${
                  profile?.port || 22
                }: Connection timed out\n` +
                'kex_exchange_identification: Connection closed by remote host\n' +
                'Connection closed by 203.0.113.10 port 22',
              exitCode: 255,
            }
            return failed
          }
          const ok: TestConnectionResponse = {
            ok: true,
            stdout: `Connected to ${profile?.host || 'login.hpc.example.com'} (${profile?.user || 'demo-user'})`,
            exitCode: 0,
          }
          return ok
        }
        case 'deleteProfile': {
          const id = String((args as { id?: string } | undefined)?.id || '')
          profiles = profiles.filter(item => item.id !== id)
          workspaces = workspaces.filter(item => item.profileId !== id)
          state.mutations += 1
          const response: DeleteProfileResponse = {
            ok: true,
            profiles: cloneProfiles(profiles),
            workspaces: cloneWorkspaces(workspaces),
          }
          return response
        }
        case 'listSshConfigHosts': {
          const response: ListSshConfigHostsResponse = { ok: true, hosts: SSH_CONFIG_HOSTS.map(host => ({ ...host })) }
          return response
        }
        case 'listWorkspaces': {
          const response: ListWorkspacesResponse = { ok: true, workspaces: cloneWorkspaces(workspaces) }
          return response
        }
        case 'updateWorkspaceGuards': {
          const payload = args as UpdateWorkspaceGuardsPayload
          workspaces = workspaces.map(workspace =>
            workspace.id === payload.id
              ? {
                  ...workspace,
                  writeBack: payload.writeBack,
                  writeBackExclude: [...payload.writeBackExclude],
                  syncPaths: [...payload.syncPaths],
                  syncExclude: [...payload.syncExclude],
                  syncMaxBytes: payload.syncMaxBytes,
                }
              : workspace,
          )
          state.mutations += 1
          const response: UpdateWorkspaceGuardsResponse = {
            ok: true,
            workspaces: cloneWorkspaces(workspaces),
          }
          return response
        }
        case 'syncDown':
        case 'syncUp': {
          state.mutations += 1
          const response: SyncResponse = { ok: true }
          return response
        }
        case 'deleteWorkspace': {
          const id = String((args as { id?: string } | undefined)?.id || '')
          workspaces = workspaces.filter(item => item.id !== id)
          state.mutations += 1
          const response: DeleteWorkspaceResponse = { ok: true, workspaces: cloneWorkspaces(workspaces) }
          return response
        }
        case 'getPrefs': {
          const response: GetPrefsResponse = { ok: true, prefs: { ...prefs, defaultSyncPaths: [...(prefs.defaultSyncPaths || [])], defaultSyncExclude: [...(prefs.defaultSyncExclude || [])] }, deleteSync: true }
          return response
        }
        case 'savePrefs': {
          const payload = args as SavePrefsPayload
          prefs = {
            nodePath: payload.nodePath,
            writeBackFailure: payload.writeBackFailure,
            writeBackFreshness: payload.writeBackFreshness,
            defaultSyncPaths: [...payload.defaultSyncPaths],
            defaultSyncExclude: [...payload.defaultSyncExclude],
            defaultSyncMaxBytes: payload.defaultSyncMaxBytes,
          }
          state.mutations += 1
          const response: SavePrefsResponse = { ok: true, prefs: { ...prefs } }
          return response
        }
        default: {
          return { ok: false, error: `fake api: unknown method ${method}` }
        }
      }
    } finally {
      markSettled()
    }
  }

  return handle as RemoteSshApi
}
