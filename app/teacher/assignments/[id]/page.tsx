"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type SmsSessionRow = {
  id: string;
  studentPhone: string;
  studentId: string | null;
  score: number;
  total: number;
  status: "ACTIVE" | "COMPLETE" | "EXPIRED";
  expiresAt: string;
  createdAt: string;
};

type StudentRow = {
  id: string;
  name: string | null;
  phone: string | null;
};

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [sessions, setSessions] = useState<SmsSessionRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [sending, setSending] = useState<Record<string, boolean>>({});
  const [phoneOverride, setPhoneOverride] = useState<Record<string, string>>({});

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch(`/api/teacher/assignments/${id}/sms-status`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions ?? []);
      }
    } finally {
      setLoadingSessions(false);
    }
  }, [id]);

  useEffect(() => {
    loadSessions();

    // Load students in class via existing assignments API
    fetch(`/api/teacher/classes/students?assignmentId=${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.students) setStudents(d.students);
      })
      .catch(() => null);
  }, [id, loadSessions]);

  async function sendSms(studentId: string, phone: string, name: string) {
    setSending((p) => ({ ...p, [studentId]: true }));
    try {
      const res = await fetch(`/api/teacher/assignments/${id}/sms-send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          studentId,
          studentPhone: phone,
          // Questions array must be built from assignment data in a full implementation.
          // For now, prompt teacher to ensure the assignment has MCQ questions set up.
          questions: [],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Failed to send SMS");
      } else if (!data.sent) {
        alert("SMS provider unavailable — check AT_API_KEY env var.");
      } else {
        alert(`SMS quiz sent to ${name} (${phone})`);
        await loadSessions();
      }
    } finally {
      setSending((p) => ({ ...p, [studentId]: false }));
    }
  }

  function statusBadge(status: SmsSessionRow["status"]) {
    const cls =
      status === "COMPLETE"
        ? "bg-emerald-500/20 text-emerald-300"
        : status === "ACTIVE"
          ? "bg-amber-500/20 text-amber-300"
          : "bg-red-500/20 text-red-300";
    return (
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${cls}`}>{status}</span>
    );
  }

  return (
    <main className="ll-dashboard-shell px-4 py-5">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/teacher/assignments" className="text-xs text-[var(--ll-yellow)]">
          &larr; Assignments
        </Link>

        {/* SMS Delivery Section */}
        <div className="ll-section p-5 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--ll-text)]">SMS Delivery</h2>
            <p className="text-xs text-[var(--ll-text-muted)]">
              Send this assignment as an SMS quiz to students with feature phones.
            </p>
          </div>

          {/* Student list with send buttons */}
          {students.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-[var(--ll-text-muted)]">
                    <th className="pb-2 pr-4">Student</th>
                    <th className="pb-2 pr-4">Phone</th>
                    <th className="pb-2">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ll-border)]">
                  {students.map((s) => {
                    const phone = phoneOverride[s.id] ?? s.phone ?? "";
                    return (
                      <tr key={s.id}>
                        <td className="py-2 pr-4 text-[var(--ll-text)]">{s.name ?? s.id}</td>
                        <td className="py-2 pr-4">
                          <input
                            type="tel"
                            value={phone}
                            onChange={(e) =>
                              setPhoneOverride((p) => ({ ...p, [s.id]: e.target.value }))
                            }
                            placeholder="+2310XXXXXXX"
                            className="w-40 rounded border border-[var(--ll-border)] bg-[var(--ll-surface)] px-2 py-1 text-xs text-[var(--ll-text)] placeholder-[var(--ll-text-muted)]"
                          />
                        </td>
                        <td className="py-2">
                          <button
                            type="button"
                            disabled={!phone || sending[s.id]}
                            onClick={() => sendSms(s.id, phone, s.name ?? s.id)}
                            className="rounded bg-[var(--ll-yellow)] px-3 py-1 text-xs font-semibold text-[var(--ll-bg)] disabled:opacity-40"
                          >
                            {sending[s.id] ? "Sending…" : "Send Quiz"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {students.length === 0 && (
            <p className="text-xs text-[var(--ll-text-muted)]">
              No student data available. Students will appear here once loaded.
            </p>
          )}

          {/* Session status */}
          <div>
            <h3 className="mb-2 text-sm font-semibold text-[var(--ll-text)]">SMS Session Status</h3>
            {loadingSessions ? (
              <div className="h-10 animate-pulse rounded bg-[var(--ll-surface)]" />
            ) : sessions.length === 0 ? (
              <p className="text-xs text-[var(--ll-text-muted)]">No SMS sessions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-[var(--ll-text-muted)]">
                      <th className="pb-2 pr-4">Phone</th>
                      <th className="pb-2 pr-4">Score</th>
                      <th className="pb-2 pr-4">Status</th>
                      <th className="pb-2">Sent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--ll-border)]">
                    {sessions.map((s) => (
                      <tr key={s.id}>
                        <td className="py-2 pr-4 font-mono">{s.studentPhone}</td>
                        <td className="py-2 pr-4">
                          {s.status === "COMPLETE" ? `${s.score}/${s.total}` : `${s.score}/${s.total}`}
                        </td>
                        <td className="py-2 pr-4">{statusBadge(s.status)}</td>
                        <td className="py-2 text-[var(--ll-text-muted)]">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
