/**
 * scripts/generate-textbooks-for-approved.ts
 *
 * Textbook Pass 1: For each APPROVED CurriculumContent lesson, generate a full
 * textbook chapter authored at the level of a senior curriculum developer / SME.
 *
 * A "textbook" here means a standalone, print-ready chapter that:
 *   - Opens with a lesson overview and learning objectives
 *   - Delivers core instructional content with in-text lesson references
 *   - Grounds every concept in Liberian real-world context (place names, crops,
 *     markets, culture, MOE standards)
 *   - Closes with key terms, chapter review questions, a further-reading note,
 *     and MOE alignment codes
 *
 * The chapter is stored in payload.textbook of the CurriculumContent record.
 * Existing textbook entries are skipped unless --overwrite is passed.
 *
 * Usage:
 *   npx dotenv -e .env.production -- npx tsx scripts/generate-textbooks-for-approved.ts
 *   npx dotenv -e .env.production -- npx tsx scripts/generate-textbooks-for-approved.ts --limit 10 --subject MATH --grade 7
 *   npx dotenv -e .env.production -- npx tsx scripts/generate-textbooks-for-approved.ts --overwrite
 *
 * Flags:
 *   --limit N       process at most N lessons (default: all)
 *   --subject X     SCIENCE | MATH | LITERACY | SOCIAL_STUDIES | CIVICS | any valid subject
 *   --grade N       filter to a specific grade level (1â€“12)
 *   --overwrite     regenerate even when payload.textbook already exists
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
const governedCurriculum = createConservativeCurriculumMaintenanceClient("generate-textbooks-for-approved");
import OpenAI from "openai";

const localEnvPath = resolve(process.cwd(), ".env.local");
if (existsSync(localEnvPath)) loadEnv({ path: localEnvPath });
loadEnv();

const prisma = new PrismaClient();

const BATCH_SIZE = 3;
const BATCH_DELAY_MS = 3000;
const MAX_BODY_CHARS = 3000;

// â”€â”€ CLI args â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function readArg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function readNumberArg(flag: string): number | undefined {
  const v = readArg(flag);
  const n = parseInt(v ?? "", 10);
  return Number.isFinite(n) ? n : undefined;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// â”€â”€ Body extraction (mirrors lab generator) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function truncateBody(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n[...truncated]";
}

function extractBodyText(payload: Record<string, unknown>): string {
  const raw = payload.body_block || payload.body_standard;
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw)) return raw.map((s: unknown) => (typeof s === "string" ? s : "")).join("\n");
  return "";
}

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type TextbookKeyTerm = {
  term: string;
  definition: string;
};

type TextbookSection = {
  heading: string;
  body: string;           // 2-5 paragraphs; may contain inline lesson refs like [Lesson: X]
  realWorldExample: string; // Liberian context: specific place/crop/person/event
};

type TextbookReviewQuestion = {
  question: string;
  type: "recall" | "comprehension" | "application" | "analysis";
  sampleAnswer: string;
};

type GeneratedTextbook = {
  chapterTitle: string;
  subject: string;
  grade: number;
  lessonRef: string;         // Lesson title this chapter accompanies
  overview: string;          // 1-paragraph overview of the chapter
  learningObjectives: string[]; // 3-5 SMART objectives
  sections: TextbookSection[]; // 3-5 main content sections
  keyTerms: TextbookKeyTerm[];  // 6-12 terms
  reviewQuestions: TextbookReviewQuestion[]; // 5-8 questions, mixed types
  furtherReading: string;    // Real Liberian / MOE resource note
  moeAlignmentNote: string;  // Which MOE standards this chapter supports
  authorNote: string;        // "Authored for Liberia Ministry of Education, Grade X curriculum"
};

// â”€â”€ Validation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function validateTextbook(tb: unknown): tb is GeneratedTextbook {
  if (!tb || typeof tb !== "object") return false;
  const t = tb as Record<string, unknown>;
  if (typeof t.chapterTitle !== "string" || !t.chapterTitle.trim()) return false;
  if (!Array.isArray(t.learningObjectives) || t.learningObjectives.length < 3) return false;
  if (!Array.isArray(t.sections) || t.sections.length < 3) return false;
  if (!Array.isArray(t.keyTerms) || t.keyTerms.length < 6) return false;
  if (!Array.isArray(t.reviewQuestions) || t.reviewQuestions.length < 5) return false;
  return true;
}

// â”€â”€ AI generation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const LIBERIAN_CONTEXT = `
Liberia-specific grounding rules:
- Use Liberian place names: Monrovia, Kakata, Buchanan, Gbarnga, Voinjama, Zwedru, Harper, Robertsport, Sanniquellie.
- Reference Liberian crops, foods, and livelihoods: cassava, rice, palm oil, rubber plantations, fish markets, pepper farm.
- Reference Liberian institutions where relevant: Ministry of Education (MOE), University of Liberia, Cuttington University, WAEC exams.
- Use Liberian cultural context: community meetings, market day in Kakata, the St. John River, Sapo National Park, Firestone Plantation.
- Currency: Liberian Dollar (LRD). Measurements: metric system.
- Literacy levels vary â€” write at accessible Grade-level language but never condescend.
- Lessons will be used in schools with limited electricity and internet; examples should reflect this reality.
`.trim();

async function generateTextbook(
  client: OpenAI,
  lesson: { id: string; title: string; subject: string; grade: number; bodyText: string; moeCode?: string }
): Promise<GeneratedTextbook | null> {
  const truncated = truncateBody(lesson.bodyText, MAX_BODY_CHARS);

  const systemPrompt = `You are a senior textbook author, curriculum developer, instructional designer, educational content writer, and subject matter expert (SME) for Liberia's Ministry of Education national curriculum.

Your task: Write one complete textbook chapter that accompanies the lesson described below.

${LIBERIAN_CONTEXT}

Chapter authoring standards:
1. OVERVIEW: One tight paragraph that orients a student to the chapter and why it matters in their Liberian context.
2. LEARNING OBJECTIVES: 3â€“5 SMART objectives. Use Bloom's verbs (identify, explain, calculate, compare, apply, analyse, evaluate).
3. SECTIONS (3â€“5): Each section has:
   - A clear HEADING
   - A substantive BODY of 3â€“4 paragraphs. Weave in [Lesson: <lesson title>] references where the lesson directly teaches the concept. Use [Activity] or [Lab] inline cues where hands-on work fits.
   - A REAL_WORLD_EXAMPLE grounded in a specific Liberian place, person, or event (not generic "Africa").
4. KEY TERMS: 6â€“12 terms with precise, grade-appropriate definitions.
5. REVIEW QUESTIONS: 5â€“8 questions mixing recall (remember), comprehension (understand), application (apply), and analysis (analyse) types.
6. FURTHER READING: Cite a real or plausible MOE Liberia resource, WAEC study guide, or community knowledge source.
7. MOE ALIGNMENT NOTE: State which MOE subject strand(s) and grade band this chapter supports.
8. AUTHOR NOTE: "Authored for Liberia Ministry of Education, Grade [N] [Subject] curriculum."

Return ONLY valid JSON matching this exact schema (no markdown, no commentary):
{
  "chapterTitle": string,
  "subject": string,
  "grade": number,
  "lessonRef": string,
  "overview": string,
  "learningObjectives": string[],
  "sections": [
    {
      "heading": string,
      "body": string,
      "realWorldExample": string
    }
  ],
  "keyTerms": [{"term": string, "definition": string}],
  "reviewQuestions": [
    {
      "question": string,
      "type": "recall" | "comprehension" | "application" | "analysis",
      "sampleAnswer": string
    }
  ],
  "furtherReading": string,
  "moeAlignmentNote": string,
  "authorNote": string
}

Requirements (validation gate â€” must be met or response is rejected):
- learningObjectives: at least 3
- sections: at least 3
- keyTerms: at least 6
- reviewQuestions: at least 5`;

  const userMessage = `Lesson title: ${lesson.title}
Subject: ${lesson.subject}
Grade: ${lesson.grade}
${lesson.moeCode ? `MOE alignment code: ${lesson.moeCode}` : ""}

Lesson content (excerpt):
${truncated}

Write the full textbook chapter for this lesson.`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.6,
      max_tokens: 4000,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    const tb = parsed.chapter ?? parsed.textbook ?? parsed;
    return tb as GeneratedTextbook;
  } catch (err) {
    console.error("  AI call failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// â”€â”€ Main â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function main() {
  const limitArg = readNumberArg("--limit");
  const subjectArg = readArg("--subject")?.toUpperCase();
  const gradeArg = readNumberArg("--grade");
  const overwrite = hasFlag("--overwrite");

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("OPENAI_API_KEY is required");
    process.exit(1);
  }

  const client = new OpenAI({ apiKey });

  const whereClause: Record<string, unknown> = { status: "APPROVED" };
  if (subjectArg) whereClause.subject = subjectArg;
  if (gradeArg) whereClause.grade = gradeArg;

  console.log(`\nTextbook Pass 1 â€” Generate chapters for APPROVED lessons`);
  console.log(`Subject: ${subjectArg ?? "all"} | Grade: ${gradeArg ?? "all"} | Overwrite: ${overwrite} | Limit: ${limitArg ?? "all"}`);
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
    orderBy: [{ grade: "asc" }, { subject: "asc" }],
  });

  // Filter: skip lessons that already have a textbook unless --overwrite
  const candidates = lessons.filter((lesson) => {
    if (overwrite) return true;
    const payload = lesson.payload as Record<string, unknown> | null;
    if (!payload) return true;
    const tb = payload.textbook;
    return !tb || (typeof tb === "object" && Object.keys(tb as object).length === 0);
  });

  const total = limitArg ? Math.min(candidates.length, limitArg) : candidates.length;
  const toProcess = candidates.slice(0, total);

  console.log(`Found ${lessons.length} APPROVED | ${candidates.length} need textbook â†’ processing ${total}`);
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

    const moeCode = typeof payload.moeCode === "string" ? payload.moeCode : undefined;

    const generated = await generateTextbook(client, {
      id: lesson.id,
      title: lesson.title,
      subject: lesson.subject,
      grade: lesson.grade ?? 1,
      bodyText,
      moeCode,
    });

    if (!generated) {
      console.log(`${prefix} â€” FAIL (AI returned null)`);
      fail++;
      continue;
    }

    if (!validateTextbook(generated)) {
      const g = generated as Record<string, unknown>;
      const objs = Array.isArray(g.learningObjectives) ? (g.learningObjectives as unknown[]).length : 0;
      const secs = Array.isArray(g.sections) ? (g.sections as unknown[]).length : 0;
      const terms = Array.isArray(g.keyTerms) ? (g.keyTerms as unknown[]).length : 0;
      const qs = Array.isArray(g.reviewQuestions) ? (g.reviewQuestions as unknown[]).length : 0;
      console.log(
        `${prefix} â€” FAIL (validation: objs=${objs}/${3}, secs=${secs}/${3}, terms=${terms}/${6}, qs=${qs}/${5})`
      );
      fail++;
      continue;
    }

    await governedCurriculum.update({
      where: { id: lesson.id },
      data: {
        payload: {
          ...payload,
          textbook: generated,
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
