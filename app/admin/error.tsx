"use client";
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="rounded-xl border border-red-500/20 bg-[var(--ll-bg)]/70 p-8 text-center max-w-md">
        <p className="text-red-400 font-semibold mb-2">Something went wrong</p>
        <p className="text-xs text-[var(--ll-text-muted)] mb-4">Please try again or return to the admin console.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="rounded-xl bg-[var(--ll-surface-muted)] px-4 py-2 text-sm text-[var(--ll-text)] hover:bg-[var(--ll-surface-muted)]">Try Again</button>
          <a href="/admin" className="rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm text-[var(--ll-text)] hover:bg-[var(--ll-yellow-soft)]">Return to Console</a>
        </div>
      </div>
    </div>
  );
}
