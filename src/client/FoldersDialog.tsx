/**
 * The folder dialog of one workspace row: the base folder first, then every
 * extra folder in stored order. A row is chosen as the root (the folder new
 * sessions default to); open/remove act per row, and the base folder is never
 * removable because the workspace's canonical directory cannot be dropped.
 *
 * Folders come in two kinds, and the add area switches between them:
 * · local — a directory picked on this machine (`pickDirectory`);
 * · cloud — a directory on an SSH host, browsed through the SSH plugin's own
 *   pooled session, then registered as a mirror-backed workspace.
 *
 * Cloud browsing lives here rather than behind a second modal: the dialog body
 * swaps to the remote tree, so no stacked overlays are needed and the current
 * location stays readable at the top.
 */
import { useEffect, useState } from 'react'
import {
  Button,
  IconFolderOpenOutlineRegular,
  IconTrashOutlineRegular,
  Modal,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import { effectiveFolders, memberOf, rootOf, samePath, type WorkspaceFolderEntry } from '../core/folders.ts'
import type { GroupsBrowserProps } from './contract.ts'
import { folderLabel } from './tree.ts'
import {
  listRemoteDirectory,
  remoteDirJoin,
  remoteDirParent,
  type RemoteDirEntry,
  type RemoteProfileSummary,
} from './folder-directory.ts'

/** Which kind of folder the add area currently offers. */
type AddMode = 'local' | 'cloud'

/** Relative path of `picked` inside `root`: '' for the root itself, null outside. */
function subfolderOf(root: string | null, picked: string): string | null {
  if (root === null) return null
  const base = root.trim().replace(/\/+$/u, '')
  if (base === '') return null
  if (picked === base) return ''
  return picked.startsWith(`${base}/`) ? picked.slice(base.length + 1) : null
}

export function FoldersDialog({ workspace, entry, t, busy, canOpen, remote, ownerRemotePath, profiles, profilesError, knownWorkspaceIds, onClose, onAddFolder, onAddRemote, onAddSubpath, onSetRoot, onRemove, onOpenFolder }: {
  workspace: WorkspaceView
  entry: WorkspaceFolderEntry | undefined
  t: GroupsBrowserProps['t']
  busy: boolean
  canOpen: boolean
  /** Remote (mirror-backed) workspace: extra folders can also be typed subpaths. */
  remote: boolean
  /** Remote root of a cloud owner, so a browsed subdirectory joins as a subfolder. */
  ownerRemotePath: string | null
  /** SSH connections, `null` while loading or when the remote-ssh plugin is absent. */
  profiles: readonly RemoteProfileSummary[] | null
  profilesError: string | null
  /** Live workspace ids, so a member whose workspace is gone can say so. */
  knownWorkspaceIds: readonly string[]
  onClose: () => void
  /** Pick any directory (local or an already-mirrored cloud folder). */
  onAddFolder: () => void
  /** Register one cloud folder: returns true once it is stored. */
  onAddRemote: (profileId: string, remotePath: string) => Promise<boolean>
  onAddSubpath: (relative: string) => Promise<boolean>
  onSetRoot: (path: string) => void
  onRemove: (path: string, deleteRecord: boolean) => void
  onOpenFolder: (path: string) => void
}) {
  const folders = effectiveFolders(workspace.path, entry)
  const root = rootOf(workspace.path, entry)
  const [addMode, setAddMode] = useState<AddMode>('local')
  // Path of the remote member whose removal awaits the delete-record choice.
  const [confirmRemovePath, setConfirmRemovePath] = useState<string | null>(null)
  const [profileId, setProfileId] = useState('')
  const [remotePath, setRemotePath] = useState('')
  const [browsing, setBrowsing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const profileChoices = profiles ?? []
  const knownIds = new Set(knownWorkspaceIds)
  const selectedProfile = profileChoices.some(profile => profile.id === profileId)
    ? profileId
    : (profileChoices[0]?.id ?? '')
  const currentProfile = profileChoices.find(profile => profile.id === selectedProfile)
  /** One field, two shapes: a bare name creates a subdirectory inside THIS
   *  project's remote root, anything with a separator registers a new cloud
   *  workspace. Keeping them in one field removed a whole extra row from a
   *  ~330px wide dialog. */
  const typed = remotePath.trim()
  const asSubfolder = remote && typed !== '' && !/[/\\~]/u.test(typed)
  const submitAdd = (): void => {
    if (typed === '' || busy) return
    if (asSubfolder) {
      void onAddSubpath(typed).then(success => { if (success) setRemotePath('') })
      return
    }
    if (selectedProfile === '') return
    void onAddRemote(selectedProfile, typed).then((success) => {
      if (!success) return
      setRemotePath('')
      setBrowsing(false)
    })
  }

  if (browsing && currentProfile !== undefined) {
    return (
      <RemoteFolderPicker
        profile={currentProfile}
        startPath={remotePath.trim() === '' ? (ownerRemotePath ?? currentProfile.remoteRoot) : remotePath.trim()}
        t={t}
        busy={busy}
        onPick={(picked) => {
          const relative = subfolderOf(ownerRemotePath, picked)
          if (relative === '' && ownerRemotePath !== null) {
            // Already this project's base folder: nothing to add, say so.
            setNotice(t('folder.alreadyRoot'))
            setBrowsing(false)
            return
          }
          if (relative !== null) {
            // Inside the owner's remote root: one folder of this mirror, no second copy.
            void onAddSubpath(relative).then((success) => {
              if (success) {
                setNotice(null)
                setBrowsing(false)
              }
            })
            return
          }
          setRemotePath(picked)
          setBrowsing(false)
        }}
        onCancel={() => { setBrowsing(false) }}
      />
    )
  }

  const cloudAvailable = profiles !== null
  const extraFolders = folders.length > 1
  // A cloud project's directory is a generated mirror id, so the header names the
  // place a human recognises: the remote root, when we managed to read it.
  const ownerPath = remote ? (ownerRemotePath ?? workspace.path) : workspace.path
  return (
    <Modal
      open
      onClose={onClose}
      closeLabel={t('close')}
      title={t('folder.title')}
      footer={(
        <Button variant="primary" onClick={onClose}>{t('folder.done')}</Button>
      )}
    >
      <div className="wgFolderBody">
        <header className="wgFolderHead">
          <span className="wgFolderHeadName" title={workspace.title}>{workspace.title}</span>
          <code className="wgFolderHeadPath" title={ownerPath}>{ownerPath}</code>
        </header>

        <section className="wgFolderSection">
          <div className="wgFolderSectionTitle">{t('folder.sectionList')}</div>
          <div className="wgFolderList" role="list" aria-label={t('folder.listAria')}>
            {folders.map((path, index) => {
              const isBase = index === 0
              const isRoot = samePath(path, root)
              const member = memberOf(entry, path)
              // A cloud member's directory is a generated mirror id, so the dialog
              // names it by its remote path/title, exactly like the sidebar row does.
              // The base folder is named by the workspace title for the same reason.
              const label = isBase
                ? workspace.title
                : member?.kind === 'remote'
                  ? (member.title ?? folderLabel(member.remotePath ?? path))
                  : folderLabel(path)
              const displayPath = member === undefined
                ? (isBase ? ownerPath : path)
                : (member.remotePath ?? member.path)
              // A member whose own workspace disappeared (deleted outside this
              // overlay, or an SSH record the plugin dropped) keeps its row so the
              // user can still remove it, but says that it cannot run sessions.
              const memberGone = member !== undefined && !knownIds.has(member.workspaceId)
              const canDeleteRecord = member?.kind === 'remote' && member.recordId !== undefined && member.recordId !== ''
              return (
                <div key={path}>
                <div className="wgFolderListRow" role="listitem" data-active={isRoot}>
                  <label className="wgFolderRootPick" title={t('folder.rootBadge')}>
                    <input
                      type="radio"
                      className="wgFolderRadio"
                      name="wg-folder-root"
                      checked={isRoot}
                      aria-label={`${t('folder.rootBadge')} ${label}`}
                      onChange={() => { onSetRoot(path) }}
                    />
                  </label>
                  <span className="wgFolderEntry">
                    <span className="wgFolderListLabel" title={path}>{label}</span>
                    <code className="wgFolderListPath" title={displayPath}>{displayPath}</code>
                  </span>
                  <span className="wgFolderListTags">
                    {isBase && <span className="wgFolderListTag" data-tone="base">{t('folder.base')}</span>}
                    {isRoot && <span className="wgFolderListTag" data-tone="root">{t('folder.rootBadge')}</span>}
                    {member !== undefined && (
                      <span className="wgFolderListTag" data-tone={member.kind === 'remote' ? 'cloud' : 'local'}>
                        {member.kind === 'remote' ? t('folder.cloudTag') : t('folder.localTag')}
                      </span>
                    )}
                    {memberGone && (
                      <span className="wgFolderListTag" data-tone="danger" role="alert">{t('folder.memberMissing')}</span>
                    )}
                  </span>
                  <span className="wgFolderListActions">
                    {canOpen && (
                      <button
                        type="button"
                        className="wgIconButton"
                        aria-label={`${t('workspace.openInFolder')} ${label}`}
                        onClick={() => { onOpenFolder(path) }}
                      >
                        <IconFolderOpenOutlineRegular size={16} />
                      </button>
                    )}
                    {!isBase && (
                      <button
                        type="button"
                        className="wgIconButton"
                        aria-label={`${t('folder.remove')} ${label}`}
                        onClick={() => {
                          // A remote member can take its backing workspace
                          // with it; ask which removal the user means first.
                          if (canDeleteRecord) setConfirmRemovePath(path)
                          else onRemove(path, false)
                        }}
                      >
                        <IconTrashOutlineRegular />
                      </button>
                    )}
                  </span>
                </div>
                {confirmRemovePath === path && (
                  <div className="wgFolderConfirm" role="alert">
                    <span className="wgFolderConfirmText">{t('folder.removeRemotePrompt')}</span>
                    <span className="wgFolderConfirmActions">
                      <button
                        type="button"
                        className="wgFolderConfirmButton"
                        data-tone="danger"
                        onClick={() => { setConfirmRemovePath(null); onRemove(path, true) }}
                      >
                        {t('folder.removeRemoteDelete')}
                      </button>
                      <button
                        type="button"
                        className="wgFolderConfirmButton"
                        onClick={() => { setConfirmRemovePath(null); onRemove(path, false) }}
                      >
                        {t('folder.removeRemoteOnly')}
                      </button>
                      <button
                        type="button"
                        className="wgFolderConfirmButton"
                        onClick={() => { setConfirmRemovePath(null) }}
                      >
                        {t('cancel')}
                      </button>
                    </span>
                  </div>
                )}
                </div>
              )
            })}
          </div>
          {!extraFolders && <p className="wgFolderEmpty">{t('folder.emptyHint')}</p>}
        </section>

        <section className="wgFolderAdd">
          <div className="wgFolderSectionTitle">{t('folder.sectionAdd')}</div>
          <div className="wgFolderSegmented" role="tablist" aria-label={t('folder.addAria')}>
            <button
              type="button"
              role="tab"
              className="wgFolderTab"
              aria-selected={addMode === 'local'}
              onClick={() => { setAddMode('local'); setNotice(null) }}
            >
              {t('folder.tabLocal')}
            </button>
            {cloudAvailable && (
              <button
                type="button"
                role="tab"
                className="wgFolderTab"
                aria-selected={addMode === 'cloud'}
                onClick={() => { setAddMode('cloud'); setNotice(null) }}
              >
                {t('folder.tabCloud')}
              </button>
            )}
          </div>
          {notice !== null && <p className="wgFolderNote" role="status">{notice}</p>}

          {addMode === 'local'
            ? (
                <div className="wgFolderLocalPane">
                  {/* Full width, own line: the action used to share a row with the
                      consequence text and the label wrapped onto two lines. */}
                  <button type="button" className="wgFolderPick" disabled={busy} onClick={onAddFolder}>
                    <span className="wgFolderPickPlus" aria-hidden>＋</span>
                    <span>{t('folder.pickLocal')}</span>
                  </button>
                  <p className="wgFolderHint">{remote ? t('folder.localIntoRemote') : t('folder.localNote')}</p>
                </div>
              )
            : (
                <>
                  {/* One control per line: the dialog body is only ~330px wide, so a
                      profile select, a path field and a labelled button cannot share
                      a row without squeezing one of them. Browsing therefore docks
                      into the path field as an icon instead of its own button. */}
                  <div className="wgFolderStack">
                    {profileChoices.length === 0
                      ? <p className="wgFolderNote">{t('folder.noProfiles')}</p>
                      : (
                          <select
                            className="wgFolderSubpathInput wgFolderSelect"
                            value={selectedProfile}
                            aria-label={t('folder.profileLabel')}
                            disabled={busy}
                            onChange={event => setProfileId(event.target.value)}
                          >
                            {profileChoices.map(profile => (
                              <option key={profile.id} value={profile.id}>
                                {profile.host === '' ? profile.name : `${profile.name} (${profile.user}@${profile.host})`}
                              </option>
                            ))}
                          </select>
                        )}
                    <div className="wgFolderField">
                      <input
                        type="text"
                        className="wgFolderSubpathInput wgFolderFieldInput"
                        value={remotePath}
                        placeholder={t(remote ? 'folder.remotePathOrName' : 'folder.remotePathPlaceholder')}
                        aria-label={t(remote ? 'folder.remotePathOrName' : 'folder.remotePathLabel')}
                        disabled={busy}
                        onChange={event => setRemotePath(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return
                          event.preventDefault()
                          submitAdd()
                        }}
                      />
                      <button
                        type="button"
                        className="wgFolderFieldAction"
                        title={t('folder.browse')}
                        aria-label={t('folder.browse')}
                        disabled={busy || currentProfile === undefined}
                        onClick={() => { setBrowsing(true) }}
                      >
                        <IconFolderOpenOutlineRegular size={15} />
                      </button>
                    </div>
                    <div className="wgFolderActions">
                      <Button
                        variant="primary"
                        disabled={busy || typed === '' || (!asSubfolder && selectedProfile === '')}
                        onClick={submitAdd}
                      >
                        {t(asSubfolder ? 'folder.createAndAdd' : 'folder.addRemote')}
                      </Button>
                    </div>
                  </div>
                  <p className="wgFolderHint">{t(remote ? 'folder.cloudNoteBoth' : 'folder.cloudNote')}</p>
                </>
              )}
          {profilesError !== null && (
            <p className="wgFolderNote" role="alert">{t('folder.profilesError')}: {profilesError}</p>
          )}
        </section>
      </div>
    </Modal>
  )
}

/**
 * Browse one SSH host and pick a directory. Entries come from the SSH plugin's
 * `listDir`, so the local machine never runs a copy of the remote tree and the
 * connection's own auth (key, password, ProxyJump) is reused unchanged.
 */
function RemoteFolderPicker({ profile, startPath, t, busy, onPick, onCancel }: {
  profile: RemoteProfileSummary
  startPath: string
  t: GroupsBrowserProps['t']
  busy: boolean
  onPick: (path: string) => void
  onCancel: () => void
}) {
  const [path, setPath] = useState(startPath)
  const [resolved, setResolved] = useState(startPath)
  const [entries, setEntries] = useState<readonly RemoteDirEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(null)
    void listRemoteDirectory(profile.id, path).then(
      (listing) => {
        if (!live) return
        setEntries(listing.entries)
        setResolved(listing.resolved)
        setLoading(false)
        // The shell resolved `~` or a relative name: browse the real place next
        // so "up" and the children join behave like an absolute path.
        if (listing.resolved !== path) setPath(listing.resolved)
      },
      (reason: unknown) => {
        if (!live) return
        setError(reason instanceof Error ? reason.message : String(reason))
        setLoading(false)
      },
    )
    return () => { live = false }
  }, [profile.id, path, reloadKey])

  const parent = remoteDirParent(resolved)
  const directories = entries.filter(entry => entry.type === 'directory')
  const choose = (): void => { onPick(resolved) }
  return (
    <Modal
      open
      onClose={onCancel}
      closeLabel={t('close')}
      title={`${t('folder.browseTitle')} · ${profile.name}`}
      footer={(
        <>
          <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
          <Button variant="primary" disabled={busy || loading || error !== null} onClick={choose}>
            {t('folder.chooseHere')}
          </Button>
        </>
      )}
    >
      <div className="wgRemoteBar">
        <code className="wgRemotePath" title={resolved}>{resolved}</code>
        <span className="wgRemoteActions">
          <Button variant="outline" disabled={parent === null || loading} onClick={() => { if (parent !== null) setPath(parent) }}>
            {t('folder.up')}
          </Button>
          <Button variant="outline" disabled={loading} onClick={() => { setPath(profile.remoteRoot) }}>
            {t('folder.home')}
          </Button>
          <Button variant="outline" disabled={loading} onClick={() => { setReloadKey(key => key + 1) }}>
            {t('folder.refresh')}
          </Button>
        </span>
      </div>
      <div className="wgRemoteList" role="list" aria-label={t('folder.browseListAria')}>
        {loading && <p className="wgFolderNote">{t('folder.loading')}</p>}
        {!loading && error !== null && (
          <p className="wgFolderNote" role="alert">{t('folder.browseFailed')}: {error}</p>
        )}
        {!loading && error === null && directories.length === 0 && (
          <p className="wgFolderNote">{t('folder.emptyDir')}</p>
        )}
        {!loading && error === null && directories.map(entry => (
          <button
            key={entry.name}
            type="button"
            role="listitem"
            className="wgRemoteRow"
            onClick={() => { setPath(remoteDirJoin(resolved, entry.name)) }}
          >
            <IconFolderOpenOutlineRegular size={16} />
            <span className="wgRemoteName">{entry.name}</span>
          </button>
        ))}
      </div>
      <p className="wgFolderNote">{t('folder.browseNote')}</p>
    </Modal>
  )
}
