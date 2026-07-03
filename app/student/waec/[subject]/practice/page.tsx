import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DashboardTopBar } from "@/components/DashboardTopBar";
import { LegalFooter } from "@/components/LegalFooter";
import { waecSubjectFromSlug, waecSlug } from "@/lib/waec/syllabus";
import { WAEC_MIN_GRADE } from "@/lib/waec/eligibility";
import { WaecPracticeClient } from "@/components/waec/WaecPracticeClient";

export const dynamic = "force-dynamic";

export default async function WaecPracticePage({ params }: { params: { subject: string } }) {
  const subject = waecSubjectFromSlug(params.subject);
  if (!subject || subject.masterySubject === null) notFound();

  const session = (await getServerSession(authOptions)) as { user?: { id?: string; role?: string; name?: string | null } } | null;
  if (!session?.user?.id) redirect("/login");
  if (session.user.role === "TEACHER") redirect("/teacher");
  if (session.user.role === "ADMIN") redirect("/admin");

  const student = await prisma.student.findFirst({
    where: { userId: session.user.id },
    select: { id: true, currentGrade: true },
  });
  if (!student || (student.currentGrade ?? 0) < WAEC_MIN_GRADE) redirect("/dashboard");

  const slug = waecSlug(subject.id);

  return (
    <ErrorBoundary>
      <main className="ll-dashboard-shell">
        <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-4 px-3 py-5 sm:px-4 sm:py-6">
          <DashboardTopBar
            roleLabel="Student"
            roleBadgeBg="bg-[var(--ll-yellow)]/10 border-emerald-500/20"
            roleAccent="text-[var(--ll-accent)]"
            userName={session.user.name || "Student"}
            subtitle={`${subject.name} Practice · WAEC Prep`}
          />
          <Link href={`/student/waec/${slug}`} className="inline-flex w-fit items-center gap-1 text-xs text-[var(--ll-text-faint)] hover:text-[var(--ll-text)]">
            <ChevronLeft size={14} /> {subject.name}
          </Link>
          <WaecPracticeClient slug={slug} subjectName={subject.name} />
        </div>
        <LegalFooter variant="portal" />
      </main>
    </ErrorBoundary>
  );
}
