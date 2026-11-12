// Build step for the merged bundle: produce lib/remote-ssh/index.js from the
// vendored upstream host half (vendor/dsh-remote-ssh/lib/index.js, kept
// pristine) with the bundle's local patch set applied. Every edit is
// anchor-asserted: if upstream changes the anchored code, the build fails
// loudly instead of silently shipping an unpatched file.
//
// Patch 1 — canonical remote-path identity in createRemoteWorkspace:
// upstream's issue-#32 reuse lookup compares remotePath as a raw string, so
// the same remote directory spelled two ways (~/proj vs /home/u/proj vs
// proj/) registers a second workspace record, a second local mirror and a
// second native workspace — the "duplicate folder" bug. The patch compares
// light-normalized spellings first; on a miss it resolves the path once
// over SSH (pwd -P + $HOME) and compares canonical forms, storing the
// canonical spelling so records converge. Resolution failures are
// fail-open: creation proceeds with the light form, exactly as upstream,
// never blocked.
//
// Patch 2 — ssh argv hardening in sshArgv (the single constructor every
// internal connection flows through):
//   a) "--" is inserted before the user@host target. Profile fields reach
//      this point from settings, ~/.ssh/config imports and the remote_ssh
//      tools' inline arguments; a user/host value starting with "-" (e.g.
//      -oProxyCommand=...) would otherwise be parsed as an ssh option and
//      execute LOCAL commands, breaking the tools' "remote only" boundary.
//   b) POSIX password auth uses `sshpass -e` (password via the SSHPASS
//      environment variable, merged into the spawn env by the caller)
//      instead of `sshpass -p`, which leaves the password in the process
//      list, readable by every local user via ps / /proc/<pid>/cmdline —
//      on the shared login nodes this plugin targets, that is everyone.
//      (The Windows path already passes its password via env.)
//
// Patch 3 — the generated terminal shell wrapper (dsh-remote-shell):
//   a) The marker file .remote-ssh.json is honored only when the cwd IS a
//      direct child of the mirror base ~/.dsh/remote-workspaces — exactly
//      where the host itself writes it. A marker planted in a cloned repo
//      or any other directory must never auto-connect the user's terminal
//      to an attacker's server.
//   b) StrictHostKeyChecking=no becomes accept-new (aligning with the
//      internal channel): a changed host key fails loudly.
//   c) "--" before the user@host target, same as patch 2a.
//   d) remotePath reaches the remote shell base64-encoded and is decoded
//      there, so its content is data, never shell syntax: quotes, $() and
//      backticks in a directory name can no longer break out. (~ still
//      expands on the remote side; a remote without base64 falls back to
//      $HOME exactly as the old code did when cd failed.)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HELPERS = `// ---------------------------------------------------------------------------
// [workspace-groups-remote local patch] Canonical remote-path identity.
// See scripts/patch-remote-ssh.mjs in the merged bundle for the rationale.
// ---------------------------------------------------------------------------

/** Light canonical form of a remote path: trimmed, trailing slashes removed. */
function lightRemotePath(raw) {
  let s = String(raw == null ? "" : raw).trim();
  if (s.length > 1) s = s.replace(/\\/+$/, "");
  return s;
}

/** Expand a leading ~ or ~/ with the remote home directory, when known. */
function expandRemoteHome(path, home) {
  const h = String(home == null ? "" : home).replace(/\\/+$/, "");
  if (!h) return path;
  if (path === "~") return h;
  if (path.startsWith("~/")) return h + path.slice(1);
  return path;
}

/**
 * Resolve a remote path to its canonical absolute form via one SSH round
 * trip (also learns the remote $HOME). Returns { canonical, home }; on any
 * failure canonical falls back to the home-expanded light form and the
 * caller proceeds exactly as upstream would (fail-open).
 */
async function resolveRemoteCanonical(subprocess, p, rawPath) {
  const light = lightRemotePath(rawPath);
  try {
    const cmd = "printf '__DSH_HOME__%s\\n' \\"$HOME\\"; cd " + shellQuotePath(light) + " 2>/dev/null && pwd -P";
    const r = await runRemote(subprocess, p, cmd, undefined, 64 * 1024, undefined, 15000);
    if (!r || !r.ok || !r.stdout) return { canonical: light, home: "" };
    let home = "";
    let resolved = "";
    const lines = String(r.stdout).split("\\n");
    for (const line of lines) {
      const t = line.trim();
      if (t.startsWith("__DSH_HOME__")) home = t.slice("__DSH_HOME__".length).trim();
      else if (t.startsWith("/")) resolved = t;
    }
    if (!resolved) return { canonical: expandRemoteHome(light, home), home: home };
    return { canonical: lightRemotePath(resolved), home: home };
  } catch (e) {
    return { canonical: light, home: "" };
  }
}

/**
 * First symlink under the given root whose target resolves outside it, else null.
 * The sync-down tar stream is remote-controlled: an escaping link extracted
 * into the temp tree would be followed by the copy/swap that lands the tree
 * in the mirror, writing outside it. Bounded walk (directory pops capped).
 */
function findEscapingLink(root) {
  const base = resolvePath(root);
  const stack = [base];
  let guard = 0;
  while (stack.length > 0 && guard++ < 20000) {
    const dir = stack.pop();
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch (e) { continue; }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isSymbolicLink()) {
        let target;
        try { target = readlinkSync(full); } catch (e) { continue; }
        const resolved = resolvePath(dir, target);
        if (resolved !== base && !resolved.startsWith(base + "/") && !resolved.startsWith(base + "\\\\")) return full;
      } else if (entry.isDirectory()) {
        stack.push(full);
      }
    }
  }
  return null;
}

`

const RUNREMOTE_ANCHOR = 'async function runRemote(subprocess, p, remoteCmd, stdinData, maxBytes, extraOpts, timeoutMs, signal) {'

// Load-time self-check inserted with the helpers: the canonical-path patch
// calls upstream internals (runRemote / shellQuotePath) from inside a
// fail-open try/catch, so an upstream rename would otherwise degrade
// silently to unpatched behavior. Fail loudly at module load instead.
const SELF_CHECK = `// [workspace-groups-remote patch] Load-time self-check: if upstream renames
// the internals the canonical-path patch relies on, fail loudly HERE rather
// than silently degrading inside the fail-open resolution path.
if (typeof runRemote !== 'function' || typeof shellQuotePath !== 'function') {
  throw new Error('[workspace-groups-remote] patched remote-ssh: upstream internals changed (runRemote / shellQuotePath not found) — the bundle patch needs re-checking')
}

`

const FIND_ANCHOR = '      const existing = prefsNow.workspaces.find((w) => w && w.profileId === a.profileId && String(w.remotePath) === String(a.remotePath));'

const FIND_REPLACEMENT = `      // [workspace-groups-remote patch] Canonical-path reuse: compare
      // light-normalized spellings first; on a miss, resolve once over SSH
      // (fail-open) and compare canonical forms, so ~/x, x/ and the absolute
      // form of one directory all reuse the existing record instead of
      // registering a duplicate workspace + mirror. The stored spelling
      // converges to the matched/canonical form below.
      let existing = prefsNow.workspaces.find((w) => w && w.profileId === a.profileId && lightRemotePath(w.remotePath) === lightRemotePath(a.remotePath));
      if (existing) {
        a.remotePath = lightRemotePath(a.remotePath);
      } else {
        const resolvedCanonical = await resolveRemoteCanonical(subprocess, p, a.remotePath);
        a.remotePath = resolvedCanonical.canonical;
        existing = prefsNow.workspaces.find((w) => w && w.profileId === a.profileId && expandRemoteHome(lightRemotePath(w.remotePath), resolvedCanonical.home) === resolvedCanonical.canonical);
      }`

// Each entry: [label, anchor, replacement]. Anchors are exact byte strings
// from the vendored file; every one must occur exactly once.
const TRANSFORMS = [
  ['patch 11: settings entry id falls back to the bundle row',
    'const entryId = ownEntryId(ctx, name) || NS;',
    `// [workspace-groups-remote patch] Inside the merged bundle there is no
  // loader row named dsh-remote-ssh: the settings entry lives on the
  // bundle's own row, whose composed plugin exports this plugin's Config.
  // Resolve that row before falling back to the standalone namespace.
  const entryId = ownEntryId(ctx, name) || ownEntryId(ctx, "workspace-groups-remote") || NS;`],

  ['patch 2a: sshArgv "--" before target',
    '  const argv = head.concat(opts, [target]);',
    `  // [workspace-groups-remote patch] "--" ends ssh option parsing: a
  // user/host value starting with "-" (e.g. -oProxyCommand=...) must never
  // be parsed as an ssh option — that would execute local commands.
  const argv = head.concat(opts, ["--", target]);`],
  ['patch 2b: sshpass -e instead of -p',
    '      head = ["sshpass", "-p", String(p.password)];',
    `      // [workspace-groups-remote patch] sshpass -e: the password travels
      // via the SSHPASS env var (passwordEnv below is merged into the spawn
      // env by the caller), not via argv, where any local user could read
      // it from the process list. Mirrors the Windows env-based path.
      head = ["sshpass", "-e"];
      passwordEnv = { SSHPASS: String(p.password) };`],
  ['patch 3a: wrapper requires the os module',
    '    "const { spawn } = require(\'child_process\');",',
    `    "const { spawn } = require('child_process');",
    "const os = require('os');",`],
  ['patch 3a: wrapper only trusts mirror-root marker files',
    '    "  if (fs.existsSync(info)) {",',
    `    "  // [workspace-groups-remote patch] Only a registered mirror root may",
    "  // trigger an automatic connection: the marker file counts solely when",
    "  // the cwd IS a direct child of the mirror base — exactly where the",
    "  // host itself writes it. A .remote-ssh.json planted in a cloned repo",
    "  // or any other directory must never auto-connect the user's terminal.",
    "  const inMirrorRoot = path.dirname(process.cwd()) === path.join(os.homedir(), '.dsh', 'remote-workspaces');",
    "  if (inMirrorRoot && fs.existsSync(info)) {",`],
  ['patch 3b: wrapper host key checking accept-new',
    '    "      const args = [\'-tt\', \'-o\', \'StrictHostKeyChecking=no\', \'-o\', \'ExitOnForwardFailure=no\'];",',
    `    "      // [workspace-groups-remote patch] accept-new, never 'no': a changed",
    "      // host key must fail loudly instead of being silently trusted.",
    "      const args = ['-tt', '-o', 'StrictHostKeyChecking=accept-new', '-o', 'ExitOnForwardFailure=no'];",`],
  ['patch 3c: wrapper "--" before target',
    '    "      args.push(\'-p\', String(port), \'-i\', j.keyPath, j.user + \'@\' + j.host);",',
    `    "      // [workspace-groups-remote patch] '--' ends option parsing, so a",
    "      // user/host value starting with '-' can never become an ssh option.",
    "      args.push('-p', String(port), '-i', j.keyPath, '--', j.user + '@' + j.host);",`],
  ['patch 4: localToRemote folds dot segments, refuses root escape',
    `    if (rel.startsWith("/")) rel = rel.slice(1);
    if (!rel) return remoteBase;
    // 拼接远程路径`,
    `    if (rel.startsWith("/")) rel = rel.slice(1);
    if (!rel) return remoteBase;
    // [workspace-groups-remote patch] Fold "." / ".." segments lexically:
    // a ".." climbing above the mirror root would map the request OUTSIDE
    // the remote workspace (e.g. <mirror>/../../etc/passwd) — refuse
    // instead of silently following it.
    const foldedParts = [];
    for (const seg of rel.split("/")) {
      if (seg === "" || seg === ".") continue;
      if (seg === "..") {
        if (foldedParts.length === 0) throw new Error("remote path escapes the workspace root: " + localPath);
        foldedParts.pop();
        continue;
      }
      foldedParts.push(seg);
    }
    rel = foldedParts.join("/");
    if (!rel) return remoteBase;
    // 拼接远程路径`],
  ['patch 5a: writeBack settings comment (fail-closed)',
    '    // 工作区设置（按镜像目录匹配）；读不到设置时按默认（推、无排除）处理',
    '    // 工作区设置（按镜像目录匹配）；读不到设置时不推（fail-closed —— 见下方 catch 的 PATCH 说明）'],
  ['patch 5b: writeBack settings-read failure fails closed',
    `    } catch (e) {}
    // ---- 护栏 B（issue #24 第二轮）：推之前先看远端这一份有没有被别的写入者改过 ----`,
    `    } catch (e) {
      // [workspace-groups-remote patch] Fail CLOSED: the old empty catch let
      // a settings-read failure push anyway, with the writeBack guard
      // (writeBack=false / writeBackExclude) never evaluated. Skip the push
      // and surface it through the same writeBackFailure channel as a
      // failed push: "error" throws to the caller, "log" warns, "silent"
      // stays quiet.
      const mode = writeBackFailureMode();
      if (mode !== "silent") {
        try { ctx.logger?.warn?.("[dsh-remote-ssh] 读不到工作区设置，写回护栏无法确认，本次不推送: " + String(absPath)); } catch (e2) {}
      }
      if (mode === "error") {
        throw new Error("无法读取工作区设置，写回护栏（writeBack / writeBackExclude）未能确认，本次写入未同步到远端: " + remoteFile);
      }
      return;
    }
    // ---- 护栏 B（issue #24 第二轮）：推之前先看远端这一份有没有被别的写入者改过 ----`],
  ['patch 6: fs imports for the link scan + atomic rename',
    'import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";',
    'import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, lstatSync, readlinkSync, renameSync } from "node:fs";'],
  ['patch 7: freshness state written atomically',
    `    writeFileSync(file, JSON.stringify(data), "utf8");
    freshnessCache = { file: file, data: data };`,
    `    // [workspace-groups-remote patch] Write-then-rename: a crash mid-write
    // must not leave a torn state file behind.
    const tmpFile = file + ".tmp-" + process.pid;
    writeFileSync(tmpFile, JSON.stringify(data), "utf8");
    renameSync(tmpFile, file);
    freshnessCache = { file: file, data: data };`],
  ['patch 8a: remote stat at nanosecond resolution',
    '  try { r = await runner(p, "stat -c\'%s %Y\' " + shellQuotePath(remotePath), undefined, 65536, false); } catch (e) {',
    '  try { r = await runner(p, "stat -c\'%s %Y %N\' " + shellQuotePath(remotePath), undefined, 65536, false); } catch (e) {'],
  ['patch 8b: stamp carries the nanosecond fraction',
    `  const m = /^(\\d+)\\s+(\\d+)$/.exec(out);
  if (r && r.ok && m) return { ok: true, exists: true, stamp: m[1] + ":" + m[2], err: "" };`,
    `  const m = /^(\\d+)\\s+(\\d+)(?:\\s+(\\d+))?$/.exec(out);
  if (r && r.ok && m) return { ok: true, exists: true, stamp: m[1] + ":" + m[2] + (m[3] ? "." + m[3] : ""), err: "" };`],
  ['patch 8c: verdict tolerates pre-upgrade second-resolution stamps',
    `  if (before && before.ok && before.exists) {
    if (String(before.stamp) === prev) return { changed: false, unknown: false, why: "" };`,
    `  if (before && before.ok && before.exists) {
    if (String(before.stamp) === prev) return { changed: false, unknown: false, why: "" };
    // [workspace-groups-remote patch] Stamps recorded before the nanosecond
    // upgrade carry no fraction — compare those at second precision instead
    // of reporting a phantom change on every tracked file.
    if (!prev.includes(".") && String(before.stamp).startsWith(prev + ".")) return { changed: false, unknown: false, why: "" };`],
  ['patch 9: matchRemoteWorkspace folds case only on Windows',
    '    const norm = (p) => String(p || "").replace(/\\\\/g, "/").replace(/\\/+$/, "").toLowerCase();',
    `    // [workspace-groups-remote patch] Fold case only where the filesystem
    // is case-insensitive (Windows); on POSIX a fold can match a DIFFERENT
    // workspace whose mirror differs only by letter case.
    const foldCase = process.platform === "win32";
    const norm = (p) => { const v = String(p || "").replace(/\\\\/g, "/").replace(/\\/+$/, ""); return foldCase ? v.toLowerCase() : v; };`],
  ['patch 10: findMirrorRoot trusts markers only at a real mirror root',
    '        if (info && info.host && info.user && info.remotePath) return { root: dir, info: info };',
    `        // [workspace-groups-remote patch] Trust a marker only at a real
        // mirror root — a directory directly under the mirror base, exactly
        // where the host writes it. The walk passes through arbitrary
        // parent directories; a marker planted there must not steer
        // write-back to an attacker's host.
        if (info && info.host && info.user && info.remotePath && dirname(dir) === join(homedir(), ".dsh", "remote-workspaces")) return { root: dir, info: info };`],
  ['patch 11: sync-down refuses escaping links before the tree lands',
    `  const pipe = await runTarPipe(sshH, tarH, o.timeoutMs, { label: "同步", a: "ssh", b: "tar" }, signal);
  if (!pipe.ok) {
    try { await rm(tmpDir, { recursive: true, force: true }); } catch (e) {}
    return { ok: false, error: pipe.error + "（本地镜像未改动，已丢弃本次拉取的内容）" };
  }`,
    `  const pipe = await runTarPipe(sshH, tarH, o.timeoutMs, { label: "同步", a: "ssh", b: "tar" }, signal);
  if (!pipe.ok) {
    try { await rm(tmpDir, { recursive: true, force: true }); } catch (e) {}
    return { ok: false, error: pipe.error + "（本地镜像未改动，已丢弃本次拉取的内容）" };
  }
  // [workspace-groups-remote patch] The tar stream is remote-controlled:
  // refuse the sync when the extracted tree holds a symlink pointing
  // outside the extraction dir — the copy/swap below would follow it and
  // land content outside the mirror.
  const escapee = findEscapingLink(tmpDir);
  if (escapee) {
    try { await rm(tmpDir, { recursive: true, force: true }); } catch (e) {}
    return { ok: false, error: "已拒绝同步：远端内容包含指向镜像之外的符号链接（" + escapee + "），本地镜像未改动。" };
  }`],
  ['patch 3d: wrapper remotePath base64-encoded',
    '    "        const expanded = remotePath === \'~\' ? \'$HOME\' : (remotePath.indexOf(\'~/\') === 0 ? \'$HOME/\' + remotePath.slice(2) : remotePath);",',
    `    "        // [workspace-groups-remote patch] The path reaches the remote",
    "        // shell base64-encoded and is decoded there: its content is data,",
    "        // never shell syntax, so quotes, $() and backticks in a directory",
    "        // name can no longer break out. (~ still expands remotely.)",
    "        const b64 = (s) => Buffer.from(String(s), 'utf8').toString('base64');",
    "        const expanded = remotePath === '~' ? '$HOME' : (remotePath.indexOf('~/') === 0 ? '$HOME/$(printf %s \\\\'' + b64(remotePath.slice(2)) + '\\\\' | base64 -d)' : '$(printf %s \\\\'' + b64(remotePath) + '\\\\' | base64 -d)');",`],
]

function countOccurrences(text, needle) {
  let count = 0
  let at = text.indexOf(needle)
  while (at !== -1) { count += 1; at = text.indexOf(needle, at + needle.length) }
  return count
}

function applyPatch(source) {
  if (countOccurrences(source, RUNREMOTE_ANCHOR) !== 1) {
    throw new Error('patch-remote-ssh: runRemote anchor not found exactly once — upstream changed, re-check the patch')
  }
  if (countOccurrences(source, FIND_ANCHOR) !== 1) {
    throw new Error('patch-remote-ssh: createRemoteWorkspace reuse-lookup anchor not found exactly once — upstream changed, re-check the patch')
  }
  let out = source.replace(RUNREMOTE_ANCHOR, HELPERS + SELF_CHECK + RUNREMOTE_ANCHOR)
  out = out.replace(FIND_ANCHOR, FIND_REPLACEMENT)
  for (const [label, anchor, replacement] of TRANSFORMS) {
    if (countOccurrences(out, anchor) !== 1) {
      throw new Error('patch-remote-ssh: anchor for ' + label + ' not found exactly once — upstream changed, re-check the patch')
    }
    out = out.replace(anchor, replacement)
  }
  // Post-conditions: the vulnerable code forms must be gone, the fixed
  // forms present. (A historical comment mentioning StrictHostKeyChecking=no
  // remains in the source; only the executable code form is asserted here.)
  const gone = ['head.concat(opts, [target])', '["sshpass", "-p"', "'StrictHostKeyChecking=no', '-o', 'ExitOnForwardFailure=no'"]
  for (const bad of gone) {
    if (out.includes(bad)) throw new Error('patch-remote-ssh: vulnerable form still present after patching: ' + bad)
  }
  const present = ['resolveRemoteCanonical', 'head.concat(opts, ["--", target])', '"sshpass", "-e"', 'StrictHostKeyChecking=accept-new', 'inMirrorRoot', 'base64 -d', 'foldedParts', '写回护栏无法确认，本次不推送', 'upstream internals changed (runRemote / shellQuotePath not found)', 'findEscapingLink', 'renameSync(tmpFile, file)', "%s %Y %N", 'startsWith(prev + ".")', 'foldCase', 'dirname(dir) === join(homedir()']
  for (const good of present) {
    if (!out.includes(good)) throw new Error('patch-remote-ssh: expected patched form missing: ' + good)
  }
  return out
}

export function writePatchedRemoteSsh(root) {
  const sourcePath = join(root, 'vendor/dsh-remote-ssh/lib/index.js')
  const targetPath = join(root, 'lib/remote-ssh/index.js')
  const patched = applyPatch(readFileSync(sourcePath, 'utf8'))
  mkdirSync(dirname(targetPath), { recursive: true })
  writeFileSync(targetPath, patched)
  return targetPath
}

const invokedDirectly = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  const target = writePatchedRemoteSsh(root)
  console.log('patch-remote-ssh: wrote ' + target)
}
