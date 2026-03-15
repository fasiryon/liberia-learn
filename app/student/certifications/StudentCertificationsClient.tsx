"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Certification = {
  id: string;
  examTitle: string;
  subject: string;
  grade: number;
  score: number;
  issuedAt: string;
  certCode: string;
};

export default function StudentCertificationsClient() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [certifications, setCertifications] = useState<Certification[]>([]);

  useEffect(() => {
    fetch("/api/student/certifications", { cache: "no-store" })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load certifications");
        setCertifications(data.certifications ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 print:bg-white print:text-black">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/dashboard" className="text-sm text-emerald-300 hover:text-emerald-200 print:hidden">
          &larr; Back to Dashboard
        </Link>
        <div>
          <h1 className="text-3xl font-semibold">My Certifications</h1>
          <p className="mt-2 text-sm text-slate-400">Pass an exam to earn your first certificate.</p>
        </div>

        {loading ? <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-400">Loading certifications...</div> : null}
        {error ? <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">{error}</div> : null}
        {!loading && !error && certifications.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-8 text-center text-sm text-slate-400">
            No certifications yet - pass an exam to earn your first certificate.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {certifications.map((certification) => (
            <div key={certification.id} className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 print:border print:border-slate-300 print:bg-white">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300 print:text-slate-600">Certificate</p>
              <h2 className="mt-2 text-xl font-semibold">{certification.examTitle}</h2>
              <div className="mt-4 space-y-2 text-sm text-slate-300 print:text-slate-700">
                <p>Subject: {certification.subject}</p>
                <p>Grade: {certification.grade}</p>
                <p>Score: {Math.round(certification.score * 100)}%</p>
                <p>Date issued: {new Date(certification.issuedAt).toLocaleDateString()}</p>
              </div>
              <div className="mt-5 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-200 print:border-slate-300 print:bg-slate-50 print:text-slate-800">
                {certification.certCode}
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="mt-5 rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 print:hidden"
              >
                Download Certificate
              </button>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
