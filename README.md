<p align="right">
  <strong>English</strong> · <a href="./README_ZH.md">简体中文</a>
</p>

# dsh-better-workspace-group

A workspace grouping plugin for DeepSeek Harness. Built on [z-col/dsh-workspace-groups](https://github.com/z-col/dsh-workspace-groups), it keeps workspaces, folders, and sessions easier to organize and use from the sidebar.

## Merged bundle: workspace-groups-remote

This tree merges two DSH plugins into **one installable bundle** (package `workspace-groups-remote`):

- **workspace-groups** (this repository's original content): the sidebar grouping manager and session tab strip. Its host half builds from `src/` to `lib/groups.js`; its client half lives in `src/client/groups-client.ts`.
- **@zhangfengshun/dsh-remote-ssh** 2.4.45 (MIT, © ZhangFengshun): vendored verbatim under `vendor/dsh-remote-ssh/`. Its host half ships **unbundled** as `lib/remote-ssh/index.js` — it must resolve `@deepseek-ai/schemastery` from the host's module table, because its Config schema relies on the DSH-branch schemastery `.volatile()` marker. The shipped host artifact carries **a small local patch set**, applied at build time by `scripts/patch-remote-ssh.mjs` with the vendor tree kept pristine (see "Duplicate remote folders" and "Security hardening" below). Its client ships upstream as a self-registering module-loader bundle; `scripts/build-remote-ssh-client.mjs` extracts the bare factory at build time and the merged client entry (`src/client/index.ts`) applies it next to the groups client.

### Duplicate remote folders — fixed in this bundle

Upstream's `createRemoteWorkspace` matched existing records by the raw `remotePath` string, so the same remote directory spelled two ways (`~/proj` vs `/home/u/proj` vs `proj/`) registered a **second workspace record, local mirror and native workspace** — visible as two folder rows for one remote project. This bundle fixes it in two layers:

- **Host (build-time patch, `scripts/patch-remote-ssh.mjs`)**: registration compares light-normalized spellings first; on a miss it resolves the path once over SSH (`pwd -P` + `$HOME`) and compares canonical forms, storing the canonical spelling. Resolution failures are fail-open (creation proceeds as upstream). Behavior is covered by `npm run test:patch`; the vendored tree stays pristine, so upstream updates still drop in.
- **Client (groups)**: adding a cloud folder also refuses when an existing member is backed by the same workspace, or names the same connection + remote directory, regardless of mirror paths.

Already-duplicated projects are not merged automatically (sessions belong to their workspace); remove the duplicate member from the folder dialog once its session is no longer needed — that deletes the duplicate record with it.

### Security hardening (also in the patch set)

Fixes from a 2026-11-11 audit, all applied by the same build-time patch script (behavior covered by `npm run test:patch`, including end-to-end runs of the generated terminal wrapper):

- **ssh option injection**: every internal connection is built by `sshArgv`, which now inserts `--` before the `user@host` target, so a user/host value starting with `-` (e.g. `-oProxyCommand=...`, reachable via the remote_ssh tools' inline arguments) can no longer be parsed as an ssh option and execute local commands. The terminal wrapper's own argv gets the same `--`.
- **POSIX password handling**: `sshpass -p` (password visible in the process list to every local user) becomes `sshpass -e`, with the password passed via the `SSHPASS` environment variable — matching the Windows env-based path.
- **Terminal wrapper trust**: the generated `dsh-remote-shell` previously honored a `.remote-ssh.json` in ANY directory with host-key checking fully off. It now only honors the marker when the cwd is a registered mirror root (a direct child of `~/.dsh/remote-workspaces`, exactly where the host writes it), uses `StrictHostKeyChecking=accept-new`, and passes `remotePath` to the remote shell base64-encoded so quotes/`$()` in a directory name stay inert data.
- **Remote path escape**: `localToRemote` now folds `.`/`..` segments lexically and refuses a path whose `..` would climb above the mirror root, instead of mapping fs requests outside the remote workspace root.
- **Write-back guard fails closed**: if the workspace settings cannot be read, the write-back push is skipped (and surfaced through the `writeBackFailure` channel) instead of pushing with the `writeBack` / `writeBackExclude` guard never evaluated.

`lib/index.js` (source: `bundle/index.js`) is composition only — it applies both plugins on one fiber. `cordis.patch.yml` inserts a single row for this package and carries remote-ssh's `better-sidebar` / `terminal-controller` shell overrides over verbatim.

### Install / migrate

1. Remove the two old bundles from the profile (`workspace-groups-local` and `@zhangfengshun/dsh-remote-ssh`).
2. Add this package instead and fully restart DSH.

Stored data is untouched by the merge: `~/.dsh/workspace-groups.yaml` and the `$DSH_HOME` sidecars, the `dsh-remote-ssh` settings namespace, and `~/.dsh/remote-ssh/` all keep working. If you ever set remote-ssh options in its old bundle row, they now nest: `config: { remoteSsh: { ... } }` (connection profiles live in DSH settings either way).

### Verify

```sh
npm install
npm run build
npm run verify:bundle   # composition checks over the built artifacts, incl. vendor integrity + an executable client smoke
npm run verify          # everything: tsc + vitest + verify:bundle + patch behavior tests
```

The vendored upstream suite also runs in place once its dependencies resolve — from the repo root: `ln -s ../../node_modules vendor/dsh-remote-ssh/node_modules`, then `node tests/run-all.mjs` inside `vendor/dsh-remote-ssh`. Known pre-existing failures off Windows: 6 groups folders tests use `C:\` paths, and a few remote-ssh suites assume WSL / Windows path semantics; both fail identically in the unmerged upstreams.

### Known trade-offs

- **Load coupling**: the two halves load as one bundle, so if either half ever fails to import, the whole package fails — grouping included. That is the price of the single install entry; splitting failure domains would need the host to support lazy per-half loading, which it does not promise today.
- **Shell overrides apply to every install**: the bundle carries remote-ssh's `better-sidebar` / `terminal-controller` shell overrides, so installing this package also replaces the profile's terminal shell integration (that is what makes mirror terminals auto-connect). What the host's patch engine does when an override target is absent from a future host version is not verified — it is on the real-machine checklist.
- **First connection to a new SSH host is not fingerprint-confirmed** (`accept-new`, the same default as VS Code Remote-SSH): the internal channel trusts a host key on first sight and fails loudly if it changes afterwards. The terminal wrapper was raised from `no` to the same `accept-new` level by the patch set.

### Maintenance

The vendored code is not a fork: to update remote-ssh, replace `vendor/dsh-remote-ssh/` with the new upstream tree, run `npm run vendor:manifest` to re-record its sha256 manifest, and rebuild — the client transform asserts its anchors and fails loudly if upstream changes its bundle wrapper shape. Local changes outside the vendor tree: `src/client/GroupsBrowser.tsx` narrows a possibly-null ref explicitly (`pending !== null && ...`) because the fork's `tsc` types step rejected the optional-chain form (semantics unchanged), and the duplicate-folder guards described above (`src/core/folders.ts`, `addRemoteFolderTo`). The host patch script likewise asserts its anchors and fails loudly if upstream changes the anchored code.

## Preview

<img src="screenshot.png" alt="Workspace grouping plugin preview" width="280" />

## Implemented features

- **Workspace groups**: browse by group → project → session, with group creation, renaming, deletion, folding, and pinning.
- **Drag-and-drop organization**: move projects into or out of groups and reorder groups and projects.
- **Group appearance**: set group colors and icons, including a new Materials & Lab section for lab work, material structures, characterization, and functional devices.
- **Multiple folders per project**: attach extra folders, choose the default root, and place sessions under the folder that matches their working directory.
- **Local and remote directories**: create folders in local workspaces and registered SSH remote workspaces without falling back to a local mirror when a remote operation fails.
- **Session tabs**: open, switch, pin, rename, reorder, and close tabs, including closing other tabs or tabs to the right.
- **Sidebar refinements**: keep the default workspace pinned at the bottom, align row metadata and actions consistently, and scroll long appearance dialogs.
- **Search and persistence**: search sessions without losing their group context and keep groups, ordering, tabs, and folder settings across refreshes and restarts.

## Install

For the Desktop profile:

```sh
dsh plugin --profile desktop add github:newbieQQ/dsh-better-workspace-group
```

For Web, replace `desktop` with `web`. Fully restart DSH or the corresponding Web profile after installation.

## Basic use

1. Click **New Group** in the workspace header, then drag projects into it.
2. Use the `⋯` menu on a project or group to manage grouping, appearance, and folders.
3. Open **Folders…** on a project to attach folders or choose its default root.

For automatic grouping by path or name, see [workspace-groups.example.yaml](./workspace-groups.example.yaml) and configure `~/.dsh/workspace-groups.yaml`. Manual grouping works without this file.

## Uninstall

```sh
dsh plugin --profile desktop remove workspace-groups-local
```

## Credit and license

The original project was created by [zcol](https://github.com/z-col) under the MIT License. This fork adds Materials & Lab icons, the bottom default-workspace bar, consistent row actions, remote-workspace folders, and other refinements.

Original work © 2026 zcol; modifications © 2026 newbieQQ. See [LICENSE](./LICENSE) and [NOTICE.md](./NOTICE.md).
