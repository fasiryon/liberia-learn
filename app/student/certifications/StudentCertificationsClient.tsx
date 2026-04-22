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
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)] print:bg-white print:text-black">
      <div className="mx-auto max-w-5xl space-y-6">
        <Link href="/dashboard" className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)] print:hidden">
          &larr; Back to Dashboard
        </Link>
        <div>
          <h1 className="text-3xl font-semibold">My Certifications</h1>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">Pass an exam to earn your first certificate.</p>
        </div>

        {loading ? <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 text-sm text-[var(--ll-text-muted)]">Loading certifications...</div> : null}
        {error ? <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">{error}</div> : null}
        {!loading && !error && certifications.length === 0 ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-8 text-center text-sm text-[var(--ll-text-muted)]">
            No certifications yet - pass an exam to earn your first certificate.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {certifications.map((certification) => (
            <div key={certification.id} className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6 print:border print:border-[var(--ll-border)] print:bg-white">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--ll-yellow)] print:text-[var(--ll-text-faint)]">Certificate</p>
              <h2 className="mt-2 text-xl font-semibold">{certification.examTitle}</h2>
              <div className="mt-4 space-y-2 text-sm text-[var(--ll-text)] print:text-[var(--ll-text-faint)]">
                <p>Subject: {certification.subject}</p>
                <p>Grade: {certification.grade}</p>
                <p>Score: {Math.round(certification.score * 100)}%</p>
                <p>Date issued: {new Date(certification.issuedAt).toLocaleDateString()}</p>
              </div>
              <div className="mt-5 rounded-xl border border-emerald-400/30 bg-[var(--ll-yellow)]/10 p-4 text-sm font-semibold text-[var(--ll-yellow)] print:border-[var(--ll-border)] print:bg-[var(--ll-surface-muted)] print:text-[var(--ll-text-faint)]">
                {certification.certCode}
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="mt-5 rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-[var(--ll-text-faint)] print:hidden"
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
