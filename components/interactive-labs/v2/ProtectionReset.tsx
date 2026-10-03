"use client";
// Founder decision 2026-10-02: a latched protection trip (spec.protection) never clears by itself. This is the explicit
// reset. It appears only while the latch is set; while a reset would fail it stays focusable (aria-disabled, not
// disabled) so keyboard and screen-reader users reach the reason, which is shown beside it. After a successful reset
// the button is replaced by a focused "power restored" status, so focus never drops to the page (R3 interaction P1).
import { useEffect, useId, useRef, useState } from "react";
import type { InteractiveLabDefinition, LabAction, LabState } from "@/lib/interactive-labs/v2/types";
import { protectionStatus } from "@/lib/interactive-labs/v2/fidelity/engine";

type Props = { definition: InteractiveLabDefinition<LabState>; state: LabState; dispatch: (action: LabAction) => void; surface: "hud" | "panel" };

export function ProtectionReset({ definition, state, dispatch, surface }: Props) {
  const reasonId = useId();
  const spec = definition.fidelity, fidelity = state.fidelity;
  const status = spec && fidelity ? protectionStatus(spec, fidelity) : null;
  // This surface's reset was accepted when the latch clears after its click. The confirmation then lasts while the
  // variables object is unchanged (camera or panel actions keep it; any load, unit or season change replaces it).
  const [pending, setPending] = useState(false);
  const [restoredAt, setRestoredAt] = useState<Readonly<Record<string, number>> | null>(null);
  const restoredRef = useRef<HTMLParagraphElement>(null);
  const latched = !!status?.latched, variables = fidelity?.variables ?? null;
  useEffect(() => {
    if (!pending || latched) return;
    setPending(false);
    setRestoredAt(variables);
  }, [pending, latched, variables]);
  const showRestored = restoredAt !== null && !latched && variables === restoredAt;
  useEffect(() => { if (showRestored) restoredRef.current?.focus(); }, [showRestored]);

  if (showRestored) {
    return <p ref={restoredRef} tabIndex={-1} role="status" data-lab-protection-restored={surface} className="mt-1.5 rounded-xl border border-emerald-300 bg-emerald-800 px-2.5 py-1 text-sm font-bold text-white">Plant reset: power restored to the city.</p>;
  }
  if (!status?.latched) return null;
  const blocked = status.blocker !== null;
  return (
    <div data-lab-protection-reset={surface} className="mt-1.5 flex flex-wrap items-center gap-2">
      <button type="button" data-lab-control={`protection-reset-${surface}`} aria-disabled={blocked} aria-describedby={blocked ? reasonId : undefined}
        onClick={() => {
          if (blocked) return;
          setPending(true);
          dispatch({ type: "reset-protection" });
        }}
        className={`min-h-11 rounded-full border-2 px-4 text-sm font-bold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${blocked ? "cursor-not-allowed border-slate-500 bg-slate-700 text-slate-300" : "border-white bg-emerald-300 text-slate-950 hover:bg-emerald-200"}`}>
        {status.resetLabel}
      </button>
      {/* The HUD alert above already shows the reason; there it is kept for assistive technology only. */}
      {blocked && <span id={reasonId} data-lab-protection-blocker className={surface === "hud" ? "sr-only" : "text-xs font-semibold text-red-100"}>{status.blocker}</span>}
    </div>
  );
}
