"use client";
export default function AdminError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="rounded-xl border border-red-500/20 bg-[var(--ll-bg)]/70 p-8 text-center max-w-md space-y-4">
        <p className="text-red-400 font-semibold">Something went wrong</p>
        {error?.message && (
          <pre className="text-xs text-red-400 bg-black/20 p-4 rounded overflow-auto text-left whitespace-pre-wrap">
            {error.message}
          </pre>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="rounded-xl bg-[var(--ll-surface-muted)] px-4 py-2 text-sm text-[var(--ll-text)] hover:bg-[var(--ll-surface-muted)]">Try Again</button>
          <a href="/admin" className="rounded-xl bg-[var(--ll-yellow)] px-4 py-2 text-sm text-[var(--ll-text)] hover:bg-[var(--ll-yellow-soft)]">Return to Console</a>
        </div>
      </div>
    </div>
  );
}
