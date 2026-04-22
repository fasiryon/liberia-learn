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
      <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
        <section className="mx-auto max-w-2xl rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6 shadow-none shadow-black/30">
          <Link href="/enroll" className="text-sm font-semibold text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            Back to enrollment
          </Link>
          <div className="mt-6 space-y-3">
            <h1 className="text-2xl font-bold text-[var(--ll-text)]">Too many requests</h1>
            <p className="text-sm leading-6 text-[var(--ll-text)]">
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
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <section className="mx-auto max-w-2xl rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6 shadow-none shadow-black/30">
        <Link href="/enroll" className="text-sm font-semibold text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
          Back to enrollment
        </Link>

        {!school ? (
          <div className="mt-6 space-y-3">
            <h1 className="text-2xl font-bold text-[var(--ll-text)]">Application not found</h1>
            <p className="text-sm leading-6 text-[var(--ll-text)]">
              Enter the same principal email used on the enrollment form to check status.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ll-yellow)]">
                School enrollment status
              </p>
              <h1 className="mt-2 text-2xl font-bold text-[var(--ll-text)]">
                Your application for {school.name} has been received.
              </h1>
            </div>

            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-4">
              <p className="text-xs text-[var(--ll-text-muted)]">Status</p>
              <p className="mt-1 text-xl font-semibold text-[var(--ll-yellow)]">{school.status}</p>
              <p className="mt-3 text-sm text-[var(--ll-text)]">Expected review time: 2-3 business days</p>
              <p className="mt-1 text-sm text-[var(--ll-text)]">Questions: support@liberialearn.org</p>
            </div>

            {school.status === "ACTIVE" ? (
              <div className="rounded-xl border border-emerald-400/30 bg-[var(--ll-yellow)]/10 p-4">
                <p className="text-sm text-[var(--ll-text)]">
                  Your school has been approved. Check your email for login details and your school code.
                </p>
                <Link
                  href="/login"
                  className="mt-4 inline-flex rounded-xl bg-[var(--ll-yellow-soft)] px-5 py-3 text-sm font-bold text-[var(--ll-text-faint)]"
                >
                  Go to login
                </Link>
              </div>
            ) : null}

            {school.status === "REJECTED" ? (
              <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
                Your application was not approved. Contact support@liberialearn.org for details.
              </div>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
