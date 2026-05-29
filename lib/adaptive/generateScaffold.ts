/**
 * lib/adaptive/generateScaffold.ts  — NR-14B-ii
 *
 * Generates a scaffold variant for a lesson — a gentler, more broken-down
 * version of the same content for students who get stuck.
 *
 * A scaffold is NOT a new lesson. It takes the parent lesson body and
 * produces a simplified version that:
 *   - Breaks concepts into smaller steps
 *   - Uses simpler vocabulary (one grade level easier)
 *   - Adds concrete Liberian daily-life examples
 *   - Is ~40-60% of the original length
 *   - Shares the same learning objective
 *
 * Quality gate: ≥300 words AND ≥40% of parent body length.
 * If the first attempt fails the gate, retries once then returns null.
 *
 * Uses routedCompletion (never direct OpenAI/Groq).
 */

import { routedCompletion } from "@/lib/ai/router";
import { toneGuidance } from "@/lib/localization/tone-standardizer";

export type ScaffoldResult = {
  body: string;
  wordCount: number;
  parentWordCount: number;
  ratioOfParent: number;
};

export type ScaffoldFailure = {
  error: string;
  attempts: number;
};

const MIN_WORDS = 300;
const MIN_RATIO = 0.40; // scaffold must be ≥40% of parent length

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

function buildScaffoldPrompt(input: {
  grade: number;
  subject: string;
  title: string;
  parentBody: string;
  tone: string;
}): string {
  const truncatedBody = input.parentBody.slice(0, 6000);
  return `You are helping a student who is STRUGGLING with a ${input.grade} ${input.subject} lesson titled "${input.title}".

Here is the original lesson:
${truncatedBody}

Create a SCAFFOLDED version for a student who got stuck. Follow these rules exactly:

1. **Break every concept into the smallest possible steps** — never assume the student understood anything from the original
2. **Use simpler words** — aim for one grade level easier in reading difficulty
3. **Add 2-3 concrete worked examples** from Liberian daily life (markets, farms, cassava, palm oil, rivers, Liberian dollars, county names, student names like Kpan, Musa, Fatu, Emmanuel)
4. **Language tone**: ${input.tone}
5. **Use encouraging, patient language** ("Let's take this slowly...", "Don't worry — this part confused many students at first...")
6. **Keep the SAME learning goal** but make the path gentler
7. **Aim for about half the length** of the original — clear and focused, not padded
8. **Use clear headings** (##) and short paragraphs
9. **Never say the original was "too hard"** — frame everything as "let's go deeper together"

Output ONLY the scaffolded lesson body in markdown. No preamble, no "here is the scaffolded version", just the content.`;
}

/**
 * Generate a scaffold variant for a lesson.
 *
 * @param input.lessonId     CurriculumContent.id (for logging only)
 * @param input.parentBody   The lesson's full body text
 * @param input.grade        Grade number (1-12)
 * @param input.subject      Subject string (MATH, SCIENCE, etc.)
 * @param input.title        Lesson title
 *
 * @returns ScaffoldResult on success, null on failure after retries
 */
export async function generateScaffold(input: {
  lessonId: string;
  parentBody: string;
  grade: number;
  subject: string;
  title: string;
}): Promise<ScaffoldResult | null> {
  const parentWordCount = countWords(input.parentBody);
  const tone = toneGuidance(input.grade);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await routedCompletion({
        messages: [
          {
            role: "user",
            content: buildScaffoldPrompt({
              grade: input.grade,
              subject: input.subject,
              title: input.title,
              parentBody: input.parentBody,
              tone,
            }),
          },
        ],
        maxTokens: 2000,
        forceSmartTier: false, // fast tier is fine for scaffold (simpler output)
        aiUsage: {
          route: "scripts/generate-scaffolds",
          feature: "curriculum",
          subject: input.subject,
          contentId: input.lessonId,
          requestType: "scaffold_generation",
          metadata: {
            grade: input.grade,
            attempt,
          },
        },
      });

      const body = result.content.trim();
      const wordCount = countWords(body);
      const ratioOfParent = parentWordCount > 0 ? wordCount / parentWordCount : 1;

      // Quality gate: must be substantial and proportionate to parent
      if (wordCount >= MIN_WORDS && ratioOfParent >= MIN_RATIO) {
        return { body, wordCount, parentWordCount, ratioOfParent };
      }

      console.warn(
        `[generateScaffold] Attempt ${attempt} failed quality gate: ` +
          `${wordCount} words (min ${MIN_WORDS}), ratio ${ratioOfParent.toFixed(2)} (min ${MIN_RATIO}) — ` +
          `lessonId=${input.lessonId}`
      );
    } catch (err) {
      console.error(`[generateScaffold] Attempt ${attempt} error for lessonId=${input.lessonId}:`, err);
    }
  }

  return null; // Failed both attempts
}
