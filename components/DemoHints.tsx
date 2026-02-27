"use client";

import { useState } from "react";
import type { DemoHintGroup } from "@/lib/demoHints";

type DemoHintsProps = {
  title: string;
  groups: DemoHintGroup[];
};

export function DemoHints({ title, groups }: DemoHintsProps) {
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  async function copyEmail(email: string) {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail(null), 1500);
    } catch {
      setCopiedEmail(null);
    }
  }

  return (
    <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-emerald-200">{title}</h2>
        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-200">
          Demo Mode
        </span>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {groups.map((g) => (
          <div
            key={g.key}
            className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2"
          >
            <p className="text-xs font-semibold text-slate-200">{g.label}</p>
            <div className="mt-1 flex items-center justify-between gap-2">
              <p className="text-xs text-slate-400 font-mono break-all">{g.email}</p>
              <button
                type="button"
                onClick={() => copyEmail(g.email)}
                className="shrink-0 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
              >
                {copiedEmail === g.email ? "Copied" : "Copy email"}
              </button>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">{g.passwordHint}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
