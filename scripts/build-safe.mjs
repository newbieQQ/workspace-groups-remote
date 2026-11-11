// Build with a safety net: snapshot lib/ first, and if any build step
// fails, restore the previous artifacts — a failed build must never leave
// a half-built lib/ behind for the next install to pick up.
import { cpSync, existsSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const lib = join(root, 'lib')
const backup = join(root, '.lib-backup')

rmSync(backup, { recursive: true, force: true })
const hadLib = existsSync(lib)
if (hadLib) cpSync(lib, backup, { recursive: true })

const run = spawnSync('npm', ['run', 'build:inner'], {
  cwd: root,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
if (run.status !== 0) {
  if (hadLib) {
    rmSync(lib, { recursive: true, force: true })
    cpSync(backup, lib, { recursive: true })
    console.error('build-safe: build failed — the previous lib/ has been restored')
  } else {
    console.error('build-safe: build failed (no previous lib/ to restore)')
  }
  rmSync(backup, { recursive: true, force: true })
  process.exit(run.status ?? 1)
}
rmSync(backup, { recursive: true, force: true })
