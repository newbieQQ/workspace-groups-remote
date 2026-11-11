// Build step: turn the vendored dsh-remote-ssh client bundle into an
// importable factory module for the merged client entry.
//
// Upstream ships lib/client.js as a self-registering module-loader bundle:
//   window.__ModuleLoader__.load({ id: "@zhangfengshun/dsh-remote-ssh",
//     factory: (require) => { ... } })
// A DSH package gets exactly ONE client row (keyed by package name), so the
// merged package cannot ship that file as-is. This script strips the
// registration wrapper and re-exports the factory itself; the merged client
// entry invokes it with the bundle's own require and applies the result
// next to the workspace-groups client. The factory body is byte-identical
// to upstream — only the two wrapper lines change.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = readFileSync(join(root, 'vendor/dsh-remote-ssh/lib/client.js'), 'utf8')

const LOAD = 'window.__ModuleLoader__.load({'
if (source.split(LOAD).length - 1 !== 1) throw new Error('remote-ssh client: expected exactly one __ModuleLoader__.load call')
const loadAt = source.indexOf(LOAD)
const header = source.slice(0, loadAt)
const rest = source.slice(loadAt + LOAD.length)

const ID_LINE = '\n  id: "@zhangfengshun/dsh-remote-ssh",'
if (!rest.startsWith(ID_LINE)) throw new Error('remote-ssh client: id line anchor mismatch')
const FACTORY_LINE = '\n  factory: (require) => {'
const afterId = rest.slice(ID_LINE.length)
if (!afterId.startsWith(FACTORY_LINE)) throw new Error('remote-ssh client: factory line anchor mismatch')
let body = afterId.slice(FACTORY_LINE.length)

const TAIL = '\n  }\n});'
if (body.endsWith(TAIL + '\n')) body = body.slice(0, -(TAIL.length + 1))
else if (body.endsWith(TAIL)) body = body.slice(0, -TAIL.length)
else throw new Error('remote-ssh client: tail anchor mismatch')

const out = header
  + '// --- merged-bundle transform (scripts/build-remote-ssh-client.mjs) ---\n'
  + '// Upstream registers this factory under its own package id; the merged\n'
  + '// package registers ONE client row, so the factory is exported instead\n'
  + '// and applied by src/client/index.ts. Body below is upstream-verbatim.\n'
  + 'export default (require) => {'
  + body
  + '\n}\n'
writeFileSync(join(root, 'src/client/remote-ssh-factory.generated.mjs'), out)
console.log('remote-ssh client factory -> src/client/remote-ssh-factory.generated.mjs')
