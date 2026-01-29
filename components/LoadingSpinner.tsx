// components/LoadingSpinner.tsx
export function LoadingSpinner() {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-lg font-black text-slate-950 mx-auto animate-pulse">
            L
          </div>
          <p className="text-sm text-slate-400">Loading your dashboard...</p>
        </div>
      </div>
    );
  }
  