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
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)] print:bg-white print:text-[var(--ll-text-faint)]">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/student/progress"
              className="text-sm text-[var(--ll-pink)] transition-colors hover:opacity-80 print:hidden"
            >
              &larr; Back to Progress
            </Link>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--ll-text)] print:text-[var(--ll-text-faint)]">
              My Certificates
            </h1>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)] print:text-[var(--ll-text-faint)]">
              Print and verify the certificates you have earned in LiberiaLearn.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-6 text-sm text-[var(--ll-text-muted)]">
            Loading certificates...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-xl border border-[var(--ll-danger)]/30 bg-[var(--ll-danger)]/10 p-6 text-sm text-[var(--ll-danger)]">
            {error}
          </div>
        ) : null}

        {!loading && !error && certificates.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--ll-border)] bg-[var(--ll-surface)] p-8 text-center text-sm text-[var(--ll-text-muted)]">
            Complete lessons and score at least 70% on the quiz to earn your first certificate.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          {certificates.map((certificate) => (
            <article
              key={certificate.id}
              className="break-inside-avoid rounded-xl border border-[var(--ll-pink)]/30 bg-[var(--ll-surface)] p-6 shadow-none print:border print:border-[var(--ll-border)] print:bg-white"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--ll-pink)] print:text-[var(--ll-text-faint)]">
                    LiberiaLearn
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-[var(--ll-text)] print:text-[var(--ll-text-faint)]">
                    {labelForType(certificate.type)}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="rounded-full border border-[var(--ll-pink)]/30 bg-[var(--ll-pink-soft)] px-4 py-2 text-xs font-semibold text-[var(--ll-pink)] transition-colors hover:opacity-90 print:hidden"
                >
                  Print
                </button>
              </div>

              <div className="mt-6 space-y-3 text-sm text-[var(--ll-text-muted)] print:text-[var(--ll-text-faint)]">
                <p>
                  This certifies that <span className="font-semibold">{certificate.studentName}</span>{" "}
                  has completed{" "}
                  <span className="font-semibold">{certificate.title}</span>.
                </p>
                <p>Subject: {subjectLabel(certificate.subject)}</p>
                <p>Date awarded: {new Date(certificate.awardedAt).toLocaleDateString()}</p>
              </div>

              <div className="mt-6 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface-muted)] p-4 print:border-[var(--ll-border)] print:bg-[var(--ll-surface-muted)]">
                <p className="text-[11px] uppercase tracking-[0.24em] text-[var(--ll-text-faint)]">
                  Verification Code
                </p>
                <p className="mt-2 font-mono text-xs font-semibold tracking-[0.2em] text-[var(--ll-silver)] print:text-[var(--ll-text-faint)]">
                  {certificate.certificateCode}
                </p>
                <p className="mt-2 text-xs text-[var(--ll-text-faint)] print:text-[var(--ll-text-faint)]">
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
