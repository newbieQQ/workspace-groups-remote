/**
 * Remote-SSH settings — pure model.
 *
 * Everything here is plain data transformation (no React, no DOM, no
 * imports from other plugin sources), so the real behaviour can be covered
 * by unit tests without mounting the shell:
 *
 * - connection form validation and the exact `saveProfile` payload
 * - `~/.ssh/config` import mapping, per-item outcomes, partial-failure counts
 *   and failed-only retry merges (the old face reported the selection size as
 *   "imported" regardless of each save result)
 * - per-workspace guard drafts, dirty detection, reload reconciliation and the
 *   exact `updateWorkspaceGuards` payload
 * - global preferences draft/payload/dirty/reconcile
 *
 * Field semantics and unit conversions are copied from the vendored client
 * (`splitList`, `bytesToGibText`, `gibTextToBytes`, `prefsForUi`) so the face
 * keeps the existing Host contract: lists accept comma/newline/semicolon,
 * the size cap is edited in GiB and stored in bytes, empty = Host default.
 */
import type { RemoteSshPrefs, RemoteSshProfile, RemoteSshWorkspace, SavePrefsPayload, SaveProfilePayload, SshConfigHost, TestConnectionResponse, UpdateWorkspaceGuardsPayload } from './contract.ts';
/** Controlled draft of the "add connection" form (all fields are strings). */
export interface ConnectionForm {
    name: string;
    host: string;
    port: string;
    user: string;
    authMethod: 'key' | 'password';
    keyPath: string;
    password: string;
    remoteRoot: string;
    proxyJump: string;
}
/** Values the vendored client used when opening/clearing the form. */
export declare const EMPTY_CONNECTION_FORM: ConnectionForm;
/** Fresh copy (never share the frozen constant with component state). */
export declare function emptyConnectionForm(): ConnectionForm;
/** Field-level issue; the component maps `messageKey` through `t`. */
export interface FormIssue {
    field: 'host' | 'user' | 'port';
    messageKey: 'add.errHost' | 'add.errUser' | 'add.errPort';
}
/**
 * Validate exactly what the Host requires (`host` + `user`) plus a real port
 * range. The Host would otherwise `parseInt(port) || 22`, silently turning a
 * typo into 22; the UI refuses it instead. Aliases, empty key paths and the
 * reliance on ssh-agent / ~/.ssh/config stay legal (the backend accepts them).
 */
export declare function validateConnectionForm(form: ConnectionForm): FormIssue[];
/** Whether the form can be submitted (callers still re-check on submit). */
export declare function isConnectionFormValid(form: ConnectionForm): boolean;
/**
 * Exact `saveProfile` body. Fields are passed through as typed by the user
 * (the Host trims/derives where it always did: name falls back to host, port
 * parsing is already done here, password only persists for password auth).
 */
export declare function toSaveProfilePayload(form: ConnectionForm): SaveProfilePayload;
/** `user@host:port` summary used by connection cards. */
export declare function profileSummary(profile: RemoteSshProfile): string;
/** Display name with the upstream `name || host` fallback. */
export declare function profileName(profile: RemoteSshProfile): string;
/** "comma or newline (or semicolon) separated" text → trimmed non-empty list. */
export declare function splitList(value: string | null | undefined): string[];
/** Byte count → GiB text (empty = Host built-in default cap). */
export declare function bytesToGibText(bytes: number | null | undefined): string;
/** GiB text → bytes; empty/invalid → 0 (= Host built-in default cap). */
export declare function gibTextToBytes(text: string | number | null | undefined): number;
/** Trimmed error text from an API envelope, else the caller's fallback. */
export declare function apiErrorMessage(value: {
    error?: string;
} | null | undefined, fallback: string): string;
export type TestStatus = 'success' | 'warning' | 'error';
/** Rendered shape of one connection test result. */
export interface ConnectionTestView {
    status: TestStatus;
    /** Localized status line (caller resolves the keys). */
    titleKey: 'connection.testOk' | 'connection.testWarn' | 'connection.testFail';
    /** Raw warning returned by the Host (successful connect with degraded key path). */
    warning: string;
    /** stdout for success, stderr/error text for failure. */
    detail: string;
}
/**
 * Map `testConnection` output to the card feedback. A successful probe that
 * carries `warning` stays a warning (never collapsed into a plain success).
 */
export declare function connectionTestView(result: TestConnectionResponse | null | undefined): ConnectionTestView;
/** Stable row key; same spelling the vendored importer used for selection. */
export declare function importHostKey(host: SshConfigHost): string;
/** Default selection: every discovered host (upstream opened all checked). */
export declare function selectAllHosts(hosts: SshConfigHost[]): Record<string, boolean>;
/** Toggle one selection key without mutating the previous map. */
export declare function toggleHostSelection(selected: Record<string, boolean>, key: string): Record<string, boolean>;
/** Selected hosts, in discovery order (never trusts map iteration order). */
export declare function selectedHosts(hosts: SshConfigHost[], selected: Record<string, boolean>): SshConfigHost[];
/** Count of checked rows. */
export declare function countSelected(selected: Record<string, boolean>): number;
/**
 * Exact import mapping kept from the vendored face: name, host, port, user,
 * keyPath (identityFile), proxyJump; key auth, empty password, remoteRoot ~.
 */
export declare function importProfilePayload(host: SshConfigHost): SaveProfilePayload;
/** One save attempt inside an import run. */
export interface ImportItemOutcome {
    key: string;
    name: string;
    hostName: string;
    ok: boolean;
    /** Host/transport error text (absent when ok). */
    error?: string;
    /** Synthesized reason when the call resolved without an envelope. */
    errorCode?: 'no-result';
}
/** Aggregated per-run statistics (never "selected size" as success count). */
export interface ImportSummary {
    outcomes: ImportItemOutcome[];
    okCount: number;
    failCount: number;
    failedHosts: SshConfigHost[];
}
/** Injected `saveProfile` port (the vendored api wrapper satisfies this). */
export type SaveProfileCall = (payload: SaveProfilePayload) => Promise<{
    ok?: boolean;
    error?: string;
} | null | undefined>;
/**
 * Import hosts one by one. Each item is checked individually:
 * - `ok: true` counts as success;
 * - `ok: false` (or any thrown request error) counts as failure with its reason;
 * - a missing envelope counts as failure (`errorCode: 'no-result'`) so a
 *   silent transport layer can never be reported as imported.
 *
 * Sequential on purpose: profile saves rewrite one settings table, and the
 * calls are cheap compared to SSH; this also keeps progress deterministic.
 */
export declare function runImport(hosts: SshConfigHost[], saveProfile: SaveProfileCall, options?: {
    onProgress?: (done: number, total: number, host: SshConfigHost) => void;
}): Promise<ImportSummary>;
/**
 * Fold a failed-only retry run into the previous summary: previously
 * successful items stay successes (they are never resubmitted), failed items
 * take the retry outcome.
 */
export declare function mergeImportRetry(previous: ImportSummary, retry: ImportSummary): ImportSummary;
/** Controlled draft of one workspace's write-back / sync settings. */
export interface GuardDraft {
    writeBack: boolean;
    writeBackExclude: string;
    syncPaths: string;
    syncExclude: string;
    syncMaxBytes: string;
}
/** Draft initialized from a persisted record (defaults match the Host). */
export declare function guardDraftFromWorkspace(workspace: RemoteSshWorkspace): GuardDraft;
/** Drafts + baselines keyed by workspace id. */
export declare function guardsFromWorkspaces(workspaces: RemoteSshWorkspace[]): Record<string, GuardDraft>;
/** Canonical signature: list formatting / "2" vs "2.0" must not look dirty. */
export declare function guardDraftSignature(draft: GuardDraft): string;
/** Whether the draft differs semantically from the persisted baseline. */
export declare function isGuardDraftDirty(draft: GuardDraft, baseline: GuardDraft): boolean;
/** Exact `updateWorkspaceGuards` body — always carries the target workspace id. */
export declare function toUpdateWorkspaceGuardsPayload(workspaceId: string, draft: GuardDraft): UpdateWorkspaceGuardsPayload;
/**
 * Reconcile drafts with a freshly persisted list. Dirty drafts survive a
 * reload (their baseline moves to the new server truth); clean drafts adopt
 * it. Records removed on the Host disappear. A draft with no baseline is
 * treated as dirty so an unrelated refresh can never wipe typed text.
 */
export declare function reconcileGuards(previousDrafts: Record<string, GuardDraft>, previousBaselines: Record<string, GuardDraft>, workspaces: RemoteSshWorkspace[]): {
    drafts: Record<string, GuardDraft>;
    baselines: Record<string, GuardDraft>;
};
/** Controlled draft of the advanced section. */
export interface PrefsDraft {
    nodePath: string;
    writeBackFailure: 'error' | 'log';
    writeBackFreshness: boolean;
    defaultSyncPaths: string;
    defaultSyncExclude: string;
    defaultSyncMaxBytes: string;
}
/** Host preferences → draft (same projection the vendored face used). */
export declare function prefsDraftFromApi(prefs: RemoteSshPrefs | null | undefined): PrefsDraft;
/** Canonical preference signature for dirty detection. */
export declare function prefsDraftSignature(draft: PrefsDraft): string;
/** Whether the advanced draft differs from the saved preferences. */
export declare function isPrefsDraftDirty(draft: PrefsDraft, baseline: PrefsDraft): boolean;
/** Exact `savePrefs` body (array conversions + GiB → bytes). */
export declare function toSavePrefsPayload(draft: PrefsDraft): SavePrefsPayload;
/**
 * Reconcile the advanced draft with a fresh `getPrefs` read: unsaved edits
 * survive, clean drafts adopt server truth. Baselines always follow the
 * server so the dirty badge compares against what is actually stored.
 */
export declare function reconcilePrefs(previousDraft: PrefsDraft | null, previousBaseline: PrefsDraft | null, serverDraft: PrefsDraft): {
    draft: PrefsDraft;
    baseline: PrefsDraft;
};
