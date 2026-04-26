import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--ll-bg)] px-4 text-[var(--ll-text)]">
      <BrandMark size={28} />
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-8 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--ll-text-faint)]">
          404
        </p>
        <h1 className="text-xl font-semibold">Page not found</h1>
        <p className="text-sm text-[var(--ll-text-muted)]">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="flex flex-col gap-3 pt-2">
          <Link
            href="/"
            className="w-full rounded-lg bg-[var(--ll-accent)] px-4 py-2.5 text-sm font-semibold text-[var(--ll-text-faint)] hover:opacity-90"
          >
            Go to homepage
          </Link>
          <Link
            href="/login"
            className="w-full rounded-lg border border-[var(--ll-border)] px-4 py-2.5 text-sm font-medium text-[var(--ll-text)] hover:bg-[var(--ll-surface-muted)]"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
