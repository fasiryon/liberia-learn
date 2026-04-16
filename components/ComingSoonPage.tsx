/**
 * components/ComingSoonPage.tsx
 *
 * Shared placeholder for legal pages not yet published.
 * Renders a clean "Coming soon" page with back-to-homepage link.
 */
import Link from "next/link";
import { PublicFooter } from "@/components/PublicFooter";

type ComingSoonPageProps = {
  title: string;
  description?: string;
};

export function ComingSoonPage({ title, description }: ComingSoonPageProps) {
  return (
    <main className="ll-page flex min-h-screen flex-col bg-slate-950 text-slate-50">
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400 text-xl font-black text-slate-950 mb-6">
          L
        </div>
        <h1 className="text-2xl font-semibold text-slate-50">{title}</h1>
        <p className="mt-3 max-w-md text-sm leading-6 text-slate-400">
          {description ?? "This page is being prepared. Please check back soon."}
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center rounded-full bg-emerald-400 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-300"
        >
          Back to homepage
        </Link>
      </div>
      <PublicFooter />
    </main>
  );
}
