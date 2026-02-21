"use client";
export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="rounded-2xl border border-red-500/20 bg-slate-900/70 p-8 text-center max-w-md">
        <p className="text-red-400 font-semibold mb-2">Something went wrong</p>
        <p className="text-xs text-slate-400 mb-4">Please try again or return to the admin console.</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="rounded-xl bg-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-600">Try Again</button>
          <a href="/admin" className="rounded-xl bg-emerald-500 px-4 py-2 text-sm text-white hover:bg-emerald-400">Return to Console</a>
        </div>
      </div>
    </div>
  );
}

