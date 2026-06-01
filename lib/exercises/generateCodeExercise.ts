/**
 * lib/exercises/generateCodeExercise.ts  — NR-14D Phase 2
 *
 * Generates a Python coding exercise for a CS lesson and SELF-VALIDATES it
 * by running the reference solution through Judge0 against all test cases.
 *
 * CRITICAL INVARIANT: no exercise is persisted unless the reference solution
 * passes 100% of its own test cases. A broken exercise destroys student trust
 * faster than no exercise at all.
 *
 * Uses routedCompletion (never direct OpenAI/Groq per house rule).
 * Judge0 budget: each validation call consumes 1 submission per test case.
 * Free tier = 50/day → ~16 validated exercises/day (3 test cases each).
 */

import { routedCompletion } from "@/lib/ai/router";
import { gradeCode } from "@/lib/grading/gradeCode";

export type GeneratedExercise = {
  title: string;
  description: string;
  starterCode: string;
  referenceSolution: string;
  testCases: Array<{ stdin: string; expectedStdout: string; hidden: boolean }>;
};

export type GenerateCodeExerciseResult =
  | { success: true; exercise: GeneratedExercise }
  | { success: false; reason: string };

/**
 * Strip prompt strings from input() calls — models consistently use input('prompt: ')
 * despite instructions. This turns `input('Enter value: ')` → `input()` so that
 * input() prompts don't appear in stdout and break the expectedStdout comparison.
 */
function stripInputPrompts(code: string): string {
  return code.replace(/input\s*\(\s*(['"`][^'"`]*['"`])\s*\)/g, "input()");
}

function safeParseExerciseJSON(raw: string): GeneratedExercise | null {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  try {
    const parsed = JSON.parse(cleaned) as Partial<GeneratedExercise>;
    if (
      typeof parsed.title !== "string" ||
      typeof parsed.description !== "string" ||
      typeof parsed.starterCode !== "string" ||
      typeof parsed.referenceSolution !== "string" ||
      !Array.isArray(parsed.testCases) ||
      parsed.testCases.length < 2
    ) {
      return null;
    }
    const testCases = parsed.testCases.map((tc: Record<string, unknown>) => ({
      stdin: String(tc.stdin ?? ""),
      expectedStdout: String(tc.expectedStdout ?? ""),
      hidden: Boolean(tc.hidden ?? false),
    }));
    return { ...parsed, testCases } as GeneratedExercise;
  } catch {
    return null;
  }
}

/**
 * Generate a Python exercise for a CS lesson.
 *
 * The reference solution is run through Judge0 before this returns.
 * If the reference fails any test case, returns { success: false }.
 *
 * @param input.lessonTitle  Title of the CS lesson
 * @param input.lessonBody   Lesson body text (prose markdown)
 * @param input.grade        Grade number (1–12)
 * @param input.difficulty   "intro" | "guided" | "challenge"
 */
export async function generateCodeExercise(input: {
  lessonId: string;
  lessonTitle: string;
  lessonBody: string;
  grade: number;
  difficulty: "intro" | "guided" | "challenge";
}): Promise<GenerateCodeExerciseResult> {
  const difficultyGuide =
    input.difficulty === "intro"
      ? "beginner (first time seeing this concept — simple, one function, clear I/O)"
      : input.difficulty === "guided"
        ? "intermediate (student knows the concept, needs to apply it to a new scenario)"
        : "challenge (student applies concept in a harder, multi-step scenario)";

  const prompt = `You are designing a Python 3 coding exercise for Grade ${input.grade} students in Liberia studying: "${input.lessonTitle}".

Lesson content (for context):
${input.lessonBody.slice(0, 4000)}

Create ONE Python exercise at ${difficultyGuide} difficulty.

Use Liberian context where natural: markets, mobile money (MTN, Orange), cassava, palm oil, Liberian dollars (LD), Waterside Market, student names (Boima, Fatu, Kpan, Musa, Emmanuel).

Return ONLY valid JSON — no preamble, no code fences:
{
  "title": "Short exercise name (5-8 words)",
  "description": "Clear instructions using encouraging language. Start with context, then what the student should write. 3-5 sentences.",
  "starterCode": "# Starter Python 3 code with TODO comments the student fills in\\n# ...",
  "referenceSolution": "# Complete working Python 3 solution that passes all test cases\\n# ...",
  "testCases": [
    { "stdin": "exact input string", "expectedStdout": "exact output string", "hidden": false },
    { "stdin": "exact input string 2", "expectedStdout": "exact output 2", "hidden": false },
    { "stdin": "edge case input", "expectedStdout": "edge case output", "hidden": true }
  ]
}

CRITICAL RULES — read each one carefully:
1. Python 3 only (Judge0 language_id 71)
2. NEVER pass a prompt string to input(). Write input() NOT input("Enter value: "). The prompt UI is in the description, not the code. Every input() call must be bare.
3. NEVER print anything except the final result. No "Enter your name:" messages. Only the answer goes to stdout.
4. expectedStdout is ONLY the final print() output — nothing else goes to stdout
5. stdin has one value per line for each input() call; use "" if no input needed
6. 2 visible test cases + 1 hidden edge case
7. referenceSolution MUST pass all test cases with NO extra output
8. Use "Try writing..." not "Implement" — encouraging tone
9. Match ONLY the lesson concept (no recursion in a loops lesson)
10. No imports beyond standard library`;

  // Attempt up to 3 generations — LLM is non-deterministic, a retry often succeeds
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await routedCompletion({
      messages: [{ role: "user", content: prompt }],
      maxTokens: 1200,
      forceSmartTier: true,
      aiUsage: {
        route: "lib/exercises/generateCodeExercise",
        feature: "curriculum",
        requestType: "code_exercise_generation",
      },
    });

    const raw = safeParseExerciseJSON(result.content);
    if (!raw) {
      if (attempt < 3) continue;
      return { success: false, reason: "invalid_json" };
    }

    // Strip prompt strings from input() calls — models reliably use input('prompt...')
    // despite instructions, which pollutes stdout and breaks expectedStdout comparison.
    const exercise: GeneratedExercise = {
      ...raw,
      referenceSolution: stripInputPrompts(raw.referenceSolution),
      starterCode: stripInputPrompts(raw.starterCode),
    };

    // SELF-VALIDATE: run reference solution through Judge0 against every test case.
    // If it fails ANY test case, the exercise is broken — retry or give up.
    let validationResult;
    try {
      validationResult = await gradeCode({
        sourceCode: exercise.referenceSolution,
        languageId: 71,
        testCases: exercise.testCases.map((tc) => ({
          stdin: tc.stdin,
          expectedStdout: tc.expectedStdout,
        })),
      });
    } catch (err) {
      return {
        success: false,
        reason: `judge0_error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (validationResult.passed === validationResult.total) {
      return { success: true, exercise };
    }

    // Validation failed — log and retry if attempts remain
    if (attempt < 3) continue;

    return {
      success: false,
      reason: `reference_solution_failed: ${validationResult.passed}/${validationResult.total} test cases`,
    };
  }

  return { success: false, reason: "max_attempts_exceeded" };
}
