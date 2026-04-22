import Link from "next/link";
import { requireRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function GuardianPhoneUpdatePage() {
  await requireRole("GUARDIAN");

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] px-4 py-8 text-[var(--ll-text)]">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <Link
            href="/guardian/settings"
            className="text-sm text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]"
          >
            &larr; Back to Guardian Settings
          </Link>
          <h1 className="mt-3 text-3xl font-bold">Update Phone Number</h1>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
            Phone number updates are managed by your child&apos;s school to keep guardian records accurate.
          </p>
        </div>

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
          <p className="text-sm text-[var(--ll-text)]">
            Contact your school admin or guardian support contact to update the phone number linked to your LiberiaLearn account.
          </p>
        </section>
      </div>
    </main>
  );
}
