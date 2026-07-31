/**
 * Removes all load-test data created by seed-load-test-pool.ts.
 * Run ONLY after NR-4/NR-5 are complete and documented.
 *
 *   npx dotenv -e .env.production -- npx tsx scripts/cleanup-load-test-users.ts
 */

// DIRECT_URL has been intermittently unreachable from this working
// environment (confirmed again 2026-07-30); use the pooled DATABASE_URL
// as-is rather than overriding it. See docs/agents/ADVISOR_ESCALATION_CONTRACT.md
// carry-forward rule 3.

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.deleteMany({
    where: { email: { contains: "@loadtest.liberialearn.internal" } },
  })
  const schools = await prisma.school.deleteMany({
    where: { code: { startsWith: "lt-school-" } },
  })
  console.log(`Deleted ${users.count} users, ${schools.count} schools`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
