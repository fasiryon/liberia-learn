"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignoffPage({ params }: { params: { changeRequestId: string } }) {
  const router = useRouter();
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/ops/optimization/change-requests/${params.changeRequestId}/signoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, comment: comment || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to record sign-off");
      } else {
        router.push(`/admin/ops/optimization/change-requests/${params.changeRequestId}`);
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-6 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-xl space-y-6">
        <header>
          <p className="text-sm font-semibold uppercase text-[var(--ll-text-muted)]">Reviewer Sign-Off</p>
          <h1 className="text-2xl font-semibold">Record Your Sign-Off</h1>
        </header>
        <form onSubmit={submit} className="space-y-4 rounded border bg-[var(--ll-surface)] p-6">
          <div className="space-y-1">
            <label className="text-sm font-medium">Decision</label>
            <select value={decision} onChange={(e) => setDecision(e.target.value as any)} className="w-full rounded border px-3 py-2 text-sm bg-[var(--ll-bg)]">
              <option value="APPROVED">Approve</option>
              <option value="REJECTED">Reject</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">Comment (optional)</label>
            <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} className="w-full rounded border px-3 py-2 text-sm bg-[var(--ll-bg)]" placeholder="Add reasoning or concerns..." />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={submitting} className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-60">
              {submitting ? "Submitting..." : "Submit Sign-Off"}
            </button>
            <button type="button" onClick={() => router.back()} className="rounded border px-4 py-2 text-sm hover:bg-[var(--ll-bg)]">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
