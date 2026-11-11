// Merged-bundle composition checks (run after `npm install` + `npm run build`).
// Verifies the assembled artifacts, not a live DSH host:
//  1. lib/index.js loads and exports the bundle identity + inject union.
//  2. Its apply() composes exactly the two original plugins, under their
//     original names, with the remote-ssh Config schema attached.
//  3. lib/client.js registers exactly one module-loader row, keyed by this
//     package's name, and contains code from both client halves.
//  4. cordis.patch.yml carries the single insert row plus remote-ssh's two
//     shell overrides (better-sidebar / terminal-controller).
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'
import { checkVendorManifest } from './vendor-manifest.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
let failures = 0
const check = (label, ok) => { console.log(`${ok ? '✓' : '✗ FAIL'} ${label}`); if (!ok) failures++ }

const host = await import(join(root, 'lib/index.js'))
check('host name is the package name', host.name === pkg.name)
check('host inject is the union', JSON.stringify(host.inject) === JSON.stringify(['webServer', 'subprocess', 'tools', 'workspaceRegistry']))
const applied = []
host.apply({ plugin: (plugin, config) => applied.push({ plugin, config }) }, {})
check('apply composes exactly two plugins', applied.length === 2)
check('groups half keeps its name/inject', applied[0]?.plugin.name === 'workspace-groups-local' && JSON.stringify(applied[0]?.plugin.inject) === '["webServer"]')
check('remote-ssh half keeps its name/inject/Config', applied[1]?.plugin.name === '@zhangfengshun/dsh-remote-ssh' && !!applied[1]?.plugin.Config)
check('remote-ssh receives the nested row config', JSON.stringify(applied[1]?.config) === '{}')

const client = readFileSync(join(root, 'lib/client.js'), 'utf8')
check('client has exactly one module-loader registration', client.split('__ModuleLoader__').length - 1 === 1)
check('client row id is the package name', client.includes(`id: "${pkg.name}"`) || client.includes(`id:"${pkg.name}"`) || client.includes(`id: '${pkg.name}'`))
check('client contains the groups half', client.includes('workspaceGroups'))
check('client contains the remote-ssh half', client.includes('remssh'))

const remoteHost = readFileSync(join(root, 'lib/remote-ssh/index.js'), 'utf8')
const vendorHost = readFileSync(join(root, 'vendor/dsh-remote-ssh/lib/index.js'), 'utf8')
check('remote-ssh host artifact carries the canonical-path patch', remoteHost.includes('resolveRemoteCanonical') && remoteHost.includes('lightRemotePath(w.remotePath) === lightRemotePath(a.remotePath)'))
check('vendored upstream host stays pristine', !vendorHost.includes('resolveRemoteCanonical'))
check('remote-ssh host artifact carries the ssh hardening patches', remoteHost.includes('head.concat(opts, ["--", target])') && remoteHost.includes('"sshpass", "-e"') && remoteHost.includes('inMirrorRoot'))
check('remote-ssh host artifact has no vulnerable code forms', !remoteHost.includes('["sshpass", "-p"') && !remoteHost.includes("'StrictHostKeyChecking=no', '-o', 'ExitOnForwardFailure=no'"))

check('remote-ssh host artifact carries the path-escape and write-back patches', remoteHost.includes('foldedParts') && remoteHost.includes('写回护栏无法确认，本次不推送'))
check('remote-ssh host artifact carries the load-time patch self-check', remoteHost.includes('upstream internals changed (runRemote / shellQuotePath not found)'))

const vendorProblems = checkVendorManifest(root)
check('vendor tree matches its sha256 manifest', vendorProblems.length === 0)
for (const problem of vendorProblems) console.log('  ' + problem)

// Executable client smoke: the static string checks above cannot see a
// factory cut at the wrong brace or an apply() that throws on first contact.
// Evaluate the real bundle against a fake module loader, invoke the factory
// with a universal stub require, and run apply() against a stub context —
// any structural break in either client half fails here.
{
  const registrations = []
  const fakeWindow = { __ModuleLoader__: { load: (def) => registrations.push(def) } }
  const sandbox = { window: fakeWindow, console, setTimeout, clearTimeout }
  vm.createContext(sandbox)
  let plugin
  try {
    vm.runInContext(client, sandbox)
    const stub = () => stubCache
    const stubCache = new Proxy(function () {}, {
      get: (target, key) => {
        if (key === Symbol.toPrimitive) return () => ''
        if (key === Symbol.iterator) return function* () {}
        if (key === 'prototype') return {}
        return stubCache
      },
      apply: stub,
      construct: stub,
    })
    plugin = registrations[0]?.factory(() => stubCache)
    plugin.apply(stubCache)
  } catch (error) {
    console.log('  client smoke error: ' + (error instanceof Error ? error.message : String(error)))
    plugin = undefined
  }
  check('client bundle evaluates, registers one row and applies cleanly', registrations.length === 1 && plugin !== undefined && typeof plugin.apply === 'function')
  check('client inject is the union of both halves', JSON.stringify(plugin?.inject) === JSON.stringify(['slots', 'sessions', 'workspaces', 'uiWorkspace', 'locale']))
}

const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')
check('patch inserts the merged bundle once', patch.includes(`name: '${pkg.name}'`))
check('patch keeps the better-sidebar shell override', patch.includes('- id: better-sidebar'))
check('patch keeps the terminal-controller shell override', patch.includes('- id: terminal-controller'))

console.log(failures === 0 ? '\nBUNDLE OK' : `\n${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
