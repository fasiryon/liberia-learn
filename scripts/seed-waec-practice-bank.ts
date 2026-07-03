/** Pre-generate & cache the WAEC practice question bank for the given subjects. */
import { prisma } from "@/lib/db";
import { ensureBank } from "@/lib/waec/practice";
import { getWaecSubjects, type WaecSubjectId } from "@/lib/waec/syllabus";

function arg(n: string) {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  if (hit) return hit.split("=")[1];
  const i = process.argv.indexOf(`--${n}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const only = arg("subjects")?.split(",");
  const subjects = getWaecSubjects().filter((s) => s.masterySubject !== null && (!only || only.includes(s.id)));
  for (const s of subjects) {
    process.stdout.write(`Filling ${s.name}… `);
    await ensureBank(s.id as WaecSubjectId, 11);
    const n = await prisma.waecPracticeItem.count({ where: { subjectId: s.id } });
    console.log(`${n} items in bank.`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
