"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { component: "global-error-boundary" },
      extra: { digest: error.digest },
    });
  }, [error]);

  return (
    <html>
      <body className="bg-[var(--ll-bg)] text-[var(--ll-text)]">
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
          <div className="w-full max-w-md rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/90 p-6 text-center shadow-none">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-3 text-sm text-[var(--ll-text)]">
              LiberiaLearn hit an unexpected error. You can try again, and configured monitoring will capture it for review.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="mt-6 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--ll-yellow)] px-5 py-2 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)]"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
