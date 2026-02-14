/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

// Load .env without needing any package
function loadDotEnv() {
  const envPath = path.join(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    console.log("ℹ️ No .env found at:", envPath);
    return;
  }

  const raw = fs.readFileSync(envPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;

    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();

    // strip surrounding quotes
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = val;
  }

  console.log("✅ Loaded .env into process.env");
}

loadDotEnv();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}. Add it to .env in repo root.`);
  return v;
}

async function main() {
  console.log("🚀 Running seed-mastery-demo.cjs");
  console.log("📍 CWD:", process.cwd());

  const studentId = requireEnv("DEMO_STUDENT_ID");
  const skillId = requireEnv("DEMO_SKILL_ID");
  const gradeId = requireEnv("DEMO_GRADE_ID");

  console.log("✅ Using IDs:", { studentId, skillId, gradeId });

  // sanity checks
  const student = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!student) throw new Error(`Student not found: ${studentId}`);

  const skill = await prisma.skill.findUnique({ where: { id: skillId }, select: { id: true } });
  if (!skill) throw new Error(`Skill not found: ${skillId}`);

  const grade = await prisma.grade.findUnique({ where: { id: gradeId }, select: { id: true } });
  if (!grade) throw new Error(`Grade not found: ${gradeId}`);

  // Create snapshot (try FORMATIVE then fallback)
  console.log("✅ Creating ObjectiveMasterySnapshot...");
  let snapshot;
  try {
    snapshot = await prisma.objectiveMasterySnapshot.create({
      data: {
        studentId,
        skillId,
        masteryLevel: 0.75,
        measuredAt: new Date(),
        measurementType: "FORMATIVE",
        contextNote: "Demo snapshot generated from demo grade",
      },
      select: { id: true, studentId: true, skillId: true, masteryLevel: true, measuredAt: true },
    });
  } catch (e) {
    snapshot = await prisma.objectiveMasterySnapshot.create({
      data: {
        studentId,
        skillId,
        masteryLevel: 0.75,
        measuredAt: new Date(),
        measurementType: "SUMMATIVE",
        contextNote: "Demo snapshot generated from demo grade (fallback SUMMATIVE)",
      },
      select: { id: true, studentId: true, skillId: true, masteryLevel: true, measuredAt: true },
    });
  }

  console.log("✅ Snapshot:", snapshot);

  // Create evidence (try ASSESSMENT then fallback)
  console.log("✅ Creating MasteryEvidence...");
  let evidence;
  try {
    evidence = await prisma.masteryEvidence.create({
      data: {
        snapshotId: snapshot.id,
        gradeId,
        sourceType: "ASSESSMENT",
        weight: 1.0,
        recordedAt: new Date(),
        note: "Demo evidence linked to demo grade",
      },
      select: { id: true, snapshotId: true, gradeId: true, sourceType: true, weight: true },
    });
  } catch (e) {
    evidence = await prisma.masteryEvidence.create({
      data: {
        snapshotId: snapshot.id,
        gradeId,
        sourceType: "OTHER",
        weight: 1.0,
        recordedAt: new Date(),
        note: "Demo evidence linked to demo grade (fallback OTHER)",
      },
      select: { id: true, snapshotId: true, gradeId: true, sourceType: true, weight: true },
    });
  }

  console.log("✅ Evidence:", evidence);

  // Show mastery history
  const history = await prisma.objectiveMasterySnapshot.findMany({
    where: { studentId, skillId },
    orderBy: { measuredAt: "asc" },
    select: { id: true, masteryLevel: true, measuredAt: true, measurementType: true, contextNote: true },
  });

  console.log("\n📈 Mastery History:");
  for (const h of history) {
    console.log(`- ${h.measuredAt.toISOString()} | ${h.measurementType} | ${h.masteryLevel} | ${h.contextNote || ""}`);
  }

  console.log("\n✅ Done.");
}

main()
  .catch((e) => {
    console.error("\n❌ ERROR:", e.message || e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
