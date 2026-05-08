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
  canvaUrl: string | null;
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
            <nav className="flex flex-wrap gap-3 text-sm print:hidden" aria-label="Certificate navigation">
              <Link
                href="/dashboard"
                className="text-[var(--ll-yellow)] transition-colors hover:opacity-80"
              >
                &larr; Back to Dashboard
              </Link>
              <Link
                href="/student/progress"
                className="text-[var(--ll-pink)] transition-colors hover:opacity-80"
              >
                My Progress
              </Link>
            </nav>
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
            Your earned certificates appear here automatically when you complete 80% of a subject.
          </div>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          {certificates.map((certificate) => (
            <article
              key={certificate.id}
              className="relative overflow-hidden break-inside-avoid rounded-2xl border-2 border-[var(--ll-yellow)] bg-gradient-to-br from-[#1a1500] to-[#0d0d0d] p-8 shadow-xl print:border print:border-[var(--ll-yellow)] print:bg-white"
            >
              {/* Decorative corner accents */}
              <div className="absolute top-0 left-0 w-16 h-16 border-t-4 border-l-4 border-[var(--ll-yellow)] rounded-tl-xl" />
              <div className="absolute top-0 right-0 w-16 h-16 border-t-4 border-r-4 border-[var(--ll-yellow)] rounded-tr-xl" />
              <div className="absolute bottom-0 left-0 w-16 h-16 border-b-4 border-l-4 border-[var(--ll-yellow)] rounded-bl-xl" />
              <div className="absolute bottom-0 right-0 w-16 h-16 border-b-4 border-r-4 border-[var(--ll-yellow)] rounded-br-xl" />

              {/* Header */}
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[var(--ll-yellow)] mb-3">
                  <span className="text-2xl">🎓</span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ll-yellow)] mb-1">
                  LiberiaLearn
                </p>
                <h2 className="text-2xl font-bold text-[var(--ll-text)] print:text-black">
                  Certificate of Achievement
                </h2>
              </div>

              {/* Body */}
              <div className="text-center mb-6">
                <p className="text-sm text-[var(--ll-text-muted)] mb-2">This certifies that</p>
                <p className="text-3xl font-bold text-[var(--ll-yellow)] mb-2">
                  {certificate.studentName}
                </p>
                <p className="text-sm text-[var(--ll-text-muted)] mb-1">has successfully completed</p>
                <p className="text-xl font-semibold text-[var(--ll-text)] mb-1 print:text-black">
                  {certificate.title}
                </p>
                <p className="text-sm text-[var(--ll-text-faint)]">
                  {subjectLabel(certificate.subject)} · {labelForType(certificate.type)}
                </p>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-4 border-t border-[var(--ll-border)]">
                <div>
                  <p className="text-xs text-[var(--ll-text-faint)]">Date Awarded</p>
                  <p className="text-sm font-medium text-[var(--ll-text)] print:text-black">
                    {new Date(certificate.awardedAt).toLocaleDateString("en-LR", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[var(--ll-text-faint)]">Verification Code</p>
                  <p className="text-sm font-mono font-bold text-[var(--ll-yellow)]">
                    {certificate.certificateCode}
                  </p>
                </div>
              </div>

              {/* Action */}
              {certificate.canvaUrl ? (
                <a
                  href={certificate.canvaUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--ll-yellow)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-bg)] hover:opacity-90 transition-opacity print:hidden"
                >
                  View Official Certificate →
                </a>
              ) : (
                <div className="mt-4 text-center print:hidden">
                  <p className="text-xs text-[var(--ll-text-faint)]">
                    Verify at liberialearn.vercel.app/verify/{certificate.certificateCode}
                  </p>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="mt-2 rounded-lg border border-[var(--ll-yellow)]/30 bg-[var(--ll-yellow)]/10 px-4 py-2 text-xs font-semibold text-[var(--ll-yellow)] transition-colors hover:opacity-90"
                  >
                    Print Certificate
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
