"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught an error", error);
  }, [error]);

  return (
    <html>
      <body className="bg-slate-950 text-slate-50">
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/90 p-6 text-center shadow-2xl">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-3 text-sm text-slate-300">
              LiberiaLearn hit an unexpected error. You can try again, and configured monitoring will capture it for review.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
