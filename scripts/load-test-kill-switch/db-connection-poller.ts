/**
 * Polls real production DB connection state at a fixed interval and logs
 * timestamped samples, for correlating against a concurrent k6 diagnostic
 * run's latency timeline. Run alongside cold-path-diagnosis.js /
 * sustained-load-diagnosis.js, not standalone.
 *
 * Run: npx dotenv -e .env.production -- npx tsx scripts/load-test-kill-switch/db-connection-poller.ts <durationSeconds> <intervalSeconds>
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const durationSec = Number(process.argv[2] ?? 300)
const intervalSec = Number(process.argv[3] ?? 15)

async function sample() {
  const rows: any = await prisma.$queryRawUnsafe(`
    SELECT
      count(*) FILTER (WHERE state = 'active') as active,
      count(*) FILTER (WHERE state = 'idle') as idle,
      count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_txn,
      count(*) as total
    FROM pg_stat_activity
  `)
  const r = rows[0]
  console.log(
    `${new Date().toISOString()} active=${r.active} idle=${r.idle} idle_in_txn=${r.idle_in_txn} total=${r.total}`
  )
}

async function main() {
  const iterations = Math.floor(durationSec / intervalSec)
  console.log(`polling every ${intervalSec}s for ${durationSec}s (${iterations} samples)`)
  for (let i = 0; i < iterations; i++) {
    await sample().catch((e) => console.log(`${new Date().toISOString()} SAMPLE FAILED: ${e.message}`))
    await new Promise((resolve) => setTimeout(resolve, intervalSec * 1000))
  }
  await prisma.$disconnect()
}

main()
