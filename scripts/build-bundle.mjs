// Build step (runs last, after tsdown): assemble the merged host artifact.
// - lib/groups.js + lib/client.js come from tsdown.
// - lib/remote-ssh/index.js is the vendored upstream host half with the
//   bundle's one local patch applied at build time (it must stay unbundled
//   — see bundle/index.js — and the vendor tree stays pristine; see
//   scripts/patch-remote-ssh.mjs).
// - lib/index.js is the composition entry from bundle/index.js.
import { copyFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { writePatchedRemoteSsh } from './patch-remote-ssh.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
writePatchedRemoteSsh(root)
copyFileSync(join(root, 'bundle/index.js'), join(root, 'lib/index.js'))
console.log('bundle assembled: lib/index.js (composition) + lib/groups.js + lib/remote-ssh/index.js (patched) + lib/client.js')
