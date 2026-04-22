import { prisma } from "@/lib/db";
import { findInviteByToken } from "@/lib/inviteTokens";
import Link from "next/link";
import RegisterForm from "./RegisterForm";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function GuardianRegisterPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const tokenValue = Array.isArray(params.token) ? params.token[0] : params.token;

  if (!tokenValue) {
    return <ExpiredState />;
  }

  const invite = await findInviteByToken(tokenValue);
  if (!invite || invite.tokenType !== "GUARDIAN_LINK" || invite.usedAt || invite.expiresAt < new Date() || !invite.studentId) {
    return <ExpiredState />;
  }

  const [student, school, guardian] = await Promise.all([
    prisma.student.findUnique({
      where: { id: invite.studentId },
      select: { user: { select: { name: true } } },
    }),
    prisma.school.findUnique({ where: { id: invite.schoolId }, select: { name: true } }),
    invite.email ? prisma.user.findUnique({ where: { email: invite.email }, select: { name: true, guardianPhoneE164: true } }) : null,
  ]);

  if (!student || !school || !guardian?.guardianPhoneE164) {
    return <ExpiredState />;
  }

  return (
    <main className="min-h-screen bg-[var(--ll-surface-muted)] px-4 py-8 text-[var(--ll-text-faint)]">
      <div className="mx-auto max-w-md rounded-xl bg-white p-6 shadow-none shadow-slate-300/50">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ll-yellow)]">LiberiaLearn</p>
        <h1 className="mt-4 text-3xl font-bold leading-tight">Create your guardian account</h1>
        <p className="mt-3 text-lg leading-7 text-[var(--ll-text-faint)]">
          You have been invited to monitor {student.user.name ?? "your child"} at {school.name}.
        </p>
        <p className="mt-2 text-base leading-7 text-[var(--ll-text-faint)]">
          Use your phone number and a simple PIN to sign in. Review the{" "}
          <Link href="/legal/data-for-minors" className="font-semibold text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            Data Policy for Minors
          </Link>{" "}
          for guardian data rights.
        </p>
        <div className="mt-6">
          <RegisterForm token={tokenValue} defaultName={guardian.name ?? ""} phone={guardian.guardianPhoneE164} />
        </div>
      </div>
    </main>
  );
}

function ExpiredState() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--ll-surface-muted)] px-4 py-8 text-[var(--ll-text-faint)]">
      <div className="max-w-md rounded-xl bg-white p-6 text-center shadow-none shadow-slate-300/50">
        <h1 className="text-2xl font-bold">This link has expired.</h1>
        <p className="mt-3 text-lg leading-7 text-[var(--ll-text-faint)]">Please contact your child&apos;s school.</p>
      </div>
    </main>
  );
}


