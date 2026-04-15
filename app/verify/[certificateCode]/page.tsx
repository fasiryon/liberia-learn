import Link from "next/link";
import { notFound } from "next/navigation";

import { getCertificateVerification } from "@/lib/certificates/certificateService";

export default async function CertificateVerificationPage({
  params,
}: {
  params: { certificateCode: string };
}) {
  const verification = await getCertificateVerification(params.certificateCode);

  if (!verification) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-12 text-slate-50">
      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300">
            LiberiaLearn Verification
          </p>
          <h1 className="mt-3 text-3xl font-semibold text-white">
            Certificate Verified
          </h1>
          <div className="mt-6 space-y-3 text-sm text-slate-200">
            <p>
              Student: <span className="font-semibold">{verification.studentFirstName}</span>
            </p>
            <p>
              Completed: <span className="font-semibold">{verification.completed}</span>
            </p>
            <p>
              Date awarded:{" "}
              <span className="font-semibold">
                {new Date(verification.awardedAt).toLocaleDateString()}
              </span>
            </p>
            <p>
              Code:{" "}
              <span className="font-mono font-semibold tracking-[0.16em] text-emerald-200">
                {verification.certificateCode}
              </span>
            </p>
          </div>
        </div>

        <Link href="/" className="text-sm text-emerald-300 hover:text-emerald-200">
          Return to LiberiaLearn
        </Link>
      </div>
    </main>
  );
}
