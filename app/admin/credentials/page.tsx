"use client";

import { useEffect, useState, useCallback } from "react";

type CredentialRow = {
  id: string;
  studentName: string;
  grade: string;
  term: string;
  avgScore: number;
  attendance: number;
  lessonsComplete: number;
  blobUrl: string | null;
  verifyToken: string;
  generatedAt: string;
  expiresAt: string;
};

export default function AdminCredentialsPage() {
  const [credentials, setCredentials] = useState<CredentialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ generated: number; failed: string[]; total: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/credentials");
      if (res.ok) {
        const data = await res.json();
        setCredentials(data.credentials ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleBulkGenerate() {
    if (!confirm("Generate transcripts for all students in this school?")) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/credentials/bulk-generate", { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setResult(data);
        await load();
      } else {
        alert("Bulk generation failed");
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate(studentId: string) {
    // For individual regen, POST to student generate on behalf of admin
    try {
      const res = await fetch("/api/admin/credentials/bulk-generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ studentId }),
      });
      if (res.ok) await load();
    } catch {
      alert("Failed to regenerate");
    }
  }

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--ll-text)]">Student Transcripts</h1>
            <p className="text-sm text-[var(--ll-text-muted)]">
              Generate QR-verifiable PDF transcripts for end-of-term distribution.
            </p>
          </div>
          <button
            type="button"
            onClick={handleBulkGenerate}
            disabled={generating}
            className="rounded-xl bg-[var(--ll-yellow)] px-5 py-2 text-sm font-semibold text-[var(--ll-bg)] disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate All Transcripts"}
          </button>
        </div>

        {result && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4 text-sm">
            <p className="font-semibold text-[var(--ll-text)]">
              Generated {result.generated}/{result.total}
            </p>
            {result.failed.length > 0 && (
              <p className="mt-1 text-xs text-red-400">
                {result.failed.length} failed: {result.failed.slice(0, 5).join(", ")}
                {result.failed.length > 5 ? "…" : ""}
              </p>
            )}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-[var(--ll-surface)]" />
            ))}
          </div>
        ) : credentials.length === 0 ? (
          <p className="text-sm text-[var(--ll-text-muted)]">
            No transcripts generated yet. Click &ldquo;Generate All Transcripts&rdquo; to issue them.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--ll-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--ll-surface)]">
                <tr>
                  {["Student", "Grade", "Term", "Avg Score", "Attendance", "Lessons", "Actions"].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ll-text-muted)]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {credentials.map((c) => (
                  <tr key={c.id} className="border-t border-[var(--ll-border)]">
                    <td className="px-4 py-3 font-medium">{c.studentName}</td>
                    <td className="px-4 py-3 text-[var(--ll-text-muted)]">{c.grade}</td>
                    <td className="px-4 py-3">{c.term}</td>
                    <td className="px-4 py-3">{Math.round(c.avgScore)}%</td>
                    <td className="px-4 py-3">{Math.round(c.attendance)}%</td>
                    <td className="px-4 py-3">{c.lessonsComplete}</td>
                    <td className="px-4 py-3 flex items-center gap-2">
                      {c.blobUrl && (
                        <a
                          href={c.blobUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[var(--ll-yellow)] hover:underline"
                        >
                          Download
                        </a>
                      )}
                      <a
                        href={`/credential/${c.verifyToken}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
                      >
                        Verify
                      </a>
                      <button
                        type="button"
                        onClick={() => handleRegenerate(c.id)}
                        className="text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
                      >
                        Regenerate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
