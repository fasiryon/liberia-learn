import { prisma } from "@/lib/db";
import { composeGuardianDigest } from "@/lib/notifications/guardianDigest";

async function main() {
  const guardian = await prisma.user.findUnique({
    where: { email: "guardian1@cha.family.lr" },
    select: { id: true, guardianOf: { select: { studentId: true } } },
  });
  if (!guardian) { console.log("guardian not found"); process.exit(2); }

  // Week window covering today's completion (Mon Jun 8 – Sun Jun 14 2026)
  const weekStart = new Date("2026-06-08T00:00:00Z");
  const weekEnd = new Date("2026-06-14T23:59:59Z");

  const result = await composeGuardianDigest({
    guardianId: guardian.id,
    studentIds: guardian.guardianOf.map((g) => g.studentId),
    weekStart,
    weekEnd,
  });

  if (!result) { console.log("DIGEST: null (no activity counted)"); return; }
  console.log("SMS TEXT:", result.smsText);
  console.log("METRICS:", JSON.stringify(result.metrics, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
