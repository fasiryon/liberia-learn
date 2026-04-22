// components/LoadingSpinner.tsx
export function LoadingSpinner() {
    return (
      <div className="min-h-screen bg-[var(--ll-bg)] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--ll-yellow)] text-lg font-black text-[var(--ll-text-faint)] mx-auto animate-pulse">
            L
          </div>
          <p className="text-sm text-[var(--ll-text-muted)]">Loading your dashboard...</p>
        </div>
      </div>
    );
  }
  