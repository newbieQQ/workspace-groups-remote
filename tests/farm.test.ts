/**
 * A farm is the only supported way to put several folders inside one workspace,
 * so these tests pin its two dangerous properties: the folders themselves are
 * never written to, and removal never deletes anything but links.
 */
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { buildFarm, defaultFarmRoot, farmDirectoryName, removeFarm } from '../src/host-farm.ts'

const previousHome = process.env.DSH_HOME
let scratch = ''

beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), 'wg-farm-'))
  process.env.DSH_HOME = join(scratch, 'dsh-home')
  await mkdir(process.env.DSH_HOME, { recursive: true })
})

afterEach(async () => {
  // Remove farms first: their entries are links, and a recursive delete that
  // walked into one would erase the fixture folders of another test.
  try {
    for (const name of await readdir(defaultFarmRoot())) {
      try {
        await removeFarm(join(defaultFarmRoot(), name))
      } catch {
        // A deliberately planted real directory: the scratch delete below is
        // safe because it holds no links any more.
      }
    }
  } catch {
    // No farm root: nothing was built.
  }
  if (previousHome === undefined) delete process.env.DSH_HOME
  else process.env.DSH_HOME = previousHome
  await rm(scratch, { recursive: true, force: true })
})

async function folder(...segments: string[]): Promise<string> {
  const path = join(scratch, ...segments)
  await mkdir(path, { recursive: true })
  return path
}

describe('farm directory', () => {
  it('gathers every folder into one directory of links', async () => {
    const alpha = await folder('alpha')
    const beta = await folder('beta')

    const farm = await buildFarm({ name: 'demo', folders: [alpha, beta] })

    expect(farm.path).toBe(join(defaultFarmRoot(), 'demo'))
    expect(farm.links.map(link => link.name)).toEqual(['alpha', 'beta'])
    expect(farm.links.map(link => link.target)).toEqual([alpha, beta])

    // A write through the farm lands in the real folder: that is the whole
    // point of the feature, so it is asserted rather than assumed.
    await writeFile(join(farm.path, 'alpha', 'note.txt'), 'hello', 'utf8')
    expect(await readFile(join(alpha, 'note.txt'), 'utf8')).toBe('hello')
  })

  it('keeps two folders that share a name apart', async () => {
    const one = await folder('x', 'project')
    const two = await folder('y', 'project')

    const farm = await buildFarm({ name: 'dup', folders: [one, two] })

    expect(farm.links.map(link => link.name)).toEqual(['project', 'project (2)'])
    expect(farm.links.map(link => link.target)).toEqual([one, two])
  })

  it('ignores the same folder named twice', async () => {
    const alpha = await folder('alpha')
    const beta = await folder('beta')

    const farm = await buildFarm({ name: 'twice', folders: [alpha, beta, alpha] })

    expect(farm.links).toHaveLength(2)
  })
})

describe('farm validation', () => {
  it('refuses fewer than two distinct folders', async () => {
    const alpha = await folder('alpha')
    await expect(buildFarm({ name: 'solo', folders: [alpha] })).rejects.toThrow(/at least two/u)
  })

  it('refuses a relative path', async () => {
    await expect(buildFarm({ name: 'rel', folders: ['alpha', 'beta'] }))
      .rejects.toThrow(/absolute/u)
  })

  it('refuses a folder that does not exist', async () => {
    const alpha = await folder('alpha')
    await expect(buildFarm({ name: 'gone', folders: [alpha, join(scratch, 'missing')] }))
      .rejects.toThrow(/does not exist/u)
  })

  it('refuses to reuse an existing farm', async () => {
    const alpha = await folder('alpha')
    const beta = await folder('beta')
    await buildFarm({ name: 'same', folders: [alpha, beta] })

    await expect(buildFarm({ name: 'same', folders: [alpha, beta] }))
      .rejects.toThrow(/already exists/u)
  })
})

describe('farm removal', () => {
  it('unlinks the farm but leaves the folders untouched', async () => {
    const alpha = await folder('alpha')
    const beta = await folder('beta')
    await writeFile(join(alpha, 'marker.txt'), 'keep', 'utf8')
    const farm = await buildFarm({ name: 'remove', folders: [alpha, beta] })

    await removeFarm(farm.path)

    await expect(stat(farm.path)).rejects.toThrow()
    expect(await readFile(join(alpha, 'marker.txt'), 'utf8')).toBe('keep')
    expect((await stat(beta)).isDirectory()).toBe(true)
  })

  it('refuses a directory outside the farm root', async () => {
    const elsewhere = await folder('elsewhere')
    await expect(removeFarm(elsewhere)).rejects.toThrow(/not a farm directory/u)
    expect((await stat(elsewhere)).isDirectory()).toBe(true)
  })

  it('refuses to delete a real directory planted inside a farm', async () => {
    const alpha = await folder('alpha')
    const beta = await folder('beta')
    const farm = await buildFarm({ name: 'guard', folders: [alpha, beta] })
    const real = join(farm.path, 'real')
    await mkdir(real)

    await expect(removeFarm(farm.path)).rejects.toThrow(/real directory/u)
    expect((await stat(real)).isDirectory()).toBe(true)
  })
})

describe('farm naming', () => {
  it('turns a workspace title into one safe directory name', () => {
    expect(farmDirectoryName('云端记忆系统（云端）')).toBe('云端记忆系统（云端）')
    expect(farmDirectoryName('a/b:c')).toBe('a b c')
    expect(farmDirectoryName('   ')).toBe('farm')
    expect(farmDirectoryName('CON')).toBe('_CON')
    expect(farmDirectoryName('trailing. ')).toBe('trailing')
  })
})
