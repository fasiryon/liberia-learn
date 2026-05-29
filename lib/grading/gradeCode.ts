/**
 * lib/grading/gradeCode.ts  — NR-14C Phase 2
 *
 * Sandboxed code execution grading via Judge0 (RapidAPI hosted).
 *
 * SECURITY PRINCIPLE (non-negotiable):
 *   Student-submitted code NEVER executes in this app's environment,
 *   Vercel functions, or any local process. It runs ONLY inside Judge0's
 *   isolate sandbox. This function submits code to Judge0 and reads back
 *   results — nothing more.
 *
 * Resource limits are ALWAYS set to prevent runaway code (loops, forks,
 * memory bombs). Judge0 enforces them, but we set them explicitly so
 * failures are fast and deterministic.
 *
 * Language allowlist: only languages actively taught in the curriculum.
 * Reject submissions in other languages at the route layer before this
 * function is called.
 *
 * Judge0 via RapidAPI: requires JUDGE0_API_KEY + JUDGE0_API_HOST env vars.
 * Free tier: ~50 req/day. Upgrade or migrate to self-hosted when CS
 * lesson submissions exceed the free tier.
 */

/** Judge0 language IDs for allowed curriculum languages */
export const ALLOWED_LANGUAGE_IDS: Record<string, number> = {
  python: 71, // Python 3.8.1
  python3: 71,
};

export const ALLOWED_LANGUAGE_ID_SET = new Set(Object.values(ALLOWED_LANGUAGE_IDS));

/** Hard resource limits sent with every Judge0 submission */
export const JUDGE0_LIMITS = {
  cpu_time_limit: 5,      // seconds
  memory_limit: 128_000,  // KB (128 MB)
  wall_time_limit: 10,    // seconds (hard wall clock)
  max_processes_and_or_threads: 60,
  enable_network: false,  // no outbound network from student code
} as const;

export type TestCaseResult = {
  passed: boolean;
  got: string | null;      // actual stdout (or compile/runtime error)
  expected: string;
};

export type CodeGradeResult = {
  score: number;           // 0..1 (passed / total)
  passed: number;
  total: number;
  results: TestCaseResult[];
};

type Judge0Response = {
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  status?: { id?: number; description?: string };
};

function normalizeOutput(s: string | null | undefined): string {
  return (s ?? "").trim();
}

/**
 * Grade code submission against test cases via Judge0.
 *
 * @param input.sourceCode    Student-submitted code
 * @param input.languageId    Judge0 language ID (must be in ALLOWED_LANGUAGE_ID_SET)
 * @param input.testCases     Array of { stdin, expectedStdout }
 *
 * @throws Error if JUDGE0_API_KEY / JUDGE0_API_HOST env vars are not set
 */
export async function gradeCode(input: {
  sourceCode: string;
  languageId: number;
  testCases: { stdin: string; expectedStdout: string }[];
}): Promise<CodeGradeResult> {
  if (!process.env.JUDGE0_API_KEY || !process.env.JUDGE0_API_HOST) {
    throw new Error("JUDGE0_API_KEY and JUDGE0_API_HOST must be set");
  }

  if (!ALLOWED_LANGUAGE_ID_SET.has(input.languageId)) {
    throw new Error(
      `Language ID ${input.languageId} is not in the curriculum allowlist. ` +
        `Allowed: ${Array.from(ALLOWED_LANGUAGE_ID_SET).join(", ")}`
    );
  }

  const results: TestCaseResult[] = [];
  let passed = 0;

  for (const tc of input.testCases) {
    let got: string | null = null;
    let testPassed = false;

    try {
      const res = await fetch(
        `https://${process.env.JUDGE0_API_HOST}/submissions?base64_encoded=false&wait=true`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-RapidAPI-Key": process.env.JUDGE0_API_KEY,
            "X-RapidAPI-Host": process.env.JUDGE0_API_HOST,
          },
          body: JSON.stringify({
            source_code: input.sourceCode,
            language_id: input.languageId,
            stdin: tc.stdin,
            expected_output: tc.expectedStdout,
            // Resource limits — always present, always explicit
            ...JUDGE0_LIMITS,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(`Judge0 HTTP ${res.status}`);
      }

      const data = (await res.json()) as Judge0Response;

      // Prefer stdout; fall back to stderr or compile_output for error display
      got = normalizeOutput(data.stdout) || normalizeOutput(data.compile_output) || normalizeOutput(data.stderr);

      // Only show stdout in comparison — error output is never leaked as "expected"
      const actualOutput = normalizeOutput(data.stdout);
      testPassed = actualOutput === normalizeOutput(tc.expectedStdout);
    } catch (err) {
      // Network or parse failure — treat as a failing test case, not a crash
      got = `[error: ${err instanceof Error ? err.message : String(err)}]`;
      testPassed = false;
    }

    if (testPassed) passed++;
    results.push({ passed: testPassed, got, expected: tc.expectedStdout });
  }

  const total = input.testCases.length;
  return {
    score: total > 0 ? passed / total : 0,
    passed,
    total,
    results,
  };
}
