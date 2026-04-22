"use client";
export default function PlatformError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="rounded-xl border border-red-500/20 bg-[var(--ll-bg)]/70 p-8 text-center max-w-md">
        <p className="text-red-400 font-semibold mb-2">Something went wrong</p>
        <p className="text-xs text-[var(--ll-text-muted)] mb-4">Please try again or return to the platform dashboard.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="rounded-xl bg-[var(--ll-surface-muted)] px-4 py-2 text-sm text-[var(--ll-text)] hover:bg-[var(--ll-surface-muted)]">Try Again</button>
          <a href="/platform" className="rounded-xl bg-violet-500 px-4 py-2 text-sm text-[var(--ll-text)] hover:bg-violet-400">Return to Dashboard</a>
        </div>
      </div>
    </div>
  );
}
