"use client";

import { useState } from "react";
import Link from "next/link";

const SCHOOL_TYPES = ["Public", "Private", "Mission", "Community"] as const;
const LIBERIAN_COUNTIES = [
  "Bomi",
  "Bong",
  "Gbarpolu",
  "Grand Bassa",
  "Grand Cape Mount",
  "Grand Gedeh",
  "Grand Kru",
  "Lofa",
  "Margibi",
  "Maryland",
  "Montserrado",
  "Nimba",
  "River Cess",
  "River Gee",
  "Sinoe",
] as const;

export default function SchoolEnrollmentPage() {
  const [form, setForm] = useState({
    schoolName: "",
    county: "Montserrado",
    district: "",
    schoolType: "Public",
    principalFullName: "",
    email: "",
    phone: "",
    estimatedStudentEnrollment: "100",
  });
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch("/api/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          estimatedStudentEnrollment: Number(form.estimatedStudentEnrollment),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Enrollment failed");
      setStatus(`Request submitted. Login ID: ${data.loginId}. Temporary password: ${data.temporaryPassword}`);
    } catch (error: any) {
      setStatus(error.message || "Enrollment failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Link href="/" className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">
          Back to LiberiaLearn
        </Link>
        <section className="mt-4 rounded-3xl border border-white/10 bg-slate-900/80 p-5 shadow-xl shadow-black/30">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
            School enrollment
          </p>
          <h1 className="mt-2 text-3xl font-bold">Enroll your school</h1>
          <p className="mt-2 text-sm text-slate-300">
            Submit your school details for platform-admin approval. The principal account is created immediately but can sign in only after approval.
          </p>

          <form onSubmit={submit} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="text-xs text-slate-400">School name</span>
              <input required value={form.schoolName} onChange={(e) => setForm({ ...form, schoolName: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" />
            </label>
            <label>
              <span className="text-xs text-slate-400">County</span>
              <select value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm">
                {LIBERIAN_COUNTIES.map((county) => <option key={county}>{county}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs text-slate-400">District</span>
              <input required value={form.district} onChange={(e) => setForm({ ...form, district: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" />
            </label>
            <label>
              <span className="text-xs text-slate-400">School type</span>
              <select value={form.schoolType} onChange={(e) => setForm({ ...form, schoolType: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm">
                {SCHOOL_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs text-slate-400">Estimated students</span>
              <input required type="number" min="1" value={form.estimatedStudentEnrollment} onChange={(e) => setForm({ ...form, estimatedStudentEnrollment: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" />
            </label>
            <label className="sm:col-span-2">
              <span className="text-xs text-slate-400">Principal full name</span>
              <input required value={form.principalFullName} onChange={(e) => setForm({ ...form, principalFullName: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" />
            </label>
            <label>
              <span className="text-xs text-slate-400">Principal email</span>
              <input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" />
            </label>
            <label>
              <span className="text-xs text-slate-400">Principal phone</span>
              <input required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" />
            </label>
            <button disabled={busy} className="sm:col-span-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 disabled:opacity-60">
              {busy ? "Submitting..." : "Submit enrollment request"}
            </button>
            {status ? <p className="sm:col-span-2 rounded-xl border border-white/10 bg-slate-950 p-3 text-sm text-slate-100">{status}</p> : null}
          </form>
        </section>
      </div>
    </main>
  );
}
