import chokidar from 'chokidar'
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs/promises'
import path from 'path'

const VAULT = 'C:/Users/fasir/liberia-learn/os-vault'
const QUEUE = path.join(VAULT, 'QUEUE')
const GENERATED = path.join(VAULT, 'GENERATED')
const SYSTEM_MD = path.join(VAULT, 'SYSTEM/CLAUDE.md')

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
    const [systemPrompt, fileContent] = await Promise.all([
      fs.readFile(SYSTEM_MD, 'utf8').catch(() => ''),
      fs.readFile(filePath, 'utf8')
    ])

    const folder = getRoute(filename)
    const outputDir = path.join(GENERATED, folder)
    await fs.mkdir(outputDir, { recursive: true })

    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      system: systemPrompt || 'You are a strategic AI assistant for LiberiaLearn.',
      messages: [{ role: 'user', content: fileContent }]
    })

    const output = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')

    const outputName = filename.replace('.md', `-OUTPUT-${Date.now()}.md`)
    const outputPath = path.join(outputDir, outputName)

    await fs.writeFile(outputPath, `# Output: ${filename}\n\n${output}`)

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
