import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { buildWorkflowContext } from './context.mjs'

async function fixture() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'liberialearn-context-'))
  const vault = path.join(root, 'os-vault')
  const write = async (relative, content, modifiedAt = null) => {
    const target = path.join(root, ...relative.split('/'))
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, content)
    if (modifiedAt) await fs.utimes(target, modifiedAt, modifiedAt)
    return target
  }
  await write('os-vault/SYSTEM/CLAUDE.md', 'shared system context')
  await write('os-vault/SYSTEM/workflows/01-daily-project-pulse.md', 'daily prompt')
  await write('os-vault/SYSTEM/workflows/03-security-audit-runner.md', 'audit prompt')
  return { root, vault, write }
}

async function symlinkOrSkip(t, target, link) {
  try {
    await fs.symlink(target, link, 'file')
    return true
  } catch (error) {
    if (error?.code === 'EPERM') {
      t.skip('file symlinks require Windows Developer Mode; exercised on Linux CI')
      return false
    }
    throw error
  }
}

test('daily pulse attaches current overviews, recent records, and the prior WAT note', async (t) => {
  const f = await fixture()
  t.after(() => fs.rm(f.root, { recursive: true, force: true }))
  const now = new Date('2026-09-18T12:00:00.000Z')
  await f.write('os-vault/02-PROJECTS/LiberiaLearn/overview.md', 'learn overview', new Date('2026-01-01'))
  await f.write('os-vault/02-PROJECTS/LiberiaDataEngine/overview.md', 'data overview', new Date('2026-01-01'))
  await f.write('os-vault/02-PROJECTS/LiberiaLearn/recent.md', 'recent evidence', new Date('2026-09-17'))
  await f.write('os-vault/02-PROJECTS/LiberiaLearn/old.md', 'stale evidence', new Date('2026-01-01'))
  await f.write('os-vault/06-DAILY-NOTES/2026-09-17.md', 'DONE: bounded assembly')

  const context = await buildWorkflowContext({ vaultPath: f.vault, route: 'daily-pulse', now })
  const paths = context.sources.map((source) => source.path)
  assert(paths.includes('os-vault/02-PROJECTS/LiberiaLearn/overview.md'))
  assert(paths.includes('os-vault/02-PROJECTS/LiberiaDataEngine/overview.md'))
  assert(paths.includes('os-vault/02-PROJECTS/LiberiaLearn/recent.md'))
  assert(paths.includes('os-vault/06-DAILY-NOTES/2026-09-17.md'))
  assert(!paths.includes('os-vault/02-PROJECTS/LiberiaLearn/old.md'))
  assert.match(context.user, /ATTACHED SOURCE MANIFEST/)
  assert.match(context.system, /Treat missing or omitted inputs as Unknown/)
})

test('queue routes attach their prompt, request, and declared repository inputs', async (t) => {
  const f = await fixture()
  t.after(() => fs.rm(f.root, { recursive: true, force: true }))
  await f.write('app/api/example/route.ts', 'export const governed = true')
  const queue = await f.write('os-vault/QUEUE/AUDIT-auth.md', [
    '# Auth audit',
    '## Context Inputs',
    '- `app/api/example/route.ts`',
  ].join('\n'))

  const context = await buildWorkflowContext({ vaultPath: f.vault, route: 'audit', queuePath: queue })
  assert.deepEqual(context.sources.map((source) => source.path), ['app/api/example/route.ts'])
  assert.match(context.user, /audit prompt/)
  assert.match(context.user, /TRIGGERING REQUEST/)
  assert.match(context.user, /export const governed = true/)
})

test('queue context rejects traversal and secret-bearing paths before an API request', async (t) => {
  const f = await fixture()
  t.after(() => fs.rm(f.root, { recursive: true, force: true }))
  const traversal = await f.write('os-vault/QUEUE/AUDIT-traversal.md', '## Context Inputs\n- `../outside.md`')
  await assert.rejects(
    buildWorkflowContext({ vaultPath: f.vault, route: 'audit', queuePath: traversal }),
    /context_input_path_denied/,
  )
  const secret = await f.write('os-vault/QUEUE/AUDIT-secret.md', '## Context Inputs\n- `.env.production`')
  await assert.rejects(
    buildWorkflowContext({ vaultPath: f.vault, route: 'audit', queuePath: secret }),
    /context_input_path_denied/,
  )
  const envrc = await f.write('os-vault/QUEUE/AUDIT-envrc.md', '## Context Inputs\n- `.envrc`')
  await assert.rejects(
    buildWorkflowContext({ vaultPath: f.vault, route: 'audit', queuePath: envrc }),
    /context_input_path_denied/,
  )
})

test('resolved source paths cannot disguise denied repository secrets', async (t) => {
  const f = await fixture()
  t.after(() => fs.rm(f.root, { recursive: true, force: true }))
  const secret = await f.write('.env.local', 'ANTHROPIC_API_KEY=do-not-send')
  const alias = path.join(f.root, 'docs', 'safe.md')
  await fs.mkdir(path.dirname(alias), { recursive: true })
  if (!await symlinkOrSkip(t, secret, alias)) return
  const queue = await f.write('os-vault/QUEUE/AUDIT-alias.md', '## Context Inputs\n- `docs/safe.md`')

  await assert.rejects(
    buildWorkflowContext({ vaultPath: f.vault, route: 'audit', queuePath: queue }),
    /context_input_path_denied/,
  )
})

test('queue-file symlinks cannot escape the governed queue directory', async (t) => {
  const f = await fixture()
  t.after(() => fs.rm(f.root, { recursive: true, force: true }))
  const outside = await f.write('outside-request.md', 'send this external file')
  const queue = path.join(f.vault, 'QUEUE', 'AUDIT-escape.md')
  await fs.mkdir(path.dirname(queue), { recursive: true })
  if (!await symlinkOrSkip(t, outside, queue)) return

  await assert.rejects(
    buildWorkflowContext({ vaultPath: f.vault, route: 'audit', queuePath: queue }),
    /queue_path_symlink_escape/,
  )
})
