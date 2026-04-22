"use client";

import { useState, useEffect, FormEvent } from "react";

type Student = { id: string; name: string; email: string };
type GuardianLink = {
  id: string;
  studentName: string;
  studentEmail: string;
  guardianName: string;
  guardianEmail: string;
  guardianPhone: string | null;
  preferredChannel: string;
  smsOptIn: boolean;
  relation: string | null;
};

export default function GuardianLinkPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [links, setLinks] = useState<GuardianLink[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [studentId, setStudentId] = useState("");
  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianName, setGuardianName] = useState("");
  const [relation, setRelation] = useState("");
  const [guardianCountryCode, setGuardianCountryCode] = useState("+231");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [preferredChannel, setPreferredChannel] = useState("EMAIL");
  const [smsOptIn, setSmsOptIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/admin/students").then((r) => r.json()),
      fetch("/api/admin/guardian-link").then((r) => r.json()),
    ])
      .then(([s, l]) => {
        setStudents(s.students ?? []);
        setLinks(l.links ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/guardian-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId, guardianEmail, guardianName, relation, guardianPhone: guardianPhone || undefined, guardianCountryCode, preferredChannel, smsOptIn }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to link guardian");
      } else {
        setSuccess(data.inviteUrl);
        setGuardianEmail("");
        setGuardianName("");
        setRelation("");
        setGuardianPhone("");
        setSmsOptIn(false);
        loadData();
      }
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)] px-4 py-8 sm:px-8">
      <div className="mx-auto max-w-4xl space-y-8">
        <h1 className="text-2xl font-bold tracking-tight">Guardian Links</h1>

        {/* Form */}
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-6">
          <h2 className="mb-4 text-sm font-semibold text-[var(--ll-text)]">
            Link a Guardian to a Student
          </h2>
          <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--ll-text-muted)]">
                Student
              </label>
              <select
                required
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-2 text-sm text-[var(--ll-text)] outline-none focus:border-emerald-400"
              >
                <option value="">Select student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.email})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--ll-text-muted)]">
                Guardian Email
              </label>
              <input
                required
                type="email"
                value={guardianEmail}
                onChange={(e) => setGuardianEmail(e.target.value)}
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-2 text-sm text-[var(--ll-text)] outline-none placeholder:text-[var(--ll-text-faint)] focus:border-emerald-400"
                placeholder="guardian@example.com"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--ll-text-muted)]">
                Guardian Name
              </label>
              <input
                type="text"
                value={guardianName}
                onChange={(e) => setGuardianName(e.target.value)}
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-2 text-sm text-[var(--ll-text)] outline-none placeholder:text-[var(--ll-text-faint)] focus:border-emerald-400"
                placeholder="Optional"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--ll-text-muted)]">
                Relation
              </label>
              <input
                type="text"
                value={relation}
                onChange={(e) => setRelation(e.target.value)}
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-2 text-sm text-[var(--ll-text)] outline-none placeholder:text-[var(--ll-text-faint)] focus:border-emerald-400"
                placeholder="e.g. Mother, Father, Uncle"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--ll-text-muted)]">
                Country Code
              </label>
              <input
                type="text"
                value={guardianCountryCode}
                onChange={(e) => setGuardianCountryCode(e.target.value)}
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-2 text-sm text-[var(--ll-text)] outline-none placeholder:text-[var(--ll-text-faint)] focus:border-emerald-400"
                placeholder="+231"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--ll-text-muted)]">
                Phone Number
              </label>
              <input
                type="tel"
                value={guardianPhone}
                onChange={(e) => setGuardianPhone(e.target.value)}
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-2 text-sm text-[var(--ll-text)] outline-none placeholder:text-[var(--ll-text-faint)] focus:border-emerald-400"
                placeholder="077XXXXXXX"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-medium text-[var(--ll-text-muted)]">
                Preferred Channel
              </label>
              <select
                value={preferredChannel}
                onChange={(e) => setPreferredChannel(e.target.value)}
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 px-3 py-2 text-sm text-[var(--ll-text)] outline-none focus:border-emerald-400"
              >
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="BOTH">Both</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                checked={smsOptIn}
                onChange={(e) => setSmsOptIn(e.target.checked)}
                className="h-4 w-4 rounded border-[var(--ll-border)] bg-[var(--ll-bg)] text-[var(--ll-yellow)]"
              />
              <label className="text-xs text-[var(--ll-text-muted)]">SMS Opt-In</label>
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[var(--ll-yellow)] px-6 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] shadow-lg shadow-emerald-500/40 hover:bg-[var(--ll-yellow-soft)] disabled:opacity-60"
              >
                {submitting ? "Linking..." : "Link Guardian"}
              </button>
            </div>
          </form>

          {error && (
            <p className="mt-4 text-xs text-red-400 bg-red-950/40 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          {success && (
            <div className="mt-4 rounded-lg border border-emerald-800 bg-[var(--ll-yellow-soft)] px-3 py-2">
              <p className="text-xs text-[var(--ll-yellow)]">Invite created. Share this link:</p>
              <p className="mt-1 break-all text-xs text-[var(--ll-text)] font-mono">
                {success}
              </p>
            </div>
          )}
        </div>

        {/* Existing links table */}
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/60 p-6">
          <h2 className="mb-4 text-sm font-semibold text-[var(--ll-text)]">
            Existing Guardian Links
          </h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
            </div>
          ) : links.length === 0 ? (
            <p className="py-8 text-center text-sm text-[var(--ll-text-faint)]">
              No guardian links yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--ll-border)] text-[var(--ll-text-muted)]">
                    <th className="pb-2 pr-4">Student</th>
                    <th className="pb-2 pr-4">Guardian</th>
                    <th className="pb-2 pr-4">Email</th>
                    <th className="pb-2 pr-4">Phone</th>
                    <th className="pb-2 pr-4">Channel</th>
                    <th className="pb-2">Relation</th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((l) => (
                    <tr key={l.id} className="border-b border-[var(--ll-border)]/50">
                      <td className="py-2 pr-4 text-[var(--ll-text)]">
                        {l.studentName}
                      </td>
                      <td className="py-2 pr-4 text-[var(--ll-text)]">
                        {l.guardianName}
                      </td>
                      <td className="py-2 pr-4 text-[var(--ll-text-muted)]">
                        {l.guardianEmail}
                      </td>
                      <td className="py-2 pr-4 text-[var(--ll-text-muted)]">
                        {l.guardianPhone ?? "-"}
                      </td>
                      <td className="py-2 pr-4 text-[var(--ll-text-muted)]">
                        {l.preferredChannel ?? "EMAIL"}
                      </td>
                      <td className="py-2 text-[var(--ll-text-muted)]">
                        {l.relation ?? "-"}
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
  );
}
