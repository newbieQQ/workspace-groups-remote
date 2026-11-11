// Watch mode for the merged bundle. `tsdown --watch` alone rebuilds only
// the groups host + client; the composition entry, the patched remote-ssh
// host and the extracted client factory are separate build steps whose
// outputs would silently go stale. This wrapper runs tsdown --watch AND
// re-runs the bundle steps (debounced) whenever their inputs change.
import { spawn, spawnSync } from 'node:child_process'
import { watch } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const tsdown = spawn('npx', ['tsdown', '--watch'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
tsdown.on('exit', (code) => process.exit(code ?? 0))

let timer = null
const rebuild = () => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    for (const script of ['scripts/build-remote-ssh-client.mjs', 'scripts/build-bundle.mjs']) {
      const run = spawnSync('node', [script], { cwd: root, stdio: 'inherit' })
      if (run.status !== 0) { console.error('watch: ' + script + ' failed'); break }
    }
  }, 200)
}
watch(join(root, 'bundle'), { recursive: true }, rebuild)
watch(join(root, 'vendor/dsh-remote-ssh/lib'), { recursive: true }, rebuild)
watch(join(root, 'scripts/patch-remote-ssh.mjs'), rebuild)
console.log('watch: tsdown --watch + bundle steps on bundle/, vendor host and patch-script changes')
