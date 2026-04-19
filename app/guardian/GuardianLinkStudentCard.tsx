"use client";

import { useState } from "react";

type Match = {
  confirmToken: string;
  firstName: string;
  gradeLabel: string | null;
  schoolName: string;
};

export default function GuardianLinkStudentCard({
  prominent = false,
  onLinked,
}: {
  prominent?: boolean;
  onLinked?: () => void;
}) {
  const [form, setForm] = useState({
    studentFullName: "",
    dateOfBirth: "",
    schoolCode: "",
    relation: "Guardian",
  });
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedToken, setSelectedToken] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(confirmToken?: string) {
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/guardian/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          confirmToken,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Unable to find student.");
      if (data.linked) {
        setStatus(`Your child is now linked to your account.`);
        setMatches([]);
        setSelectedToken("");
        onLinked?.();
        return;
      }
      const nextMatches = Array.isArray(data.matches) ? data.matches : [];
      setMatches(nextMatches);
      setSelectedToken(nextMatches[0]?.confirmToken ?? "");
      setStatus(nextMatches.length === 0 ? "No matching student found. Check the name, date of birth, and school code." : null);
    } catch (error: any) {
      setStatus(error?.message ?? "Unable to link student.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`rounded-3xl border p-5 ${prominent ? "border-purple-400/30 bg-purple-500/10" : "border-white/10 bg-slate-900/70"}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-200">
            Link to a student
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Find your child</h2>
          <p className="mt-1 text-sm text-slate-300">
            Enter the details exactly as the school has them, then confirm the match before linking.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label>
          <span className="text-xs text-slate-400">Student full name</span>
          <input
            value={form.studentFullName}
            onChange={(event) => setForm((current) => ({ ...current, studentFullName: event.target.value }))}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100"
          />
        </label>
        <label>
          <span className="text-xs text-slate-400">Date of birth</span>
          <input
            type="date"
            value={form.dateOfBirth}
            onChange={(event) => setForm((current) => ({ ...current, dateOfBirth: event.target.value }))}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100"
          />
        </label>
        <label>
          <span className="text-xs text-slate-400">School code</span>
          <input
            value={form.schoolCode}
            onChange={(event) => setForm((current) => ({ ...current, schoolCode: event.target.value.toUpperCase() }))}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100"
          />
        </label>
        <label>
          <span className="text-xs text-slate-400">Relationship</span>
          <input
            value={form.relation}
            onChange={(event) => setForm((current) => ({ ...current, relation: event.target.value }))}
            className="mt-1 min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-slate-100"
          />
        </label>
      </div>

      {matches.length > 0 ? (
        <div className="mt-5 space-y-3">
          <p className="text-sm font-semibold text-slate-100">Confirm the student to link</p>
          {matches.map((match) => (
            <label key={match.confirmToken} className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-950/70 p-3">
              <input
                type="radio"
                name="student-match"
                checked={selectedToken === match.confirmToken}
                onChange={() => setSelectedToken(match.confirmToken)}
                className="h-5 w-5"
              />
              <span className="text-sm text-slate-100">
                {match.firstName} {match.gradeLabel ? `(${match.gradeLabel})` : ""} - {match.schoolName}
              </span>
            </label>
          ))}
        </div>
      ) : null}

      {status ? <p className="mt-4 text-sm text-slate-200">{status}</p> : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => submit()}
          disabled={busy}
          className="ll-touch-target rounded-2xl bg-purple-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-60"
        >
          {busy ? "Checking..." : "Find student"}
        </button>
        {matches.length > 0 ? (
          <button
            type="button"
            onClick={() => submit(selectedToken)}
            disabled={busy || !selectedToken}
            className="ll-touch-target rounded-2xl border border-purple-300/40 px-5 py-3 text-sm font-semibold text-purple-100 disabled:opacity-60"
          >
            Confirm and link
          </button>
        ) : null}
      </div>
    </section>
  );
}
