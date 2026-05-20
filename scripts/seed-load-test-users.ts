/**
 * Creates 1,000 unique student accounts across 10 test schools.
 * Schools: lt-school-01 through lt-school-10 (100 students each)
 * All accounts use a deterministic password: LoadTest2026!
 * Prefixed with lt- so they are clearly non-production and can be
 * bulk-deleted after testing.
 *
 * Run ONCE against production:
 *   npx dotenv -e .env.production -- npx tsx scripts/seed-load-test-users.ts
 *
 * Clean up after load tests:
 *   npx dotenv -e .env.production -- npx tsx scripts/cleanup-load-test-users.ts
 */

// Use direct Postgres URL for seeding (bypasses PgBouncer)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const SCHOOLS = 10
const STUDENTS_PER_SCHOOL = 100
const LOAD_TEST_PASSWORD = "LoadTest2026!"

async function main() {
  const passwordHash = await bcrypt.hash(LOAD_TEST_PASSWORD, 10)
  console.log("Creating load-test schools and students...")

  for (let s = 1; s <= SCHOOLS; s++) {
    const code = `lt-school-${String(s).padStart(2, "0")}`

    const school = await prisma.school.upsert({
      where: { code },
      update: {},
      create: {
        name: `Load Test School ${s}`,
        code,
        county: "Montserrado",
        googleSsoEnabled: false,
      },
    })

    for (let u = 1; u <= STUDENTS_PER_SCHOOL; u++) {
      const email = `lt-s${String(s).padStart(2, "0")}-u${String(u).padStart(3, "0")}@loadtest.liberialearn.internal`
      const user = await prisma.user.upsert({
        where: { email },
        update: { schoolId: school.id },
        create: {
          email,
          name: `Load Test Student ${s}-${u}`,
          role: "STUDENT",
          hashedPwd: passwordHash,
          schoolId: school.id,
        },
      })
      await prisma.student.upsert({
        where: { userId: user.id },
        update: { currentGrade: 9 },
        create: {
          userId: user.id,
          currentGrade: 9,
          county: "Montserrado",
        },
      })
      if (u % 50 === 0) process.stdout.write(".")
    }
    // One guardian per school, linked via school membership (guardian reads use school scope).
    const guardianEmail = `lt-g${String(s).padStart(2, "0")}@loadtest.liberialearn.internal`
    await prisma.user.upsert({
      where: { email: guardianEmail },
      update: { schoolId: school.id },
      create: {
        email: guardianEmail,
        name: `Load Test Guardian ${s}`,
        role: "GUARDIAN",
        hashedPwd: passwordHash,
        schoolId: school.id,
      },
    })

    console.log(`\nSchool ${s}/${SCHOOLS} complete (schoolId: ${school.id})`)
  }

  const count = await prisma.user.count({
    where: { email: { contains: "@loadtest.liberialearn.internal" } },
  })
  const schoolCount = await prisma.school.count({
    where: { code: { startsWith: "lt-school-" } },
  })
  console.log(`\nDone. Load-test students: ${count}, schools: ${schoolCount}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
