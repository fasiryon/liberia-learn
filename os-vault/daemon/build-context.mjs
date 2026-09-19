import path from 'path'
import { fileURLToPath } from 'url'
import { buildWorkflowContext } from './context.mjs'

const directory = path.dirname(fileURLToPath(import.meta.url))
const vaultPath = path.resolve(directory, '..')
const [route, queueArgument] = process.argv.slice(2)
const queuePath = queueArgument ? path.resolve(vaultPath, 'QUEUE', queueArgument) : undefined

try {
  const context = await buildWorkflowContext({ vaultPath, route, queuePath })
  process.stdout.write(JSON.stringify(context))
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
}
