/**
 * Removes all load-test data created by seed-load-test-users.ts.
 * Run ONLY after NR-4/NR-5 are complete and documented.
 *
 *   npx dotenv -e .env.production -- npx tsx scripts/cleanup-load-test-users.ts
 */

// Use direct Postgres URL for deletions (bypasses PgBouncer)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

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
