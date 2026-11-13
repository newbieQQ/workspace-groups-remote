/**
 * Remote-SSH settings section — new face (UI only).
 *
 * Design constraints that shape this file:
 * - ALL drafts live in this root component: the connection form, one guard
 *   draft per remote workspace (keyed by `workspace.id`), the advanced prefs
 *   draft, the import dialog state, per-card test results and busy flags.
 *   Nothing is persisted to browser storage; the password only lives in React
 *   state (never in localStorage/sessionStorage/cookie or logs).
 * - Every collapsible area keeps its content mounted and toggles `hidden`;
 *   folding therefore cannot drop typed input and never saves.
 * - Lists are refreshed through `model.reconcileGuards` / `model.reconcilePrefs`
 *   so an unrelated reload never overwrites unsaved drafts.
 * - All failure paths clear their busy flag in `finally`; a request can never
 *   leave the UI permanently loading.
 *
 * The section is created by `createSettingsSection({ api })`: the merged
 * client entry hands over the vendored remote-ssh `api()` wrapper, so endpoint
 * names and envelopes stay byte-identical to upstream.
 */
import { useEffect, useId, useState } from 'react'
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  RemoteSshApi,
  RemoteSshPrefs,
  RemoteSshProfile,
  RemoteSshWorkspace,
  SettingsSectionComponent,
  SettingsSectionProps,
  SettingsTranslate,
  SshConfigHost,
} from './contract.ts'
import {
  apiErrorMessage,
  connectionTestView,
  emptyConnectionForm,
  guardDraftFromWorkspace,
  importHostKey,
  isGuardDraftDirty,
  isPrefsDraftDirty,
  mergeImportRetry,
  prefsDraftFromApi,
  profileName,
  profileSummary,
  reconcileGuards,
  reconcilePrefs,
  runImport,
  selectAllHosts,
  selectedHosts,
  toSaveProfilePayload,
  toSavePrefsPayload,
  toUpdateWorkspaceGuardsPayload,
  toggleHostSelection,
  validateConnectionForm,
} from './model.ts'
import type { ConnectionForm, ConnectionTestView, GuardDraft, ImportSummary, PrefsDraft } from './model.ts'
import { CheckField, ChevronIcon, Field, Notice, SelectField, StatusIcon, TextAreaField } from './ui.tsx'

/** Options handed to the extracted factory by the merged client entry. */
export interface CreateSettingsSectionOptions {
  api: RemoteSshApi
}

/** Identity `t` seat: a missing translator returns keys verbatim (preview/tests). */
const identityTranslate: SettingsTranslate = key => key

interface Feedback {
  ok: boolean
  text: string
  detail?: string | undefined
}

interface ImportProgress {
  mode: 'import' | 'retry'
  done: number
  total: number
  name: string
}

interface GuardsState {
  drafts: Record<string, GuardDraft>
  baselines: Record<string, GuardDraft>
}

interface PrefsState {
  draft: PrefsDraft
  baseline: PrefsDraft
}

/** Unknown thrown value → readable text (never `[object Object]` or a raw token). */
function errorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message
  const text = String(error)
  return text === '' || text === '[object Object]' ? fallback : text
}

/** HTML-id-safe rendering of a workspace id (hosts may contain arbitrary text). */
function safeIdFragment(value: string): string {
  return value.replace(/[^0-9A-Za-z_-]/gu, '-')
}

/** Feedback block for one connection probe (success / warning / failure). */
function TestResultView({ view, t }: { view: ConnectionTestView; t: SettingsTranslate }) {
  return (
    <div
      className={`rsui-feedback rsui-feedback-${view.status}`}
      data-rsui-test-result
      data-status={view.status}
      role={view.status === 'error' ? 'alert' : 'status'}
    >
      <StatusIcon status={view.status} />
      <div className="rsui-feedback-body">
        <div className="rsui-feedback-title">{t(view.titleKey)}</div>
        {view.warning ? (
          <div className="rsui-feedback-line">
            <span className="rsui-feedback-prefix">{t('common.warning')}</span>
            <pre className="rsui-feedback-pre">{view.warning}</pre>
          </div>
        ) : null}
        {view.detail ? (
          <div className="rsui-feedback-line">
            {view.status === 'error'
              ? <span className="rsui-feedback-prefix">{t('common.error')}</span>
              : <span className="rsui-feedback-prefix rsui-feedback-prefix-soft">{t('connection.diagnostics')}</span>}
            <pre className="rsui-feedback-pre">{view.detail}</pre>
          </div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Build the settings section component around the injected API.
 * The returned component matches the shell's `settings.section` renderer
 * signature `(props: { t? }) => ReactNode`.
 */
export function createSettingsSection(options: CreateSettingsSectionOptions): SettingsSectionComponent {
  return function RemoteSshSettingsSection(props: SettingsSectionProps) {
    return <SettingsSectionRoot api={options.api} t={props.t} />
  }
}

/** Root: owns every draft and busy flag, renders every section. */
function SettingsSectionRoot({ api, t: translate }: { api: RemoteSshApi; t?: SettingsTranslate | undefined }) {
  const t = translate ?? identityTranslate
  const uid = useId().replace(/[^0-9A-Za-z_-]/gu, '')
  const id = (name: string): string => `rsui-${uid}-${name}`
  const workspaceFieldId = (workspaceId: string, name: string): string => `rsui-${uid}-ws-${safeIdFragment(workspaceId)}-${name}`

  /* ---- data: connections / workspaces / prefs ---- */
  const [profiles, setProfiles] = useState<RemoteSshProfile[]>([])
  const [profilesBusy, setProfilesBusy] = useState(false)
  const [profilesError, setProfilesError] = useState<string | null>(null)

  const [workspaces, setWorkspaces] = useState<RemoteSshWorkspace[]>([])
  const [workspacesBusy, setWorkspacesBusy] = useState(false)
  const [workspacesError, setWorkspacesError] = useState<string | null>(null)
  const [guards, setGuards] = useState<GuardsState>({ drafts: {}, baselines: {} })

  const [prefs, setPrefs] = useState<PrefsState>(() => {
    const initial = prefsDraftFromApi(null)
    return { draft: initial, baseline: initial }
  })
  const [prefsBusy, setPrefsBusy] = useState(false)
  const [prefsError, setPrefsError] = useState<string | null>(null)

  /* ---- add-connection form (all drafts here) ---- */
  const [form, setForm] = useState<ConnectionForm>(() => emptyConnectionForm())
  const [formTouched, setFormTouched] = useState<Record<string, boolean>>({})
  const [formShowErrors, setFormShowErrors] = useState(false)
  const [addOpen, setAddOpen] = useState(true)
  const [moreOpen, setMoreOpen] = useState(false)
  const [addBusy, setAddBusy] = useState(false)
  const [addNotice, setAddNotice] = useState<Feedback | null>(null)

  /* ---- per-connection test/delete state ---- */
  const [testBusy, setTestBusy] = useState<Record<string, boolean>>({})
  const [testResults, setTestResults] = useState<Record<string, ConnectionTestView>>({})
  const [profileConfirmId, setProfileConfirmId] = useState<string | null>(null)
  const [profileDeleteBusyId, setProfileDeleteBusyId] = useState<string | null>(null)
  const [profileNotices, setProfileNotices] = useState<Record<string, Feedback>>({})
  const [connectionNotice, setConnectionNotice] = useState<Feedback | null>(null)

  /* ---- ssh-config import dialog ---- */
  const [importOpen, setImportOpen] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [importHosts, setImportHosts] = useState<SshConfigHost[]>([])
  const [importSelected, setImportSelected] = useState<Record<string, boolean>>({})
  const [importBusy, setImportBusy] = useState(false)
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null)
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null)

  /* ---- remote workspaces ---- */
  const [workspacesOpen, setWorkspacesOpen] = useState(false)
  const [workspaceExpanded, setWorkspaceExpanded] = useState<Record<string, boolean>>({})
  const [workspaceSaveBusyId, setWorkspaceSaveBusyId] = useState<string | null>(null)
  const [syncWorkspaceId, setSyncWorkspaceId] = useState<string | null>(null)
  const [syncMode, setSyncMode] = useState<'down' | 'up' | null>(null)
  const [workspaceNotices, setWorkspaceNotices] = useState<Record<string, Feedback>>({})
  const [workspaceConfirmId, setWorkspaceConfirmId] = useState<string | null>(null)
  const [workspaceDeleteBusyId, setWorkspaceDeleteBusyId] = useState<string | null>(null)
  const [workspaceBoardNotice, setWorkspaceBoardNotice] = useState<Feedback | null>(null)

  /* ---- advanced prefs ---- */
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [prefsNotice, setPrefsNotice] = useState<Feedback | null>(null)

  /* ------------------------------------------------------------------ */
  /* Loading / reconciliation                                            */
  /* ------------------------------------------------------------------ */

  function applyWorkspaceList(list: RemoteSshWorkspace[]): void {
    setWorkspaces(list)
    setWorkspacesError(null)
    setGuards(previous => reconcileGuards(previous.drafts, previous.baselines, list))
  }

  async function reloadProfiles(next?: RemoteSshProfile[]): Promise<void> {
    if (next !== undefined) {
      setProfiles(next)
      setProfilesError(null)
      return
    }
    setProfilesBusy(true)
    try {
      const result = await api('listProfiles')
      if (result && result.ok === true) {
        setProfiles(result.profiles ?? [])
        setProfilesError(null)
      } else {
        setProfilesError(apiErrorMessage(result, t('common.unknownError')))
      }
    } catch (error) {
      setProfilesError(errorText(error, t('common.unknownError')))
    } finally {
      setProfilesBusy(false)
    }
  }

  async function reloadWorkspaces(next?: RemoteSshWorkspace[]): Promise<void> {
    if (next !== undefined) {
      applyWorkspaceList(next)
      return
    }
    setWorkspacesBusy(true)
    try {
      const result = await api('listWorkspaces')
      if (result && result.ok === true) {
        applyWorkspaceList(result.workspaces ?? [])
      } else {
        setWorkspacesError(apiErrorMessage(result, t('common.unknownError')))
      }
    } catch (error) {
      setWorkspacesError(errorText(error, t('common.unknownError')))
    } finally {
      setWorkspacesBusy(false)
    }
  }

  async function reloadPrefs(next?: RemoteSshPrefs): Promise<void> {
    let serverDraft: PrefsDraft | null = next === undefined ? null : prefsDraftFromApi(next)
    if (serverDraft === null) {
      setPrefsBusy(true)
      try {
        const result = await api('getPrefs')
        if (result && result.ok === true) {
          serverDraft = prefsDraftFromApi(result.prefs)
          setPrefsError(null)
        } else {
          setPrefsError(apiErrorMessage(result, t('common.unknownError')))
        }
      } catch (error) {
        setPrefsError(errorText(error, t('common.unknownError')))
      } finally {
        setPrefsBusy(false)
      }
    }
    if (serverDraft === null) return
    const server = serverDraft
    setPrefs(previous => reconcilePrefs(previous.draft, previous.baseline, server))
  }

  useEffect(() => {
    void reloadProfiles()
    void reloadWorkspaces()
    void reloadPrefs()
    // Initial load only: later refreshes keep unsaved drafts via reconcile.
  }, [])

  /* ------------------------------------------------------------------ */
  /* Add connection                                                     */
  /* ------------------------------------------------------------------ */

  function updateForm<K extends keyof ConnectionForm>(key: K, value: ConnectionForm[K]): void {
    setForm(previous => ({ ...previous, [key]: value }))
  }

  function touchFormField(field: 'host' | 'user'): void {
    setFormTouched(previous => (previous[field] === true ? previous : { ...previous, [field]: true }))
  }

  const formIssues = validateConnectionForm(form)
  const portIssue = formIssues.find(issue => issue.field === 'port')

  function visibleIssue(field: 'host' | 'user' | 'port'): string | undefined {
    const issue = formIssues.find(candidate => candidate.field === field)
    if (!issue) return undefined
    // The port error is always surfaced: the field never sits empty, and a
    // silent fallback to 22 is exactly what this face refuses. host/user
    // errors appear once the field is touched or submit was attempted.
    if (field !== 'port' && !formShowErrors && formTouched[field] !== true) return undefined
    return t(issue.messageKey)
  }

  async function submitConnection(): Promise<void> {
    if (addBusy) return
    const issues = validateConnectionForm(form)
    if (issues.length > 0) {
      setFormShowErrors(true)
      return
    }
    setAddBusy(true)
    setAddNotice(null)
    try {
      const displayName = form.name.trim() || form.host.trim()
      const result = await api('saveProfile', toSaveProfilePayload(form))
      if (result && result.ok === true) {
        setForm(emptyConnectionForm())
        setFormTouched({})
        setFormShowErrors(false)
        setAddNotice({ ok: true, text: t('add.ok', { name: displayName }) })
        await reloadProfiles(result.profiles)
        void reloadWorkspaces()
      } else {
        setAddNotice({ ok: false, text: t('add.fail'), detail: apiErrorMessage(result, t('common.unknownError')) })
      }
    } catch (error) {
      setAddNotice({ ok: false, text: t('add.fail'), detail: errorText(error, t('common.unknownError')) })
    } finally {
      setAddBusy(false)
    }
  }

  /* ------------------------------------------------------------------ */
  /* Connection cards: test / delete                                    */
  /* ------------------------------------------------------------------ */

  function setProfileNotice(profileId: string, feedback: Feedback | null): void {
    setProfileNotices(previous => {
      const next = { ...previous }
      if (feedback === null) delete next[profileId]
      else next[profileId] = feedback
      return next
    })
  }

  async function testConnection(profile: RemoteSshProfile): Promise<void> {
    if (testBusy[profile.id] === true) return
    setTestBusy(previous => ({ ...previous, [profile.id]: true }))
    try {
      const result = await api('testConnection', { id: profile.id })
      setTestResults(previous => ({ ...previous, [profile.id]: connectionTestView(result) }))
    } catch (error) {
      setTestResults(previous => ({
        ...previous,
        [profile.id]: { status: 'error', titleKey: 'connection.testFail', warning: '', detail: errorText(error, t('common.unknownError')) },
      }))
    } finally {
      setTestBusy(previous => {
        const next = { ...previous }
        delete next[profile.id]
        return next
      })
    }
  }

  async function deleteProfile(profile: RemoteSshProfile): Promise<void> {
    if (profileDeleteBusyId !== null) return
    setProfileDeleteBusyId(profile.id)
    setConnectionNotice(null)
    setProfileNotice(profile.id, null)
    try {
      const result = await api('deleteProfile', { id: profile.id })
      if (result && result.ok === true) {
        setProfileConfirmId(null)
        await reloadProfiles(result.profiles)
        await reloadWorkspaces(result.workspaces)
        setConnectionNotice({ ok: true, text: t('connection.deleted', { name: profileName(profile) }) })
      } else {
        setProfileNotice(profile.id, {
          ok: false,
          text: t('connection.deleteFail'),
          detail: apiErrorMessage(result, t('common.unknownError')),
        })
      }
    } catch (error) {
      setProfileNotice(profile.id, { ok: false, text: t('connection.deleteFail'), detail: errorText(error, t('common.unknownError')) })
    } finally {
      setProfileDeleteBusyId(null)
    }
  }

  /* ------------------------------------------------------------------ */
  /* SSH config import                                                  */
  /* ------------------------------------------------------------------ */

  function closeImportDialog(): void {
    if (importBusy) return
    setImportOpen(false)
  }

  async function openImportDialog(): Promise<void> {
    setImportOpen(true)
    await loadImportHosts()
  }

  async function loadImportHosts(): Promise<void> {
    setImportLoading(true)
    setImportError(null)
    setImportSummary(null)
    setImportHosts([])
    setImportSelected({})
    try {
      const result = await api('listSshConfigHosts')
      if (result && result.ok === true) {
        const hosts = result.hosts ?? []
        setImportHosts(hosts)
        setImportSelected(selectAllHosts(hosts))
      } else {
        setImportError(apiErrorMessage(result, t('import.readFail')))
      }
    } catch (error) {
      setImportError(errorText(error, t('common.unknownError')))
    } finally {
      setImportLoading(false)
    }
  }

  const selectedImportHosts = selectedHosts(importHosts, importSelected)
  const importSelectedCount = selectedImportHosts.length

  function importSubmitLabel(): string {
    if (!importBusy) return t('import.submit')
    const progress = importProgress
    if (progress === null) return t('import.importing', { done: 0, total: importSelectedCount })
    return progress.mode === 'retry'
      ? t('import.retrying', { done: progress.done, total: progress.total })
      : t('import.importing', { done: progress.done, total: progress.total })
  }

  async function startImport(): Promise<void> {
    if (importBusy) return
    const picked = selectedHosts(importHosts, importSelected)
    if (picked.length === 0) return
    setImportBusy(true)
    setImportSummary(null)
    setImportProgress({ mode: 'import', done: 0, total: picked.length, name: '' })
    try {
      const summary = await runImport(picked, payload => api('saveProfile', payload), {
        onProgress: (done, total, host) => setImportProgress({ mode: 'import', done, total, name: host.name }),
      })
      setImportSummary(summary)
    } catch (error) {
      setImportError(errorText(error, t('common.unknownError')))
    } finally {
      setImportBusy(false)
      setImportProgress(null)
      void reloadProfiles()
    }
  }

  async function retryFailedImport(): Promise<void> {
    const previous = importSummary
    if (importBusy || previous === null || previous.failedHosts.length === 0) return
    setImportBusy(true)
    setImportProgress({ mode: 'retry', done: 0, total: previous.failedHosts.length, name: '' })
    try {
      const retried = await runImport(previous.failedHosts, payload => api('saveProfile', payload), {
        onProgress: (done, total, host) => setImportProgress({ mode: 'retry', done, total, name: host.name }),
      })
      setImportSummary(current => (current === null ? retried : mergeImportRetry(current, retried)))
    } catch (error) {
      setImportError(errorText(error, t('common.unknownError')))
    } finally {
      setImportBusy(false)
      setImportProgress(null)
      void reloadProfiles()
    }
  }

  /* ------------------------------------------------------------------ */
  /* Remote workspaces                                                  */
  /* ------------------------------------------------------------------ */

  function guardDraftFor(workspace: RemoteSshWorkspace): GuardDraft {
    return guards.drafts[workspace.id] ?? guardDraftFromWorkspace(workspace)
  }

  function guardBaselineFor(workspace: RemoteSshWorkspace): GuardDraft {
    return guards.baselines[workspace.id] ?? guardDraftFromWorkspace(workspace)
  }

  function updateGuardDraft(workspace: RemoteSshWorkspace, patch: Partial<GuardDraft>): void {
    setGuards(previous => {
      const current = previous.drafts[workspace.id] ?? guardDraftFromWorkspace(workspace)
      return {
        ...previous,
        drafts: { ...previous.drafts, [workspace.id]: { ...current, ...patch } },
      }
    })
  }

  function setWorkspaceNotice(workspaceId: string, feedback: Feedback | null): void {
    setWorkspaceNotices(previous => {
      const next = { ...previous }
      if (feedback === null) delete next[workspaceId]
      else next[workspaceId] = feedback
      return next
    })
  }

  function workspaceTitle(workspace: RemoteSshWorkspace): string {
    return workspace.title || workspace.id
  }

  function workspaceConnectionName(workspace: RemoteSshWorkspace): string {
    const profile = profiles.find(candidate => candidate.id === workspace.profileId)
    return profile ? profileName(profile) : t('workspace.unknownProfile')
  }

  async function saveWorkspaceGuards(workspace: RemoteSshWorkspace): Promise<void> {
    if (workspaceSaveBusyId !== null) return
    const draft = guardDraftFor(workspace)
    setWorkspaceSaveBusyId(workspace.id)
    setWorkspaceNotice(workspace.id, null)
    try {
      const result = await api('updateWorkspaceGuards', toUpdateWorkspaceGuardsPayload(workspace.id, draft))
      if (result && result.ok === true) {
        await reloadWorkspaces(result.workspaces)
        setWorkspaceNotice(workspace.id, { ok: true, text: t('workspace.saved') })
      } else {
        setWorkspaceNotice(workspace.id, {
          ok: false,
          text: t('workspace.saveFail'),
          detail: apiErrorMessage(result, t('common.unknownError')),
        })
      }
    } catch (error) {
      setWorkspaceNotice(workspace.id, { ok: false, text: t('workspace.saveFail'), detail: errorText(error, t('common.unknownError')) })
    } finally {
      setWorkspaceSaveBusyId(null)
    }
  }

  async function runWorkspaceSync(workspace: RemoteSshWorkspace, mode: 'down' | 'up'): Promise<void> {
    // One sync at a time globally: two concurrent pulls into the same mirror
    // race each other; the guard also covers a double-click on the same card.
    if (syncWorkspaceId !== null) return
    const draft = guardDraftFor(workspace)
    const baseline = guardBaselineFor(workspace)
    if (isGuardDraftDirty(draft, baseline)) {
      // Never let an unsaved draft look like it is already in effect.
      setWorkspaceNotice(workspace.id, { ok: false, text: t('workspace.syncBlocked') })
      return
    }
    const pulling = mode === 'down'
    setSyncWorkspaceId(workspace.id)
    setSyncMode(mode)
    setWorkspaceNotice(workspace.id, null)
    try {
      const result = pulling
        ? await api('syncDown', { id: workspace.id })
        : await api('syncUp', { id: workspace.id })
      if (result && result.ok === true) {
        setWorkspaceNotice(workspace.id, { ok: true, text: t(pulling ? 'workspace.syncDone' : 'workspace.pushDone') })
      } else {
        setWorkspaceNotice(workspace.id, {
          ok: false,
          text: t(pulling ? 'workspace.syncFail' : 'workspace.pushFail'),
          detail: apiErrorMessage(result, t('common.unknownError')),
        })
      }
    } catch (error) {
      setWorkspaceNotice(workspace.id, {
        ok: false,
        text: t(pulling ? 'workspace.syncFail' : 'workspace.pushFail'),
        detail: errorText(error, t('common.unknownError')),
      })
    } finally {
      // Failure and exception both land here: the card is operable again.
      setSyncWorkspaceId(null)
      setSyncMode(null)
    }
  }

  async function deleteWorkspace(workspace: RemoteSshWorkspace): Promise<void> {
    if (workspaceDeleteBusyId !== null) return
    setWorkspaceDeleteBusyId(workspace.id)
    setWorkspaceBoardNotice(null)
    try {
      const result = await api('deleteWorkspace', { id: workspace.id })
      if (result && result.ok === true) {
        const title = workspaceTitle(workspace)
        setWorkspaceConfirmId(null)
        setWorkspaceNotice(workspace.id, null)
        await reloadWorkspaces(result.workspaces)
        setWorkspaceBoardNotice({ ok: true, text: t('workspace.deleted', { title }) })
      } else {
        setWorkspaceNotice(workspace.id, {
          ok: false,
          text: t('workspace.deleteFail'),
          detail: apiErrorMessage(result, t('common.unknownError')),
        })
      }
    } catch (error) {
      setWorkspaceNotice(workspace.id, { ok: false, text: t('workspace.deleteFail'), detail: errorText(error, t('common.unknownError')) })
    } finally {
      setWorkspaceDeleteBusyId(null)
    }
  }

  /* ------------------------------------------------------------------ */
  /* Advanced prefs                                                     */
  /* ------------------------------------------------------------------ */

  function updatePrefs<K extends keyof PrefsDraft>(key: K, value: PrefsDraft[K]): void {
    setPrefs(previous => ({ ...previous, draft: { ...previous.draft, [key]: value } }))
  }

  async function savePrefsDraft(): Promise<void> {
    if (prefsBusy) return
    setPrefsBusy(true)
    setPrefsNotice(null)
    setPrefsError(null)
    try {
      const result = await api('savePrefs', toSavePrefsPayload(prefs.draft))
      if (result && result.ok === true) {
        if (result.prefs !== undefined) {
          const server = prefsDraftFromApi(result.prefs)
          setPrefs(previous => ({
            // Edits typed while the request was in flight survive; a clean
            // draft adopts the server truth (and its baseline moves with it).
            draft: isPrefsDraftDirty(previous.draft, server) ? previous.draft : server,
            baseline: server,
          }))
        } else {
          await reloadPrefs()
        }
        setPrefsNotice({ ok: true, text: t('advanced.saved') })
      } else {
        setPrefsNotice({
          ok: false,
          text: t('advanced.saveFail'),
          detail: apiErrorMessage(result, t('common.unknownError')),
        })
      }
    } catch (error) {
      setPrefsNotice({ ok: false, text: t('advanced.saveFail'), detail: errorText(error, t('common.unknownError')) })
    } finally {
      setPrefsBusy(false)
    }
  }

  /* ------------------------------------------------------------------ */
  /* Render helpers                                                     */
  /* ------------------------------------------------------------------ */

  const addRegionId = id('add-region')
  const moreRegionId = id('add-more-region')
  const workspacesRegionId = id('workspaces-region')
  const advancedRegionId = id('advanced-region')

  function renderRetryButton(label: string, busy: boolean, onRetry: () => void) {
    return (
      <button
        type="button"
        className="rsui-btn rsui-btn-outline rsui-btn-sm"
        disabled={busy}
        onClick={() => { onRetry() }}
      >
        {busy ? t('common.loading') : label}
      </button>
    )
  }

  function renderConnectionCard(profile: RemoteSshProfile) {
    const testing = testBusy[profile.id] === true
    const deleting = profileDeleteBusyId === profile.id
    const result = testResults[profile.id]
    const confirming = profileConfirmId === profile.id
    const notice = profileNotices[profile.id]
    const authLabel = profile.authMethod === 'password' ? t('connection.authPassword') : t('connection.authKey')
    const name = profileName(profile)
    return (
      <article className="rsui-card rsui-connection" key={profile.id} data-rsui-connection data-profile-id={profile.id}>
        <div className="rsui-card-head">
          <div className="rsui-card-title-block">
            <h3 className="rsui-card-title">{name}</h3>
            <div className="rsui-card-sub">
              <span className="rsui-mono rsui-wrap">{profileSummary(profile)}</span>
              <span className="rsui-sep" aria-hidden="true">·</span>
              <span>{authLabel}</span>
              {profile.passwordConfigured ? (
                <>
                  <span className="rsui-sep" aria-hidden="true">·</span>
                  <span>{t('connection.passwordConfigured')}</span>
                </>
              ) : null}
            </div>
          </div>
          <div className="rsui-actions">
            <button
              type="button"
              className="rsui-btn"
              data-rsui-test
              disabled={testing}
              aria-busy={testing ? true : undefined}
              onClick={() => { void testConnection(profile) }}
            >
              {testing ? t('connection.testing') : t('connection.test')}
            </button>
            <button
              type="button"
              className="rsui-btn rsui-btn-ghost"
              data-rsui-profile-delete
              disabled={deleting}
              onClick={() => { setProfileConfirmId(profile.id) }}
            >
              {t('connection.delete')}
            </button>
          </div>
        </div>
        {confirming ? (
          <div
            className="rsui-confirm"
            role="group"
            aria-label={t('connection.deleteTitle', { name })}
            data-rsui-profile-delete-confirm
          >
            <div className="rsui-confirm-title">{t('connection.deleteTitle', { name })}</div>
            <div className="rsui-confirm-body">{t('connection.deleteBody')}</div>
            <div className="rsui-actions">
              <button
                type="button"
                className="rsui-btn rsui-btn-danger"
                disabled={deleting}
                aria-busy={deleting ? true : undefined}
                onClick={() => { void deleteProfile(profile) }}
              >
                {t('common.confirmDelete')}
              </button>
              <button
                type="button"
                className="rsui-btn rsui-btn-ghost"
                disabled={deleting}
                onClick={() => { setProfileConfirmId(null) }}
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : null}
        {result ? <TestResultView view={result} t={t} /> : null}
        {notice ? (
          <Notice tone={notice.ok ? 'success' : 'error'} title={notice.text} detail={notice.detail} />
        ) : null}
      </article>
    )
  }

  function renderWorkspaceCard(workspace: RemoteSshWorkspace) {
    const draft = guardDraftFor(workspace)
    const baseline = guardBaselineFor(workspace)
    const dirty = isGuardDraftDirty(draft, baseline)
    const expanded = workspaceExpanded[workspace.id] === true
    const regionId = workspaceFieldId(workspace.id, 'region')
    const saving = workspaceSaveBusyId === workspace.id
    const deleting = workspaceDeleteBusyId === workspace.id
    const confirming = workspaceConfirmId === workspace.id
    const syncingHere = syncWorkspaceId === workspace.id
    const syncBusyAnywhere = syncWorkspaceId !== null
    const notice = workspaceNotices[workspace.id]
    const title = workspaceTitle(workspace)
    return (
      <article className="rsui-card rsui-workspace" key={workspace.id} data-rsui-workspace data-workspace-id={workspace.id}>
        <div className="rsui-card-head">
          <div className="rsui-card-title-block">
            <div className="rsui-title-line">
              <h3 className="rsui-card-title">{title}</h3>
              {dirty ? <span className="rsui-badge rsui-badge-warn" data-rsui-ws-dirty>{t('workspace.unsaved')}</span> : null}
            </div>
            <div className="rsui-card-sub">
              <span>{t('workspace.connection')}: <span className="rsui-wrap">{workspaceConnectionName(workspace)}</span></span>
              <span className="rsui-sep" aria-hidden="true">·</span>
              <span>{t('workspace.remotePath')}: <span className="rsui-mono rsui-wrap">{workspace.remotePath || ''}</span></span>
            </div>
          </div>
          <div className="rsui-actions">
            <button
              type="button"
              className="rsui-btn rsui-btn-ghost"
              data-rsui-ws-expand
              aria-expanded={expanded}
              aria-controls={regionId}
              onClick={() => {
                setWorkspaceExpanded(previous => ({ ...previous, [workspace.id]: previous[workspace.id] !== true }))
              }}
            >
              {expanded ? t('workspace.collapse') : t('workspace.expand')}
            </button>
          </div>
        </div>
        <div id={regionId} className="rsui-region" hidden={!expanded}>
          <div className="rsui-region-body">
            <CheckField
              id={workspaceFieldId(workspace.id, 'writeBack')}
              label={t('workspace.writeBack')}
              checked={draft.writeBack}
              onChange={value => { updateGuardDraft(workspace, { writeBack: value }) }}
            />
            <TextAreaField
              id={workspaceFieldId(workspace.id, 'writeBackExclude')}
              label={t('workspace.writeBackExclude')}
              value={draft.writeBackExclude}
              hint={t('workspace.writeBackExcludeHint')}
              onChange={value => { updateGuardDraft(workspace, { writeBackExclude: value }) }}
            />
            <TextAreaField
              id={workspaceFieldId(workspace.id, 'syncPaths')}
              label={t('workspace.syncPaths')}
              value={draft.syncPaths}
              hint={t('workspace.syncPathsHint')}
              onChange={value => { updateGuardDraft(workspace, { syncPaths: value }) }}
            />
            <TextAreaField
              id={workspaceFieldId(workspace.id, 'syncExclude')}
              label={t('workspace.syncExclude')}
              value={draft.syncExclude}
              hint={t('workspace.syncExcludeHint')}
              onChange={value => { updateGuardDraft(workspace, { syncExclude: value }) }}
            />
            <Field
              id={workspaceFieldId(workspace.id, 'syncMaxBytes')}
              label={t('workspace.syncMaxBytes')}
              value={draft.syncMaxBytes}
              inputMode="numeric"
              onChange={value => { updateGuardDraft(workspace, { syncMaxBytes: value }) }}
            />
            {dirty ? <div className="rsui-inline-hint rsui-dirty-hint">{t('workspace.syncBlocked')}</div> : null}
            {notice ? (
              <div data-rsui-ws-feedback>
                <Notice tone={notice.ok ? 'success' : 'error'} title={notice.text} detail={notice.detail} />
              </div>
            ) : null}
            <div className="rsui-actions rsui-workspace-actions">
              <button
                type="button"
                className="rsui-btn rsui-btn-primary"
                data-rsui-ws-save
                disabled={saving}
                aria-busy={saving ? true : undefined}
                onClick={() => { void saveWorkspaceGuards(workspace) }}
              >
                {saving ? t('workspace.saving') : t('workspace.save')}
              </button>
              <button
                type="button"
                className="rsui-btn"
                data-rsui-ws-sync
                disabled={syncBusyAnywhere || dirty}
                aria-busy={syncingHere && syncMode === 'down' ? true : undefined}
                onClick={() => { void runWorkspaceSync(workspace, 'down') }}
              >
                {syncingHere && syncMode === 'down' ? t('workspace.syncing') : t('workspace.syncDown')}
              </button>
              <button
                type="button"
                className="rsui-btn"
                data-rsui-ws-push
                disabled={syncBusyAnywhere || dirty}
                aria-busy={syncingHere && syncMode === 'up' ? true : undefined}
                onClick={() => { void runWorkspaceSync(workspace, 'up') }}
              >
                {syncingHere && syncMode === 'up' ? t('workspace.pushing') : t('workspace.syncUp')}
              </button>
              <button
                type="button"
                className="rsui-btn rsui-btn-ghost"
                data-rsui-ws-delete
                disabled={deleting}
                onClick={() => { setWorkspaceConfirmId(workspace.id) }}
              >
                {t('connection.delete')}
              </button>
            </div>
            {confirming ? (
              <div
                className="rsui-confirm"
                role="group"
                aria-label={t('workspace.deleteTitle', { title })}
                data-rsui-ws-delete-confirm
              >
                <div className="rsui-confirm-title">{t('workspace.deleteTitle', { title })}</div>
                <div className="rsui-confirm-body">{t('workspace.deleteBody')}</div>
                <div className="rsui-actions">
                  <button
                    type="button"
                    className="rsui-btn rsui-btn-danger"
                    disabled={deleting}
                    aria-busy={deleting ? true : undefined}
                    onClick={() => { void deleteWorkspace(workspace) }}
                  >
                    {t('common.confirmDelete')}
                  </button>
                  <button
                    type="button"
                    className="rsui-btn rsui-btn-ghost"
                    disabled={deleting}
                    onClick={() => { setWorkspaceConfirmId(null) }}
                  >
                    {t('common.cancel')}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </article>
    )
  }

  function renderImportResult() {
    const summary = importSummary
    if (summary === null) return null
    const failures = summary.outcomes.filter(outcome => !outcome.ok)
    const allOk = summary.failCount === 0
    const allFailed = summary.okCount === 0
    const tone = allOk ? 'success' : allFailed ? 'error' : 'warning'
    const title = allOk
      ? t('import.resultAllOk', { ok: summary.okCount })
      : allFailed
        ? t('import.resultAllFail', { fail: summary.failCount })
        : t('import.resultPartial', { ok: summary.okCount, fail: summary.failCount })
    const retrying = importBusy && importProgress !== null && importProgress.mode === 'retry'
    return (
      <div className="rsui-import-result" data-rsui-import-result role={allOk ? 'status' : 'alert'}>
        <div className="rsui-import-result-head">
          <StatusIcon status={tone} />
          <span className={`rsui-import-result-title rsui-tone-${tone}`}>{title}</span>
        </div>
        {failures.length > 0 ? (
          <>
            <div className="rsui-import-failed-intro">
              <span className="rsui-feedback-prefix">{t('common.warning')}</span>
              <span>{t('import.failedIntro')}</span>
            </div>
            <ul className="rsui-import-failed">
              {failures.map(outcome => (
                <li key={outcome.key}>
                  <span className="rsui-import-failed-host">
                    {outcome.name} · <span className="rsui-mono">{outcome.hostName}</span>
                  </span>
                  <span className="rsui-feedback-prefix">{t('common.error')}</span>
                  <pre className="rsui-import-failed-reason">{outcome.error || t('import.noResult')}</pre>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="rsui-btn rsui-btn-outline rsui-btn-sm"
              data-rsui-import-retry
              disabled={importBusy}
              aria-busy={retrying ? true : undefined}
              onClick={() => { void retryFailedImport() }}
            >
              {retrying && importProgress !== null
                ? t('import.retrying', { done: importProgress.done, total: importProgress.total })
                : t('import.retryFailed', { n: summary.failCount })}
            </button>
          </>
        ) : null}
      </div>
    )
  }

  /* ------------------------------------------------------------------ */
  /* Render                                                             */
  /* ------------------------------------------------------------------ */

  return (
    <div className="rsui-root" data-rsui-root>
      <header className="rsui-page-head">
        <h1 className="rsui-page-title">{t('page.title')}</h1>
        <p className="rsui-page-subtitle">{t('page.subtitle')}</p>
      </header>

      {/* ---- My connections: always visible ---- */}
      <section className="rsui-section" aria-label={t('connection.sectionTitle')}>
        <div className="rsui-section-bar">
          <div className="rsui-section-title-block">
            <h2 className="rsui-section-title">{t('connection.sectionTitle')}</h2>
            <p className="rsui-section-summary">{t('connection.sectionSummary')}</p>
          </div>
          <span className="rsui-count">{t('connection.count', { n: profiles.length })}</span>
        </div>
        {profilesError ? (
          <Notice
            tone="error"
            prefix={t('common.error')}
            title={profilesError}
            action={renderRetryButton(t('common.retry'), profilesBusy, () => { void reloadProfiles() })}
          />
        ) : null}
        {profiles.length === 0 && profilesError === null ? (
          <p className="rsui-empty">{t('connection.empty')}</p>
        ) : null}
        {profiles.map(profile => renderConnectionCard(profile))}
        {connectionNotice ? (
          <Notice
            tone={connectionNotice.ok ? 'success' : 'error'}
            title={connectionNotice.text}
            detail={connectionNotice.detail}
          />
        ) : null}
      </section>

      {/* ---- Add connection: expanded initially ---- */}
      <section className="rsui-section" aria-label={t('add.sectionTitle')}>
        <button
          type="button"
          className="rsui-disclosure-head"
          data-rsui-toggle-add
          aria-expanded={addOpen}
          aria-controls={addRegionId}
          onClick={() => { setAddOpen(open => !open) }}
        >
          <span className="rsui-head-text">
            <span className="rsui-head-title">{t('add.sectionTitle')}</span>
            <span className="rsui-head-summary">{t('add.sectionSummary')}</span>
          </span>
          <ChevronIcon open={addOpen} />
        </button>
        <div id={addRegionId} className="rsui-region" hidden={!addOpen}>
          <div className="rsui-region-body">
            <div className="rsui-add-top">
              <button
                type="button"
                className="rsui-btn rsui-btn-outline"
                data-rsui-import-open
                onClick={() => { void openImportDialog() }}
              >
                {t('add.import')}
              </button>
            </div>
            <div className="rsui-divider">
              <span className="rsui-divider-label">{t('add.divider')}</span>
            </div>
            <div className="rsui-add-form">
              <Field
                id={id('name')}
                label={t('add.name')}
                value={form.name}
                placeholder={t('add.namePlaceholder')}
                dataField="name"
                onChange={value => { updateForm('name', value) }}
              />
              <Field
                id={id('host')}
                label={t('add.host')}
                value={form.host}
                placeholder={t('add.hostPlaceholder')}
                dataField="host"
                error={visibleIssue('host')}
                onChange={value => { updateForm('host', value) }}
                onBlur={() => { touchFormField('host') }}
              />
              <div className="rsui-form-row rsui-form-row-2">
                <Field
                  id={id('port')}
                  label={t('add.port')}
                  value={form.port}
                  inputMode="numeric"
                  dataField="port"
                  error={visibleIssue('port')}
                  onChange={value => { updateForm('port', value) }}
                />
                <Field
                  id={id('user')}
                  label={t('add.user')}
                  value={form.user}
                  placeholder={t('add.userPlaceholder')}
                  dataField="user"
                  error={visibleIssue('user')}
                  onChange={value => { updateForm('user', value) }}
                  onBlur={() => { touchFormField('user') }}
                />
              </div>
              <SelectField
                id={id('authMethod')}
                label={t('add.auth')}
                value={form.authMethod}
                dataField="authMethod"
                options={[
                  { value: 'key', label: t('add.authKey') },
                  { value: 'password', label: t('add.authPassword') },
                ]}
                onChange={value => { updateForm('authMethod', value === 'password' ? 'password' : 'key') }}
              />
              {form.authMethod === 'key' ? (
                <Field
                  id={id('keyPath')}
                  label={t('add.keyPath')}
                  value={form.keyPath}
                  placeholder={t('add.keyPathPlaceholder')}
                  dataField="keyPath"
                  onChange={value => { updateForm('keyPath', value) }}
                />
              ) : (
                <Field
                  id={id('password')}
                  label={t('add.password')}
                  type="password"
                  autoComplete="new-password"
                  value={form.password}
                  placeholder={t('add.passwordPlaceholder')}
                  dataField="password"
                  onChange={value => { updateForm('password', value) }}
                />
              )}
              <Field
                id={id('remoteRoot')}
                label={t('add.remoteRoot')}
                value={form.remoteRoot}
                placeholder={t('add.remoteRootPlaceholder')}
                dataField="remoteRoot"
                onChange={value => { updateForm('remoteRoot', value) }}
              />
              <div className="rsui-subsection">
                <button
                  type="button"
                  className="rsui-disclosure-head rsui-disclosure-sub"
                  data-rsui-toggle-more
                  aria-expanded={moreOpen}
                  aria-controls={moreRegionId}
                  onClick={() => { setMoreOpen(open => !open) }}
                >
                  <span className="rsui-head-text">
                    <span className="rsui-head-title">{t('add.moreOptions')}</span>
                    <span className="rsui-head-summary">{t('add.moreOptionsSummary')}</span>
                  </span>
                  <ChevronIcon open={moreOpen} />
                </button>
                <div id={moreRegionId} className="rsui-region rsui-region-inset" hidden={!moreOpen}>
                  <div className="rsui-region-body">
                    <Field
                      id={id('proxyJump')}
                      label={t('add.proxyJump')}
                      value={form.proxyJump}
                      placeholder={t('add.proxyJumpPlaceholder')}
                      dataField="proxyJump"
                      onChange={value => { updateForm('proxyJump', value) }}
                    />
                  </div>
                </div>
              </div>
              <div className="rsui-actions rsui-add-actions">
                <button
                  type="button"
                  className="rsui-btn rsui-btn-primary"
                  data-rsui-add-submit
                  disabled={addBusy || portIssue !== undefined}
                  aria-busy={addBusy ? true : undefined}
                  onClick={() => { void submitConnection() }}
                >
                  {addBusy ? t('add.submitting') : t('add.submit')}
                </button>
              </div>
              {addNotice ? (
                addNotice.ok ? (
                  <Notice tone="success" title={addNotice.text} />
                ) : (
                  <Notice tone="error" prefix={t('common.error')} title={addNotice.text} detail={addNotice.detail} />
                )
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ---- Remote workspaces: collapsed initially ---- */}
      <section className="rsui-section" aria-label={t('workspace.sectionTitle')}>
        <button
          type="button"
          className="rsui-disclosure-head"
          data-rsui-toggle-workspaces
          aria-expanded={workspacesOpen}
          aria-controls={workspacesRegionId}
          onClick={() => { setWorkspacesOpen(open => !open) }}
        >
          <span className="rsui-head-text">
            <span className="rsui-head-title-line">
              <span className="rsui-head-title">{t('workspace.sectionTitle')}</span>
              <span className="rsui-head-count">{workspaces.length}</span>
            </span>
            <span className="rsui-head-summary">{t('workspace.sectionSummary')}</span>
          </span>
          <ChevronIcon open={workspacesOpen} />
        </button>
        {workspacesBusy ? <p className="rsui-muted rsui-section-loading">{t('common.loading')}</p> : null}
        {workspacesError ? (
          <Notice
            tone="error"
            prefix={t('common.error')}
            title={workspacesError}
            action={renderRetryButton(t('common.retry'), workspacesBusy, () => { void reloadWorkspaces() })}
          />
        ) : null}
        {workspaceBoardNotice ? (
          <Notice
            tone={workspaceBoardNotice.ok ? 'success' : 'error'}
            title={workspaceBoardNotice.text}
            detail={workspaceBoardNotice.detail}
          />
        ) : null}
        <div id={workspacesRegionId} className="rsui-region" hidden={!workspacesOpen}>
          <div className="rsui-region-body">
            {workspaces.length === 0 && workspacesError === null ? (
              <p className="rsui-empty">{t('workspace.empty')}</p>
            ) : null}
            {workspaces.map(workspace => renderWorkspaceCard(workspace))}
          </div>
        </div>
      </section>

      {/* ---- Advanced settings: collapsed initially, content mounted but hidden ---- */}
      <section className="rsui-section" aria-label={t('advanced.sectionTitle')}>
        <button
          type="button"
          className="rsui-disclosure-head"
          data-rsui-toggle-advanced
          aria-expanded={advancedOpen}
          aria-controls={advancedRegionId}
          onClick={() => { setAdvancedOpen(open => !open) }}
        >
          <span className="rsui-head-text">
            <span className="rsui-head-title">{t('advanced.sectionTitle')}</span>
            <span className="rsui-head-summary">{t('advanced.sectionSummary')}</span>
          </span>
          <ChevronIcon open={advancedOpen} />
        </button>
        <div
          id={advancedRegionId}
          className="rsui-region"
          data-rsui-advanced-content
          hidden={!advancedOpen}
        >
          <div className="rsui-region-body">
            {prefsError ? (
              <Notice
                tone="error"
                prefix={t('common.error')}
                title={prefsError}
                action={renderRetryButton(t('common.retry'), prefsBusy, () => { void reloadPrefs() })}
              />
            ) : null}
            <div className="rsui-group">
              <h3 className="rsui-group-title">{t('advanced.terminalGroup')}</h3>
              <Field
                id={id('nodePath')}
                label={t('advanced.nodePath')}
                value={prefs.draft.nodePath}
                placeholder={t('advanced.nodePathPlaceholder')}
                hint={t('advanced.nodePathHint')}
                dataField="nodePath"
                onChange={value => { updatePrefs('nodePath', value) }}
              />
              <SelectField
                id={id('writeBackFailure')}
                label={t('advanced.writeBackFailure')}
                value={prefs.draft.writeBackFailure}
                dataField="writeBackFailure"
                options={[
                  { value: 'error', label: t('advanced.wbError') },
                  { value: 'log', label: t('advanced.wbLog') },
                ]}
                onChange={value => { updatePrefs('writeBackFailure', value === 'log' ? 'log' : 'error') }}
              />
              <CheckField
                id={id('writeBackFreshness')}
                label={t('advanced.writeBackFreshness')}
                checked={prefs.draft.writeBackFreshness}
                dataField="writeBackFreshness"
                onChange={value => { updatePrefs('writeBackFreshness', value) }}
              />
            </div>
            <div className="rsui-group">
              <h3 className="rsui-group-title">{t('advanced.syncDefaultsGroup')}</h3>
              <p className="rsui-hint">{t('advanced.syncDefaultsHint')}</p>
              <Field
                id={id('defaultSyncPaths')}
                label={t('advanced.defaultSyncPaths')}
                value={prefs.draft.defaultSyncPaths}
                dataField="defaultSyncPaths"
                onChange={value => { updatePrefs('defaultSyncPaths', value) }}
              />
              <Field
                id={id('defaultSyncExclude')}
                label={t('advanced.defaultSyncExclude')}
                value={prefs.draft.defaultSyncExclude}
                dataField="defaultSyncExclude"
                onChange={value => { updatePrefs('defaultSyncExclude', value) }}
              />
              <Field
                id={id('defaultSyncMaxBytes')}
                label={t('advanced.defaultSyncMaxBytes')}
                value={prefs.draft.defaultSyncMaxBytes}
                inputMode="numeric"
                dataField="defaultSyncMaxBytes"
                onChange={value => { updatePrefs('defaultSyncMaxBytes', value) }}
              />
            </div>
            <div className="rsui-actions rsui-prefs-actions">
              <button
                type="button"
                className="rsui-btn rsui-btn-primary"
                data-rsui-prefs-save
                disabled={prefsBusy}
                aria-busy={prefsBusy ? true : undefined}
                onClick={() => { void savePrefsDraft() }}
              >
                {prefsBusy ? t('advanced.saving') : t('advanced.save')}
              </button>
            </div>
            {prefsNotice ? (
              prefsNotice.ok ? (
                <Notice tone="success" title={prefsNotice.text} />
              ) : (
                <Notice tone="error" prefix={t('common.error')} title={prefsNotice.text} detail={prefsNotice.detail} />
              )
            ) : null}
          </div>
        </div>
      </section>

      {/* ---- SSH config import modal ---- */}
      {importOpen ? (
        <Modal
          open={true}
          onClose={closeImportDialog}
          title={t('import.title')}
          closeLabel={t('import.close')}
          className="rsui-modal"
        >
          <div className="rsui-import-body" data-rsui-import-dialog>
            {importLoading ? (
              <p className="rsui-muted rsui-import-status" role="status">{t('import.loading')}</p>
            ) : importError !== null ? (
              <Notice
                tone="error"
                prefix={t('common.error')}
                title={t('import.readFail')}
                detail={importError}
                action={renderRetryButton(t('common.retry'), importLoading, () => { void loadImportHosts() })}
              />
            ) : importHosts.length === 0 ? (
              <p className="rsui-empty">{t('import.empty')}</p>
            ) : (
              <>
                <div className="rsui-import-toolbar">
                  <span className="rsui-muted">
                    {t('import.selectedCount', { n: importSelectedCount, total: importHosts.length })}
                  </span>
                  {importSelectedCount === 0 ? (
                    <span className="rsui-inline-hint" role="status">{t('import.noneSelected')}</span>
                  ) : null}
                  <div className="rsui-actions">
                    <button
                      type="button"
                      className="rsui-btn rsui-btn-sm"
                      data-rsui-import-select-all
                      disabled={importBusy}
                      onClick={() => { setImportSelected(selectAllHosts(importHosts)) }}
                    >
                      {t('import.selectAll')}
                    </button>
                    <button
                      type="button"
                      className="rsui-btn rsui-btn-sm"
                      data-rsui-import-clear
                      disabled={importBusy}
                      onClick={() => { setImportSelected({}) }}
                    >
                      {t('import.clearAll')}
                    </button>
                  </div>
                </div>
                <div className="rsui-import-list">
                  {importHosts.map((host, index) => {
                    const key = importHostKey(host)
                    const checked = importSelected[key] === true
                    const checkboxId = id(`import-host-${index}`)
                    return (
                      <div className="rsui-import-row" key={key} data-rsui-import-row>
                        <input
                          id={checkboxId}
                          type="checkbox"
                          className="rsui-check-input"
                          checked={checked}
                          disabled={importBusy}
                          onChange={() => { setImportSelected(previous => toggleHostSelection(previous, key)) }}
                        />
                        <label className="rsui-import-row-text" htmlFor={checkboxId}>
                          <span className="rsui-import-alias">{host.name}</span>
                          <span className="rsui-import-meta">
                            <span className="rsui-mono">{host.hostName}{host.port !== undefined ? `:${host.port}` : ''}</span>
                            {host.user ? <span> · {host.user}</span> : null}
                            {host.proxyJump ? <span> · {t('import.proxyJump', { target: host.proxyJump })}</span> : null}
                          </span>
                        </label>
                      </div>
                    )
                  })}
                </div>
                <p className="rsui-hint">{t('import.note')}</p>
                <p className="rsui-hint">{t('import.authNote')}</p>
              </>
            )}
            {importBusy && importProgress !== null ? (
              <div className="rsui-import-progress" role="status" aria-live="polite">
                <span>{importProgress.mode === 'retry' ? t('import.retrying', { done: importProgress.done, total: importProgress.total }) : t('import.importing', { done: importProgress.done, total: importProgress.total })}</span>
                {importProgress.name ? <span className="rsui-muted">{t('import.progress', { name: importProgress.name })}</span> : null}
              </div>
            ) : null}
            {renderImportResult()}
            <div className="rsui-actions rsui-import-actions">
              <button
                type="button"
                className="rsui-btn rsui-btn-ghost"
                disabled={importBusy}
                onClick={closeImportDialog}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="rsui-btn rsui-btn-primary"
                data-rsui-import-submit
                disabled={importBusy || importSelectedCount === 0}
                aria-busy={importBusy ? true : undefined}
                onClick={() => { void startImport() }}
              >
                {importSubmitLabel()}
              </button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
