import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CredentialVerifyPage({
  params,
}: {
  params: { token: string };
}) {
  const credential = await prisma.portfolioCredential.findUnique({
    where: { verifyToken: params.token },
  }).catch(() => null);

  const isValid = credential && credential.expiresAt > new Date();

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-12 text-[var(--ll-text)]">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--ll-yellow)]">
            LiberiaLearn Credential Verification
          </p>

          {isValid ? (
            <>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-2xl">✓</span>
                <h1 className="text-2xl font-semibold text-emerald-400">This credential is authentic</h1>
              </div>
              <div className="mt-6 space-y-3 text-sm">
                <p>
                  Student: <span className="font-semibold">{credential.studentName}</span>
                </p>
                <p>
                  School: <span className="font-semibold">{credential.schoolName}</span>
                </p>
                <p>
                  Grade: <span className="font-semibold">{credential.grade}</span>
                </p>
                <p>
                  Term: <span className="font-semibold">{credential.term}</span>
                </p>
                <p>
                  Average Score: <span className="font-semibold">{Math.round(credential.avgScore)}%</span>
                </p>
                <p>
                  Attendance: <span className="font-semibold">{Math.round(credential.attendance)}%</span>
                </p>
                <p>
                  Lessons Completed: <span className="font-semibold">{credential.lessonsComplete}</span>
                </p>
                <p>
                  Generated:{" "}
                  <span className="font-semibold">
                    {new Date(credential.generatedAt).toLocaleDateString()}
                  </span>
                </p>
                <p className="mt-4 text-xs text-[var(--ll-text-muted)]">
                  Issued by LiberiaLearn on behalf of the Liberia Ministry of Education.
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-2xl">✗</span>
                <h1 className="text-2xl font-semibold text-red-400">Credential not found or expired</h1>
              </div>
              <p className="mt-4 text-sm text-[var(--ll-text-muted)]">
                This link may have expired or the credential does not exist. Contact the issuing school to
                obtain an updated transcript.
              </p>
            </>
          )}
        </div>

        <Link href="/" className="text-sm text-[var(--ll-yellow)] hover:opacity-80">
          Return to LiberiaLearn
        </Link>
      </div>
    </main>
  );
}
