"use client";

import { useEffect } from "react";
import GravityLabPage from "@/components/labs/GravityLabPage";

export default function GravityLessonLabPanel({
  open,
  onClose,
  lessonId,
}: {
  open: boolean;
  onClose: () => void;
  lessonId: string;
}) {
  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[var(--ll-bg)]/70 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close gravity lab"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col overflow-hidden rounded-t-[2rem] border border-[var(--ll-border)] bg-[var(--ll-bg)] text-[var(--ll-text)] shadow-none shadow-black/50 sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-none sm:w-[min(58rem,92vw)] sm:rounded-none sm:rounded-l-[2rem]">
        <header className="flex items-start justify-between gap-3 border-b border-[var(--ll-border)] px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ll-silver)]">
              Physics Lab
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--ll-text)]">Gravity Explorer</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--ll-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ll-text)] transition-colors hover:border-[var(--ll-border)] hover:text-[var(--ll-text)]"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5">
          <GravityLabPage lessonId={lessonId} />
        </div>
      </section>
    </div>
  );
}
