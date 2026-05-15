"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Upload, FileText, ExternalLink } from "lucide-react";

type Submission = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  fileName: string;
  fileSizeBytes: number;
  fileUrl: string;
  status: string;
  moeNotes: string | null;
  submittedAt: string;
  submittedBy: string;
};

const DOC_TYPES = [
  { value: "ENROLLMENT_REPORT", label: "Enrollment Report" },
  { value: "TERM_SUMMARY", label: "Term Summary" },
  { value: "ATTENDANCE_REPORT", label: "Attendance Report" },
  { value: "FINANCIAL_REPORT", label: "Financial Report" },
  { value: "INCIDENT_REPORT", label: "Incident Report" },
  { value: "OTHER", label: "Other" },
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

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="rounded-full bg-[var(--ll-surface-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--ll-text-muted)]">
      {DOC_TYPES.find((t) => t.value === type)?.label ?? type}
    </span>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MoeSubmissionsPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [docType, setDocType] = useState("ENROLLMENT_REPORT");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/moe-submissions");
    if (res.ok) setSubmissions(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) { setError("Please select a PDF file"); return; }
    if (file.type !== "application/pdf") { setError("Only PDF files are accepted"); return; }
    if (file.size > 10 * 1024 * 1024) { setError("File exceeds 10 MB"); return; }

    setSubmitting(true);
    setUploadProgress(10);

    const fd = new FormData();
    fd.append("type", docType);
    fd.append("title", title);
    fd.append("description", description);
    fd.append("file", file);

    try {
      setUploadProgress(40);
      const res = await fetch("/api/admin/moe-submissions", { method: "POST", body: fd });
      setUploadProgress(90);
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Upload failed"); return; }
      setUploadProgress(100);
      setSuccess("Document submitted to MOE successfully.");
      setShowForm(false);
      setTitle(""); setDescription(""); setFile(null); setUploadProgress(0);
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-6">
        <div>
          <Link href="/admin" className="text-xs text-[var(--ll-yellow)] hover:opacity-80">
            <ChevronLeft className="inline h-3 w-3" /> Dashboard
          </Link>
          <div className="mt-2 flex items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold text-[var(--ll-text)]">MOE Submissions</h1>
            <button
              onClick={() => { setShowForm(!showForm); setError(null); setSuccess(null); }}
              className="rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-text)] hover:opacity-90"
            >
              {showForm ? "Cancel" : "New Submission"}
            </button>
          </div>
        </div>

        {success && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-400">
            {success}
          </div>
        )}
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-5 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--ll-text)]">New Document Submission</h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--ll-text-muted)]">Document Type *</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)]"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--ll-text-muted)]">Title *</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Term 1 Enrollment Report 2025-26"
                  className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)] placeholder:text-[var(--ll-text-faint)]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--ll-text-muted)]">Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief description of this document"
                className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)] placeholder:text-[var(--ll-text-faint)] resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--ll-text-muted)]">PDF File * (max 10 MB)</label>
              <div
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-4 hover:border-[var(--ll-border-strong)]"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-5 w-5 shrink-0 text-[var(--ll-text-faint)]" />
                <span className="text-sm text-[var(--ll-text-muted)]">
                  {file ? `${file.name} (${formatBytes(file.size)})` : "Click to select PDF…"}
                </span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="h-1.5 w-full rounded-full bg-[var(--ll-surface-muted)]">
                  <div
                    className="h-1.5 rounded-full bg-[var(--ll-yellow)] transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[var(--ll-yellow)] px-5 py-2 text-sm font-semibold text-[var(--ll-text)] hover:opacity-90 disabled:opacity-40"
            >
              {submitting ? "Uploading…" : "Submit to MOE"}
            </button>
          </form>
        )}

        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)]">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--ll-text-faint)]">Loading…</div>
          ) : submissions.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-[var(--ll-text-faint)]">
              No submissions yet. Click &ldquo;New Submission&rdquo; to upload a document to the MOE.
            </div>
          ) : (
            <div className="ll-scroll-table">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--ll-border)] text-left text-xs text-[var(--ll-text-faint)]">
                    <th className="px-3 py-2.5">Title</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5">Submitted</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">File</th>
                    <th className="px-3 py-2.5">MOE Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((sub) => (
                    <tr key={sub.id} className="border-b border-[var(--ll-border)]/60 text-[var(--ll-text-muted)]">
                      <td className="px-3 py-2.5 font-medium text-[var(--ll-text)]">{sub.title}</td>
                      <td className="px-3 py-2.5"><TypeBadge type={sub.type} /></td>
                      <td className="px-3 py-2.5 text-xs">
                        {new Date(sub.submittedAt).toLocaleDateString("en-LR", {
                          month: "short", day: "numeric", year: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-2.5"><StatusBadge status={sub.status} /></td>
                      <td className="px-3 py-2.5">
                        <a
                          href={sub.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-[var(--ll-yellow)] hover:opacity-80"
                        >
                          <FileText className="h-3 w-3" />
                          {sub.fileName}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </td>
                      <td className="px-3 py-2.5 text-xs max-w-xs">
                        {sub.moeNotes ? (
                          <span className="text-amber-300">{sub.moeNotes}</span>
                        ) : (
                          <span className="text-[var(--ll-text-faint)]">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
