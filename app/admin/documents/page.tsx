"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type Doc = {
  id: string;
  type: string;
  status: string;
  canvaUrl: string | null;
  downloadUrl: string | null;
  createdAt: string;
  student: { id: string; name: string | null } | null;
};

type ClassItem = { id: string; name: string; subject: string };
type Teacher = { id: string; name: string | null };
type Student = { id: string; name: string | null };
type EventItem = { id: string; title: string; type: string };

type ActiveTab =
  | "ID_CARDS"
  | "ENROLLMENT_LETTERS"
  | "TEACHER_APPOINTMENTS"
  | "PERMISSION_SLIPS"
  | "CERTIFICATES";

const TAB_LABELS: Record<ActiveTab, string> = {
  ID_CARDS: "ID Cards",
  ENROLLMENT_LETTERS: "Enrollment Letters",
  TEACHER_APPOINTMENTS: "Teacher Appointments",
  PERMISSION_SLIPS: "Permission Slips",
  CERTIFICATES: "Certificates",
};

const DOC_TYPE_MAP: Record<ActiveTab, string> = {
  ID_CARDS: "STUDENT_ID_CARD",
  ENROLLMENT_LETTERS: "ENROLLMENT_LETTER",
  TEACHER_APPOINTMENTS: "TEACHER_APPOINTMENT",
  PERMISSION_SLIPS: "PERMISSION_SLIP",
  CERTIFICATES: "CERTIFICATE",
};

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: "bg-[var(--ll-surface-muted)] text-[var(--ll-text-muted)]",
    GENERATING: "bg-amber-500/20 text-amber-300",
    COMPLETED: "bg-emerald-500/20 text-emerald-300",
    FAILED: "bg-red-500/20 text-red-300",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[status] ?? colors.PENDING}`}
    >
      {status}
    </span>
  );
}

export default function AdminDocumentsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("ID_CARDS");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Load selectors — gracefully handle missing endpoints
    fetch("/api/admin/classes", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { classes: [] }))
      .then((d) => setClasses(d.classes ?? []))
      .catch(() => null);
    fetch("/api/admin/teachers", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { teachers: [] }))
      .then((d) => setTeachers(d.teachers ?? []))
      .catch(() => null);
    fetch("/api/admin/students", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { students: [] }))
      .then((d) => setStudents(d.students ?? []))
      .catch(() => null);
    fetch("/api/events", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) =>
        setEvents(
          (Array.isArray(d) ? d : d.events ?? []).filter(
            (e: EventItem) => e.type === "TRIP"
          )
        )
      )
      .catch(() => null);
  }, []);

  const loadDocs = useCallback(async (tab: ActiveTab) => {
    setLoading(true);
    try {
      const type = tab === "CERTIFICATES" ? "" : DOC_TYPE_MAP[tab];
      const res = await fetch(
        `/api/admin/documents${type ? `?type=${type}` : ""}`,
        { cache: "no-store" }
      );
      if (res.ok) setDocs(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDocs(activeTab);
  }, [activeTab, loadDocs]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      let endpoint = "";
      let body: Record<string, string> = {};

      if (activeTab === "ID_CARDS") {
        if (!selectedClassId) {
          setError("Select a class");
          return;
        }
        endpoint = "/api/admin/documents/id-cards/generate";
        body = { classId: selectedClassId };
      } else if (activeTab === "ENROLLMENT_LETTERS") {
        if (!selectedStudentId) {
          setError("Select a student");
          return;
        }
        endpoint = "/api/admin/documents/enrollment-letter";
        body = { studentId: selectedStudentId };
      } else if (activeTab === "TEACHER_APPOINTMENTS") {
        if (!selectedTeacherId) {
          setError("Select a teacher");
          return;
        }
        endpoint = "/api/admin/documents/teacher-appointment";
        body = { teacherId: selectedTeacherId };
      } else if (activeTab === "PERMISSION_SLIPS") {
        if (!selectedEventId) {
          setError("Select a TRIP event");
          return;
        }
        endpoint = "/api/admin/documents/permission-slips";
        body = { eventId: selectedEventId };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setSuccess(`Generated ${data.generated ?? 1} document(s)`);
      await loadDocs(activeTab);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to generate");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="ll-page-enter mx-auto max-w-5xl space-y-6">
        <Link
          href="/admin/dashboard"
          className="inline-flex items-center gap-1 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-yellow)] mb-4 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Dashboard
        </Link>
        <h1 className="text-2xl font-bold text-[var(--ll-text)]">Documents</h1>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(TAB_LABELS) as ActiveTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold border transition ${
                activeTab === tab
                  ? "bg-[var(--ll-yellow)] text-[var(--ll-bg)] border-transparent"
                  : "border-[var(--ll-border)] text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>

        {activeTab !== "CERTIFICATES" && (
          <div className="ll-section p-4 space-y-3">
            <p className="text-sm font-semibold text-[var(--ll-text)]">
              Generate {TAB_LABELS[activeTab]}
            </p>
            {activeTab === "ID_CARDS" && (
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] px-3 py-2 text-sm text-[var(--ll-text)]"
              >
                <option value="">Select class...</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} — {c.subject}
                  </option>
                ))}
              </select>
            )}
            {activeTab === "ENROLLMENT_LETTERS" && (
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] px-3 py-2 text-sm text-[var(--ll-text)]"
              >
                <option value="">Select student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name ?? s.id}
                  </option>
                ))}
              </select>
            )}
            {activeTab === "TEACHER_APPOINTMENTS" && (
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] px-3 py-2 text-sm text-[var(--ll-text)]"
              >
                <option value="">Select teacher...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name ?? t.id}
                  </option>
                ))}
              </select>
            )}
            {activeTab === "PERMISSION_SLIPS" && (
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)] px-3 py-2 text-sm text-[var(--ll-text)]"
              >
                <option value="">Select TRIP event...</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.title}
                  </option>
                ))}
              </select>
            )}
            {error && <p className="text-xs text-red-400">{error}</p>}
            {success && <p className="text-xs text-emerald-400">{success}</p>}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-bg)] disabled:opacity-50"
            >
              {generating ? "Generating..." : `Generate ${TAB_LABELS[activeTab]}`}
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 animate-pulse rounded-xl bg-[var(--ll-surface)]"
              />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <p className="text-sm text-[var(--ll-text-muted)]">No documents yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--ll-border)]">
            <table className="w-full text-sm">
              <thead className="border-b border-[var(--ll-border)] bg-[var(--ll-surface)]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--ll-text-faint)]">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--ll-text-faint)]">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--ll-text-faint)]">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--ll-text-faint)]">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--ll-text-faint)]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--ll-border)]">
                {docs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="bg-[var(--ll-surface)] hover:bg-[var(--ll-surface-muted)]"
                  >
                    <td className="px-4 py-3 text-[var(--ll-text)]">
                      {doc.student?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-[var(--ll-text-muted)]">
                      {doc.type.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={doc.status} />
                    </td>
                    <td className="px-4 py-3 text-[var(--ll-text-faint)] text-xs">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {doc.downloadUrl ? (
                        <a
                          href={doc.downloadUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-[var(--ll-yellow)] hover:underline"
                        >
                          Download
                        </a>
                      ) : (
                        "—"
                      )}
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
