"use client";

import { UnitProgressList } from "@/components/student/learn/UnitProgressList";
import { useLearnRead } from "@/components/student/learn/useLearnRead";
import { validActiveUnits, type ActiveUnitsEnvelope } from "@/components/student/learn/learnPresentation";

/**
 * Units the learner's classes are moving through this week, in server order.
 * A failed load says so; only a confirmed empty list renders the empty line.
 */
export function ThisWeeksUnits() {
  const [units] = useLearnRead<ActiveUnitsEnvelope>("/api/student/units/active", validActiveUnits);
  const rows = units.data?.items ?? [];
  const envelope = units.data;
  return <section data-tour="this-weeks-units" aria-labelledby="this-weeks-units-heading">
    <h2 id="this-weeks-units-heading">This week&apos;s units</h2>
    {units.state === "loading" ? <p role="status" className="pdv2-meta">Loading units…</p>
      : units.state !== "ready" && !units.stale ? <p role="status" className="pdv2-learn-notice">{units.error ?? "Units could not load."} This does not mean you have none.</p>
      : envelope?.eligibility === "not_enrolled" ? <p className="pdv2-learn-empty">You are not enrolled in a class yet, so no units are shown.</p>
      : envelope?.availability === "unavailable" || envelope?.eligibility === "unavailable" ? <p role="status" className="pdv2-learn-notice">Units are unavailable right now. This does not mean you have none.</p>
      : rows.length === 0 ? <p className="pdv2-learn-empty">No units are scheduled for your class this week.</p>
      : <UnitProgressList units={rows} stale={units.stale} />}
  </section>;
}
