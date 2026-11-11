// Behavior test for the bundle's remote-ssh canonical-path patch
// (scripts/patch-remote-ssh.mjs), run against the BUILT artifact
// lib/remote-ssh/index.js. Uses the same source-grab technique as the
// vendored upstream tests: extract the patched functions from the artifact
// and drive them with stubbed services — no SSH server needed; the stub
// emulates the one resolution round trip (printf $HOME; cd …; pwd -P).
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(root, 'lib/remote-ssh/index.js'), 'utf8')
const vendorSrc = readFileSync(join(root, 'vendor/dsh-remote-ssh/lib/index.js'), 'utf8')

let pass = 0, fail = 0
const check = (cond, label) => { if (cond) { pass++; console.log('  ok ' + label) } else { fail++; console.log('  FAIL: ' + label) } }

/**
 * Index just past the closing brace that matches the `{` at openIndex.
 * String-, comment- and template-aware: braces inside '...', "...", `...`
 * (including ${ } nesting), // and block comments do not move the depth —
 * the naive counter this replaces would cut a function short the day an
 * upstream string literal gained a brace.
 */
function matchingBrace(text, openIndex) {
  const stack = [] // 'brace' | 'template'
  let mode = 'code'
  let depth = 0
  for (let i = openIndex; i < text.length; i++) {
    const ch = text[i]
    const next = text[i + 1]
    if (mode === 'code') {
      if (ch === '{') { depth++; stack.push('brace') } else if (ch === '}') {
        depth--
        if (stack[stack.length - 1] === 'template-expr') { stack.pop(); mode = 'template' } else stack.pop()
        if (depth === 0) return i
      } else if (ch === "'") mode = 'single'
      else if (ch === '"') mode = 'double'
      else if (ch === '`') { stack.push('template'); mode = 'template' }
      else if (ch === '/' && next === '/') { mode = 'line'; i++ }
      else if (ch === '/' && next === '*') { mode = 'block'; i++ }
    } else if (mode === 'single') {
      if (ch === '\\') i++
      else if (ch === "'") mode = 'code'
    } else if (mode === 'double') {
      if (ch === '\\') i++
      else if (ch === '"') mode = 'code'
    } else if (mode === 'template') {
      if (ch === '\\') i++
      else if (ch === '`') { stack.pop(); mode = 'code' }
      else if (ch === '$' && next === '{') { stack.push('template-expr'); depth++; mode = 'code'; i++ }
    } else if (mode === 'line') {
      if (ch === '\n') mode = 'code'
    } else if (mode === 'block') {
      if (ch === '*' && next === '/') { mode = 'code'; i++ }
    }
  }
  throw new Error('matchingBrace: unbalanced input')
}

function grabFunction(name) {
  const at = src.indexOf('function ' + name)
  if (at < 0) throw new Error(name + ' not found in patched artifact')
  const start = src.lastIndexOf('\n', at) + 1 // keep a leading `async ` on the declaration line
  const open = src.indexOf('{', start)
  return src.slice(start, matchingBrace(src, open) + 1)
}

function grabHandler() {
  const marker = 'createRemoteWorkspace: async'
  const start = src.indexOf(marker)
  if (start < 0) throw new Error('createRemoteWorkspace handler not found')
  const fnStart = src.indexOf('async', start)
  const open = src.indexOf('{', fnStart)
  return src.slice(fnStart, matchingBrace(src, open) + 1)
}

// --- scope: real helpers from the artifact, stubbed transport -------------
const shellQuote = new Function(grabFunction('shellQuote') + '\nreturn shellQuote;')()
const shellQuotePath = new Function('shellQuote', grabFunction('shellQuotePath') + '\nreturn shellQuotePath;')(shellQuote)
const lightRemotePath = new Function(grabFunction('lightRemotePath') + '\nreturn lightRemotePath;')()
const expandRemoteHome = new Function(grabFunction('expandRemoteHome') + '\nreturn expandRemoteHome;')()

const HOME = '/home/u'
let sshCalls = 0
let sshFails = false
function fakeRunRemote(subprocess, p, cmd) {
  sshCalls += 1
  if (sshFails) return Promise.resolve({ ok: false, error: 'stubbed failure' })
  // Emulate: printf '__DSH_HOME__%s\n' "$HOME"; cd '<path>' && pwd -P
  const m = /cd (.+) 2>\/dev\/null/.exec(cmd)
  let target = m ? m[1].trim() : ''
  if (target.startsWith('~/')) target = target.slice(2).replace(/^'(.*)'$/, '$1')
  else target = target.replace(/^'(.*)'$/, '$1')
  const resolved = (target.startsWith('/') ? target : HOME + '/' + target).replace(/\/+$/, '')
  return Promise.resolve({ ok: true, stdout: '__DSH_HOME__' + HOME + '\n' + resolved + '\n' })
}
const resolveRemoteCanonical = new Function('shellQuotePath', 'runRemote', 'lightRemotePath', 'expandRemoteHome',
  grabFunction('resolveRemoteCanonical') + '\nreturn resolveRemoteCanonical;')(shellQuotePath, fakeRunRemote, lightRemotePath, expandRemoteHome)

// --- pure helpers ----------------------------------------------------------
console.log('helpers')
check(lightRemotePath('/home/u/proj/') === '/home/u/proj', 'light: trailing slash dropped')
check(lightRemotePath(' ~/proj ') === '~/proj', 'light: trimmed')
check(lightRemotePath('/') === '/', 'light: root kept')
check(expandRemoteHome('~/proj', HOME) === '/home/u/proj', 'expand: ~/ with home')
check(expandRemoteHome('/abs', HOME) === '/abs', 'expand: absolute untouched')
check(expandRemoteHome('~/proj', '') === '~/proj', 'expand: no home, untouched')

console.log('resolveRemoteCanonical')
{
  const r = await resolveRemoteCanonical({}, {}, '~/proj/')
  check(r.canonical === '/home/u/proj' && r.home === HOME, 'resolves ~/proj/ to the absolute canonical path')
  sshFails = true
  const f = await resolveRemoteCanonical({}, {}, '~/proj')
  check(f.canonical === '~/proj' && f.home === '', 'SSH failure is fail-open (light form, no home)')
  sshFails = false
}

// --- the patched handler ----------------------------------------------------
function fakeSettings(seed) {
  const state = { workspaces: seed.map(w => ({ ...w })) }
  return {
    state,
    face: {
      read: () => ({ workspaces: state.workspaces.map(w => ({ ...w })), defaultSyncPaths: [], defaultSyncExclude: [], defaultSyncMaxBytes: 0 }),
      updateWorkspaces: async (list) => { state.workspaces = list },
    },
  }
}
function makeHandler(face) {
  const deps = {
    getProfile: (id) => id === 'prof-1' ? { id: 'prof-1', name: 'lab', host: 'h', user: 'u', port: 22, keyPath: '', proxyJump: '' } : undefined,
    settingsFace: face,
    subprocess: {},
    lightRemotePath,
    expandRemoteHome,
    resolveRemoteCanonical,
    join,
    mkdir: async () => {},
    writeFile: async () => {},
    mirrorBaseDir: () => '/mirrors',
    remoteWorkspaceReadme: () => 'readme',
    workspaceRegistry: { create: async (path, title) => ({ id: 'native:' + path, title, setTitle: async () => {} }) },
    normalizeSyncList: (v) => Array.isArray(v) ? v : [],
    parseSyncMaxBytes: () => null,
  }
  const names = Object.keys(deps)
  const factory = new Function(...names, 'return (' + grabHandler() + ')')
  return factory(...names.map(n => deps[n]))
}
const seedRecord = { id: 'wOLD', profileId: 'prof-1', title: 'proj', remotePath: '~/proj', mirrorPath: '/mirrors/wOLD', syncPaths: [], syncExclude: [] }

console.log('createRemoteWorkspace (patched)')
{
  const { face, state } = fakeSettings([seedRecord])
  const handler = makeHandler(face)
  sshCalls = 0
  const r = await handler({ profileId: 'prof-1', remotePath: '/home/u/proj' })
  check(r.ok === true && r.reused === true, 'A: absolute spelling reuses the ~-spelled record')
  check(state.workspaces.length === 1 && state.workspaces[0].id === 'wOLD', 'A: still exactly one record')
  check(r.mirrorPath === '/mirrors/wOLD', 'A: original mirror kept (local edits preserved)')
}
{
  const { face, state } = fakeSettings([{ ...seedRecord, remotePath: '/home/u/proj' }])
  const handler = makeHandler(face)
  const r = await handler({ profileId: 'prof-1', remotePath: '~/proj/' })
  check(r.ok === true && r.reused === true && state.workspaces.length === 1, 'B: ~-spelling with trailing slash reuses the absolute record')
}
{
  const { face, state } = fakeSettings([])
  const handler = makeHandler(face)
  const r = await handler({ profileId: 'prof-1', remotePath: '~/newdir' })
  check(r.ok === true && r.reused === false, 'C: genuinely new directory creates a record')
  check(state.workspaces.length === 1 && state.workspaces[0].remotePath === '/home/u/newdir', 'C: new record stores the canonical spelling')
}
{
  const { face, state } = fakeSettings([seedRecord])
  const handler = makeHandler(face)
  const r = await handler({ profileId: 'prof-1', remotePath: '/home/u/proj/' })
  check(r.ok === true && r.reused === true && state.workspaces.length === 1, 'E: trailing-slash variant reuses')
}
{
  const { face, state } = fakeSettings([seedRecord])
  const handler = makeHandler(face)
  sshFails = true
  const r = await handler({ profileId: 'prof-1', remotePath: '/home/u/proj' })
  sshFails = false
  check(r.ok === true && state.workspaces.length === 2, 'D: with SSH down the create still succeeds (fail-open, upstream behavior)')
}


// --- sshArgv hardening (patch 2) -------------------------------------------
const sshArgv = new Function('sshExecutablePath', 'expandSshPath', 'ensureWindowsAskpass',
  grabFunction('sshArgv') + '\nreturn sshArgv;')(() => 'ssh', (x) => x, () => { throw new Error('win32 only') })

console.log('sshArgv (patched)')
{
  const evil = { user: '-oProxyCommand=touch /tmp/pwn', host: 'example.com', port: 22, authMethod: 'key', keyPath: '/k' }
  const { argv } = sshArgv(evil, undefined, false)
  const target = '-oProxyCommand=touch /tmp/pwn@example.com'
  check(argv[argv.indexOf(target) - 1] === '--', 'F: option-like user value stays positional behind --')
}
{
  const { argv } = sshArgv({ user: 'u', host: 'h', port: 22, authMethod: 'key', keyPath: '/k' }, 'echo hi', false)
  check(argv[argv.indexOf('u@h') - 1] === '--' && argv[argv.length - 1] === 'echo hi', 'F2: normal profile: -- before target, command after')
}
{
  const { argv, env } = sshArgv({ user: 'u', host: 'h', port: 22, authMethod: 'password', password: 's3cret-value' }, undefined, false)
  check(argv[0] === 'sshpass' && argv[1] === '-e', 'G: POSIX password auth uses sshpass -e')
  check(!argv.some(a => String(a).includes('s3cret-value')), 'G: password is not in argv')
  check(env !== undefined && env.SSHPASS === 's3cret-value', 'G: password travels via the SSHPASS env var')
}

// --- terminal wrapper (patch 3) ----------------------------------------------
function extractWrapperSource() {
  const lines = src.split('\n')
  const start = lines.findIndex(l => l.includes('const wrapperJs = ['))
  if (start < 0) throw new Error('wrapperJs not found in patched artifact')
  let end = start + 1
  while (end < lines.length && !lines[end].trim().startsWith('].join')) end += 1
  const arrayText = lines.slice(start, end + 1).join('\n').replace(/^\s*const wrapperJs = /, '').replace(/\]\.join\([\s\S]*$/, ']')
  return new Function('return (' + arrayText + ')')().join('\n')
}

console.log('terminal wrapper (patched)')
{
  const sandbox = mkdtempSync(join(tmpdir(), 'wg-remote-wrapper-'))
  const fakeHome = join(sandbox, 'home')
  const binDir = join(sandbox, 'bin')
  mkdirSync(join(fakeHome, '.dsh', 'remote-workspaces', 'wTEST'), { recursive: true })
  mkdirSync(binDir, { recursive: true })
  const sshCapture = join(sandbox, 'ssh-argv.txt')
  const shellCapture = join(sandbox, 'shell.txt')
  writeFileSync(join(binDir, 'ssh'), '#!/bin/sh\n: > "$SSH_CAPTURE"\nfor a in "$@"; do printf \'%s\\n\' "$a" >> "$SSH_CAPTURE"; done\nexit 0\n')
  writeFileSync(join(binDir, 'fakeshell'), '#!/bin/sh\necho local-shell >> "$SHELL_CAPTURE"\npwd\nexit 0\n')
  chmodSync(join(binDir, 'ssh'), 0o755)
  chmodSync(join(binDir, 'fakeshell'), 0o755)
  const wrapperPath = join(sandbox, 'dsh-remote-shell.js')
  writeFileSync(wrapperPath, extractWrapperSource())
  const baseEnv = { ...process.env, HOME: fakeHome, PATH: binDir + ':' + process.env.PATH, SHELL: join(binDir, 'fakeshell'), SSH_CAPTURE: sshCapture, SHELL_CAPTURE: shellCapture }
  const runWrapper = (cwd) => spawnSync('node', [wrapperPath], { cwd, env: baseEnv, encoding: 'utf8' })
  const marker = (fields) => JSON.stringify({ keyPath: '/keys/id_rsa', host: 'lab.example', user: 'u', port: 22, ...fields })

  // A marker planted OUTSIDE the mirror base must not connect at all.
  const evilDir = join(sandbox, 'cloned-repo')
  mkdirSync(evilDir, { recursive: true })
  writeFileSync(join(evilDir, '.remote-ssh.json'), marker({ remotePath: '/srv/x' }))
  runWrapper(evilDir)
  check(!existsSync(sshCapture), 'W1: marker in a random directory does not trigger ssh')
  check(existsSync(shellCapture), 'W1: terminal falls back to the local shell')

  // A marker in a real mirror root connects, hardened.
  const mirrorDir = join(fakeHome, '.dsh', 'remote-workspaces', 'wTEST')
  writeFileSync(join(mirrorDir, '.remote-ssh.json'), marker({ remotePath: '/srv/proj' }))
  runWrapper(mirrorDir)
  const wArgv = readFileSync(sshCapture, 'utf8').split('\n')
  check(wArgv.includes('StrictHostKeyChecking=accept-new') && !wArgv.includes('StrictHostKeyChecking=no'), 'W2: host key checking is accept-new, never no')
  check(wArgv[wArgv.indexOf('u@lab.example') - 1] === '--', 'W2: -- before the target')

  // A command-injection payload in remotePath stays inert data.
  const pwn = join(sandbox, 'pwned')
  writeFileSync(join(mirrorDir, '.remote-ssh.json'), marker({ remotePath: '/tmp/$(touch ' + pwn + ')' }))
  runWrapper(mirrorDir)
  const remoteCmd = readFileSync(sshCapture, 'utf8').split('\n').filter(Boolean).pop()
  spawnSync('bash', ['-c', remoteCmd], { env: { ...baseEnv, SHELL: join(binDir, 'fakeshell') }, encoding: 'utf8' })
  check(!existsSync(pwn), 'W3: $() payload in remotePath is not executed by the remote shell')

  // A legitimate path with spaces, a quote and a $() round-trips exactly.
  const weird = join(fakeHome, 'my proj $(x) "q"')
  mkdirSync(weird, { recursive: true })
  writeFileSync(join(mirrorDir, '.remote-ssh.json'), marker({ remotePath: weird }))
  runWrapper(mirrorDir)
  const remoteCmd2 = readFileSync(sshCapture, 'utf8').split('\n').filter(Boolean).pop()
  const out = spawnSync('bash', ['-c', remoteCmd2], { env: { ...baseEnv, SHELL: join(binDir, 'fakeshell') }, encoding: 'utf8' })
  check(out.stdout.trim().endsWith(weird), 'W4: weird-but-legit path lands in the right directory')
}

console.log('localToRemote dot-segment folding')
{
  const localToRemote = new Function(grabFunction('localToRemote') + '\nreturn localToRemote;')()
  check(localToRemote('/mirror/root/sub/file.txt', '/mirror/root', '/srv/proj') === '/srv/proj/sub/file.txt',
    'L1: plain subpath maps under the remote root')
  check(localToRemote('/mirror/root', '/mirror/root', '/srv/proj') === '/srv/proj',
    'L2: the mirror root maps to the remote root')
  check(localToRemote('/mirror/root/a/../b.txt', '/mirror/root', '/srv/proj') === '/srv/proj/b.txt',
    'L3: an in-tree ".." folds without escaping')
  check(localToRemote('/mirror/root/a/./b.txt', '/mirror/root', '/srv/proj') === '/srv/proj/a/b.txt',
    'L4: "." segments fold away')
  let threw = false
  try { localToRemote('/mirror/root/../../etc/passwd', '/mirror/root', '/srv/proj') } catch { threw = true }
  check(threw, 'L5: a ".." climbing above the mirror root is refused')
  threw = false
  try { localToRemote('/mirror/root/a/../../../etc/passwd', '/mirror/root', '/srv/proj') } catch { threw = true }
  check(threw, 'L6: a buried escape attempt is refused')
}

console.log('freshness: nanosecond stamps + legacy tolerance + escaping links')
{
  const verdict = new Function(grabFunction('freshnessVerdict') + '\nreturn freshnessVerdict;')()
  check(verdict('10:100', { ok: true, exists: true, stamp: '10:100.123456789' }).changed === false,
    'F1: a pre-upgrade second-resolution stamp still matches at second precision')
  check(verdict('10:100', { ok: true, exists: true, stamp: '10:101.000000000' }).changed === true,
    'F2: a genuinely different second still reads as changed')
  check(verdict('10:100.5', { ok: true, exists: true, stamp: '10:100.500000000' }).changed === true,
    'F3: a fractional recorded stamp compares exactly (no false tolerance)')

  const syncErrText = new Function(grabFunction('syncErrText') + '\nreturn syncErrText;')()
  const remoteMtimeInfo = new Function('shellQuotePath', 'syncErrText',
    grabFunction('remoteMtimeInfo') + '\nreturn remoteMtimeInfo;')(shellQuotePath, syncErrText)
  const runnerNs = async () => ({ ok: true, stdout: '10 100 123456789\n', stderr: '', error: '' })
  const infoNs = await remoteMtimeInfo(runnerNs, {}, '/srv/f')
  check(infoNs.ok && infoNs.stamp === '10:100.123456789', 'F4: remote stat carries nanoseconds into the stamp')
  let statCmd = ''
  const runnerCap = async (p, cmd) => { statCmd = cmd; return { ok: true, stdout: '1 2 3\n', stderr: '', error: '' } }
  await remoteMtimeInfo(runnerCap, {}, '/srv/f')
  check(statCmd.includes("%s %Y %N"), 'F5: the stat command asks for the nanosecond field')

  const findEscapingLink = new Function('resolvePath', 'readdirSync', 'readlinkSync', 'join',
    grabFunction('findEscapingLink') + '\nreturn findEscapingLink;')(
    (await import('node:path')).resolve,
    (await import('node:fs')).readdirSync,
    (await import('node:fs')).readlinkSync,
    (await import('node:path')).join)
  const tree = mkdtempSync(join(tmpdir(), 'wg-links-'))
  try {
    mkdirSync(join(tree, 'sub'), { recursive: true })
    writeFileSync(join(tree, 'sub', 'f.txt'), 'x')
    symlinkSync(join(tree, 'sub', 'f.txt'), join(tree, 'inner-link'))
    check(findEscapingLink(tree) === null, 'F6: an in-tree symlink is fine')
    symlinkSync('/etc', join(tree, 'sub', 'escape-link'))
    check(String(findEscapingLink(tree)).endsWith('escape-link'), 'F7: a symlink escaping the tree is found')
  } finally {
    rmSync(tree, { recursive: true, force: true })
  }
}

console.log('patch hygiene')
check(!vendorSrc.includes('resolveRemoteCanonical'), 'vendor tree stays pristine (no patch markers)')
check(src.includes('resolveRemoteCanonical'), 'built artifact carries the patch')

console.log('\n' + pass + ' passed, ' + fail + ' failed')
process.exit(fail === 0 ? 0 : 1)
