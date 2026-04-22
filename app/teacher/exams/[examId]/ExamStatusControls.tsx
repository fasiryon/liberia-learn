"use client";

import { useRouter } from "next/navigation";

export default function ExamStatusControls({ examId, isAdmin, status }: { examId: string; isAdmin: boolean; status: string }) {
  const router = useRouter();

  async function call(url: string, method: string, body?: unknown) {
    const response = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error ?? "Request failed");
    }
    router.refresh();
  }

  if (!isAdmin) {
    return <div className="rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm text-[var(--ll-text-muted)]">Admin controls only</div>;
  }

  return (
    <div className="flex flex-wrap gap-3">
      {status !== "PUBLISHED" ? (
        <button type="button" onClick={() => void call(`/api/admin/exams/${examId}/publish`, "POST")} className="rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)]">
          Publish
        </button>
      ) : null}
      {status !== "CLOSED" ? (
        <button type="button" onClick={() => void call(`/api/admin/exams/${examId}`, "PATCH", { status: "CLOSED" })} className="rounded-xl border border-[var(--ll-border)] px-4 py-2 text-sm">
          Close
        </button>
      ) : null}
    </div>
  );
}
