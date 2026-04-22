"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const SUBJECTS = [
  "MATH", "SCIENCE", "LITERACY", "CIVICS",
  "COMPUTER_SCIENCE", "ENGINEERING", "ARTS", "PE", "CAREER",
];

type CurriculumItem = {
  id: string;
  contentId: string;
  grade: number;
  subject: string;
  contentType: string;
  status: string;
  payload: any;
  createdAt: string;
};

function statusBadge(status: string, payloadStatus?: string) {
  const s = payloadStatus || status;
  if (s === "published" || s === "APPROVED")
    return <span className="rounded-full bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)] px-2.5 py-0.5 text-[11px]">Approved</span>;
  if (s === "pending_approval" || s === "PENDING_APPROVAL")
    return <span className="rounded-full bg-[var(--ll-yellow-soft)] text-[var(--ll-yellow)] px-2.5 py-0.5 text-[11px]">Pending Approval</span>;
  if (s === "DRAFT" || s === "draft")
    return <span className="rounded-full bg-[var(--ll-surface-muted)]/20 text-[var(--ll-text)] px-2.5 py-0.5 text-[11px]">Draft</span>;
  return <span className="rounded-full bg-[var(--ll-surface-muted)]/20 text-[var(--ll-text-muted)] px-2.5 py-0.5 text-[11px]">{s}</span>;
}

export default function AdminCurriculumPage() {
  const router = useRouter();

  const [mode, setMode] = useState<"lesson" | "term_plan" | "unit_plan" | "full_pack">("lesson");
  const [lessonFormat, setLessonFormat] = useState<"standard" | "block" | "either">("either");
  const [grade, setGrade] = useState(4);
  const [subject, setSubject] = useState("MATH");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    contentId: string;
    title: string;
    objectivesCount: number;
    approvalStatus: string;
    labsCount: number;
  } | null>(null);
  const [items, setItems] = useState<CurriculumItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [expandedLabs, setExpandedLabs] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);

  async function loadItems() {
    setLoadingItems(true);
    try {
      const res = await fetch("/api/curriculum?limit=20", { cache: "no-store" });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      // ignore
    } finally {
      setLoadingItems(false);
    }
  }

  useEffect(() => { loadItems(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const endpoint = mode === "full_pack"
        ? "/api/admin/curriculum/generate-full-pack"
        : "/api/admin/curriculum/generate";
      const payload = mode === "full_pack"
        ? { grade, subject, topic: topic.trim() }
        : { grade, subject, topic: topic.trim(), mode, lessonFormat };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.status === 401 || res.status === 403) { router.push("/login"); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setResult({
        contentId: data.contentId,
        title: data.payloadPreview?.title ?? data.contentId,
        objectivesCount: data.payloadPreview?.objectivesCount ?? 0,
        approvalStatus: data.approvalStatus,
        labsCount: data.labsCount ?? data.packSummary?.labCount ?? 0,
      });
      loadItems();
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(contentId: string) {
    setApproving(contentId);
    try {
      const res = await fetch("/api/admin/curriculum/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Approval failed");
      }
      loadItems();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setApproving(null);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e22,_transparent_60%)]" />

      <div className="mx-auto max-w-4xl px-4 py-6 space-y-8">
        <div>
          <Link href="/admin" className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            &larr; Back to Admin Console
          </Link>
          <h1 className="text-2xl font-bold mt-2">Curriculum &amp; AI Factory</h1>
          <p className="text-sm text-[var(--ll-text-muted)] mt-1">
            Generate AI-powered lessons with labs, aligned to Liberian MOE standards.
            Admin-generated items are auto-approved. Teacher-generated items need approval.
          </p>
          <div className="mt-3">
            <Link
              href="/admin/curriculum/units"
              className="inline-flex rounded-full border border-cyan-500/40 bg-[var(--ll-silver-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-silver)] hover:border-cyan-400 hover:bg-[var(--ll-silver-soft)]"
            >
              Open Unit Assembly
            </Link>
          </div>
        </div>

        {/* Generate form */}
        <form
          onSubmit={handleGenerate}
          className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 space-y-5"
        >
          <h2 className="text-lg font-semibold">Run AI Factory &mdash; Generate Curriculum</h2>

          {/* Mode selector */}
          <div className="flex gap-2">
            {(["lesson", "unit_plan", "term_plan", "full_pack"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-full border px-3 py-1.5 text-xs capitalize ${
                  mode === m
                    ? "border-emerald-400 bg-[var(--ll-yellow)]/20 text-[var(--ll-yellow)]"
                    : "border-[var(--ll-border)] bg-[var(--ll-bg)]/80 text-[var(--ll-text)] hover:border-[var(--ll-border)]"
                }`}
              >
                {m.replace(/_/g, " ")}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-[var(--ll-text-muted)] mb-1">Grade</label>
              <select
                value={grade}
                onChange={(e) => setGrade(Number(e.target.value))}
                className="w-full rounded-lg bg-[var(--ll-bg)] border border-[var(--ll-border)] px-3 py-2 text-sm text-[var(--ll-text)] focus:outline-none focus:border-emerald-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ll-text-muted)] mb-1">Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg bg-[var(--ll-bg)] border border-[var(--ll-border)] px-3 py-2 text-sm text-[var(--ll-text)] focus:outline-none focus:border-emerald-500"
              >
                {SUBJECTS.map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--ll-text-muted)] mb-1">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder='e.g. "Fractions and Mixed Numbers"'
                required
                className="w-full rounded-lg bg-[var(--ll-bg)] border border-[var(--ll-border)] px-3 py-2 text-sm text-[var(--ll-text)] focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {mode === "lesson" && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--ll-text-muted)]">Lesson format</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { value: "standard", label: "Standard Period (45 min)", description: "Generate a single 45-minute lesson." },
                  { value: "block", label: "Block Period (90 min / A-B Day)", description: "Generate a full 90-minute block lesson." },
                  { value: "either", label: "Both formats", description: "Generate both standard and block versions." },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setLessonFormat(option.value as typeof lessonFormat)}
                    className={`rounded-xl border px-4 py-3 text-left transition ${
                      lessonFormat === option.value
                        ? "border-emerald-400 bg-[var(--ll-yellow)]/15 text-[var(--ll-yellow)]"
                        : "border-[var(--ll-border)] bg-[var(--ll-bg)]/80 text-[var(--ll-text)] hover:border-[var(--ll-border)]"
                    }`}
                  >
                    <span className="block text-sm font-semibold">{option.label}</span>
                    <span className="mt-1 block text-xs text-[var(--ll-text-muted)]">{option.description}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !topic.trim()}
            className="rounded-xl bg-[var(--ll-yellow)] px-6 py-3 text-sm font-semibold text-[var(--ll-text-faint)] shadow-lg shadow-emerald-500/30 hover:bg-[var(--ll-yellow-soft)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Running AI Factory..." : `Generate ${mode.replace(/_/g, " ")}`}
          </button>
        </form>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {result && (
          <div className="rounded-xl border border-emerald-500/30 bg-[var(--ll-yellow)]/10 p-5 space-y-3">
            <h2 className="text-lg font-semibold text-[var(--ll-yellow)]">Lesson + Labs Generated</h2>
            <dl className="grid grid-cols-2 gap-2 text-sm text-[var(--ll-text)]">
              <div>
                <dt className="text-xs text-[var(--ll-text-faint)]">Title</dt>
                <dd className="font-medium">{result.title}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--ll-text-faint)]">Content ID</dt>
                <dd className="font-mono text-xs">{result.contentId}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--ll-text-faint)]">Objectives</dt>
                <dd>{result.objectivesCount} learning objectives</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--ll-text-faint)]">Labs</dt>
                <dd>{result.labsCount} lab(s) included</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--ll-text-faint)]">Status</dt>
                <dd>{statusBadge(result.approvalStatus)}</dd>
              </div>
            </dl>
            <Link
              href={`/student/lesson/${result.contentId}`}
              className="inline-block rounded-lg bg-[var(--ll-yellow)] px-4 py-2 text-xs font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)]"
            >
              Preview Lesson
            </Link>
          </div>
        )}

        {/* Curriculum items with approval + labs */}
        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">All Curriculum Items</h2>
            <button onClick={loadItems} className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
              Refresh
            </button>
          </div>

          {loadingItems ? (
            <p className="text-sm text-[var(--ll-text-muted)]">Loading...</p>
          ) : items.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[var(--ll-text-muted)] text-sm">No curriculum yet -- generate one above.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const labs = item.payload?.labs ?? [];
                const isExpanded = expandedLabs === item.contentId;
                const isPending = item.status === "pending_approval" ||
                  item.payload?.approvalStatus === "PENDING_APPROVAL";

                return (
                  <div key={item.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--ll-text)]">
                          {item.payload?.title ?? item.contentId}
                        </p>
                        <p className="text-xs text-[var(--ll-text-muted)] mt-1">
                          Grade {item.grade} - {item.subject} - {item.contentType}
                          {labs.length > 0 && ` - ${labs.length} lab(s)`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {statusBadge(item.status, item.payload?.approvalStatus)}
                        {isPending && (
                          <button
                            onClick={() => handleApprove(item.contentId)}
                            disabled={approving === item.contentId}
                            className="rounded-lg bg-[var(--ll-yellow)] px-3 py-1 text-xs font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-50"
                          >
                            {approving === item.contentId ? "..." : "Approve"}
                          </button>
                        )}
                        {item.contentType === "full_pack" ? (
                          <Link
                            href={`/admin/curriculum/${item.contentId}/review`}
                            className="rounded-lg border border-blue-700 bg-[var(--ll-silver-soft)] px-3 py-1 text-xs text-[var(--ll-silver)] hover:text-[var(--ll-silver)]"
                          >
                            Review Pack
                          </Link>
                        ) : (
                          <Link
                            href={`/student/lesson/${item.contentId}`}
                            className="rounded-lg border border-[var(--ll-border)] px-3 py-1 text-xs text-[var(--ll-text)] hover:text-[var(--ll-text)]"
                          >
                            Preview
                          </Link>
                        )}
                      </div>
                    </div>

                    {/* Labs toggle */}
                    {labs.length > 0 && (
                      <div>
                        <button
                          onClick={() => setExpandedLabs(isExpanded ? null : item.contentId)}
                          className="text-xs text-[var(--ll-silver)] hover:text-[var(--ll-silver)]"
                        >
                          {isExpanded ? "Hide labs" : `Show ${labs.length} lab(s)`}
                        </button>
                        {isExpanded && (
                          <div className="mt-2 space-y-3">
                            {labs.map((lab: any, i: number) => (
                              <div key={lab.id ?? i} className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-3 text-xs space-y-1">
                                <p className="font-semibold text-[var(--ll-text)]">{lab.title}</p>
                                <p className="text-[var(--ll-text-muted)]"><strong>Objective:</strong> {lab.objective}</p>
                                <p className="text-[var(--ll-text-muted)]"><strong>Materials:</strong> {lab.materials?.join(", ")}</p>
                                <div className="text-[var(--ll-text-muted)]">
                                  <strong>Steps:</strong>
                                  <ol className="list-decimal ml-4 mt-1 space-y-0.5">
                                    {lab.steps?.map((s: string, j: number) => <li key={j}>{s}</li>)}
                                  </ol>
                                </div>
                                <p className="text-[var(--ll-text-muted)]"><strong>Assessment:</strong> {lab.assessment}</p>
                                {lab.safetyNotes && (
                                  <p className="text-[var(--ll-yellow)]"><strong>Safety:</strong> {lab.safetyNotes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
