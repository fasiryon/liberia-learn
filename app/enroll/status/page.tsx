import Link from "next/link";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

export default async function EnrollmentStatusPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const headersList = headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "unknown";
  const limit = await checkRateLimit(`enroll-status:${ip}`, {
    windowMs: 3_600_000,
    limit: 10,
    namespace: "enrollment",
  });

  if (!limit.allowed) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
        <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/30">
          <Link href="/enroll" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
            Back to enrollment
          </Link>
          <div className="mt-6 space-y-3">
            <h1 className="text-2xl font-bold text-white">Too many requests</h1>
            <p className="text-sm leading-6 text-slate-300">
              Please wait before checking again.
            </p>
          </div>
        </section>
      </main>
    );
  }

  const email = searchParams.email?.trim().toLowerCase() ?? "";
  const school = email
    ? await prisma.school.findFirst({
        where: { contactEmail: email },
        orderBy: { createdAt: "desc" },
        select: {
          name: true,
          status: true,
        },
      })
    : null;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <section className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-black/30">
        <Link href="/enroll" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">
          Back to enrollment
        </Link>

        {!school ? (
          <div className="mt-6 space-y-3">
            <h1 className="text-2xl font-bold text-white">Application not found</h1>
            <p className="text-sm leading-6 text-slate-300">
              Enter the same principal email used on the enrollment form to check status.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">
                School enrollment status
              </p>
              <h1 className="mt-2 text-2xl font-bold text-white">
                Your application for {school.name} has been received.
              </h1>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4">
              <p className="text-xs text-slate-400">Status</p>
              <p className="mt-1 text-xl font-semibold text-emerald-300">{school.status}</p>
              <p className="mt-3 text-sm text-slate-300">Expected review time: 2-3 business days</p>
              <p className="mt-1 text-sm text-slate-300">Questions: support@liberialearn.org</p>
            </div>

            {school.status === "ACTIVE" ? (
              <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                <p className="text-sm text-slate-100">
                  Your school has been approved. Check your email for login details and your school code.
                </p>
                <Link
                  href="/login"
                  className="mt-4 inline-flex rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950"
                >
                  Go to login
                </Link>
              </div>
            ) : null}

            {school.status === "REJECTED" ? (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
                Your application was not approved. Contact support@liberialearn.org for details.
              </div>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
