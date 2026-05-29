"use client";
/**
 * components/grading/CodeSubmit.tsx  — NR-14C Phase 3
 *
 * In-lesson code submission component.
 * Sends code to /api/grading/code which proxies it to Judge0 sandbox.
 * Student code NEVER executes in this component or in the app process.
 *
 * Encouragement on failure: shows which tests passed/failed with
 * specific output diff, not just "FAILED".
 */

import { useState, useCallback } from "react";

type TestCaseInput = {
  stdin: string;
  expectedStdout: string;
  label?: string; // optional human-readable label, e.g. "Sample 1"
};

type TestCaseResult = {
  passed: boolean;
  got: string | null;
  expected: string;
};

type RunResult = {
  score: number;
  passed: number;
  total: number;
  results: TestCaseResult[];
  feedback: string;
};

type Props = {
  lessonId: string;
  promptId?: string;
  /** The coding problem description */
  prompt: string;
  /** Language to use — only "python" currently (languageId 71) */
  language?: "python";
  testCases: TestCaseInput[];
  onGraded?: (result: RunResult) => void;
};

const LANGUAGE_IDS: Record<string, number> = { python: 71 };

export function CodeSubmit({
  lessonId,
  promptId,
  prompt,
  language = "python",
  testCases,
  onGraded,
}: Props) {
  const [code, setCode] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRun = useCallback(async () => {
    if (!code.trim() || running) return;
    setRunning(true);
    setError(null);
    setResult(null);

    const clientSubmissionId = crypto.randomUUID();
    try {
      const res = await fetch("/api/grading/code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          promptId,
          sourceCode: code,
          languageId: LANGUAGE_IDS[language],
          testCases: testCases.map(({ stdin, expectedStdout }) => ({
            stdin,
            expectedStdout,
          })),
          clientSubmissionId,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "unknown error" }));
        if (res.status === 429) {
          setError("You have reached the submission limit for this hour. Try again later.");
        } else {
          setError(err.error ?? "Submission failed — please try again.");
        }
        return;
      }

      const data = await res.json();
      const runResult: RunResult = {
        score: data.score ?? 0,
        passed: data.passed ?? 0,
        total: data.total ?? testCases.length,
        results: (data.results as TestCaseResult[]) ?? [],
        feedback: data.feedback ?? "",
      };
      setResult(runResult);
      onGraded?.(runResult);
    } catch {
      setError("Could not connect to the code runner. Check your internet connection and try again.");
    } finally {
      setRunning(false);
    }
  }, [lessonId, promptId, code, running, language, testCases, onGraded]);

  const allPassed = result?.passed === result?.total && (result?.total ?? 0) > 0;

  return (
    <div className="space-y-4">
      {/* Prompt */}
      <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
        <p className="text-sm font-medium text-violet-900">Coding challenge</p>
        <p className="mt-1 text-sm text-violet-800 whitespace-pre-wrap">{prompt}</p>
        <p className="mt-2 text-xs text-violet-600">
          Language: {language} · {testCases.length} test case{testCases.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Code editor (plain textarea — avoids heavy CodeMirror dep) */}
      <div className="relative">
        <textarea
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={`# Write your ${language} code here\n`}
          rows={12}
          spellCheck={false}
          className="w-full border border-gray-300 rounded-lg p-3 font-mono text-sm focus:ring-2 focus:ring-violet-400 focus:border-transparent resize-y bg-gray-50"
          disabled={running}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {code.split("\n").length} line{code.split("\n").length !== 1 ? "s" : ""}
        </span>
        <button
          onClick={handleRun}
          disabled={running || !code.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {running ? (
            <>
              <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
              Running…
            </>
          ) : (
            "▶ Run & check"
          )}
        </button>
      </div>

      {error && (
        <p className="text-sm text-rose-600 bg-rose-50 rounded-lg px-3 py-2">{error}</p>
      )}

      {/* Test case results */}
      {result && (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          {/* Summary header */}
          <div
            className={`px-4 py-3 border-b flex items-center justify-between ${
              allPassed
                ? "bg-emerald-50 border-emerald-200"
                : "bg-amber-50 border-amber-200"
            }`}
          >
            <span
              className={`text-sm font-medium ${
                allPassed ? "text-emerald-800" : "text-amber-800"
              }`}
            >
              {allPassed
                ? `All ${result.total} test cases passed! 🎉`
                : `${result.passed} of ${result.total} test cases passed`}
            </span>
          </div>

          {/* Per-test breakdown */}
          <div className="divide-y divide-gray-100">
            {result.results.map((tc, i) => {
              const label = testCases[i]?.label ?? `Test ${i + 1}`;
              return (
                <div key={i} className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs font-bold ${
                        tc.passed ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {tc.passed ? "✓" : "✗"}
                    </span>
                    <span className="text-sm font-medium text-gray-700">{label}</span>
                  </div>
                  {!tc.passed && (
                    <div className="mt-1 space-y-1 pl-4">
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Expected:</span>{" "}
                        <code className="bg-gray-100 px-1 rounded">{tc.expected}</code>
                      </div>
                      <div className="text-xs text-gray-500">
                        <span className="font-medium">Your output:</span>{" "}
                        <code className="bg-rose-50 px-1 rounded">
                          {tc.got ?? "(no output)"}
                        </code>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Feedback */}
          {result.feedback && (
            <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-700">{result.feedback}</p>
            </div>
          )}

          <div className="px-4 py-3 border-t border-gray-200">
            <button
              onClick={() => setResult(null)}
              className="text-sm text-violet-600 underline"
            >
              Edit and try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
