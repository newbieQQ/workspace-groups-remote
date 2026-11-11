// Vendor integrity manifest: sha256 of every file under
// vendor/dsh-remote-ssh/, recorded in scripts/vendor-manifest.json.
// The vendor tree is supposed to be byte-identical to the upstream release;
// the merge layer's build-time patch is the ONLY sanctioned deviation, and
// it never writes into vendor/. verify-bundle recomputes the manifest and
// fails on any drift (edited, added or missing files), so an accidental
// vendor edit or a botched upstream refresh cannot slip through silently.
// Regenerate after an intentional upstream update: npm run vendor:manifest
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const MANIFEST_PATH = 'scripts/vendor-manifest.json'
const VENDOR_DIR = 'vendor/dsh-remote-ssh'

/** sha256 of every vendored file, keyed by POSIX-style relative path. */
export function computeVendorManifest(root) {
  const base = join(root, VENDOR_DIR)
  const files = {}
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue // local test scaffolding, never vendored content
      const path = join(dir, entry.name)
      if (entry.isDirectory()) { walk(path); continue }
      if (!entry.isFile()) continue
      const rel = relative(base, path).split(sep).join('/')
      files[rel] = createHash('sha256').update(readFileSync(path)).digest('hex')
    }
  }
  walk(base)
  return files
}

/** Compare the on-disk vendor tree with the recorded manifest. Returns a list of problems ([] = clean). */
export function checkVendorManifest(root) {
  let recorded
  try {
    recorded = JSON.parse(readFileSync(join(root, MANIFEST_PATH), 'utf8')).files
  } catch {
    return ['vendor manifest missing or unreadable: ' + MANIFEST_PATH]
  }
  const current = computeVendorManifest(root)
  const problems = []
  for (const [rel, hash] of Object.entries(current)) {
    if (!(rel in recorded)) problems.push('unrecorded vendor file: ' + rel)
    else if (recorded[rel] !== hash) problems.push('vendor file changed: ' + rel)
  }
  for (const rel of Object.keys(recorded)) {
    if (!(rel in current)) problems.push('vendor file missing: ' + rel)
  }
  return problems
}

const invokedDirectly = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]
if (invokedDirectly) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..')
  if (process.argv.includes('--write')) {
    const files = computeVendorManifest(root)
    writeFileSync(join(root, MANIFEST_PATH), JSON.stringify({ algorithm: 'sha256', files }, null, 2) + '\n')
    console.log('vendor manifest written: ' + Object.keys(files).length + ' files')
  } else {
    const problems = checkVendorManifest(root)
    if (problems.length > 0) { console.error(problems.join('\n')); process.exit(1) }
    console.log('vendor manifest OK')
  }
}
