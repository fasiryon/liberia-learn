import Link from "next/link";
import { PublicFooter } from "@/components/PublicFooter";

export function LegalPageShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <header className="border-b border-white/5 bg-slate-950/80">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400 text-sm font-black text-slate-950">
              L
            </div>
            <span className="text-sm font-semibold text-slate-100">LiberiaLearn</span>
          </Link>
          <Link href="/contact" className="text-xs font-semibold text-emerald-300 hover:text-emerald-200">
            Contact
          </Link>
        </div>
      </header>

      <article className="mx-auto w-full max-w-4xl px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">
          Legal and compliance
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        <div className="mt-8 space-y-7 text-sm leading-7 text-slate-300 sm:text-base">
          {children}
        </div>
      </article>

      <PublicFooter />
    </main>
  );
}
