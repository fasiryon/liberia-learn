"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type PendingSchool = {
  id: string;
  name: string;
  county: string | null;
  district: string | null;
  schoolType: string | null;
  estimatedEnrollment: number | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
};

export default function PendingSchoolsPage() {
  const [schools, setSchools] = useState<PendingSchool[]>([]);
  const [status, setStatus] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/schools/pending", { cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Unable to load pending schools");
      return;
    }
    setSchools(data.schools ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function act(schoolId: string, action: "approve" | "reject") {
    const reason = action === "reject" ? window.prompt("Reason to send to principal?") ?? "" : "";
    const res = await fetch("/api/admin/schools/pending", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolId, action, reason }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Action failed");
      return;
    }
    setStatus(action === "approve" ? `Approved. School code: ${data.schoolCode}` : "Rejected.");
    await load();
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Link href="/admin/schools" className="text-xs font-semibold text-emerald-300">
          Back to schools
        </Link>
        <header className="mt-4 rounded-3xl border border-white/10 bg-slate-900/80 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Platform admin</p>
          <h1 className="mt-2 text-3xl font-bold">Pending schools</h1>
          <p className="mt-2 text-sm text-slate-300">Approve requests to activate principal access and issue school codes.</p>
        </header>
        {status ? <p className="mt-4 rounded-xl border border-white/10 bg-slate-900 p-3 text-sm">{status}</p> : null}
        <section className="mt-5 grid gap-4">
          {schools.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-slate-900/80 p-5 text-sm text-slate-300">No pending schools.</p>
          ) : (
            schools.map((school) => (
              <article key={school.id} className="rounded-2xl border border-white/10 bg-slate-900/80 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold">{school.name}</h2>
                    <p className="mt-1 text-sm text-slate-300">
                      {school.county ?? "County missing"} - {school.district ?? "District missing"} - {school.schoolType ?? "Type missing"}
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      Principal: {school.contactName ?? "Missing"} - {school.contactEmail ?? "No email"} - {school.contactPhone ?? "No phone"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Estimated enrollment: {school.estimatedEnrollment ?? "-"} - Submitted {new Date(school.createdAt).toLocaleString("en-LR")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => act(school.id, "approve")} className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-bold text-slate-950">Approve</button>
                    <button onClick={() => act(school.id, "reject")} className="rounded-xl border border-red-400/40 px-4 py-2 text-sm font-bold text-red-200">Reject</button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
