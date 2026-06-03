"use client";

import { useRouter } from "next/navigation";

export default function RefreshButton() {
  const router = useRouter();
  return (
    <button
      onClick={() => router.refresh()}
      className="rounded border border-[var(--ll-border)] px-3 py-1.5 text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)] transition-colors"
    >
      Refresh
    </button>
  );
}
