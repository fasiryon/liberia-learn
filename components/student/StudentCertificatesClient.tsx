"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type CertificateRecord = {
  id: string;
  type: "LESSON" | "SUBJECT";
  referenceId: string;
  title: string;
  subject: string;
  awardedAt: string;
  certificateCode: string;
  studentName: string;
};

function labelForType(type: CertificateRecord["type"]) {
  return type === "LESSON" ? "Lesson Certificate" : "Subject Certificate";
}

function subjectLabel(subject: string) {
  return subject.replace(/_/g, " ");
}

export default function StudentCertificatesClient() {
  const [certificates, setCertificates] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/student/certificates", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(data?.error ?? "Failed to load certificates.");
        }

        setCertificates(Array.isArray(data?.certificates) ? data.certificates : []);
      })
      .catch((loadError: Error) => setError(loadError.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50 print:bg-white print:text-slate-950">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/student/progress"
              className="text-sm text-emerald-300 transition-colors hover:text-emerald-200 print:hidden"
            >
              &larr; Back to Progress
            </Link>
            <h1 className="mt-2 text-3xl font-semibold text-white print:text-slate-950">
              My Certificates
            </h1>
            <p className="mt-2 text-sm text-slate-400 print:text-slate-600">
              Print and verify the certificates you have earned in LiberiaLearn.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 text-sm text-slate-300">
            Loading certificates...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-3xl border border-red-500/20 bg-red-500/10 p-6 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {!loading && !error && certificates.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-slate-900/70 p-8 text-center text-sm text-slate-400">
            Complete lessons and score at least 70% on the quiz to earn your first certificate.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {certificates.map((certificate) => (
            <article
              key={certificate.id}
              className="break-inside-avoid rounded-[2rem] border border-white/10 bg-gradient-to-br from-emerald-400/10 via-slate-900/90 to-cyan-400/10 p-6 shadow-xl shadow-black/20 print:border print:border-slate-300 print:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300 print:text-slate-500">
                    LiberiaLearn
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white print:text-slate-950">
                    {labelForType(certificate.type)}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-400/20 print:hidden"
                >
                  Print
                </button>
              </div>

              <div className="mt-6 space-y-3 text-sm text-slate-200 print:text-slate-700">
                <p>
                  This certifies that <span className="font-semibold">{certificate.studentName}</span>{" "}
                  has completed{" "}
                  <span className="font-semibold">{certificate.title}</span>.
                </p>
                <p>Subject: {subjectLabel(certificate.subject)}</p>
                <p>Date awarded: {new Date(certificate.awardedAt).toLocaleDateString()}</p>
              </div>

              <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/70 p-4 print:border-slate-300 print:bg-slate-50">
                <p className="text-[11px] uppercase tracking-[0.24em] text-slate-400">
                  Verification Code
                </p>
                <p className="mt-2 font-mono text-lg font-semibold tracking-[0.2em] text-emerald-200 print:text-slate-900">
                  {certificate.certificateCode}
                </p>
                <p className="mt-2 text-xs text-slate-400 print:text-slate-600">
                  Verify publicly at /verify/{certificate.certificateCode}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
