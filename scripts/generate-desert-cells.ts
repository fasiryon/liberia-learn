// Generates NEEDS_REVIEW lesson stubs for desert grade×subject cells
// (cells below the national gate of 15 approved lessons).
//
// Creates CurriculumContent records + CurriculumRegenerationJob records so that
// process-regen-jobs-direct.ts can generate full lesson content for them.
//
// Usage:
//   npx dotenv -e .env.production -- npx tsx scripts/generate-desert-cells.ts --subject=ENGLISH
//   npx dotenv -e .env.production -- npx tsx scripts/generate-desert-cells.ts --subject=CS
//   npx dotenv -e .env.production -- npx tsx scripts/generate-desert-cells.ts --subject=ENGINEERING
//   npx dotenv -e .env.production -- npx tsx scripts/generate-desert-cells.ts --subject=CIVICS --grade=G2
//   npx dotenv -e .env.production -- npx tsx scripts/generate-desert-cells.ts --subject=ENGLISH --dry-run
//
// Flags:
//   --subject=X    required; one of ENGLISH, CS, ENGINEERING, CIVICS
//   --grade=G2     optional; restrict to a single grade (e.g. G2, G7)
//   --limit=20     optional; max lessons to create per desert grade (default: 20)
//   --dry-run      preview changes without writing to the database

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { randomUUID, createHash } from "crypto";
import { PrismaClient } from "@prisma/client";
import {
  ENGLISH_TITLES,
  CS_TITLES,
  ENGINEERING_TITLES,
  CIVICS_TITLES,
} from "./data/desert-lesson-titles";

const prisma = new PrismaClient();

const NATIONAL_GATE = 15;
const FACTORY_VERSION = "desert-gen-2026.1";
const APPROVED_STATUSES = new Set(["published", "APPROVED"]);
const ALL_GRADES = ["G1","G2","G3","G4","G5","G6","G7","G8","G9","G10","G11","G12"];

// ─── Arg parsing ─────────────────────────────────────────────────────────────

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function readKvArg(prefix: string): string | undefined {
  const entry = process.argv.find((a) => a.startsWith(prefix));
  return entry ? entry.slice(prefix.length).trim() : undefined;
}

// ─── Subject normalisation ────────────────────────────────────────────────────

const SUBJECT_ALIASES: Record<string, string> = {
  "CS": "COMPUTER_SCIENCE",
  "COMPUTER_SCIENCE": "COMPUTER_SCIENCE",
  "ENGINEERING": "ENGINEERING_FOUNDATIONS",
  "ENGINEERING_FOUNDATIONS": "ENGINEERING_FOUNDATIONS",
  "ENGLISH": "ENGLISH",
  "CIVICS": "CIVICS",
};

// ─── Title bank lookup ────────────────────────────────────────────────────────

function getTitleBank(subject: string): Record<string, string[]> {
  if (subject === "COMPUTER_SCIENCE") return CS_TITLES;
  if (subject === "ENGINEERING_FOUNDATIONS") return ENGINEERING_TITLES;
  if (subject === "ENGLISH") return ENGLISH_TITLES;
  if (subject === "CIVICS") return CIVICS_TITLES;
  return {};
}

// ─── ID helpers ───────────────────────────────────────────────────────────────

function buildContentId(subject: string, grade: number, title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const suffix = randomUUID().slice(0, 8);
  return `desert-${subject.toLowerCase()}-g${grade}-${slug}-${suffix}`;
}

function buildIdempotencyKey(runId: string, contentId: string, grade: number, subject: string): string {
  return createHash("sha256")
    .update(`${runId}:${grade}:${subject.toUpperCase()}:${contentId}`)
    .digest("hex");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = hasFlag("--dry-run");
  const rawSubject = readKvArg("--subject=");
  const rawGrade = readKvArg("--grade=");
  const limit = parseInt(readKvArg("--limit=") ?? "20", 10);

  if (!rawSubject) {
    console.error("Error: --subject= is required. Options: ENGLISH, CS, ENGINEERING, CIVICS");
    process.exit(1);
  }

  const canonicalSubject = SUBJECT_ALIASES[(rawSubject ?? "").toUpperCase()] ?? (rawSubject ?? "").toUpperCase();
  const subject = canonicalSubject;
  const titleBank = getTitleBank(subject);

  if (Object.keys(titleBank).length === 0) {
    console.error(`Error: no title bank found for subject "${subject}"`);
    process.exit(1);
  }

  const gradeFilter = rawGrade ? [rawGrade.replace(/^G/i, "")] : null;
  const targetGradeLabels = gradeFilter
    ? ALL_GRADES.filter((g) => gradeFilter.includes(g.replace("G", "")))
    : ALL_GRADES;

  console.log(`\n[DESERT-GEN] Desert Cell Generation Script`);
  console.log(`[DESERT-GEN] subject  : ${subject}`);
  console.log(`[DESERT-GEN] grades   : ${targetGradeLabels.join(", ")}`);
  console.log(`[DESERT-GEN] limit    : ${limit} lessons per desert grade`);
  console.log(`[DESERT-GEN] mode     : ${dryRun ? "DRY RUN (no writes)" : "LIVE"}\n`);

  // ── Step 1: identify desert grades ────────────────────────────────────────
  const desertGrades: Array<{ label: string; gradeNum: number; approvedCount: number }> = [];

  for (const gradeLabel of targetGradeLabels) {
    const gradeNum = parseInt(gradeLabel.replace("G", ""), 10);

    const approvedCount = await prisma.curriculumContent.count({
      where: {
        contentType: "lesson",
        grade: gradeNum,
        subject,
        status: { in: ["published", "APPROVED"] },
      },
    });

    if (approvedCount < NATIONAL_GATE) {
      desertGrades.push({ label: gradeLabel, gradeNum, approvedCount });
      console.log(`[DESERT-GEN] ${gradeLabel} ${subject}: ${approvedCount} approved — DESERT`);
    } else {
      console.log(`[DESERT-GEN] ${gradeLabel} ${subject}: ${approvedCount} approved — OK (skipping)`);
    }
  }

  if (desertGrades.length === 0) {
    console.log(`\n[DESERT-GEN] No desert grades found for ${subject}. Nothing to do.`);
    await prisma.$disconnect();
    return;
  }

  console.log(`\n[DESERT-GEN] Desert grades to fill: ${desertGrades.map((g) => g.label).join(", ")}\n`);

  // ── Step 2: build list of new content to create ────────────────────────────
  type NewContent = { gradeLabel: string; gradeNum: number; title: string };
  const toCreate: NewContent[] = [];

  for (const { label, gradeNum } of desertGrades) {
    const bankTitles: string[] = titleBank[label] ?? titleBank.DEFAULT ?? [];
    if (bankTitles.length === 0) {
      console.log(`[DESERT-GEN] ${label} ${subject}: no titles in bank — skipping`);
      continue;
    }

    // Fetch existing lesson titles for this grade+subject (any status) to avoid exact duplicates
    const existing = await prisma.curriculumContent.findMany({
      where: { contentType: "lesson", grade: gradeNum, subject },
      select: { title: true },
    });
    const existingTitles = new Set(existing.map((r) => r.title?.trim().toLowerCase()).filter(Boolean));

    const freshTitles = bankTitles.filter(
      (t) => !existingTitles.has(t.trim().toLowerCase())
    );

    const numToCreate = Math.min(limit, freshTitles.length);
    if (numToCreate === 0) {
      console.log(`[DESERT-GEN] ${label} ${subject}: all ${bankTitles.length} titles already exist — skipping`);
      continue;
    }

    for (let i = 0; i < numToCreate; i++) {
      toCreate.push({ gradeLabel: label, gradeNum, title: freshTitles[i] });
    }

    console.log(`[DESERT-GEN] ${label} ${subject}: will create ${numToCreate} lessons`);
  }

  const total = toCreate.length;
  console.log(`\n[DESERT-GEN] Total lessons to create: ${total}`);

  if (total === 0) {
    console.log("[DESERT-GEN] Nothing to create.");
    await prisma.$disconnect();
    return;
  }

  if (dryRun) {
    console.log("\n[DESERT-GEN] DRY RUN — no DB writes. Lessons that would be created:");
    for (const item of toCreate) {
      console.log(`  ${item.gradeLabel} ${subject}: ${item.title}`);
    }
    await prisma.$disconnect();
    return;
  }

  // ── Step 3: create CurriculumRegenerationRun ───────────────────────────────
  const run = await prisma.curriculumRegenerationRun.create({
    data: {
      status: "running",
      targetStatus: "NEEDS_REVIEW",
      totalPlanned: total,
    },
  });
  console.log(`\n[DESERT-GEN] Created regeneration run: ${run.id}`);

  // Create checkpoints (one per grade)
  const gradeGroups = new Map<string, { gradeNum: number; count: number }>();
  for (const item of toCreate) {
    const g = gradeGroups.get(item.gradeLabel) ?? { gradeNum: item.gradeNum, count: 0 };
    g.count++;
    gradeGroups.set(item.gradeLabel, g);
  }
  for (const [, g] of gradeGroups) {
    await prisma.curriculumRegenerationCheckpoint.upsert({
      where: {
        runId_gradeLevel_subject: { runId: run.id, gradeLevel: g.gradeNum, subject },
      },
      update: { plannedCount: g.count, status: "pending" },
      create: { runId: run.id, gradeLevel: g.gradeNum, subject, plannedCount: g.count, status: "pending" },
    });
  }

  // ── Step 4: create content stubs + jobs ────────────────────────────────────
  let contentCreated = 0;
  let jobsCreated = 0;

  for (const item of toCreate) {
    const contentId = buildContentId(subject, item.gradeNum, item.title);

    const stubPayload = {
      title: item.title,
      grade: item.gradeNum,
      subject,
      lessonFormat: "standard",
      objectives: [],
      body: "",
      metadata: {
        topic: item.title,
        locale: "LR",
        generatedAt: FACTORY_VERSION,
        model: "pending",
        desertGen: true,
      },
    };

    await prisma.curriculumContent.create({
      data: {
        contentId,
        title: item.title,
        grade: item.gradeNum,
        subject,
        contentType: "lesson",
        status: "NEEDS_REVIEW",
        version: FACTORY_VERSION,
        payload: stubPayload,
      },
    });
    contentCreated++;

    const idempotencyKey = buildIdempotencyKey(run.id, contentId, item.gradeNum, subject);
    await prisma.curriculumRegenerationJob.create({
      data: {
        runId: run.id,
        curriculumContentId: contentId,
        gradeLevel: item.gradeNum,
        subject,
        topic: item.title,
        status: "pending",
        requestedBy: null,
        idempotencyKey,
      },
    });
    jobsCreated++;

    process.stdout.write(`\r[DESERT-GEN] Created: ${contentCreated}/${total}`);
  }

  console.log(`\n\n[DESERT-GEN] Done.`);
  console.log(`[DESERT-GEN] Content stubs created : ${contentCreated}`);
  console.log(`[DESERT-GEN] Jobs created          : ${jobsCreated}`);
  console.log(`[DESERT-GEN] Run ID                : ${run.id}`);
  console.log(`\n[DESERT-GEN] Next step:`);
  console.log(`  npx dotenv -e .env.production -- npx tsx scripts/process-regen-jobs-direct.ts --limit 50 --subject ${subject}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[DESERT-GEN] Fatal:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
