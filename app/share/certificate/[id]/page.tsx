import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

import { prisma } from "@/lib/db";
import { verifyShareToken } from "@/lib/certificates/shareToken";
import { resolveLessonTitle } from "@/lib/lessons/resolveLessonTitle";

const BASE_URL =
  process.env.NEXTAUTH_URL ?? "https://liberia-learn.vercel.app";

async function getCertData(id: string) {
  const certificate = await prisma.certificate.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      referenceId: true,
      awardedAt: true,
      certificateCode: true,
      student: {
        select: { userId: true, user: { select: { name: true } } },
      },
    },
  });

  if (!certificate) return null;

  let title = `${certificate.referenceId.replace(/_/g, " ")} Subject`;
  let subject = certificate.referenceId.replace(/_/g, " ");

  if (certificate.type === "LESSON") {
    const sw = await prisma.scheduledWork.findUnique({
      where: { id: certificate.referenceId },
      select: {
        content: { select: { payload: true, subject: true, contentId: true } },
      },
    });
    if (sw) {
      const payload = (sw.content.payload ?? {}) as Record<string, unknown>;
      title = resolveLessonTitle({
        payload,
        subject: sw.content.subject,
        fallbackTitle: sw.content.contentId,
      });
      subject = sw.content.subject.replace(/_/g, " ");
    }
  }

  return {
    ...certificate,
    title,
    subject,
    studentName: certificate.student.user?.name ?? "A student",
  };
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { token?: string };
}): Promise<Metadata> {
  const token = searchParams.token ?? "";
  if (!verifyShareToken(params.id, token)) return {};

  const cert = await getCertData(params.id);
  if (!cert) return {};

  const imageUrl = `${BASE_URL}/api/certificates/${params.id}/image?token=${token}`;

  return {
    title: `${cert.studentName} earned a certificate on LiberiaLearn`,
    description: `${cert.studentName} completed "${cert.title}" on LiberiaLearn.`,
    openGraph: {
      title: `${cert.studentName} earned a certificate on LiberiaLearn`,
      description: `${cert.studentName} completed "${cert.title}".`,
      images: [{ url: imageUrl, width: 1200, height: 630 }],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${cert.studentName} earned a certificate on LiberiaLearn`,
      images: [imageUrl],
    },
  };
}

export default async function ShareCertificatePage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { token?: string };
}) {
  const token = searchParams.token ?? "";

  if (!verifyShareToken(params.id, token)) {
    notFound();
  }

  const cert = await getCertData(params.id);
  if (!cert) notFound();

  // Increment click count fire-and-forget
  prisma.certificateShare
    .updateMany({
      where: { certificateId: params.id, shareToken: token },
      data: { clickCount: { increment: 1 } },
    })
    .catch(() => null);

  const imageUrl = `${BASE_URL}/api/certificates/${params.id}/image?token=${token}`;
  const awardedDate = new Date(cert.awardedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-12 text-[var(--ll-text)]">
      <div className="mx-auto max-w-2xl space-y-8">
        {/* Certificate image */}
        <div className="overflow-hidden rounded-2xl border border-[var(--ll-border)] shadow-xl">
          <img
            src={imageUrl}
            alt={`Certificate for ${cert.studentName}`}
            width={1200}
            height={630}
            className="w-full"
          />
        </div>

        {/* Details */}
        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-6 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-yellow)]">
            LiberiaLearn · Certificate of Achievement
          </p>
          <h1 className="text-2xl font-bold text-[var(--ll-text)]">{cert.studentName}</h1>
          <p className="text-[var(--ll-text-muted)]">
            Completed{" "}
            <span className="font-semibold text-[var(--ll-text)]">{cert.title}</span>
          </p>
          <p className="text-sm text-[var(--ll-text-faint)]">
            {cert.subject} · {awardedDate}
          </p>
          <p className="text-xs font-mono text-[var(--ll-yellow)] tracking-[0.15em]">
            Code: {cert.certificateCode}
          </p>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/verify/${cert.certificateCode}`}
            className="flex-1 rounded-lg bg-[var(--ll-yellow)] px-4 py-3 text-center text-sm font-semibold text-[var(--ll-bg)] transition-opacity hover:opacity-90"
          >
            Verify this certificate
          </Link>
          <Link
            href="/register"
            className="flex-1 rounded-lg border border-[var(--ll-yellow)]/40 px-4 py-3 text-center text-sm font-semibold text-[var(--ll-yellow)] transition-opacity hover:opacity-80"
          >
            Sign up your child free →
          </Link>
        </div>

        <p className="text-center text-xs text-[var(--ll-text-faint)]">
          LiberiaLearn — quality education for every Liberian student
        </p>
      </div>
    </main>
  );
}
