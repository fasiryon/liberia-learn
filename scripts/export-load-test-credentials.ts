/**
 * Exports comma-separated credential lists for k6 env vars.
 * Writes load-tests/fixtures/load-test-env.sample (no secrets in repo — copy locally).
 *
 * Run after seed-load-test-pool.ts:
 *   npx dotenv -e .env.production -- npx tsx scripts/export-load-test-credentials.ts
 */

import { PrismaClient } from "@prisma/client"
import { mkdirSync, writeFileSync } from "fs"
import path from "path"

// DIRECT_URL has been intermittently unreachable from this working
// environment (confirmed again 2026-07-30); use the pooled DATABASE_URL
// as-is rather than overriding it. See docs/agents/ADVISOR_ESCALATION_CONTRACT.md
// carry-forward rule 3.

const prisma = new PrismaClient()
const PASSWORD = "LoadTest2026!"
const BATCH = 200

async function main() {
  const students = await prisma.user.findMany({
    where: { email: { contains: "@loadtest.liberialearn.internal" } },
    select: { email: true },
    orderBy: { email: "asc" },
  })

  if (students.length === 0) {
    throw new Error("No load-test students found. Run seed-load-test-pool.ts first.")
  }

  const emails = students.map((s) => s.email)
  const passwords = emails.map(() => PASSWORD)

  const lines = [
    "# Copy to load-tests/fixtures/load-test.env (gitignored) before k6 peak/moderate runs",
    `STUDENT_EMAILS=${emails.slice(0, BATCH).join(",")}`,
    `STUDENT_PASSWORDS=${passwords.slice(0, BATCH).map(() => PASSWORD).join(",")}`,
    `# Full pool: ${emails.length} students — extend BATCH in script for 1000+ creds`,
    `LOAD_TEST_LESSON_ID=math-g10-5-geometry-and-spatial-thinking-independent-practice`,
    `BASE_URL=https://liberia-learn.vercel.app`,
    `LOAD_TEST_AI_ENABLED=false`,
    `LOAD_TEST_USE_TOKEN_POOL=true`,
  ]

  const outDir = path.join(process.cwd(), "load-tests", "fixtures")
  mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, "load-test-env.sample")
  writeFileSync(outPath, lines.join("\n") + "\n")
  console.log(`Wrote ${outPath} (${emails.length} students in DB, ${Math.min(BATCH, emails.length)} in sample)`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
