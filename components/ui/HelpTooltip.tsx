"use client";

import { useEffect, useRef, useState } from "react";

export default function HelpTooltip({
  text,
  position = "top",
}: {
  text: string;
  position?: "top" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const positionClass =
    position === "right"
      ? "left-full top-1/2 ml-3 -translate-y-1/2"
      : "bottom-full left-1/2 mb-3 -translate-x-1/2";

  return (
    <span
      ref={ref}
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="More information"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-600 bg-slate-900 text-xs font-semibold text-slate-200 hover:border-emerald-400 hover:text-emerald-300"
      >
        i
      </button>
      {open ? (
        <span
          role="tooltip"
          className={`absolute z-20 w-56 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs leading-5 text-slate-200 shadow-lg shadow-slate-950/40 ${positionClass}`}
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
