/**
 * scripts/seed-waec-demo-mastery.ts — PHASE 5A Surface demo data
 *
 * Seeds ONE clearly-labeled Grade-11 demo student and realistic WAEC completions across
 * Math, Physics, Chemistry, English, so the WAEC Prep surface has a populated multi-subject
 * demo. Readiness is NOT written directly — it is computed on read by lib/waec/readiness.ts
 * from the mastery profiles this script produces through the REAL mastery engine
 * (resolveMasteryStrandForLesson + updateMasteryProfile — the same service
 * completeScheduledLesson calls).
 *
 * Constraints honoured:
 *   - Only touches waec-demo-g11@cha.edu.lr. Never touches other students.
 *   - Uses existing Grade 9+ tagged lessons for each subject.
 *   - Exit-ticket-style scores vary 70–90%, drift upward over ~6 weeks (real trend).
 *   - Partial (not 100%) coverage: a small skip-set of strands is left unassessed per subject.
 *
 * Run:   npx dotenv -e .env.production -- npx tsx scripts/seed-waec-demo-mastery.ts
 * Reset: npx dotenv -e .env.production -- npx tsx scripts/seed-waec-demo-mastery.ts --reset
 */
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { updateMasteryProfile } from "@/lib/mastery/masteryService";
import { contentSubjectToWaec, getTopic } from "@/lib/waec/syllabus";

const DEMO_EMAIL = "waec-demo-g11@cha.edu.lr";
const DEMO_NAME = "WAEC Demo Student (Grade 11)";
const DEMO_PASSWORD = "WaecDemo!2026"; // documented in docs/curriculum/WAEC_DEMO_DATA.md
const APPROVED = ["accepted", "published", "APPROVED"];
const hasFlag = (n: string) => process.argv.includes(`--${n}`);

// Content subjects grouped per WAEC subject we want populated. skipTopics are left
// deliberately unassessed so coverage is realistically partial (never 100%).
const SUBJECT_GROUPS: { label: string; contentSubjects: string[]; skipTopics: string[] }[] = [
  { label: "MATH", contentSubjects: ["MATH"], skipTopics: ["math.vectors_transformation", "math.trigonometry"] },
  { label: "PHYSICS", contentSubjects: ["PHYSICS"], skipTopics: ["physics.modern"] },
  { label: "CHEMISTRY", contentSubjects: ["CHEMISTRY"], skipTopics: ["chemistry.organic"] },
  { label: "ENGLISH", contentSubjects: ["ENGLISH", "LITERACY"], skipTopics: ["english.oral"] },
];

// Deterministic pseudo-random so re-runs are stable.
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function resetDemo() {
  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL }, select: { id: true, student: { select: { id: true } } } });
  if (!user) { console.log("No demo student to reset."); return; }
  if (user.student) {
    const del = await prisma.studentMasteryProfile.deleteMany({ where: { studentId: user.student.id } });
    console.log(`Deleted ${del.count} mastery profiles.`);
    await prisma.student.delete({ where: { id: user.student.id } });
  }
  await prisma.user.delete({ where: { id: user.id } });
  console.log("Deleted demo user + student.");
}

async function main() {
  if (hasFlag("reset")) { await resetDemo(); return; }

  const school = await prisma.school.findFirst({ where: { code: "CHA" }, select: { id: true } })
    ?? await prisma.school.findFirst({ select: { id: true } });
  if (!school) throw new Error("No school found");

  const hashed = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: DEMO_NAME, role: "STUDENT", schoolId: school.id },
    create: { email: DEMO_EMAIL, name: DEMO_NAME, role: "STUDENT", hashedPwd: hashed, schoolId: school.id },
    select: { id: true },
  });
  const student = await prisma.student.upsert({
    where: { userId: user.id },
    update: { currentGrade: 11 },
    create: { userId: user.id, currentGrade: 11 },
    select: { id: true },
  });
  // Clear prior demo mastery so the seed is deterministic.
  await prisma.studentMasteryProfile.deleteMany({ where: { studentId: student.id } });
  console.log(`Demo student ${DEMO_EMAIL} (Student.id ${student.id}) at school ${school.id}`);

  const rand = mulberry32(42);
  const now = Date.now();
  const DAY = 86_400_000;

  for (const group of SUBJECT_GROUPS) {
    const lessons = await prisma.curriculumContent.findMany({
      where: { status: { in: APPROVED }, grade: { gte: 9 }, subject: { in: group.contentSubjects }, NOT: { waecSyllabusTopics: { isEmpty: true } } },
      select: { waecSyllabusTopics: true },
      take: 200,
    });

    // Count real tagged lessons per topic (drives which topics get "completed" and how many).
    const lessonsPerTopic = new Map<string, number>();
    for (const l of lessons) {
      for (const t of l.waecSyllabusTopics) {
        if (group.skipTopics.includes(t)) continue;
        if (contentSubjectToWaec(group.contentSubjects[0])?.topics.some((x) => x.id === t)) {
          lessonsPerTopic.set(t, (lessonsPerTopic.get(t) ?? 0) + 1);
        }
      }
    }

    // Build completions per mastery strand, driven by each covered topic's primary strand.
    type Strand = { subject: any; strandKey: string; series: { score: number; at: number }[] };
    const strands = new Map<string, Strand>();
    for (const [topicId, lessonCount] of lessonsPerTopic) {
      const topic = getTopic(topicId);
      const primary = topic?.strands[0];
      if (!primary) continue;
      const k = Math.min(6, Math.max(3, Math.min(lessonCount, 3 + Math.floor(rand() * 3)))); // 3-6
      const flat = rand() < 0.22;
      const base = 0.70 + rand() * 0.08;
      const s = strands.get(primary.strandKey) ?? { subject: primary.subject, strandKey: primary.strandKey, series: [] };
      for (let i = 0; i < k; i++) {
        const drift = flat ? 0 : (i / Math.max(1, k - 1)) * (0.12 + rand() * 0.06);
        const noise = (rand() - 0.5) * 0.04;
        const score = Math.min(0.9, Math.max(0.7, base + drift + noise));
        const at = now - (42 - Math.round((i / k) * 40 + rand() * 2)) * DAY; // ~6 weeks
        s.series.push({ score: Math.round(score * 100) / 100, at });
      }
      strands.set(primary.strandKey, s);
    }

    // Replay each strand's series chronologically through the mastery engine.
    let completions = 0;
    for (const [, s] of strands) {
      s.series.sort((a, b) => a.at - b.at);
      const running: number[] = [];
      const days: number[] = [];
      for (let i = 0; i < s.series.length; i++) {
        running.push(s.series[i].score);
        if (i > 0) days.push(Math.max(1, Math.round((s.series[i].at - s.series[i - 1].at) / DAY)));
        await updateMasteryProfile({
          studentId: student.id, schoolId: school.id,
          subject: s.subject, strandKey: s.strandKey, gradeBand: "G10_12",
          newScore: s.series[i].score, wasAiAssisted: false,
          totalAttempts: i + 1, aiAssistedAttempts: 0,
          recentScores: running.slice(-10), daysBetweenScores: days.slice(-9),
        });
        completions++;
      }
    }
    console.log(`  ${group.label.padEnd(9)} → ${lessonsPerTopic.size} topics, ${strands.size} strands, ${completions} completions`);
  }

  console.log("\nDone. Verify with: npx dotenv -e .env.production -- npx tsx scripts/verify-waec-readiness.ts --email " + DEMO_EMAIL);
}

main().catch((e) => { console.error("SEED ERROR:", e); process.exit(1); }).finally(() => prisma.$disconnect());
