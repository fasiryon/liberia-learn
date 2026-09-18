import fs from 'fs/promises'
import path from 'path'

const MAX_FILES = 40
const MAX_FILE_BYTES = 64 * 1024
const MAX_TOTAL_BYTES = 512 * 1024
const ALLOWED_CONTEXT_EXTENSIONS = new Set([
  '.cjs', '.css', '.csv', '.go', '.gql', '.graphql', '.html', '.js', '.json',
  '.md', '.mjs', '.prisma', '.ps1', '.py', '.rs', '.sh', '.sql', '.toml',
  '.ts', '.tsx', '.txt', '.xml', '.yaml', '.yml',
])
const ALLOWED_EXTENSIONLESS_FILES = new Set(['dockerfile', 'procfile'])
const DENIED_CREDENTIAL_FILES = new Set([
  '_netrc', 'auth.json', 'config.gcloud', 'service-account.json',
])

export const CONTEXT_ROUTES = Object.freeze({
  'daily-pulse': { prompt: 'os-vault/SYSTEM/workflows/01-daily-project-pulse.md', queue: false },
  research: { prompt: 'os-vault/SYSTEM/workflows/06-research-processor.md', queue: true },
  draft: { prompt: null, queue: true },
  audit: { prompt: 'os-vault/SYSTEM/workflows/03-security-audit-runner.md', queue: true },
  'sprint-review': { prompt: 'os-vault/SYSTEM/workflows/04-sprint-review-generator.md', queue: true },
  'moe-brief': { prompt: 'os-vault/SYSTEM/workflows/02-moe-brief-generator.md', queue: true },
  'weekly-review': { prompt: 'os-vault/SYSTEM/workflows/05-weekly-os-review.md', queue: false },
})

function isoDateAtWat(date) {
  return new Date(date.getTime() + 60 * 60 * 1000).toISOString().slice(0, 10)
}

function normalizeRelative(value) {
  const normalized = value.trim().replaceAll('\\', '/').replace(/^\.\//, '')
  if (!normalized || path.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized) || normalized.startsWith('//')) {
    throw new Error(`context_input_path_invalid:${value}`)
  }
  const segments = normalized.split('/')
  const lowerSegments = segments.map((segment) => segment.toLowerCase())
  const basename = lowerSegments.at(-1) ?? ''
  const extension = path.posix.extname(basename)
  if (segments.includes('..') || lowerSegments.includes('node_modules') ||
    lowerSegments.some((segment) => segment.startsWith('.') && segment !== '.github') ||
    DENIED_CREDENTIAL_FILES.has(basename) ||
    lowerSegments.some((segment) => /credential|password|secret/i.test(segment)) ||
    ['.key', '.p12', '.pem', '.pfx'].includes(extension) ||
    (!ALLOWED_CONTEXT_EXTENSIONS.has(extension) && !ALLOWED_EXTENSIONLESS_FILES.has(basename))) {
    throw new Error(`context_input_path_denied:${value}`)
  }
  return normalized
}

async function walkMarkdown(directory) {
  const output = []
  let entries
  try {
    entries = await fs.readdir(directory, { withFileTypes: true })
  } catch (error) {
    if (error?.code === 'ENOENT') return output
    throw error
  }
  for (const entry of entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) output.push(...await walkMarkdown(absolute))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md')) output.push(absolute)
  }
  return output
}

async function addMarkdownTree(requested, directory, { cutoff = null } = {}) {
  for (const absolute of await walkMarkdown(directory)) {
    if (cutoff !== null) {
      const stat = await fs.stat(absolute)
      if (stat.mtimeMs < cutoff) continue
    }
    requested.push(absolute)
  }
}

function parseDeclaredInputs(queueContent) {
  const lines = queueContent.split(/\r?\n/)
  const heading = lines.findIndex((line) => /^##\s+Context Inputs\s*$/i.test(line.trim()))
  if (heading < 0) return []
  const inputs = []
  for (const line of lines.slice(heading + 1)) {
    if (/^##\s+/.test(line.trim())) break
    const match = line.match(/^\s*-\s+`?([^`]+?)`?\s*$/)
    if (match) inputs.push(normalizeRelative(match[1]))
  }
  return inputs
}

async function readRequired(absolute, label) {
  try {
    const content = await fs.readFile(absolute, 'utf8')
    if (Buffer.byteLength(content) > MAX_FILE_BYTES) throw new Error(`required_context_too_large:${label}`)
    return content
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('required_context_too_large:')) throw error
    throw new Error(`required_context_missing:${label}:${error?.code ?? 'read_failed'}`)
  }
}

export async function buildWorkflowContext({ vaultPath, route, queuePath, now = new Date() }) {
  const routeConfig = CONTEXT_ROUTES[route]
  if (!routeConfig) throw new Error(`context_route_unknown:${route}`)
  const resolvedVault = path.resolve(vaultPath)
  const repositoryRoot = path.resolve(resolvedVault, '..')
  const realRepositoryRoot = await fs.realpath(repositoryRoot)
  const systemPath = path.join(resolvedVault, 'SYSTEM', 'CLAUDE.md')
  const systemBase = await readRequired(systemPath, 'SYSTEM/CLAUDE.md')
  const workflowPrompt = routeConfig.prompt
    ? await readRequired(path.join(repositoryRoot, ...routeConfig.prompt.split('/')), routeConfig.prompt)
    : 'Follow the triggering request. Produce a draft only and mark unsupported claims Unknown.'

  let queueContent = ''
  let queueRelative = null
  if (routeConfig.queue) {
    if (!queuePath) throw new Error(`queue_context_required:${route}`)
    const resolvedQueue = path.resolve(queuePath)
    const queueRoot = path.join(resolvedVault, 'QUEUE')
    const lexicalQueueRelative = path.relative(queueRoot, resolvedQueue)
    if (lexicalQueueRelative.startsWith('..') || path.isAbsolute(lexicalQueueRelative)) {
      throw new Error('queue_path_outside_vault')
    }
    const [realQueueRoot, realQueue] = await Promise.all([fs.realpath(queueRoot), fs.realpath(resolvedQueue)])
    const realQueueRelative = path.relative(realQueueRoot, realQueue)
    if (realQueueRelative.startsWith('..') || path.isAbsolute(realQueueRelative)) {
      throw new Error('queue_path_symlink_escape')
    }
    const realRepositoryRelative = path.relative(realRepositoryRoot, realQueue).replaceAll('\\', '/')
    if (realRepositoryRelative.startsWith('../') || path.isAbsolute(realRepositoryRelative)) {
      throw new Error('queue_path_outside_repository')
    }
    if (path.extname(realQueue).toLowerCase() !== '.md') throw new Error('queue_file_type_invalid')
    queueContent = await readRequired(realQueue, realRepositoryRelative)
    queueRelative = realRepositoryRelative
  }

  const requested = []
  const cutoff = now.getTime() - 7 * 86_400_000
  if (route === 'daily-pulse' || route === 'weekly-review') {
    const projectRoot = path.join(resolvedVault, '02-PROJECTS')
    const projectFiles = await walkMarkdown(projectRoot)
    for (const absolute of projectFiles) {
      const stat = await fs.stat(absolute)
      if (path.basename(absolute).toLowerCase() === 'overview.md' || stat.mtimeMs >= cutoff) requested.push(absolute)
    }
    const yesterday = isoDateAtWat(new Date(now.getTime() - 86_400_000))
    requested.push(path.join(resolvedVault, '06-DAILY-NOTES', `${yesterday}.md`))
    if (route === 'weekly-review') {
      requested.push(path.join(resolvedVault, 'SYSTEM', 'logs', 'operations.md'))
      await addMarkdownTree(requested, path.join(resolvedVault, '06-DAILY-NOTES'), { cutoff })
      await addMarkdownTree(requested, path.join(resolvedVault, 'GENERATED'), { cutoff })
    }
  }
  if (route === 'moe-brief') {
    requested.push(path.join(resolvedVault, '01-CLIENTS', 'MOE', 'overview.md'))
    await addMarkdownTree(requested, path.join(resolvedVault, '01-CLIENTS', 'MOE', 'communications'))
  }
  if (route === 'sprint-review') {
    requested.push(path.join(resolvedVault, '02-PROJECTS', 'LiberiaLearn', 'overview.md'))
    await addMarkdownTree(requested, path.join(resolvedVault, '06-DAILY-NOTES'))
  }
  if (route === 'research') await addMarkdownTree(requested, path.join(resolvedVault, '04-RESEARCH'))
  const declared = parseDeclaredInputs(queueContent)
    .map((relative) => path.join(repositoryRoot, ...relative.split('/')))
  requested.unshift(...declared)

  const unique = [...new Set(requested.map((entry) => path.resolve(entry)))]
  const sources = []
  const missingInputs = []
  let totalBytes = 0
  for (const absolute of unique) {
    const relative = path.relative(repositoryRoot, absolute).replaceAll('\\', '/')
    if (relative.startsWith('../') || path.isAbsolute(relative)) throw new Error(`context_input_outside_repository:${relative}`)
    normalizeRelative(relative)
    if (sources.length >= MAX_FILES) {
      missingInputs.push(`${relative} (file limit exceeded)`)
      continue
    }
    try {
      const real = await fs.realpath(absolute)
      const realRelative = path.relative(realRepositoryRoot, real).replaceAll('\\', '/')
      if (realRelative.startsWith('../') || path.isAbsolute(realRelative)) throw new Error(`context_input_symlink_escape:${relative}`)
      normalizeRelative(realRelative)
      const stat = await fs.stat(real)
      if (!stat.isFile()) throw new Error('not_a_file')
      if (stat.size > MAX_FILE_BYTES || totalBytes + stat.size > MAX_TOTAL_BYTES) {
        missingInputs.push(`${relative} (size limit exceeded)`)
        continue
      }
      const content = await fs.readFile(real, 'utf8')
      totalBytes += Buffer.byteLength(content)
      sources.push({ path: relative, modifiedAt: stat.mtime.toISOString(), content })
    } catch (error) {
      if (error?.code === 'ENOENT') missingInputs.push(`${relative} (not present)`)
      else throw error
    }
  }

  const manifest = sources.map((source) => `- ${source.path} (modified ${source.modifiedAt})`).join('\n') || '- None'
  const missing = missingInputs.map((entry) => `- ${entry}`).join('\n') || '- None'
  const sourceBodies = sources.map((source) => `\n--- SOURCE: ${source.path} ---\n${source.content}`).join('\n')
  const user = [
    workflowPrompt,
    queueContent ? `\n--- TRIGGERING REQUEST: ${queueRelative} ---\n${queueContent}` : '',
    `\n--- ATTACHED SOURCE MANIFEST ---\n${manifest}`,
    `\n--- MISSING OR OMITTED INPUTS ---\n${missing}`,
    sourceBodies,
  ].join('\n')
  const system = `${systemBase}\n\nOnly the sources attached to this request are available. You have no filesystem or web tools. Treat missing or omitted inputs as Unknown and do not claim external verification.`
  return { route, system, user, sources: sources.map(({ path: sourcePath, modifiedAt }) => ({ path: sourcePath, modifiedAt })), missingInputs }
}

export function contextRouteForQueueFilename(filename) {
  if (filename.startsWith('RESEARCH-')) return 'research'
  if (filename.startsWith('DRAFT-')) return 'draft'
  if (filename.startsWith('AUDIT-')) return 'audit'
  if (filename.startsWith('SPRINT-REVIEW-')) return 'sprint-review'
  if (filename.startsWith('BRIEF-MOE-')) return 'moe-brief'
  return 'draft'
}
