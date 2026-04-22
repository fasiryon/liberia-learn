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
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <header className="border-b border-white/5 bg-[var(--ll-bg)]/80">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--ll-yellow-soft)] text-sm font-black text-[var(--ll-text-faint)]">
              L
            </div>
            <span className="text-sm font-semibold text-[var(--ll-text)]">LiberiaLearn</span>
          </Link>
          <Link href="/contact" className="text-xs font-semibold text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
            Contact
          </Link>
        </div>
      </header>

      <article className="mx-auto w-full max-w-4xl px-4 py-10">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ll-yellow)]">
          Legal and compliance
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--ll-text)] sm:text-4xl">
          {title}
        </h1>
        <div className="mt-8 space-y-7 text-sm leading-7 text-[var(--ll-text)] sm:text-base">
          {children}
        </div>
      </article>

      <PublicFooter />
    </main>
  );
}
