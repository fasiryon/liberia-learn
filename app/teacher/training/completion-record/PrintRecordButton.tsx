"use client";

export function PrintRecordButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-black"
    >
      Print or save PDF
    </button>
  );
}
