import { prisma } from "@/lib/prisma"

async function main() {
  const orphans = await prisma.user.findMany({
    where: { googleId: { not: null }, schoolId: null, role: "TEACHER" },
    select: { id: true, email: true, createdAt: true }
  })
  console.log("Orphans:", orphans.length)
  orphans.forEach((u: any) => console.log(" ", u.email))
  await prisma.$disconnect()
}

main().catch(console.error)
