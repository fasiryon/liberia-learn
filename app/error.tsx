"use client"

import { useEffect } from "react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[var(--ll-bg)] px-4 text-center">
      <img src="/logo.png" alt="LiberiaLearn" className="h-12 w-auto" />
      <h1 className="text-2xl font-bold text-[var(--ll-text)]">
        Something went wrong
      </h1>
      <p className="max-w-md text-sm text-[var(--ll-text-faint)]">
        An unexpected error occurred. Your work has been saved.
        Please try again or contact your school administrator.
      </p>
      {error.digest && (
        <p className="text-xs text-[var(--ll-text-faint)]">
          Error reference: {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--ll-yellow)] px-5 py-2 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)]"
        >
          Try again
        </button>
        <button
          type="button"
          onClick={() => { window.location.href = "/" }}
          className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-[var(--ll-border)] bg-transparent px-5 py-2 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-surface)]"
        >
          Go home
        </button>
      </div>
    </div>
  )
}
