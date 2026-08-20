/**
 * scripts/generate-labs-for-approved.ts
 *
 * Lab Pass 3: Generate hands-on lab activities for APPROVED lessons that have empty labs.
 * Targets SCIENCE, MATH, and LITERACY subjects where lab activities are meaningful.
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/generate-labs-for-approved.ts
 *   npx dotenv -e .env.production -- npx tsx scripts/generate-labs-for-approved.ts --limit 5 --subject SCIENCE --grade 7
 *
 * Flags:
 *   --limit N       process at most N lessons (default: all)
 *   --subject X     filter to a specific subject (SCIENCE, MATH, LITERACY)
 *   --grade N       filter to a specific grade level
 */

// Use direct Postgres URL for local scripts
// (bypasses Prisma Accelerate requirement)
if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL
}

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { createConservativeCurriculumMaintenanceClient } from "@/lib/curriculum/mutations/maintenanceClient";
const governedCurriculum = createConservativeCurriculumMaintenanceClient("generate-labs-for-approved");
import OpenAI from "openai";

const localEnvPath = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) loadEnv({ path: localEnvPath });
loadEnv();

const prisma = new PrismaClient();

const LAB_SUBJECTS = ["SCIENCE", "MATH", "LITERACY"];
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2000;
const MAX_BODY_CHARS = 2000;

function readArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function readNumberArg(flag: string): number | undefined {
  const v = readArg(flag);
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : undefined;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function truncateBody(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n[...truncated]";
}

function extractBodyText(payload: Record<string, unknown>): string {
  const bodyBlock = payload.body_block;
  const bodyStandard = payload.body_standard;
  const raw = bodyBlock || bodyStandard;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.map((s: unknown) => (typeof s === "string" ? s : "")).join("\n");
  return "";
}

type LabProcedureStep = {
  stepNumber: number;
  instruction: string;
  teacherNote: string | null;
  durationMinutes: number;
};

type LabObservationField = {
  field: string;
  prompt: string;
  inputType: "text" | "number" | "choice";
  choices: string[] | null;
};

type LabAnalysisQuestion = {
  question: string;
  expectedAnswer: string;
  scoringRubric: string;
};

type GeneratedLab = {
  title: string;
  type: "guided_walkthrough";
  durationMinutes: number;
  subject: string;
  grade: number;
  labObjective: string;
  materialsNeeded: string[];
  safetyNotes: string | null;
  procedure: LabProcedureStep[];
  observationForm: LabObservationField[];
  analysisQuestions: LabAnalysisQuestion[];
  connectionToLesson: string;
  offlineCapable: true;
  virtualAlternative: string | null;
};

function validateLab(lab: unknown): lab is GeneratedLab {
  if (!lab || typeof lab !== "object") return false;
  const l = lab as Record<string, unknown>;
  if (!Array.isArray(l.procedure) || l.procedure.length < 3) return false;
  if (!Array.isArray(l.observationForm) || l.observationForm.length < 2) return false;
  if (!Array.isArray(l.analysisQuestions) || l.analysisQuestions.length < 2) return false;
  return true;
}

async function generateLab(
  client: OpenAI,
  lesson: { title: string; subject: string; grade: number; bodyText: string }
): Promise<GeneratedLab | null> {
  const truncated = truncateBody(lesson.bodyText, MAX_BODY_CHARS);

  const systemPrompt = `You are a curriculum lab designer for Liberia's Ministry of Education. Generate one hands-on lab activity for this lesson.

Use only locally available Liberian materials: leaves, water, stones, cassava, bottle caps, paper, pencils, string, rulers, cups, buckets, notebooks, local plants, coins.

Return ONLY valid JSON matching this schema:
{
  "title": string,
  "type": "guided_walkthrough",
  "durationMinutes": number (20-30),
  "subject": string,
  "grade": number,
  "labObjective": string,
  "materialsNeeded": string[],
  "safetyNotes": string | null,
  "procedure": [{"stepNumber": number, "instruction": string, "teacherNote": string | null, "durationMinutes": number}],
  "observationForm": [{"field": string, "prompt": string, "inputType": "text" | "number" | "choice", "choices": string[] | null}],
  "analysisQuestions": [{"question": string, "expectedAnswer": string, "scoringRubric": string}],
  "connectionToLesson": string,
  "offlineCapable": true,
  "virtualAlternative": string | null
}

Requirements:
- procedure must have at least 3 steps
- observationForm must have at least 2 fields
- analysisQuestions must have at least 2 questions
- durationMinutes must be between 20 and 30
- offlineCapable must be true`;

  const userMessage = `Lesson title: ${lesson.title}
Subject: ${lesson.subject}
Grade: ${lesson.grade}

Lesson content:
${truncated}

Generate one lab activity for this lesson.`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    // Handle case where the AI wraps it in a key
    const lab = parsed.lab ?? parsed;
    return lab as GeneratedLab;
  } catch (err) {
    console.error("  AI call failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

async function main() {
  const limitArg = readNumberArg("--limit");
  const subjectArg = readArg("--subject")?.toUpperCase();
  const gradeArg = readNumberArg("--grade");

  if (subjectArg && !LAB_SUBJECTS.includes(subjectArg)) {
    console.error(`Subject must be one of: ${LAB_SUBJECTS.join(", ")}`);
    process.exit(1);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is required");
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  const subjects = subjectArg ? [subjectArg] : LAB_SUBJECTS;

  // Build filter: APPROVED lessons where labs is empty or missing, in target subjects
  const whereClause: Record<string, unknown> = {
    status: "APPROVED",
    subject: { in: subjects },
  };
  if (gradeArg) {
    whereClause.grade = gradeArg;
  }

  console.log(`\nLab Pass 3 â€” Generate labs for APPROVED lessons`);
  console.log(`Subjects: ${subjects.join(", ")} | Grade: ${gradeArg ?? "all"} | Limit: ${limitArg ?? "all"}`);
  console.log("â”€".repeat(60));

  const lessons = await prisma.curriculumContent.findMany({
    where: whereClause as Parameters<typeof prisma.curriculumContent.findMany>[0]["where"],
    select: {
      id: true,
      title: true,
      subject: true,
      grade: true,
      payload: true,
    },
    orderBy: { grade: "asc" },
  });

  // Filter to lessons where labs is empty or missing
  const candidates = lessons.filter((lesson) => {
    const payload = lesson.payload as Record<string, unknown> | null;
    if (!payload) return true;
    const labs = payload.labs;
    return !labs || (Array.isArray(labs) && labs.length === 0);
  });

  const total = limitArg ? Math.min(candidates.length, limitArg) : candidates.length;
  const toProcess = candidates.slice(0, total);

  console.log(`Found ${candidates.length} candidates â†’ processing ${total}`);
  console.log("â”€".repeat(60));

  let ok = 0;
  let fail = 0;
  let skip = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const lesson = toProcess[i];
    const prefix = `[${i + 1}/${total}] G${lesson.grade} ${lesson.subject} â€” ${lesson.title}`;

    const payload = (lesson.payload as Record<string, unknown>) ?? {};
    const bodyText = extractBodyText(payload);

    if (!bodyText) {
      console.log(`${prefix} â€” SKIP (no body text)`);
      skip++;
      continue;
    }

    const generated = await generateLab(client, {
      title: lesson.title,
      subject: lesson.subject,
      grade: lesson.grade ?? 1,
      bodyText,
    });

    if (!generated) {
      console.log(`${prefix} â€” FAIL (AI returned null)`);
      fail++;
      continue;
    }

    if (!validateLab(generated)) {
      const g = generated as Record<string, unknown>;
      const procedureLen = Array.isArray(g.procedure) ? (g.procedure as unknown[]).length : 0;
      const obsLen = Array.isArray(g.observationForm) ? (g.observationForm as unknown[]).length : 0;
      const qaLen = Array.isArray(g.analysisQuestions) ? (g.analysisQuestions as unknown[]).length : 0;
      console.log(
        `${prefix} â€” FAIL (validation: procedure=${procedureLen}/${3}, obs=${obsLen}/${2}, qa=${qaLen}/${2})`
      );
      fail++;
      continue;
    }

    // Ensure offlineCapable is true
    generated.offlineCapable = true;

    await governedCurriculum.update({
      where: { id: lesson.id },
      data: {
        payload: {
          ...payload,
          labs: [generated],
        },
      },
    });

    console.log(`${prefix} â€” OK`);
    ok++;

    if ((i + 1) % BATCH_SIZE === 0 && i < toProcess.length - 1) {
      await sleep(BATCH_DELAY_MS);
    }
  }

  console.log("â”€".repeat(60));
  console.log(`Done: ${ok} OK | ${fail} FAIL | ${skip} SKIP`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
