/**
 * Read-only verification: print WAEC readiness for a student by email.
 * Run: npx dotenv -e .env.production -- npx tsx scripts/verify-waec-readiness.ts --email x@y
 */
import { prisma } from "@/lib/db";
import { getStudentWaecReadinessAll } from "@/lib/waec/readiness";

function arg(n: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  if (hit) return hit.split("=")[1];
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("email");
  const emails = email ? [email] : ["student03@lib-bon-0001.edu.lr", "marcus.sumo@pcs.edu.lr"];

  for (const em of emails) {
    const user = await prisma.user.findUnique({ where: { email: em }, select: { id: true } });
    const student = user ? await prisma.student.findUnique({ where: { userId: user.id }, select: { id: true, currentGrade: true } }) : null;
    if (!student) {
      console.log(`\n=== ${em} — no student record ===`);
      continue;
    }
    console.log(`\n=== ${em} (Grade ${student.currentGrade}, Student.id ${student.id}) ===`);
    const all = await getStudentWaecReadinessAll(student.id);
    for (const r of all) {
      const score = r.readiness == null ? (r.available ? "— (take placement)" : "— (unavailable)") : `${r.readiness}%`;
      console.log(
        `  ${r.name.padEnd(28)} readiness=${String(score).padEnd(20)} coverage=${Math.round(r.coverage * 100)}%  trend=${r.trend}  next=${r.nextFocusName ?? "-"}`
      );
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
