"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ExternalLink, FileText } from "lucide-react";

type Submission = {
  id: string;
  schoolId: string;
  schoolName: string;
  submittedBy: string;
  type: string;
  title: string;
  description: string | null;
  fileName: string;
  fileSizeBytes: number;
  fileUrl: string;
  status: string;
  moeNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  submittedAt: string;
};

const DOC_TYPES = [
  { value: "", label: "All Types" },
  { value: "ENROLLMENT_REPORT", label: "Enrollment Report" },
  { value: "TERM_SUMMARY", label: "Term Summary" },
  { value: "ATTENDANCE_REPORT", label: "Attendance Report" },
  { value: "FINANCIAL_REPORT", label: "Financial Report" },
  { value: "INCIDENT_REPORT", label: "Incident Report" },
  { value: "OTHER", label: "Other" },
];

const STATUSES = [
  { value: "", label: "All Statuses" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "UNDER_REVIEW", label: "Under Review" },
  { value: "ACKNOWLEDGED", label: "Acknowledged" },
  { value: "RETURNED", label: "Returned" },
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    SUBMITTED: "bg-blue-500/20 text-blue-300",
    UNDER_REVIEW: "bg-amber-500/20 text-amber-300",
    ACKNOWLEDGED: "bg-emerald-500/20 text-emerald-300",
    RETURNED: "bg-red-500/20 text-red-300",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${map[status] ?? map.SUBMITTED}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function MoeSubmissionsPortalPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("");
  const [schools, setSchools] = useState<{ id: string; name: string }[]>([]);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [returnNotes, setReturnNotes] = useState<Record<string, string>>({});
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (schoolFilter) params.set("schoolId", schoolFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (statusFilter) params.set("status", statusFilter);
    const res = await fetch(`/api/moe/submissions?${params}`);
    if (res.ok) {
      const data: Submission[] = await res.json();
      setSubmissions(data);
      const seen = new Set<string>();
      setSchools(data.reduce((acc, s) => {
        if (!seen.has(s.schoolId)) { seen.add(s.schoolId); acc.push({ id: s.schoolId, name: s.schoolName }); }
        return acc;
      }, [] as { id: string; name: string }[]));
    }
    setLoading(false);
  }, [schoolFilter, typeFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

  async function review(id: string, status: string, moeNotes?: string) {
    setReviewingId(id);
    setActionMsg(null);
    const res = await fetch(`/api/moe/submissions/${id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, moeNotes }),
    });
    const data = await res.json();
    if (res.ok) {
      setActionMsg("Status updated.");
      await load();
    } else {
      setActionMsg(data.error ?? "Update failed");
    }
    setReviewingId(null);
  }

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-6xl space-y-6">
        <div>
          <Link href="/moe/dashboard" className="text-xs text-[var(--ll-yellow)] hover:opacity-80">
            <ChevronLeft className="inline h-3 w-3" /> Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--ll-text)]">School Submissions</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Review documents submitted by schools to the Ministry of Education.
          </p>
        </div>

        {actionMsg && (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-3 text-sm text-[var(--ll-text-muted)]">
            {actionMsg}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={schoolFilter}
            onChange={(e) => setSchoolFilter(e.target.value)}
            className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
          >
            <option value="">All Schools</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
          >
            {DOC_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
          >
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>

        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)]">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--ll-text-faint)]">Loading…</div>
          ) : submissions.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--ll-text-faint)]">No submissions match the current filters.</div>
          ) : (
            <div className="divide-y divide-[var(--ll-border)]">
              {submissions.map((sub) => (
                <div key={sub.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm text-[var(--ll-text)]">{sub.title}</span>
                        <StatusBadge status={sub.status} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-[var(--ll-text-faint)]">
                        <span>{sub.schoolName}</span>
                        <span>·</span>
                        <span>{sub.type.replace(/_/g, " ")}</span>
                        <span>·</span>
                        <span>{new Date(sub.submittedAt).toLocaleDateString("en-LR", { month: "short", day: "numeric", year: "numeric" })}</span>
                        <span>·</span>
                        <span>by {sub.submittedBy}</span>
                      </div>
                      {sub.description && (
                        <p className="text-xs text-[var(--ll-text-muted)]">{sub.description}</p>
                      )}
                      {sub.moeNotes && (
                        <p className="text-xs text-amber-300">MOE Notes: {sub.moeNotes}</p>
                      )}
                    </div>
                    <a
                      href={sub.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 rounded-lg border border-[var(--ll-border)] px-3 py-1.5 text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      Download
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Actions */}
                  {sub.status !== "ACKNOWLEDGED" && (
                    <div className="flex flex-wrap items-start gap-2 pt-1">
                      {sub.status !== "UNDER_REVIEW" && (
                        <button
                          onClick={() => review(sub.id, "UNDER_REVIEW")}
                          disabled={reviewingId === sub.id}
                          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/20 disabled:opacity-40"
                        >
                          Mark Under Review
                        </button>
                      )}
                      <button
                        onClick={() => review(sub.id, "ACKNOWLEDGED")}
                        disabled={reviewingId === sub.id}
                        className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-40"
                      >
                        Acknowledge
                      </button>
                      <div className="flex items-start gap-2 w-full sm:w-auto">
                        <textarea
                          rows={1}
                          placeholder="Return note (required)…"
                          value={returnNotes[sub.id] ?? ""}
                          onChange={(e) => setReturnNotes((prev) => ({ ...prev, [sub.id]: e.target.value }))}
                          className="flex-1 min-w-[180px] rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-2 py-1.5 text-xs text-[var(--ll-text)] resize-none"
                        />
                        <button
                          onClick={() => review(sub.id, "RETURNED", returnNotes[sub.id])}
                          disabled={reviewingId === sub.id || !returnNotes[sub.id]?.trim()}
                          className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20 disabled:opacity-40"
                        >
                          Return
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
