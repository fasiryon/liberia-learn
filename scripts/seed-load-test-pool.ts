/**
 * NR-3: Load-Test Identity Pool.
 *
 * Creates/repairs a pool of load-test students across 50+ synthetic schools
 * for NR-4/NR-5 k6 runs to rotate through. Idempotent (upsert throughout) —
 * safe to rerun.
 *
 * Schools lt-school-01..10 already existed in production from an earlier
 * NR-3 attempt (1,000 users, 100 students each) but were missing their
 * Student rows entirely (verified 2026-07-30) — this run backfills those.
 * Schools lt-school-11..50 are new (20 students each) to clear the 50+
 * school requirement additively, without touching the existing 10.
 *
 * All rows are tagged via the existing naming convention consumed by
 * lib/loadTest/syntheticIdentity.ts: school code prefix `lt-school-` and
 * email domain `@loadtest.liberialearn.internal`.
 *
 * DIRECT_URL was confirmed unreachable from this session on 2026-07-30
 * (see docs/agents/ADVISOR_ESCALATION_CONTRACT.md carry-forward rule 3) —
 * this script uses the pooled DATABASE_URL as-is and writes sequentially
 * (not concurrently) to avoid starving the single pooled connection.
 *
 * Run:
 *   npx dotenv -e .env.production -- npx tsx scripts/seed-load-test-pool.ts
 *
 * Follow-up steps (unchanged from the prior pool):
 *   npx dotenv -e .env.production -- npx tsx scripts/generate-load-test-tokens.ts
 *   npx dotenv -e .env.production -- npx tsx scripts/export-load-test-credentials.ts
 *
 * Cleanup after NR-4/NR-5 complete:
 *   npx dotenv -e .env.production -- npx tsx scripts/cleanup-load-test-users.ts
 */

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const TOTAL_SCHOOLS = 50
const EXISTING_SCHOOLS = 10
const STUDENTS_PER_EXISTING_SCHOOL = 100
const STUDENTS_PER_NEW_SCHOOL = 20
const LOAD_TEST_PASSWORD = "LoadTest2026!"

function studentsForSchool(schoolIndex: number): number {
  return schoolIndex <= EXISTING_SCHOOLS ? STUDENTS_PER_EXISTING_SCHOOL : STUDENTS_PER_NEW_SCHOOL
}

// The pooled connection (DIRECT_URL is unreachable this session) occasionally
// resets mid-run ("Server has closed the connection", P1017) — transient,
// not a real failure. Retry with backoff instead of aborting the whole run.
async function withRetry<T>(fn: () => Promise<T>, label: string, attempts = 5): Promise<T> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === attempts) throw err
      const delayMs = 500 * attempt
      console.warn(`\n[retry ${attempt}/${attempts}] ${label}: ${(err as Error).message?.split("\n")[0]}`)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  throw new Error("unreachable")
}

async function main() {
  const passwordHash = await bcrypt.hash(LOAD_TEST_PASSWORD, 10)
  let totalStudentsCreated = 0

  console.log(`Seeding/repairing load-test pool: ${TOTAL_SCHOOLS} schools...`)

  for (let s = 1; s <= TOTAL_SCHOOLS; s++) {
    const code = `lt-school-${String(s).padStart(2, "0")}`
    const studentCount = studentsForSchool(s)

    const school = await withRetry(
      () =>
        prisma.school.upsert({
          where: { code },
          update: {},
          create: {
            name: `Load Test School ${s}`,
            code,
            county: "Montserrado",
            googleSsoEnabled: false,
          },
        }),
      `school upsert ${code}`
    )

    for (let u = 1; u <= studentCount; u++) {
      const email = `lt-s${String(s).padStart(2, "0")}-u${String(u).padStart(3, "0")}@loadtest.liberialearn.internal`
      const user = await withRetry(
        () =>
          prisma.user.upsert({
            where: { email },
            update: { schoolId: school.id },
            create: {
              email,
              name: `Load Test Student ${s}-${u}`,
              role: "STUDENT",
              hashedPwd: passwordHash,
              schoolId: school.id,
            },
          }),
        `user upsert ${email}`
      )

      const existingStudent = await withRetry(
        () => prisma.student.findUnique({ where: { userId: user.id } }),
        `student lookup ${email}`
      )
      if (!existingStudent) totalStudentsCreated += 1
      await withRetry(
        () =>
          prisma.student.upsert({
            where: { userId: user.id },
            update: { currentGrade: 9 },
            create: {
              userId: user.id,
              currentGrade: 9,
              county: "Montserrado",
            },
          }),
        `student upsert ${email}`
      )

      if (u % 50 === 0) process.stdout.write(".")
    }

    const guardianEmail = `lt-g${String(s).padStart(2, "0")}@loadtest.liberialearn.internal`
    await withRetry(
      () =>
        prisma.user.upsert({
          where: { email: guardianEmail },
          update: { schoolId: school.id },
          create: {
            email: guardianEmail,
            name: `Load Test Guardian ${s}`,
            role: "GUARDIAN",
            hashedPwd: passwordHash,
            schoolId: school.id,
          },
        }),
      `guardian upsert ${guardianEmail}`
    )

    console.log(`\nSchool ${s}/${TOTAL_SCHOOLS} complete (schoolId: ${school.id}, students: ${studentCount})`)
  }

  const finalUserCount = await prisma.user.count({
    where: { email: { contains: "@loadtest.liberialearn.internal" } },
  })
  const finalSchoolCount = await prisma.school.count({
    where: { code: { startsWith: "lt-school-" } },
  })
  const finalStudentCount = await prisma.student.count({
    where: { user: { email: { contains: "@loadtest.liberialearn.internal" } } },
  })

  console.log(`\nDone.`)
  console.log(`Load-test users: ${finalUserCount}`)
  console.log(`Load-test schools: ${finalSchoolCount}`)
  console.log(`Load-test Student rows: ${finalStudentCount} (created this run: ${totalStudentsCreated})`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
