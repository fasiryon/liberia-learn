// lib/curriculum/generateLessonV2.ts
//
// V2 lesson generator — structured 17-section format with:
//   - Higher word floors than V1 (3,500+ words total)
//   - Per-section enforcement with targeted expansion calls
//   - Structured [STUDENT_PROBLEM_START/END] + [ANSWER_START/END] markers
//   - Problem set extraction (student prompts separated from answer keys)
//   - Student body sanitization (answer blocks stripped before delivery)
//   - takeawaySummary extracted from Section 17 "Key Takeaways:"
//
// Does NOT modify lib/ai/curriculum-factory.ts — V1 stays alive.

import { routedCompletion } from "@/lib/ai/router";
import {
  CurriculumPayloadSchema,
  type CurriculumPayload,
} from "@/lib/schemas/curriculumPayload";
import { parseToSlides } from "@/lib/lessons/parseToSlides";

// ─── Custom error ─────────────────────────────────────────────────────────────

export class GenerateLessonV2Error extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GenerateLessonV2Error";
  }
}

// ─── Public types ─────────────────────────────────────────────────────────────

export type GenerateLessonV2Input = {
  grade: number;
  subject: string;
  topic: string;
  demoReady?: boolean;
  moeAlignmentCodes?: string[];
  /** Override OpenAI model (e.g. "gpt-4o" for hero set, "gpt-4o-mini" for bulk). */
  model?: string;
};

export type GenerateLessonV2Result = {
  payload: CurriculumPayload;
  wordCount: number;
  model: string;
  problemSetsCount: number;
  slidesCount: number;
};

// ─── Internal types ───────────────────────────────────────────────────────────

type ExtractedProblem = {
  id: string;
  sectionId: string;
  label: string;
  studentPrompt: string;
  answerKey: string;
};

type SectionCheckGroup = {
  nums: number[];
  label: string;
  floor: number;
};

// ─── Per-section floor groups ─────────────────────────────────────────────────
// Maps to the 17-section V2 template. Each group can span multiple section numbers.
// Floors match the sprint spec (Phase 1).

const SECTION_CHECK_GROUPS: SectionCheckGroup[] = [
  { nums: [1], label: "Hook", floor: 200 },
  { nums: [4, 5], label: "Direct Instruction (Core Concepts)", floor: 1500 },
  { nums: [7, 8], label: "Worked Examples", floor: 800 },
  { nums: [10, 11, 12], label: "Guided Practice", floor: 1200 },
  { nums: [13, 14, 15], label: "Independent Practice", floor: 600 },
  { nums: [17], label: "Assessment & Summary", floor: 200 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function extractTakeaways(body: string): string {
  const match = body.match(/Key Takeaways?:\s*\n((?:\s*[-*]\s+.+\n?)+)/i);
  if (match) return match[1].trim();
  const bullets = body.split("\n").filter((l) => /^[-*]\s+.{20,}/.test(l)).slice(-5);
  return bullets.length >= 2
    ? bullets.join("\n")
    : "- Review what you learned today and complete the exit ticket.";
}

function extractProblemSets(body: string): ExtractedProblem[] {
  const prompts = new Map<string, string>();
  const answers = new Map<string, string>();

  const promptRegex = /\[STUDENT_PROBLEM_START:(\w+)\]([\s\S]*?)\[STUDENT_PROBLEM_END:\1\]/g;
  const answerRegex = /\[ANSWER_START:(\w+)\]([\s\S]*?)\[ANSWER_END:\1\]/g;

  let m: RegExpExecArray | null;
  while ((m = promptRegex.exec(body)) !== null) {
    prompts.set(m[1], m[2].trim());
  }
  while ((m = answerRegex.exec(body)) !== null) {
    answers.set(m[1], m[2].trim());
  }

  const labelMap: Record<string, string> = {
    gp1: "Guided Practice 1",
    gp2: "Guided Practice 2",
    gp3: "Guided Practice 3",
    ip1a: "Practice Tier 1 — Problem 1",
    ip1b: "Practice Tier 1 — Problem 2",
    ip2a: "Practice Tier 2 — Problem 1",
    ip2b: "Practice Tier 2 — Problem 2",
    ip3a: "Practice Tier 3 — Problem 1",
    ip3b: "Practice Tier 3 — Problem 2",
  };

  const problems: ExtractedProblem[] = [];
  for (const [id, studentPrompt] of prompts) {
    const answerKey = answers.get(id) ?? "";
    const sectionId = id.startsWith("gp") ? "guided-practice" : "independent-practice";
    problems.push({
      id,
      sectionId,
      label: labelMap[id] ?? id,
      studentPrompt,
      answerKey,
    });
  }
  return problems;
}

function buildStudentBody(rawBody: string): string {
  const body = rawBody
    .replace(/\[STUDENT_PROBLEM_START:\w+\]/g, "")
    .replace(/\[STUDENT_PROBLEM_END:\w+\]/g, "")
    .replace(/\[ANSWER_START:\w+\][\s\S]*?\[ANSWER_END:\w+\]/g, "");
  return body.trim();
}

/** Parse rawBody into a map of section number → section text (including heading). */
function parseSections(body: string): Map<number, string> {
  const sections = new Map<number, string>();
  const regex = /^(## (\d+)\. )/gm;
  const matches = [...body.matchAll(regex)];
  for (let i = 0; i < matches.length; i++) {
    const num = parseInt(matches[i][2], 10);
    const start = matches[i].index!;
    const end = i + 1 < matches.length ? matches[i + 1].index! : body.length;
    sections.set(num, body.slice(start, end));
  }
  return sections;
}

/** Return section groups that are below their word floor. */
function findThinGroups(
  sections: Map<number, string>
): Array<{ group: SectionCheckGroup; combinedText: string; actualWords: number }> {
  const thin: Array<{ group: SectionCheckGroup; combinedText: string; actualWords: number }> = [];
  for (const group of SECTION_CHECK_GROUPS) {
    const texts = group.nums.map((n) => sections.get(n) ?? "").filter(Boolean);
    const combinedText = texts.join("\n\n");
    const actualWords = countWords(combinedText);
    if (actualWords < group.floor) {
      thin.push({ group, combinedText, actualWords });
    }
  }
  return thin;
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function buildPass1System(grade: number, subject: string, moeAlignmentCodes?: string[]): string {
  const moeHint = moeAlignmentCodes?.length
    ? `Address MOE standards: ${moeAlignmentCodes.join(", ")}.`
    : "";

  return `You are an expert Liberian teacher writing a complete classroom lesson for Grade ${grade} ${subject}.
Write the FULL lesson body as Markdown prose. Do NOT write JSON. Write the actual teaching content.
Use Liberian context throughout: names (Boima, Fatu, Pewee, Kpaan, Finda, Gbanyan), places (Monrovia, Nimba, Bong, Lofa, Waterside Market), foods (cassava, palm oil, rice, mangoes), currency (LD$ and US$).
${moeHint}
Rules:
- Minimum word count per section is stated in the template. Write to the floor — do not truncate.
- Show EVERY STEP of every worked example with all arithmetic visible.
- Never describe what a section will contain — write the actual content immediately.
- For sections with [STUDENT_PROBLEM_START:id] markers, follow the exact marker format shown.
- Every practice problem must include the complete worked answer inside [ANSWER_START:id]...[ANSWER_END:id] markers.`;
}

function buildPass1User(grade: number, subject: string, topic: string): string {
  return `Write a complete Grade ${grade} ${subject} lesson on: "${topic}"

Use exactly these 17 sections with ## headings:

## 1. Hook — The Real-World Challenge (300+ words)
A vivid, complete story from Liberian life. Full narrative — do not describe, write it.
Name people (Boima, Fatu, Pewee, Kpaan, Finda, Gbanyan), places (Monrovia, Nimba, Bong, Lofa),
foods (cassava, palm oil, rice, mangoes), currency (LD$ and US$).
End with a question students want to answer.

## 2. Learning Objectives (150+ words)
"Learning Objective:" label. 3 measurable objectives (calculate/explain/identify/apply/compare/prove).
WHY this matters for real life in Liberia + future careers.

## 3. Prior Knowledge Activation (200+ words)
3 warm-up problems, fully stated, numbered 1-3. Each followed by "Answer:" with complete solution.

## 4. Core Concept — Concrete Foundation (400+ words)
"Introduction:" label. Concept in physical/tangible Liberian context.
Full explanation speaking directly to student. One complete concrete example.
Define every new term on first use.

## 5. Core Concept — The Rule and Why It Works (300+ words)
State the abstract rule/formula/principle.
Explain WHY it works in plain language. Connect to Section 4's concrete example.
"Can you see why this always works?"

## 6. Key Vocabulary (200+ words)
Every new term: (a) definition, (b) full example sentence in Liberian context, (c) memory tip.

## 7. Worked Example 1 — Standard Method (300+ words)
Full problem statement. EVERY step shown and labelled. Liberian names/LD$.
"What do you notice about this method?" + expected student observation.
"Try this yourself: [a similar problem, fully stated]"

## 8. Worked Example 2 — Alternative Method (300+ words)
Same problem type, different method (visual/shortcut/algebraic).
"Method 1 took X steps. Method 2 took Y steps. Method 2 is faster when..."

## 9. Error Analysis (250+ words)
"Common Error:" label. 3 specific wrong answers students commonly produce.
For each: WHY this error happens, correct working side-by-side, one-sentence rule to prevent it.

## 10. Guided Practice — Problem 1 (200+ words)
[STUDENT_PROBLEM_START:gp1]
Full problem statement only. No solution visible to student.
[STUDENT_PROBLEM_END:gp1]
[ANSWER_START:gp1]
Complete step-by-step solution with every step shown.
[ANSWER_END:gp1]

## 11. Guided Practice — Problem 2 (200+ words)
[STUDENT_PROBLEM_START:gp2]
Full problem statement only.
[STUDENT_PROBLEM_END:gp2]
[ANSWER_START:gp2]
Complete solution, slightly harder than Problem 1.
[ANSWER_END:gp2]

## 12. Guided Practice — Problem 3 (200+ words)
[STUDENT_PROBLEM_START:gp3]
Full problem combining two ideas from this lesson.
[STUDENT_PROBLEM_END:gp3]
[ANSWER_START:gp3]
Complete solution explaining why both ideas are needed.
[ANSWER_END:gp3]

## 13. Independent Practice — Tier 1 (150+ words)
[STUDENT_PROBLEM_START:ip1a]
Problem 1 statement.
[STUDENT_PROBLEM_END:ip1a]
[ANSWER_START:ip1a]
Answer 1.
[ANSWER_END:ip1a]
[STUDENT_PROBLEM_START:ip1b]
Problem 2 statement.
[STUDENT_PROBLEM_END:ip1b]
[ANSWER_START:ip1b]
Answer 2.
[ANSWER_END:ip1b]

## 14. Independent Practice — Tier 2 Standard (150+ words)
[STUDENT_PROBLEM_START:ip2a]
Problem 1 statement.
[STUDENT_PROBLEM_END:ip2a]
[ANSWER_START:ip2a]
Answer 1.
[ANSWER_END:ip2a]
[STUDENT_PROBLEM_START:ip2b]
Problem 2 statement.
[STUDENT_PROBLEM_END:ip2b]
[ANSWER_START:ip2b]
Answer 2.
[ANSWER_END:ip2b]

## 15. Independent Practice — Tier 3 Advanced (150+ words)
[STUDENT_PROBLEM_START:ip3a]
Problem 1 statement.
[STUDENT_PROBLEM_END:ip3a]
[ANSWER_START:ip3a]
Answer 1.
[ANSWER_END:ip3a]
[STUDENT_PROBLEM_START:ip3b]
Problem 2 statement.
[STUDENT_PROBLEM_END:ip3b]
[ANSWER_START:ip3b]
Answer 2.
[ANSWER_END:ip3b]

## 16. Group Discussion (150+ words)
Full discussion prompt. 4-5 key points students should arrive at.
Cross-curricular connection to Liberian context.

## 17. Assessment, Exit Ticket, and Lesson Summary (200+ words)
"Assessment:" label. 2 exit ticket questions fully stated.
Key Takeaways:
- [3-5 actual bullets summarising what was learned — NOT copied from body, written fresh]
"In the next lesson, we will..."

TOTAL MINIMUM: 3,500 words. Start writing immediately. Begin with ## 1.`;
}

function buildPass2User(bodySlice: string): string {
  return `Lesson content:
---
${bodySlice}
---

Return ONLY this JSON (no other text):
{
  "title": "[descriptive lesson title, max 80 chars]",
  "learningObjectives": ["[objective 1 from Learning Objectives section]", "[objective 2]", "[objective 3]"],
  "assessmentQuestions": [
    {"question": "[from Assessment/Exit Ticket section]", "answer": "[expected answer]", "choices": null},
    {"question": "[second question]", "answer": "[expected answer]", "choices": null}
  ]
}`;
}

function buildExpansionUser(
  groupLabel: string,
  currentText: string,
  targetWords: number,
  grade: number,
  subject: string,
  topic: string
): string {
  return `You are expanding a section of a Grade ${grade} ${subject} lesson on "${topic}".

The section "${groupLabel}" is currently ${countWords(currentText)} words but needs at least ${targetWords} words.

Current content:
---
${currentText}
---

Rewrite this section to be at least ${targetWords} words by:
- Adding more detail to every explanation
- Expanding each worked example to show every arithmetic step
- Adding more checks for student understanding
- Using more Liberian context (names: Boima, Fatu, Pewee; places: Monrovia, Nimba; currency: LD$)

IMPORTANT:
- Do NOT change the section topic
- Preserve any [STUDENT_PROBLEM_START/END:id] and [ANSWER_START/END:id] markers exactly
- Keep the ## heading(s) at the top
- Return ONLY the expanded section text, nothing else`;
}

// ─── Per-section expansion ────────────────────────────────────────────────────

async function expandThinSections(
  rawBody: string,
  grade: number,
  subject: string,
  topic: string,
  modelOverride: string | undefined,
  timeoutMs: number
): Promise<string> {
  let body = rawBody;
  const MAX_EXPANSION_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_EXPANSION_ATTEMPTS; attempt++) {
    const sections = parseSections(body);
    const thinGroups = findThinGroups(sections);

    if (thinGroups.length === 0) {
      console.log(`[generateLessonV2] All sections pass floor checks.`);
      break;
    }

    console.log(
      `[generateLessonV2] Expansion attempt ${attempt + 1}: ${thinGroups.length} thin section(s) — ` +
        thinGroups
          .map((t) => `${t.group.label} (${t.actualWords}/${t.group.floor}w)`)
          .join(", ")
    );

    for (const { group, combinedText, actualWords } of thinGroups) {
      console.log(
        `  Expanding "${group.label}": ${actualWords} → target ${group.floor} words`
      );
      try {
        const expansionResult = await routedCompletion({
          messages: [
            {
              role: "system",
              content: `You are an expert Liberian teacher. Expand the given lesson section to meet the minimum word count. Write rich, detailed teaching content in Markdown prose.`,
            },
            {
              role: "user",
              content: buildExpansionUser(group.label, combinedText, group.floor, grade, subject, topic),
            },
          ],
          maxTokens: 6000,
          forceSmartTier: true,
          modelOverride,
          aiUsage: {
            route: "curriculum.v2.expand",
            feature: "curriculum",
            subject,
            requestType: "elite_curriculum_generation",
            metadata: { grade, topic, group: group.label, attempt },
          },
        });

        const expandedText = expansionResult.content.trim();
        const expandedWords = countWords(expandedText);
        console.log(`    Result: ${expandedWords} words via ${expansionResult.model}`);

        // Replace the original section(s) in body with the expanded version
        // Find the first heading of this group in the body
        const firstNum = group.nums[0];
        const lastNum = group.nums[group.nums.length - 1];

        const firstHeadingRegex = new RegExp(`^## ${firstNum}\\.`, "m");
        const firstMatch = body.match(firstHeadingRegex);
        if (!firstMatch || firstMatch.index == null) continue;

        // Find the end: the heading after lastNum in body (or end of body)
        const afterLastRegex = new RegExp(`^## ${lastNum + 1}\\.`, "m");
        const afterMatch = body.match(afterLastRegex);

        const replaceStart = firstMatch.index;
        const replaceEnd = afterMatch?.index ?? body.length;

        body =
          body.slice(0, replaceStart) +
          expandedText +
          "\n\n" +
          body.slice(replaceEnd);
      } catch (err) {
        console.warn(
          `  Expansion call failed for "${group.label}": ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  // Final check — log any sections still below floor (don't fail, just warn)
  const finalSections = parseSections(body);
  const stillThin = findThinGroups(finalSections);
  if (stillThin.length > 0) {
    console.warn(
      `[generateLessonV2] After ${MAX_EXPANSION_ATTEMPTS} expansion attempts, ` +
        `${stillThin.length} section(s) still below floor: ` +
        stillThin.map((t) => `${t.group.label} (${t.actualWords}/${t.group.floor}w)`).join(", ")
    );
  }

  return body;
}

// ─── Main generator ───────────────────────────────────────────────────────────

export async function generateLessonV2(
  input: GenerateLessonV2Input
): Promise<GenerateLessonV2Result> {
  const { grade, subject, topic, demoReady, moeAlignmentCodes, model: modelOverride } = input;
  const timeoutMs = 240_000;

  // ── Pass 1: body generation (text mode, high token budget) ───────────────────
  const pass1Result = await routedCompletion({
    messages: [
      { role: "system", content: buildPass1System(grade, subject, moeAlignmentCodes) },
      { role: "user", content: buildPass1User(grade, subject, topic) },
    ],
    maxTokens: 16000,
    forceSmartTier: true,
    modelOverride,
    aiUsage: {
      route: "curriculum.v2.body",
      feature: "curriculum",
      subject,
      requestType: "elite_curriculum_generation",
      promptKey: "lesson.deep.v2",
      metadata: { grade, topic, pass: 1 },
    },
  });

  // Strip accidental markdown fences
  let rawBody = pass1Result.content.trim();
  if (rawBody.startsWith("```")) {
    rawBody = rawBody
      .replace(/^```(?:markdown)?\s*/i, "")
      .replace(/```\s*$/, "")
      .trim();
  }

  const pass1Words = countWords(rawBody);
  const pass1Model = pass1Result.model;

  console.log(`[generateLessonV2] Pass 1: ${pass1Words} words via ${pass1Model}`);

  // Hard gate: < 2000 words is unusable
  if (pass1Words < 2000) {
    throw new GenerateLessonV2Error(`Pass 1 too thin: ${pass1Words} words via ${pass1Model}`);
  }

  // Soft warning: < 3000 words is below the target floor
  if (pass1Words < 3000) {
    console.warn(
      `[generateLessonV2] Pass 1 below 3000-word floor: ${pass1Words} words. Running expansion.`
    );
  }

  // ── Per-section enforcement (Phase 1) ────────────────────────────────────────
  rawBody = await expandThinSections(rawBody, grade, subject, topic, modelOverride, timeoutMs);

  const expandedWords = countWords(rawBody);
  console.log(`[generateLessonV2] After expansion: ${expandedWords} words total`);

  // Hard fail if still below 2,000 after expansion (shouldn't happen)
  if (expandedWords < 2000) {
    throw new GenerateLessonV2Error(
      `Lesson still too thin after expansion: ${expandedWords} words`
    );
  }

  // ── Pass 2: metadata extraction (JSON mode, short output) ────────────────────
  const pass2Result = await routedCompletion({
    messages: [
      {
        role: "system",
        content:
          "You are a JSON extractor. Read the lesson content provided and return ONLY a compact JSON object with the metadata fields. Do not include the lesson body in your response.",
      },
      { role: "user", content: buildPass2User(rawBody.slice(0, 6000)) },
    ],
    maxTokens: 600,
    forceSmartTier: false,
    responseFormat: "json",
    aiUsage: {
      route: "curriculum.v2.meta",
      feature: "curriculum",
      subject,
      requestType: "elite_curriculum_structure",
      provider: "openai",
    },
  });

  let meta: {
    title?: string;
    learningObjectives?: string[];
    assessmentQuestions?: unknown[];
  } = {};

  try {
    meta = JSON.parse(pass2Result.content);
  } catch {
    console.warn("[generateLessonV2] Pass 2 metadata parse failed — using defaults");
  }

  const combinedModel = `${pass1Model}+${pass2Result.model}`;

  // ── Pass 3: extract takeaways (regex, no LLM call) ───────────────────────────
  const takeawaySummary = extractTakeaways(rawBody);

  // ── Extract problem sets from structured markers ──────────────────────────────
  const extractedProblems = extractProblemSets(rawBody);

  if (extractedProblems.length === 0) {
    console.warn(
      "[generateLessonV2] No structured problem sets found — model may not have followed the marker format."
    );
  }

  // ── Build student body (strip answer blocks) ──────────────────────────────────
  const studentBody = buildStudentBody(rawBody);

  // ── Compute slides ────────────────────────────────────────────────────────────
  const lessonTitle = meta.title?.trim() || `Grade ${grade} ${subject}: ${topic}`;
  const slides = parseToSlides({
    title: lessonTitle,
    content: studentBody,
    takeawaySummary,
  });

  // ── Build and validate final payload ─────────────────────────────────────────
  const objectives: string[] =
    Array.isArray(meta.learningObjectives) && meta.learningObjectives.length > 0
      ? meta.learningObjectives.filter((o) => typeof o === "string" && o.trim())
      : [`Students will learn and apply concepts related to ${topic}.`];

  const finalPayload = CurriculumPayloadSchema.parse({
    title: lessonTitle,
    grade,
    subject,
    lessonFormat: "either",
    objectives,
    body: studentBody,
    body_standard: studentBody,
    body_block: studentBody,
    activities: [],
    labs: [],
    moeAlignments: moeAlignmentCodes ?? [],
    takeawaySummary,
    demoReady: demoReady ?? false,
    problemSets: extractedProblems.map((ps) => ({
      id: ps.id,
      sectionId: ps.sectionId,
      label: ps.label,
      studentPrompt: ps.studentPrompt,
      answerKey: ps.answerKey,
    })),
    metadata: {
      topic,
      locale: "LR",
      generatedAt: new Date().toISOString(),
      model: combinedModel,
    },
  });

  return {
    payload: finalPayload,
    wordCount: countWords(studentBody),
    model: combinedModel,
    problemSetsCount: extractedProblems.length,
    slidesCount: slides.length,
  };
}
