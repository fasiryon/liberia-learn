import Link from "next/link";
import { PublicFooter } from "@/components/PublicFooter";

export const metadata = { title: "Contact - LiberiaLearn" };

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <section className="mx-auto flex min-h-[calc(100vh-84px)] w-full max-w-3xl flex-col justify-center px-4 py-12">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--ll-yellow-soft)] text-sm font-black text-[var(--ll-text-faint)]">
            L
          </div>
          <span className="text-sm font-semibold text-[var(--ll-text)]">LiberiaLearn</span>
        </Link>

        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ll-yellow)]">
          Contact
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--ll-text)] sm:text-4xl">LiberiaLearn Support</h1>
        <p className="mt-4 text-base leading-7 text-[var(--ll-text)]">
          LiberiaLearn supports national K-12 education delivery for students, guardians, schools, and Ministry of
          Education stakeholders in the Republic of Liberia.
        </p>

        <div className="mt-8 grid gap-4">
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
            <h2 className="text-lg font-semibold text-[var(--ll-text)]">Data requests</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ll-text)]">
              Email data-requests@liberialearn.org for student data access, correction, deletion, and privacy questions.
              Data-related inquiries should also review the{" "}
              <Link href="/legal/privacy" className="text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
                Privacy Policy
              </Link>.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
            <h2 className="text-lg font-semibold text-[var(--ll-text)]">School enrollment questions</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ll-text)]">
              Email enrollment@liberialearn.org for school onboarding, pilot readiness, and administrator setup support.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-5">
            <h2 className="text-lg font-semibold text-[var(--ll-text)]">Technical support</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ll-text)]">
              Email support@liberialearn.org for login, access, classroom workflow, or platform availability issues.
            </p>
          </div>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
