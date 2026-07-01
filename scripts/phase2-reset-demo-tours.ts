/**
 * Phase 2 fix: clear tourCompletedAt on the demo accounts so the guided tour
 * auto-starts for principals on first login (they can also replay via ?tour=true).
 * Run: npx dotenv -e .env.production -- npx tsx scripts/phase2-reset-demo-tours.ts
 */
import { prisma } from "@/lib/db";

const DEMO_EMAILS = [
  "student1@cha.edu.lr",
  "teacher1@cha.edu.lr",
  "admin@cha.edu.lr",
  "guardian1@cha.family.lr",
  "official1@moe.gov.lr",
];

async function main() {
  const users = await prisma.user.findMany({
    where: { email: { in: DEMO_EMAILS } },
    select: { id: true, email: true, role: true, tourCompletedAt: true },
  });
  console.log(`Matched ${users.length} demo accounts:`);
  for (const u of users) console.log(`  ${u.email} (${u.role}) tourCompletedAt=${u.tourCompletedAt?.toISOString() ?? "null"}`);

  const res = await prisma.user.updateMany({
    where: { email: { in: DEMO_EMAILS } },
    data: { tourCompletedAt: null },
  });
  console.log(`Reset tourCompletedAt on ${res.count} accounts.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
