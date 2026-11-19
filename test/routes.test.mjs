import { strict as assert } from 'node:assert'
import { execFile as execute } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { diffRoutes, pageRoute, scanRoutes } from '../routes.mjs'

const execFile = promisify(execute)
const bin = fileURLToPath(new URL('../bin/route-diff.mjs', import.meta.url))

async function tree(t, names) {
  const root = await mkdtemp(join(tmpdir(), 'nuxt-route-diff-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  for (const name of names) {
    const file = join(root, name)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(file, '')
  }
  return root
}

test('formats nested, grouped, optional, mixed and catch-all segments', () => {
  assert.equal(pageRoute('index.vue').path, '/')
  assert.equal(pageRoute('(web)/teams-[team]/[[member]]/index.client.vue').path, '/teams-:team/:member?')
  assert.equal(pageRoute('docs/[...slug].vue').path, '/docs/:slug(.*)*')
  assert.equal(pageRoute('item/[id]@details.vue').path, '/item/:id')
})

test('keeps named views and nested indexes while flagging matching URLs', async t => {
  const root = await tree(t, [
    'item.vue', 'item/index.vue', 'item/index@aside.vue',
    '(shop)/catalog/[id].vue', '(other)/catalog/[slug].vue',
    '-drafts/index.vue', '.hidden.vue', 'ignored.txt',
  ])
  const result = await scanRoutes(root)
  assert.deepEqual(result.routes.map(route => route.path), ['/catalog/:id', '/catalog/:slug', '/item'])
  assert.deepEqual(result.routes.at(-1).files, ['item.vue', 'item/index.vue', 'item/index@aside.vue'])
  assert.deepEqual(result.collisions, [{
    matcher: '/catalog/:_',
    paths: ['/catalog/:id', '/catalog/:slug'],
    files: ['(other)/catalog/[slug].vue', '(shop)/catalog/[id].vue'],
  }])
})

test('reports route additions, removals and moved sources through the CLI', async t => {
  const before = await tree(t, ['about.vue', 'archive.vue'])
  const after = await tree(t, ['(new)/about.vue', 'help/index.vue'])
  const result = diffRoutes(await scanRoutes(before), await scanRoutes(after))
  assert.deepEqual(result, {
    added: [{ path: '/help', files: ['help/index.vue'] }],
    removed: [{ path: '/archive', files: ['archive.vue'] }],
    changed: [{ path: '/about', before: ['about.vue'], after: ['(new)/about.vue'] }],
    collisions: [],
  })
  const { stdout } = await execFile(process.execPath, [bin, 'diff', before, after, '--json'])
  assert.deepEqual(JSON.parse(stdout), result)
  await assert.rejects(execFile(process.execPath, [bin, 'diff', before, after, '--check']), { code: 1 })
  const same = await execFile(process.execPath, [bin, 'diff', before, before, '--check'])
  assert.equal(same.stdout.trim(), 'No route changes.')
})
