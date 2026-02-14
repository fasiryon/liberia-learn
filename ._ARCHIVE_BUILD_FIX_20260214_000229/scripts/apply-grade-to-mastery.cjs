/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");
const { computeNextMastery, masteryToLevel } = require("./lib/grading-engine.cjs");

function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}
loadDotEnv();

const prisma = new PrismaClient();

function getArg(name) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  if (!hit) return null;
  return hit.split("=").slice(1).join("=");
}

function requireVal(v, name) {
  if (!v) throw new Error(`Missing ${name}. Provide --${name}=... or set in .env.`);
  return v;
}

function letterToPercent(letter) {
  if (!letter) return null;
  const L = String(letter).trim().toUpperCase();
  const map = {
    "A+": 98, "A": 95, "A-": 92,
    "B+": 88, "B": 85, "B-": 82,
    "C+": 78, "C": 75, "C-": 72,
    "D+": 68, "D": 65, "D-": 62,
    "F": 55
  };
  return map[L] ?? null;
}

async function getGradeById(gradeId) {
  // Try a minimal select first (only what we've seen actually exists in your schema)
  try {
    return await prisma.grade.findUnique({
      where: { id: gradeId },
      select: {
        id: true,
        percent: true,
        letter: true,
        computedAt: true,
        studentId: true,
        classId: true,
      },
    });
  } catch (e) {
    // Fallback: no select (works even if model fields differ)
    return await prisma.grade.findUnique({ where: { id: gradeId } });
  }
}

async function main() {
  const studentId = requireVal(getArg("studentId") || process.env.DEMO_STUDENT_ID, "studentId");
  const skillId = requireVal(getArg("skillId") || process.env.DEMO_SKILL_ID, "skillId");
  const gradeId = requireVal(getArg("gradeId") || process.env.DEMO_GRADE_ID, "gradeId");

  console.log("✅ apply-grade-to-mastery");
  console.log({ studentId, skillId, gradeId });

  const grade = await getGradeById(gradeId);
  if (!grade) throw new Error(`Grade not found: ${gradeId}`);

  // infer percent-like value (0..100)
  let gradePercent = null;

  if (grade.percent !== null && grade.percent !== undefined) {
    gradePercent = Number(grade.percent);
  } else {
    gradePercent = letterToPercent(grade.letter);
  }

  if (gradePercent === null || Number.isNaN(Number(gradePercent))) {
    gradePercent = 75; // safe demo fallback
  }

  // previous mastery: from latest snapshot, else from masteryRecord.level, else 0
  let previousMastery = 0;

  const lastSnap = await prisma.objectiveMasterySnapshot.findFirst({
    where: { studentId, skillId },
    orderBy: { measuredAt: "desc" },
    select: { masteryLevel: true },
  });

  if (lastSnap) {
    previousMastery = lastSnap.masteryLevel;
  } else {
    const mr = await prisma.masteryRecord.findFirst({
      where: { studentId, skillId },
      select: { level: true },
    });
    if (mr) previousMastery = (mr.level ?? 0) / 100;
  }

  const nextMastery = computeNextMastery({
    previousMastery,
    gradePercent,
    alpha: 0.35,
  });

  const nextLevel = masteryToLevel(nextMastery);

  console.log("📊 mastery calc:", { previousMastery, gradePercent, nextMastery, nextLevel });

  const snapshot = await prisma.objectiveMasterySnapshot.create({
    data: {
      studentId,
      skillId,
      masteryLevel: nextMastery,
      measuredAt: new Date(),
      measurementType: "FORMATIVE",
      contextNote: `Auto snapshot from Grade ${gradeId}`,
    },
    select: { id: true, measuredAt: true, masteryLevel: true },
  });

  await prisma.masteryEvidence.create({
    data: {
      snapshotId: snapshot.id,
      gradeId,
      sourceType: "ASSESSMENT",
      weight: 1.0,
      recordedAt: new Date(),
      note: "Auto evidence from grade",
    },
    select: { id: true },
  });

  await prisma.masteryRecord.upsert({
    where: { studentId_skillId: { studentId, skillId } },
    update: { level: nextLevel, lastAssessedAt: new Date() },
    create: { studentId, skillId, level: nextLevel, lastAssessedAt: new Date() },
    select: { id: true },
  });

  console.log("✅ Wrote snapshot + evidence + upserted masteryRecord");
  console.log("snapshot:", snapshot);

  const history = await prisma.objectiveMasterySnapshot.findMany({
    where: { studentId, skillId },
    orderBy: { measuredAt: "asc" },
    select: { measuredAt: true, masteryLevel: true, measurementType: true, contextNote: true },
  });

  console.log("\n📈 History:");
  for (const h of history) {
    console.log(`- ${h.measuredAt.toISOString()} | ${h.measurementType} | ${h.masteryLevel} | ${h.contextNote || ""}`);
  }
}

main()
  .catch((e) => {
    console.error("\n❌ ERROR:", e.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
