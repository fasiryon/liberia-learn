import chokidar from 'chokidar'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildWorkflowContext, contextRouteForQueueFilename } from './context.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const VAULT = path.resolve(__dirname, '..')
const QUEUE = path.join(VAULT, 'QUEUE')
const GENERATED = path.join(VAULT, 'GENERATED')

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

const ROUTES = {
  'RESEARCH-':      'briefings',
  'DRAFT-':         'drafts',
  'AUDIT-':         'audits',
  'SPRINT-REVIEW-': 'reviews',
  'BRIEF-MOE-':     'briefings',
}

function getRoute(filename) {
  for (const [prefix, folder] of Object.entries(ROUTES)) {
    if (filename.startsWith(prefix)) return folder
  }
  return 'misc'
}

async function processFile(filePath) {
  const filename = path.basename(filePath)
  if (!filename.endsWith('.md')) return
  if (filename.startsWith('_')) return
  if (filename.includes('_DONE') || filename.includes('_FAILED')) return

  console.log(`[OS] Processing: ${filename}`)

  try {
    const context = await buildWorkflowContext({
      vaultPath: VAULT,
      route: contextRouteForQueueFilename(filename),
      queuePath: filePath,
    })

    const folder = getRoute(filename)
    const outputDir = path.join(GENERATED, folder)
    await fs.mkdir(outputDir, { recursive: true })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: context.system,
      messages: [{ role: 'user', content: context.user }]
    })

    const output = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')

    const outputName = filename.replace('.md', `-OUTPUT-${Date.now()}.md`)
    const outputPath = path.join(outputDir, outputName)

    const sourceManifest = context.sources.map((source) => `- ${source.path}`).join('\n') || '- None'
    await fs.writeFile(outputPath, `# Output: ${filename}\n\n## Context sources\n${sourceManifest}\n\n${output}`)

    await fs.rename(filePath, filePath.replace('.md', '_DONE.md'))

    console.log(`[OS] ✓ ${filename} → ${folder}/${outputName}`)
  } catch (err) {
    console.error(`[OS] ✗ ${filename}:`, err.message)
    await fs.rename(filePath, filePath.replace('.md', '_FAILED.md')).catch(() => {})
  }
}

await fs.mkdir(QUEUE, { recursive: true })
await fs.mkdir(GENERATED, { recursive: true })

console.log('[OS] LiberiaLearn OS Daemon started')
console.log(`[OS] Watching: ${QUEUE}`)

const watcher = chokidar.watch(QUEUE, {
  persistent: true,
  ignoreInitial: false,
  awaitWriteFinish: {
    stabilityThreshold: 1000,
    pollInterval: 100
  }
})

watcher.on('add', processFile)

console.log('[OS] Ready. Drop .md files into QUEUE/ to process.')
