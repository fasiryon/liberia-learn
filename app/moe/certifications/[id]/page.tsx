import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/db";
import { requireMoeActor } from "@/lib/moe/authority";
import { CertificationAssetsClient } from "./CertificationAssetsClient";

export const dynamic = "force-dynamic";

export default async function MoeCertificationPage({ params }: { params: { id: string } }) {
  await requireMoeActor();
  const certification = await prisma.examCertification.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      subject: true,
      grade: true,
      score: true,
      issuedAt: true,
      certCode: true,
      bannerUrl: true,
      videoUrl: true,
      assetGenerationStatus: true,
      exam: { select: { title: true } },
    },
  });

  if (!certification) notFound();

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-5">
        <Link href="/moe/dashboard" className="text-sm text-[var(--ll-yellow)]">
          &larr; Back to MOE dashboard
        </Link>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--ll-text-faint)]">
            Certification
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[var(--ll-text)]">{certification.exam.title}</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
            Grade {certification.grade} {certification.subject} &middot; Code {certification.certCode}
          </p>
        </div>
        <CertificationAssetsClient
          certificationId={certification.id}
          bannerUrl={certification.bannerUrl}
          videoUrl={certification.videoUrl}
          status={certification.assetGenerationStatus}
        />
      </div>
    </main>
  );
}
