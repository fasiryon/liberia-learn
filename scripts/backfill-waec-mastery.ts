/**
 * scripts/backfill-waec-mastery.ts — PHASE 5A Foundation (D5)
 *
 * Replays historical lesson completions (StudentProgress.exitTicketScore) for Grade 9+
 * WAEC-subject lessons through the FIXED strand resolver + mastery service, so mastery
 * lands on the correct WAEC strands and per-subject readiness becomes computable.
 *
 * Faithful replay: for each (student, strand) the completions are applied in chronological
 * order — the first sets the baseline, later ones update currentScore — so growth/trend and
 * sustainability reflect the real series (mirrors production write behaviour).
 *
 * NOTE: StudentProgress.studentId is a User.id (the known trap); we map it to Student.id
 * before writing mastery (updateMasteryProfile is keyed by Student.id).
 *
 * Idempotent-ish: mastery upserts are deterministic for a fixed completion history, so
 * re-running converges to the same profile state.
 *
 * Run (prod): npx dotenv -e .env.production -- npx tsx scripts/backfill-waec-mastery.ts [--dry-run] [--limit N]
 */
import { prisma } from "@/lib/db";
import { contentSubjectToWaec } from "@/lib/waec/syllabus";
import { resolveMasteryStrandForLesson } from "@/lib/mastery/resolveStrand";
import { updateMasteryProfile } from "@/lib/mastery/masteryService";

const APPROVED = ["accepted", "published", "APPROVED"];
const hasFlag = (n: string) => process.argv.includes(`--${n}`);
function arg(n: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${n}=`));
  if (hit) return hit.split("=")[1];
  const i = process.argv.indexOf(`--${n}`);
  if (i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")) return process.argv[i + 1];
  return undefined;
}

type Completion = {
  userId: string;
  schoolId: string;
  score: number; // 0..1
  completedAt: Date;
  contentSubject: string;
  grade: number;
  title: string | null;
  waecTopics: string[];
  moeAlignments: unknown;
};

async function main() {
  const dryRun = hasFlag("dry-run");
  const limit = arg("limit") ? parseInt(arg("limit")!, 10) : undefined;

  const progress = await prisma.studentProgress.findMany({
    where: {
      exitTicketScore: { not: null },
      scheduledWork: { content: { grade: { gte: 9 }, status: { in: APPROVED } } },
    },
    select: {
      studentId: true,
      exitTicketScore: true,
      completedAt: true,
      createdAt: true,
      scheduledWork: {
        select: {
          class: { select: { schoolId: true } },
          content: { select: { grade: true, subject: true, title: true, waecSyllabusTopics: true, moeAlignments: true } },
        },
      },
    },
  });

  const completions: Completion[] = [];
  for (const p of progress) {
    const c = p.scheduledWork?.content;
    const schoolId = p.scheduledWork?.class?.schoolId;
    if (!c || !schoolId || p.exitTicketScore == null) continue;
    if (!contentSubjectToWaec(c.subject)) continue; // WAEC subjects only
    completions.push({
      userId: p.studentId,
      schoolId,
      score: Math.min(1, Math.max(0, p.exitTicketScore / 100)),
      completedAt: p.completedAt ?? p.createdAt,
      contentSubject: c.subject,
      grade: c.grade,
      title: c.title,
      waecTopics: c.waecSyllabusTopics ?? [],
      moeAlignments: c.moeAlignments,
    });
  }

  console.log(`G9+ WAEC completions with exit scores: ${completions.length}`);

  // Map User.id → Student.id
  const userIds = Array.from(new Set(completions.map((c) => c.userId)));
  const students = await prisma.student.findMany({
    where: { userId: { in: userIds } },
    select: { id: true, userId: true },
  });
  const userToStudent = new Map(students.map((s) => [s.userId, s.id]));

  // Resolve strand + group by (studentId, subject:strandKey)
  type Group = { studentId: string; schoolId: string; subject: string; strandKey: string; gradeBand: any; series: { score: number; at: Date }[] };
  const groups = new Map<string, Group>();
  let unresolved = 0;

  for (const c of completions) {
    const studentId = userToStudent.get(c.userId);
    if (!studentId) continue;
    const strand = await resolveMasteryStrandForLesson({
      contentSubject: c.contentSubject,
      grade: c.grade,
      title: c.title,
      waecTopics: c.waecTopics,
      moeAlignmentCode: Array.isArray(c.moeAlignments)
        ? (c.moeAlignments as Array<{ code?: string }>).find((e) => e?.code)?.code ?? null
        : null,
    });
    if (!strand) {
      unresolved++;
      continue;
    }
    const key = `${studentId}|${strand.subject}|${strand.strandKey}`;
    const g = groups.get(key) ?? { studentId, schoolId: c.schoolId, subject: strand.subject, strandKey: strand.strandKey, gradeBand: strand.gradeBand, series: [] };
    g.series.push({ score: c.score, at: c.completedAt });
    groups.set(key, g);
  }

  console.log(`Resolved groups (student×strand): ${groups.size} | unresolved completions: ${unresolved}`);

  let written = 0;
  const groupList = Array.from(groups.values());
  const sliced = limit ? groupList.slice(0, limit) : groupList;

  for (const g of sliced) {
    g.series.sort((a, b) => a.at.getTime() - b.at.getTime());
    if (dryRun) {
      written++;
      continue;
    }
    const running: number[] = [];
    for (let i = 0; i < g.series.length; i++) {
      running.push(g.series[i].score);
      await updateMasteryProfile({
        studentId: g.studentId,
        schoolId: g.schoolId,
        subject: g.subject as any,
        strandKey: g.strandKey,
        gradeBand: g.gradeBand,
        newScore: g.series[i].score,
        wasAiAssisted: false,
        totalAttempts: i + 1,
        aiAssistedAttempts: 0,
        recentScores: running.slice(-10),
      }).catch((e) => console.warn(`  write failed ${g.subject}:${g.strandKey} — ${e?.message}`));
    }
    written++;
  }

  console.log(`\n${dryRun ? "[dry-run] would write" : "Wrote"} ${written} student×strand mastery profiles.`);

  // Coverage report: students with computable readiness per WAEC subject bucket
  const bySubjectStudents: Record<string, Set<string>> = {};
  for (const g of groups.values()) {
    bySubjectStudents[g.subject] ??= new Set();
    bySubjectStudents[g.subject].add(g.studentId);
  }
  console.log("\nStudents with mastery data by mastery bucket:");
  for (const [subj, set] of Object.entries(bySubjectStudents).sort()) {
    console.log(`  ${subj.padEnd(18)} ${set.size} students`);
  }
}

main()
  .catch((e) => {
    console.error("BACKFILL ERROR:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
