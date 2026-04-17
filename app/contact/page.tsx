import Link from "next/link";
import { PublicFooter } from "@/components/PublicFooter";

export const metadata = { title: "Contact - LiberiaLearn" };

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <section className="mx-auto flex min-h-[calc(100vh-84px)] w-full max-w-3xl flex-col justify-center px-4 py-12">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400 text-sm font-black text-slate-950">
            L
          </div>
          <span className="text-sm font-semibold text-slate-100">LiberiaLearn</span>
        </Link>

        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
          Contact
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-white sm:text-4xl">LiberiaLearn Support</h1>
        <p className="mt-4 text-base leading-7 text-slate-300">
          LiberiaLearn supports national K-12 education delivery for students, guardians, schools, and Ministry of
          Education stakeholders in the Republic of Liberia.
        </p>

        <div className="mt-8 grid gap-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold text-white">Data requests</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Email data-requests@liberialearn.org for student data access, correction, deletion, and privacy questions.
              Data-related inquiries should also review the{" "}
              <Link href="/legal/privacy" className="text-emerald-300 hover:text-emerald-200">
                Privacy Policy
              </Link>.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold text-white">School enrollment questions</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Email enrollment@liberialearn.org for school onboarding, pilot readiness, and administrator setup support.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold text-white">Technical support</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Email support@liberialearn.org for login, access, classroom workflow, or platform availability issues.
            </p>
          </div>
        </div>
      </section>
      <PublicFooter />
    </main>
  );
}
