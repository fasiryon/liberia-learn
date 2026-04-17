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
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm">
      <button
        type="button"
        aria-label="Close gravity lab"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <section className="absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col overflow-hidden rounded-t-[2rem] border border-white/10 bg-slate-950 text-slate-50 shadow-2xl shadow-black/50 sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-h-none sm:w-[min(58rem,92vw)] sm:rounded-none sm:rounded-l-[2rem]">
        <header className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-4 sm:px-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
              Physics Lab
            </p>
            <h2 className="mt-1 text-xl font-semibold text-white">Gravity Explorer</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-700 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
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
