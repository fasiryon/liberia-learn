// lib/curriculum/nationalFactory.ts
// National Curriculum Factory — Full-Year K-12 Coverage Generator
// Generates PENDING lessons for the national curriculum subject map.
// Does NOT auto-approve. Does NOT overwrite existing content.

import { createHash, randomUUID } from "crypto";
import { prisma as defaultPrisma } from "@/lib/db";
import type { PrismaClient } from "@prisma/client";
import { buildCoverageGenerationPlan } from "@/lib/curriculum/generationEngine";

export const NATIONAL_LESSON_TARGET = 108; // 36 weeks × 3 lessons/week
export const FACTORY_STATUS = "pending_approval";
export const FACTORY_SOURCE = "national_curriculum_generation";
export const FACTORY_VERSION = "ncf-2026.1";

// ─── Lesson Sequence Labels ──────────────────────────────────────────────────

const LESSON_SEQUENCE = [
  "Introduction and Foundations",
  "Core Concept and Vocabulary",
  "Worked Examples and Modeling",
  "Guided Practice",
  "Independent Practice",
] as const;

// ─── National Subject Map (PHASE 2) ─────────────────────────────────────────

export type NationalSubjectDefinition = {
  grades: number[];
  storageSubject: string;
  displayName: string;
  unitThemes: string[];
  lessonsPerUnit: number;
  unitsPerYear: number;
  useCatalog: boolean;
  waecAligned?: boolean;
};

export type QualityResult = { passed: boolean; reason?: string };

const NATIONAL_MAP: NationalSubjectDefinition[] = [
  // ── Primary Grades 1–6 ────────────────────────────────────────────────────
  { grades: [1,2,3,4,5,6], storageSubject: "MATH", displayName: "Mathematics", unitThemes: [], lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: true },
  { grades: [1,2,3,4,5,6], storageSubject: "LITERACY", displayName: "English / Language Arts", unitThemes: [], lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: true },
  { grades: [1,2,3,4,5,6], storageSubject: "SCIENCE", displayName: "Science", unitThemes: [], lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: true },
  { grades: [1,2,3,4,5,6], storageSubject: "SOCIAL_STUDIES", displayName: "Social Studies", unitThemes: [], lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: true },
  {
    grades: [1,2,3,4,5,6],
    storageSubject: "PE",
    displayName: "Health and Physical Education",
    unitThemes: [
      "Movement Fundamentals and Body Awareness",
      "Fitness, Strength, and Endurance",
      "Ball Skills and Team Games",
      "Athletics and Running Events",
      "Health, Nutrition, and Hygiene",
      "Community Sports and Active Living",
      "Safety, Injury Prevention, and First Aid",
      "Lifetime Fitness and Personal Goals",
    ],
    lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: false,
  },
  // ── Upper Primary Grade 5 — CIVICS + COMPUTER_SCIENCE gap closure ────────
  { grades: [5, 6], storageSubject: "CIVICS", displayName: "Civics and Citizenship", unitThemes: [], lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: true },
  {
    grades: [5],
    storageSubject: "COMPUTER_SCIENCE",
    displayName: "Introduction to Computing",
    unitThemes: [
      "Computers, Devices, and How They Work",
      "Using a Keyboard, Mouse, and Basic Navigation",
      "Creating and Saving Files and Documents",
      "Introduction to the Internet and Online Safety",
      "Problem Solving and Logical Thinking",
      "Coding Basics: Sequences and Step-by-Step Instructions",
      "Digital Citizenship and Responsible Technology Use",
      "Computing for School Life: Research, Writing, and Sharing",
    ],
    lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: false,
  },
  // ── Junior Secondary Grades 7–9 ──────────────────────────────────────────
  { grades: [7,8,9], storageSubject: "MATH", displayName: "Mathematics", unitThemes: [], lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: true },
  { grades: [7,8,9], storageSubject: "LITERACY", displayName: "English", unitThemes: [], lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: true },
  { grades: [7,8,9], storageSubject: "SCIENCE", displayName: "Science", unitThemes: [], lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: true },
  { grades: [7,8,9], storageSubject: "SOCIAL_STUDIES", displayName: "Social Studies", unitThemes: [], lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: true },
  { grades: [7,8,9], storageSubject: "CIVICS", displayName: "Civics and Government", unitThemes: [], lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: true },
  {
    grades: [7,8,9],
    storageSubject: "PE",
    displayName: "Physical Education",
    unitThemes: [
      "Movement Fundamentals and Body Awareness",
      "Fitness, Strength, and Endurance",
      "Ball Skills and Team Games",
      "Athletics and Running Events",
      "Health, Nutrition, and Hygiene",
      "Community Sports and Active Living",
      "Safety, Injury Prevention, and First Aid",
      "Lifetime Fitness and Personal Goals",
    ],
    lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: false,
  },
  // ── Senior Secondary Grades 10–12 ────────────────────────────────────────
  { grades: [10,11,12], storageSubject: "MATH", displayName: "Mathematics", unitThemes: [], lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: true, waecAligned: true },
  { grades: [10,11,12], storageSubject: "LITERACY", displayName: "English Literature and Composition", unitThemes: [], lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: true, waecAligned: true },
  {
    grades: [10,11,12],
    storageSubject: "BIOLOGY",
    displayName: "Biology",
    unitThemes: [
      "Cell Structure, Function, and Organisation",
      "Genetics, Heredity, and Biotechnology",
      "Human Body: Nutrition and Digestion",
      "Human Body: Circulation and Respiration",
      "Reproduction, Development, and Growth",
      "Ecology, Ecosystems, and Conservation",
      "Evolution, Classification, and Biodiversity",
      "WAEC Biology Preparation and Laboratory Skills",
    ],
    lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: false, waecAligned: true,
  },
  {
    grades: [10,11,12],
    storageSubject: "CHEMISTRY",
    displayName: "Chemistry",
    unitThemes: [
      "Atomic Structure and the Periodic Table",
      "Chemical Bonding and Molecular Structure",
      "States of Matter, Solutions, and Separation",
      "Chemical Reactions, Equations, and Stoichiometry",
      "Acids, Bases, Salts, and pH",
      "Rates of Reaction and Chemical Equilibrium",
      "Organic Chemistry and Carbon Compounds",
      "WAEC Chemistry Preparation and Practical Skills",
    ],
    lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: false, waecAligned: true,
  },
  {
    grades: [10,11,12],
    storageSubject: "PHYSICS",
    displayName: "Physics",
    unitThemes: [
      "Mechanics: Motion, Speed, and Velocity",
      "Forces, Newton Laws, and Momentum",
      "Work, Energy, Power, and Simple Machines",
      "Electricity, Circuits, and Electronics",
      "Waves, Sound, and Light",
      "Thermal Physics and Heat Transfer",
      "Magnetic Fields and Electromagnetic Induction",
      "WAEC Physics Preparation and Practical Investigations",
    ],
    lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: false, waecAligned: true,
  },
  {
    grades: [10,11,12],
    storageSubject: "GEOGRAPHY",
    displayName: "Geography",
    unitThemes: [
      "Maps, Scale, and Spatial Thinking",
      "Physical Geography of Liberia and West Africa",
      "Climate, Weather, and Environmental Systems",
      "Population, Settlement, and Urbanization",
      "Natural Resources and Economic Geography",
      "Agriculture, Land Use, and Food Systems",
      "Global Trade, Development, and Inequality",
      "WAEC Geography Review and Fieldwork Skills",
    ],
    lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: false, waecAligned: true,
  },
  {
    grades: [10,11,12],
    storageSubject: "HISTORY",
    displayName: "History and Civics",
    unitThemes: [
      "Pre-Colonial Liberia and Indigenous Peoples",
      "Settlement, Colonization, and the Republic (1822-1847)",
      "Independent Liberia: Governance and Society (1847-1944)",
      "Modern Liberia: Politics, Economy, and Civil War",
      "Post-Conflict Reconstruction and the Path Forward",
      "African History and Pan-African Movements",
      "World History: Revolution, Empire, and Independence",
      "Historical Sources, Evidence, and WAEC Preparation",
    ],
    lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: false, waecAligned: true,
  },
  // Economics: Grades 11–12 only
  {
    grades: [11,12],
    storageSubject: "ECONOMICS",
    displayName: "Economics",
    unitThemes: [
      "Scarcity, Choice, and Economic Systems",
      "Supply, Demand, and Market Mechanisms",
      "Production, Costs, and Business Decision Making",
      "National Income, GDP, and Economic Indicators",
      "Money, Banking, and Financial Systems",
      "International Trade and Liberia Economy",
      "Government Policy, Taxation, and Public Finance",
      "WAEC Economics Preparation and Applied Reasoning",
    ],
    lessonsPerUnit: 5, unitsPerYear: 8, useCatalog: false, waecAligned: true,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
}

function buildNationalContentId(storageSubject: string, grade: number, unitIndex: number, lessonSlug: string): string {
  return `${storageSubject.toLowerCase()}-g${grade}-u${unitIndex}-${lessonSlug}`;
}

function buildNationalLessonPayload(params: {
  grade: number; storageSubject: string; displayName: string;
  unitTheme: string; unitIndex: number; orderInUnit: number; waecAligned: boolean;
}): Record<string, unknown> {
  const { grade, storageSubject, displayName, unitTheme, orderInUnit, waecAligned } = params;
  const seqLabel = LESSON_SEQUENCE[orderInUnit - 1] ?? `Lesson ${orderInUnit}`;
  const lessonTitle = `${unitTheme}: ${seqLabel}`;
  const gradeCtx = `Grade ${grade}`;
  const unitLower = unitTheme.toLowerCase();

  const objective = `${gradeCtx} students will understand and apply key concepts from ${unitLower} using age-appropriate ${displayName.toLowerCase()} tasks, with Liberian contexts and real-world examples throughout.`;
  const explanation = `The teacher introduces the core concept of ${unitLower} with direct modeling, Liberia-relevant examples, key vocabulary, and a brief understanding check before guided practice. All instruction draws on local county contexts, market examples, and civic life in Liberia.`;
  const workedExample = `Model one complete ${displayName.toLowerCase()} example connected to ${unitLower}, naming each step and explaining the reasoning. Reference Liberian contexts such as local markets, county geography, or civic institutions where relevant.`;
  const guidedPractice = `Lead the class through one shared task and one paired task applying ${unitLower}. Use teacher prompts and quick oral checks to confirm understanding before moving to independent work.`;
  const independentPractice = `Students complete individual work demonstrating they can apply ${unitLower} without copying the model. Ask at least one student to explain their answer in writing or orally to the class.`;
  const assessment = `Short exit task: one recall item and one application item aligned to the lesson objective. Collect responses to inform next lesson planning and identify students needing remediation.`;
  const remediation = `Re-teach the main concept with simpler examples, sentence frames, and one scaffolded follow-up task for students who need additional support to reach the objective.`;
  const extension = waecAligned
    ? `Ask confident students to solve a WAEC-style question on ${unitLower}, justify their reasoning, and identify a real-world application in Liberia or West Africa.`
    : `Ask confident students to solve a more complex version of the task, justify their reasoning, or connect the concept to everyday life in their Liberian community.`;
  const guardianSupport = `Ask the student to explain today main idea from ${unitLower} to a family member. Complete one short home discussion task or observation activity using household materials available in most Liberian homes.`;
  const teacherNote = `Check prior knowledge of ${unitLower} at lesson start. Common misconception: students often confuse ${unitLower.split(" ")[0] ?? unitLower} terminology with everyday language. Use consistent vocabulary throughout and adjust pace based on exit ticket results.`;

  const bodyStandard = [
    `## Objective`, objective, ``,
    `## Teacher Explanation`, explanation, ``,
    `## Worked Example`, workedExample, ``,
    `## Guided Practice`, guidedPractice, ``,
    `## Independent Practice`, independentPractice, ``,
    `## Assessment`, assessment, ``,
    `## Remediation`, remediation, ``,
    `## Extension`, extension, ``,
    `## Guardian Support`, guardianSupport, ``,
    `## Teacher Notes`, teacherNote, ``,
    `## Metadata`, `${gradeCtx} ${displayName} Unit: "${unitTheme}" Lesson: "${lessonTitle}"`,
  ].join("\n");

  const bodyBlock = [
    `## Day 1`, `${objective}\n\n${explanation}\n\n${workedExample}`, ``,
    `## Day 2`, `${guidedPractice}\n\n${independentPractice}\n\n${assessment}`, ``,
    `## Extension and Remediation`, `${extension}\n\n${remediation}`, ``,
    `## Home Support`, guardianSupport,
  ].join("\n");

  return {
    title: lessonTitle, grade, subject: storageSubject, lessonFormat: "either",
    objectives: [objective], body: bodyStandard, body_standard: bodyStandard, body_block: bodyBlock,
    activities: [`Teacher modeling for ${unitLower}`, `Guided pair practice on ${unitLower}`, `Independent learner check`],
    labs: [], moeAlignments: [],
    metadata: { topic: unitTheme, locale: "LR", generatedAt: FACTORY_VERSION, model: "national-curriculum-factory" },
    workedExamples: [workedExample], guidedPractice: [guidedPractice], independentPractice: [independentPractice],
    assessment, remediation, extension, guardianSupport, teacherNote, waecAligned,
    contentCompleteness: { objective: true, explanation: true, workedExamples: true, guidedPractice: true, independentPractice: true, assessment: true, remediation: true, extension: true, guardianSupport: true },
  };
}

// ─── Quality Gate ────────────────────────────────────────────────────────────

export function validatePayloadQuality(payload: Record<string, unknown>): QualityResult {
  const title = payload.title as string | undefined;
  const body = payload.body as string | undefined;
  const objectives = payload.objectives as unknown[] | undefined;

  if (!title || title.length < 5) return { passed: false, reason: "missing_title" };
  if (!objectives || objectives.length === 0) return { passed: false, reason: "missing_objectives" };
  if (!body || body.length < 200) return { passed: false, reason: "body_too_short" };

  const bodyText = body.toLowerCase();
  if (!bodyText.includes("worked example") && !bodyText.includes("## worked") && !(payload.workedExamples as unknown[] | undefined)?.length) {
    return { passed: false, reason: "missing_worked_examples" };
  }
  if (!bodyText.includes("assessment") && !payload.assessment) {
    return { passed: false, reason: "missing_assessment" };
  }
  for (const ph of ["todo", "placeholder", "tbd", "[insert", "[add here"]) {
    if (bodyText.includes(ph) || title.toLowerCase().includes(ph)) {
      return { passed: false, reason: "placeholder_content" };
    }
  }
  return { passed: true };
}

// ─── Coverage Audit ───────────────────────────────────────────────────────────

const APPROVED_STATUSES = ["published", "APPROVED"];
const PENDING_STATUSES = ["pending_approval", "PENDING_APPROVAL", "DRAFT", "draft", "generated", "validated"];

export type CoverageAuditEntry = {
  grade: number; subject: string; displayName: string;
  approved: number; pending: number; total: number;
  target: number; factoryTarget: number; missing: number; gapToFullYear: number;
  severity: "critical" | "severe" | "adequate" | "complete";
};

export type CoverageAuditReport = {
  entries: CoverageAuditEntry[];
  totals: { combos: number; approved: number; pending: number; total: number; factoryTarget: number; missing: number; gapToFullYear: number };
  criticalGaps: CoverageAuditEntry[];
  severeGaps: CoverageAuditEntry[];
  quickWinPending: CoverageAuditEntry[];
};

export async function auditNationalCoverage(db: PrismaClient = defaultPrisma as unknown as PrismaClient): Promise<CoverageAuditReport> {
  const rows = await (db as any).curriculumContent.findMany({
    where: { contentType: "lesson" },
    select: { grade: true, subject: true, status: true },
  });

  const dbCounts = new Map<string, { approved: number; pending: number }>();
  for (const row of rows) {
    const key = `${row.grade}:${row.subject}`;
    if (!dbCounts.has(key)) dbCounts.set(key, { approved: 0, pending: 0 });
    const counts = dbCounts.get(key)!;
    if (APPROVED_STATUSES.includes(row.status)) counts.approved += 1;
    else if (PENDING_STATUSES.includes(row.status)) counts.pending += 1;
  }

  const entries: CoverageAuditEntry[] = [];
  const seen = new Set<string>();
  for (const def of NATIONAL_MAP) {
    for (const grade of def.grades) {
      const key = `${grade}:${def.storageSubject}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const counts = dbCounts.get(key) ?? { approved: 0, pending: 0 };
      const factoryTarget = def.unitsPerYear * def.lessonsPerUnit;
      const missing = Math.max(0, factoryTarget - counts.approved - counts.pending);
      const gapToFullYear = Math.max(0, NATIONAL_LESSON_TARGET - counts.approved - counts.pending);
      const severity: CoverageAuditEntry["severity"] =
        counts.approved < 5 ? "critical"
        : counts.approved <= 20 ? "severe"
        : counts.approved + counts.pending >= factoryTarget ? "complete"
        : "adequate";
      entries.push({ grade, subject: def.storageSubject, displayName: def.displayName, approved: counts.approved, pending: counts.pending, total: counts.approved + counts.pending, target: NATIONAL_LESSON_TARGET, factoryTarget, missing, gapToFullYear, severity });
    }
  }
  entries.sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject));
  const totals = entries.reduce((acc, e) => ({ combos: acc.combos + 1, approved: acc.approved + e.approved, pending: acc.pending + e.pending, total: acc.total + e.total, factoryTarget: acc.factoryTarget + e.factoryTarget, missing: acc.missing + e.missing, gapToFullYear: acc.gapToFullYear + e.gapToFullYear }), { combos: 0, approved: 0, pending: 0, total: 0, factoryTarget: 0, missing: 0, gapToFullYear: 0 });
  return { entries, totals, criticalGaps: entries.filter(e => e.severity === "critical"), severeGaps: entries.filter(e => e.severity === "severe"), quickWinPending: entries.filter(e => e.pending > 0 && e.approved < 5) };
}

// ─── Batch Generation ────────────────────────────────────────────────────────

export type BatchOptions = { grade?: number; subject?: string; batchSize?: number; dryRun?: boolean; sessionId?: string; prioritizeCritical?: boolean };
export type BatchItemResult = { contentId: string; title: string; outcome: "saved" | "skipped_duplicate" | "quality_failed" | "dry_run"; failureReason?: string };
export type BatchResult = { batchId: string; grade: number; subject: string; attempted: number; passed: number; failed: number; skippedDuplicates: number; estimatedCostUsd: number; status: "completed" | "partial" | "failed" | "dry_run"; startedAt: string; completedAt: string; savedContentIds: string[]; items: BatchItemResult[]; failureReasons: Record<string, number> };
export type GenerationRunSummary = { sessionId: string; batches: BatchResult[]; totalAttempted: number; totalSaved: number; totalSkipped: number; totalFailed: number; estimatedCostUsd: number; startedAt: string; completedAt: string };

function buildComboRecords(def: NationalSubjectDefinition, grade: number) {
  if (def.useCatalog) {
    const catalogRecords = buildCoverageGenerationPlan({ grade, subject: def.storageSubject });
    return catalogRecords.map(rec => ({ contentId: rec.contentId, title: String((rec.payload as any).title ?? rec.contentId), grade: rec.grade, subject: rec.subject, unitId: rec.unitId, orderInUnit: rec.orderInUnit, payload: rec.payload as Record<string, unknown>, hash: rec.hash }));
  }
  const records: Array<{ contentId: string; title: string; grade: number; subject: string; unitId: string; orderInUnit: number; payload: Record<string, unknown>; hash: string }> = [];
  def.unitThemes.slice(0, def.unitsPerYear).forEach((unitTheme, unitIdx) => {
    const unitIndex = unitIdx + 1;
    for (let lessonIdx = 0; lessonIdx < def.lessonsPerUnit; lessonIdx++) {
      const orderInUnit = lessonIdx + 1;
      const seqLabel = LESSON_SEQUENCE[lessonIdx] ?? `Lesson ${orderInUnit}`;
      const lessonTitle = `${unitTheme}: ${seqLabel}`;
      const lessonSlug = slugify(lessonTitle);
      const contentId = buildNationalContentId(def.storageSubject, grade, unitIndex, lessonSlug);
      const payload = buildNationalLessonPayload({ grade, storageSubject: def.storageSubject, displayName: def.displayName, unitTheme, unitIndex, orderInUnit, waecAligned: def.waecAligned ?? false });
      const hash = createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 40);
      const unitId = `${def.storageSubject.toLowerCase()}-g${grade}-u${unitIndex}-${slugify(unitTheme)}`;
      records.push({ contentId, title: lessonTitle, grade, subject: def.storageSubject, unitId, orderInUnit, payload, hash });
    }
  });
  return records;
}

export async function generateNationalBatch(options: BatchOptions, db: PrismaClient = defaultPrisma as unknown as PrismaClient): Promise<GenerationRunSummary> {
  const sessionId = options.sessionId ?? randomUUID();
  const batchSize = options.batchSize ?? 10;
  const startedAt = new Date().toISOString();
  const batches: BatchResult[] = [];

  const combos: Array<{ def: NationalSubjectDefinition; grade: number }> = [];
  for (const def of NATIONAL_MAP) {
    for (const grade of def.grades) {
      if (options.grade != null && grade !== options.grade) continue;
      if (options.subject && def.storageSubject !== options.subject.toUpperCase()) continue;
      const key = `${grade}:${def.storageSubject}`;
      if (!combos.find(c => `${c.grade}:${c.def.storageSubject}` === key)) combos.push({ def, grade });
    }
  }

  if (options.prioritizeCritical) {
    const audit = await auditNationalCoverage(db);
    const criticalKeys = new Set(audit.criticalGaps.map(e => `${e.grade}:${e.subject}`));
    const severeKeys = new Set(audit.severeGaps.map(e => `${e.grade}:${e.subject}`));
    combos.sort((a, b) => {
      const aKey = `${a.grade}:${a.def.storageSubject}`;
      const bKey = `${b.grade}:${b.def.storageSubject}`;
      const aScore = criticalKeys.has(aKey) ? 0 : severeKeys.has(aKey) ? 1 : 2;
      const bScore = criticalKeys.has(bKey) ? 0 : severeKeys.has(bKey) ? 1 : 2;
      return aScore - bScore || a.grade - b.grade;
    });
  }

  for (const { def, grade } of combos) {
    const batchStartedAt = new Date().toISOString();
    const batchId = `ncf-${def.storageSubject.toLowerCase()}-g${grade}-${Date.now()}`;
    const items: BatchItemResult[] = [];
    const failureReasons: Record<string, number> = {};
    const allRecords = buildComboRecords(def, grade);

    const existingIds = options.dryRun ? new Set<string>() : new Set<string>((await (db as any).curriculumContent.findMany({ where: { contentId: { in: allRecords.map(r => r.contentId) } }, select: { contentId: true } })).map((r: { contentId: string }) => r.contentId));
    const existingTitles = options.dryRun ? new Set<string>() : new Set<string>((await (db as any).curriculumContent.findMany({ where: { grade, subject: def.storageSubject, title: { in: allRecords.map(r => r.title) } }, select: { title: true } })).map((r: { title: string }) => r.title));

    const toGenerate = allRecords.filter(r => !existingIds.has(r.contentId) && !existingTitles.has(r.title));
    const batch = toGenerate.slice(0, batchSize);
    const skippedDuplicates = allRecords.length - toGenerate.length;

    let saved = 0, failed = 0;
    const savedContentIds: string[] = [];

    for (const record of batch) {
      const quality = validatePayloadQuality(record.payload);
      if (!quality.passed) {
        failed += 1;
        const reason = quality.reason ?? "unknown";
        failureReasons[reason] = (failureReasons[reason] ?? 0) + 1;
        items.push({ contentId: record.contentId, title: record.title, outcome: "quality_failed", failureReason: reason });
        continue;
      }
      if (options.dryRun) {
        items.push({ contentId: record.contentId, title: record.title, outcome: "dry_run" });
        saved += 1; savedContentIds.push(record.contentId);
        continue;
      }
      try {
        await (db as any).curriculumContent.create({ data: { contentId: record.contentId, title: record.title, grade: record.grade, subject: record.subject, contentType: "lesson", status: FACTORY_STATUS, version: FACTORY_VERSION, unitId: record.unitId, orderInUnit: record.orderInUnit, lessonType: "core", teacherCreated: false, hash: record.hash, payload: { ...record.payload, approvalStatus: FACTORY_STATUS, metadata: { ...(record.payload.metadata as Record<string, unknown> ?? {}), generationBatchId: batchId, sessionId, source: FACTORY_SOURCE, generatedAt: batchStartedAt, estimatedCostUsd: 0, qualityValidated: true } } } });
        saved += 1; savedContentIds.push(record.contentId);
        items.push({ contentId: record.contentId, title: record.title, outcome: "saved" });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("Unique constraint") || msg.includes("P2002")) {
          items.push({ contentId: record.contentId, title: record.title, outcome: "skipped_duplicate" });
        } else {
          failed += 1;
          failureReasons["db_error"] = (failureReasons["db_error"] ?? 0) + 1;
          items.push({ contentId: record.contentId, title: record.title, outcome: "quality_failed", failureReason: "db_error" });
        }
      }
    }
    for (let i = 0; i < skippedDuplicates; i++) {
      const skipped = allRecords[toGenerate.length + i];
      if (skipped) items.push({ contentId: skipped.contentId, title: skipped.title, outcome: "skipped_duplicate" });
    }
    batches.push({ batchId, grade, subject: def.storageSubject, attempted: batch.length, passed: saved, failed, skippedDuplicates, estimatedCostUsd: 0, status: failed > 0 && saved === 0 ? "failed" : options.dryRun ? "dry_run" : "completed", startedAt: batchStartedAt, completedAt: new Date().toISOString(), savedContentIds, items, failureReasons });
  }

  return { sessionId, batches, totalAttempted: batches.reduce((s, b) => s + b.attempted, 0), totalSaved: batches.reduce((s, b) => s + b.passed, 0), totalSkipped: batches.reduce((s, b) => s + b.skippedDuplicates, 0), totalFailed: batches.reduce((s, b) => s + b.failed, 0), estimatedCostUsd: 0, startedAt, completedAt: new Date().toISOString() };
}

// ─── Generation Plan ─────────────────────────────────────────────────────────

export type GenerationPlanEntry = { grade: number; subject: string; displayName: string; totalLessonsToGenerate: number; unitCount: number; lessonsPerUnit: number; estimatedCostUsd: number };

export function buildGenerationPlan(options: { grade?: number; subject?: string }): GenerationPlanEntry[] {
  const plan: GenerationPlanEntry[] = [];
  const seen = new Set<string>();
  for (const def of NATIONAL_MAP) {
    for (const grade of def.grades) {
      if (options.grade != null && grade !== options.grade) continue;
      if (options.subject && def.storageSubject !== options.subject.toUpperCase()) continue;
      const key = `${grade}:${def.storageSubject}`;
      if (seen.has(key)) continue;
      seen.add(key);
      plan.push({ grade, subject: def.storageSubject, displayName: def.displayName, totalLessonsToGenerate: def.unitsPerYear * def.lessonsPerUnit, unitCount: def.unitsPerYear, lessonsPerUnit: def.lessonsPerUnit, estimatedCostUsd: 0 });
    }
  }
  return plan.sort((a, b) => a.grade - b.grade || a.subject.localeCompare(b.subject));
}
