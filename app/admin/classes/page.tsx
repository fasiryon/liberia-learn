"use client";

import { useEffect, useState } from "react";

type Subject =
  | "MATH"
  | "SCIENCE"
  | "COMPUTER_SCIENCE"
  | "ENGINEERING"
  | "LITERACY"
  | "CIVICS"
  | "ARTS"
  | "PE"
  | "CAREER";

type ClassRow = { id: string; name: string; createdAt: string; schoolId: string; subject: Subject; teacherId: string | null };

const SUBJECTS: { value: Subject; label: string }[] = [
  { value: "MATH", label: "Math" },
  { value: "SCIENCE", label: "Science" },
  { value: "COMPUTER_SCIENCE", label: "Computer Science" },
  { value: "ENGINEERING", label: "Engineering" },
  { value: "LITERACY", label: "Literacy" },
  { value: "CIVICS", label: "Civics" },
  { value: "ARTS", label: "Arts" },
  { value: "PE", label: "PE" },
  { value: "CAREER", label: "Career" },
];

export default function AdminClassesPage() {
  const [name, setName] = useState("Grade 4 - A");
  const [subject, setSubject] = useState<Subject>("MATH");
  const [status, setStatus] = useState<string | null>(null);
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setStatus(null);
    const res = await fetch("/api/admin/classes", { method: "GET" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data?.error ? `Error: ${data.error}` : "Error loading classes");
      return;
    }
    setRows(data?.classes ?? []);
  }

  useEffect(() => { load(); }, []);

  async function create() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus(data?.error ? `Error: ${data.error}` : "Error creating class");
        return;
      }
      setStatus(`✅ Created class "${data.class?.name}" (${data.class?.subject}) (id: ${data.class?.id})`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#05060a] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold">Admin • Classes</h1>
        <p className="text-white/60 mt-1">Create at least one class so Homework can be tenant-scoped.</p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <label className="grid gap-1">
            <span className="text-sm text-white/80">Class name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-xl bg-[#0b0d14] border border-white/10 px-3 py-2 outline-none focus:border-emerald-500"
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm text-white/80">Subject</span>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value as Subject)}
              className="rounded-xl bg-[#0b0d14] border border-white/10 px-3 py-2 outline-none focus:border-emerald-500"
            >
              {SUBJECTS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </label>

          <button
            onClick={create}
            disabled={busy}
            className="rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black font-semibold px-4 py-3"
          >
            {busy ? "..." : "Create Class"}
          </button>

          {status && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm whitespace-pre-wrap">
              {status}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-white/80 font-semibold mb-2">Existing classes</div>
          {rows.length === 0 ? (
            <div className="text-white/60 text-sm">No classes yet.</div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div key={r.id} className="rounded-xl border border-white/10 bg-[#0b0d14] p-3 text-sm">
                  <div className="text-white/90">
                    {r.name} <span className="text-white/50">({r.subject})</span>
                  </div>
                  <div className="text-white/60 text-xs">id: {r.id}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 text-xs text-white/60">
          Next: use the newest classId above to run the Homework Create tenant test.
        </div>
      </div>
    </main>
  );
}
