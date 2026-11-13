/**
 * Remote-SSH settings face — wire contract.
 *
 * The settings section is produced by this module and registered into the
 * shell's `settings.section` slot by the vendored remote-ssh client (see
 * scripts/build-remote-ssh-client.mjs). The module talks to the Host through
 * the SAME `/remote-ssh/api/*` JSON-RPC the vendored client uses: the merged
 * entry hands it the vendored client's own `api()` wrapper, so endpoint
 * names, envelopes and semantics stay byte-identical to upstream.
 *
 * Types below mirror the Host implementations in
 * vendor/dsh-remote-ssh/lib/index.js (api object around line 4641) and the
 * redacted profile projection (`publicProfiles`, line 37). They are a
 * compile-time description only; nothing here changes runtime behaviour.
 */
import type { ReactNode } from 'react'

/* ------------------------------------------------------------------ */
/* Host data shapes (as returned by /remote-ssh/api/*)                  */
/* ------------------------------------------------------------------ */

/** Redacted connection profile (`publicProfiles`: password stripped, boolean kept). */
export interface RemoteSshProfile {
  id: string
  name?: string
  host: string
  port?: number
  user: string
  authMethod?: 'key' | 'password'
  keyPath?: string
  remoteRoot?: string
  proxyJump?: string
  passwordConfigured?: boolean
}

/** One persisted remote workspace record (settingsFace.workspaces entry). */
export interface RemoteSshWorkspace {
  id: string
  profileId: string
  title?: string
  remotePath?: string
  mirrorPath?: string
  shellWorkspaceId?: string
  writeBack?: boolean
  writeBackExclude?: string[]
  syncPaths?: string[]
  syncExclude?: string[]
  syncMaxBytes?: number
}

/** One `~/.ssh/config` host entry (listSshConfigHosts projection). */
export interface SshConfigHost {
  name: string
  hostName: string
  port?: number
  user?: string
  identityFile?: string
  proxyJump?: string
}

/** Global preferences as rendered by the Host (getPrefs/savePrefs.prefs). */
export interface RemoteSshPrefs {
  nodePath?: string
  writeBackFailure?: string
  writeBackFreshness?: boolean
  defaultSyncPaths?: string[]
  defaultSyncExclude?: string[]
  defaultSyncMaxBytes?: number
}

/* ------------------------------------------------------------------ */
/* Request payloads (unchanged Host contract)                          */
/* ------------------------------------------------------------------ */

/**
 * saveProfile body. Every field the vendored settings face sent is kept:
 * `name`, `host`, `port`, `user`, `authMethod`, `keyPath`, `password`,
 * `remoteRoot`, `proxyJump`. `port` is already an integer here (the form
 * rejects invalid values instead of letting the Host fall back to 22).
 */
export interface SaveProfilePayload {
  name: string
  host: string
  port: number
  user: string
  authMethod: 'key' | 'password'
  keyPath: string
  password: string
  remoteRoot: string
  proxyJump: string
}

/** updateWorkspaceGuards body: per-workspace write-back and sync scope. */
export interface UpdateWorkspaceGuardsPayload {
  id: string
  writeBack: boolean
  writeBackExclude: string[]
  syncPaths: string[]
  syncExclude: string[]
  /** Bytes; 0 = Host built-in default cap (the old face always sent this). */
  syncMaxBytes: number
}

/** savePrefs body: global terminal / write-back / new-workspace defaults. */
export interface SavePrefsPayload {
  nodePath: string
  writeBackFailure: 'error' | 'log'
  writeBackFreshness: boolean
  defaultSyncPaths: string[]
  defaultSyncExclude: string[]
  defaultSyncMaxBytes: number
}

/* ------------------------------------------------------------------ */
/* Response shapes                                                     */
/* ------------------------------------------------------------------ */

export interface ListProfilesResponse {
  ok?: boolean
  profiles?: RemoteSshProfile[]
  error?: string
}

export interface SaveProfileResponse {
  ok?: boolean
  id?: string
  profiles?: RemoteSshProfile[]
  error?: string
}

export interface TestConnectionResponse {
  ok?: boolean
  warning?: string
  stdout?: string
  stderr?: string
  error?: string
  exitCode?: number
  truncated?: boolean
}

export interface DeleteProfileResponse {
  ok?: boolean
  profiles?: RemoteSshProfile[]
  workspaces?: RemoteSshWorkspace[]
  error?: string
}

export interface ListSshConfigHostsResponse {
  ok?: boolean
  hosts?: SshConfigHost[]
  error?: string
}

export interface ListWorkspacesResponse {
  ok?: boolean
  workspaces?: RemoteSshWorkspace[]
  error?: string
}

export interface UpdateWorkspaceGuardsResponse {
  ok?: boolean
  workspaces?: RemoteSshWorkspace[]
  error?: string
}

export interface SyncResponse {
  ok?: boolean
  error?: string
}

export interface DeleteWorkspaceResponse {
  ok?: boolean
  workspaces?: RemoteSshWorkspace[]
  error?: string
}

export interface GetPrefsResponse {
  ok?: boolean
  prefs?: RemoteSshPrefs
  deleteSync?: boolean
  error?: string
}

export interface SavePrefsResponse {
  ok?: boolean
  prefs?: RemoteSshPrefs
  error?: string
}

/**
 * Typed view of the vendored client's `api(method, args)` wrapper. The
 * wrapper resolves to the Host's `value` object (which always carries its
 * own `ok` flag) or `{ ok: false, error }` for transport failures.
 */
export interface RemoteSshApi {
  (method: 'listProfiles'): Promise<ListProfilesResponse>
  (method: 'saveProfile', args: SaveProfilePayload): Promise<SaveProfileResponse>
  (method: 'testConnection', args: { id: string }): Promise<TestConnectionResponse>
  (method: 'deleteProfile', args: { id: string }): Promise<DeleteProfileResponse>
  (method: 'listSshConfigHosts'): Promise<ListSshConfigHostsResponse>
  (method: 'listWorkspaces'): Promise<ListWorkspacesResponse>
  (method: 'updateWorkspaceGuards', args: UpdateWorkspaceGuardsPayload): Promise<UpdateWorkspaceGuardsResponse>
  (method: 'syncDown', args: { id: string }): Promise<SyncResponse>
  (method: 'syncUp', args: { id: string }): Promise<SyncResponse>
  (method: 'deleteWorkspace', args: { id: string }): Promise<DeleteWorkspaceResponse>
  (method: 'getPrefs'): Promise<GetPrefsResponse>
  (method: 'savePrefs', args: SavePrefsPayload): Promise<SavePrefsResponse>
}

/* ------------------------------------------------------------------ */
/* Translation + registration                                          */
/* ------------------------------------------------------------------ */

/** Bind of the settings dictionary namespace (typed keys, `{name}` params). */
export type SettingsTranslate = (key: string, params?: Record<string, string | number>) => string

/** Props the shell's `settings.section` renderer injects (locale `t` seat). */
export interface SettingsSectionProps {
  t?: SettingsTranslate
}

/** Registration shape accepted by the slot renderer (function component). */
export type SettingsSectionComponent = (props: SettingsSectionProps) => ReactNode

/** Runtime facts the merged client entry hands to the extracted factory. */
export interface RemoteSshClientCompose {
  /** Dictionary namespace the settings entry declares (`locale:` in the slot def). */
  readonly settingsNamespace: string
  /** Build the settings section component around the vendored client's `api`. */
  createSettingsSection(deps: SettingsSectionDeps): SettingsSectionComponent
}

/** Injected runtime services for the section (the vendored client's api wrapper). */
export interface SettingsSectionDeps {
  api: RemoteSshApi
}
