/**
 * Generates NextAuth v4 JWT session tokens for load-test students and guardians.
 * Writes load-tests/fixtures/student-tokens.json and guardian-tokens.json (gitignored).
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

  const users = await prisma.user.findMany({
    where: {
      email: { contains: "@loadtest.liberialearn.internal" },
      role: { in: ["STUDENT", "GUARDIAN"] },
    },
    select: { id: true, email: true, name: true, role: true, schoolId: true },
    orderBy: { email: "asc" },
  })

  const students = users.filter((u) => u.role === "STUDENT")
  const guardians = users.filter((u) => u.role === "GUARDIAN")

  if (students.length === 0) {
    throw new Error("No load-test students found. Run seed-load-test-users.ts first.")
  }

  async function encodeToken(u: (typeof users)[number]) {
    return {
      email: u.email,
      token: await encode({
        token: {
          sub: u.id,
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          schoolId: u.schoolId,
          isPlatformAdmin: false,
          mustChangePIN: false,
        },
        secret,
        maxAge: 30 * 24 * 60 * 60,
      }),
    }
  }

  console.log(`Generating tokens for ${students.length} students...`)
  const studentTokens = await Promise.all(students.map(encodeToken))

  const outDir = path.join(process.cwd(), "load-tests", "fixtures")
  mkdirSync(outDir, { recursive: true })
  const studentPath = path.join(outDir, "student-tokens.json")
  writeFileSync(studentPath, JSON.stringify(studentTokens, null, 2))
  console.log(`Written ${studentTokens.length} tokens to ${studentPath}`)

  if (guardians.length > 0) {
    console.log(`Generating tokens for ${guardians.length} guardians...`)
    const guardianTokens = await Promise.all(guardians.map(encodeToken))
    const guardianPath = path.join(outDir, "guardian-tokens.json")
    writeFileSync(guardianPath, JSON.stringify(guardianTokens, null, 2))
    console.log(`Written ${guardianTokens.length} tokens to ${guardianPath}`)
  } else {
    console.log("No guardians found — run seed-load-test-users.ts to create lt-g* guardians.")
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
