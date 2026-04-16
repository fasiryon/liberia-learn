import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StudentRegistrationLinkPage({
  searchParams,
}: {
  searchParams: { code?: string };
}) {
  const code = searchParams.code?.trim() ?? "";
  const school = code
    ? await prisma.school.findUnique({
        where: { code },
        select: { name: true, county: true, contactName: true, contactEmail: true },
      })
    : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-8">
        <section className="w-full rounded-3xl border border-white/10 bg-slate-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Student registration</p>
          {school ? (
            <>
              <h1 className="mt-2 text-3xl font-bold">{school.name}</h1>
              <p className="mt-3 text-sm text-slate-300">
                This school is active on LiberiaLearn. Please contact the school office to complete student account creation with code <span className="font-semibold text-emerald-300">{code}</span>.
              </p>
              <p className="mt-3 text-sm text-slate-400">
                Principal/contact: {school.contactName ?? "School admin"} {school.contactEmail ? `- ${school.contactEmail}` : ""}
              </p>
            </>
          ) : (
            <>
              <h1 className="mt-2 text-3xl font-bold">School code not found</h1>
              <p className="mt-3 text-sm text-slate-300">Ask your school for the current LiberiaLearn registration link.</p>
            </>
          )}
          <Link href="/login" className="mt-5 inline-flex rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950">
            Go to login
          </Link>
        </section>
      </div>
    </main>
  );
}
