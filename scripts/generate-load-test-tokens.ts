/**
 * Generates NextAuth v4 JWT session tokens for all 1,000 load-test students.
 * Writes load-tests/fixtures/student-tokens.json (gitignored).
 * Tokens are valid for 30 days.
 *
 * Run after seed-load-test-users.ts:
 *   npx dotenv -e .env.production -- npx tsx scripts/generate-load-test-tokens.ts
 */

// Use direct Postgres URL for reads (bypasses PgBouncer)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

import { PrismaClient } from "@prisma/client"
import { encode } from "next-auth/jwt"
import { writeFileSync, mkdirSync } from "fs"
import path from "path"

const prisma = new PrismaClient()

async function main() {
  const secret = process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("NEXTAUTH_SECRET is not set")

  const students = await prisma.user.findMany({
    where: { email: { contains: "@loadtest.liberialearn.internal" } },
    select: { id: true, email: true, name: true, role: true, schoolId: true },
    orderBy: { email: "asc" },
  })

  if (students.length === 0) {
    throw new Error("No load-test students found. Run seed-load-test-users.ts first.")
  }

  console.log(`Generating tokens for ${students.length} students...`)

  const tokens = await Promise.all(
    students.map(async (s) => ({
      email: s.email,
      token: await encode({
        token: {
          sub: s.id,
          email: s.email,
          name: s.name,
          role: s.role,
          schoolId: s.schoolId,
        },
        secret,
        maxAge: 30 * 24 * 60 * 60, // 30 days
      }),
    }))
  )

  const outDir = path.join(process.cwd(), "load-tests", "fixtures")
  mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, "student-tokens.json")
  writeFileSync(outPath, JSON.stringify(tokens, null, 2))
  console.log(`Written ${tokens.length} tokens to ${outPath}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
