// Keyboard-only walkthroughs for the review harness: every step is reached with Tab and activated with Enter, so a
// passing walkthrough proves the lab's challenge and checks can be completed without a pointer. Data only; the runner
// is scripts/labs/interaction-walkthrough.ts.

export type WalkthroughStep =
  /** scope "panel": only a control outside the scene and the scene control bar counts (the 2D scene has same-named parts). */
  | { press: string; match?: "exact" | "prefix"; repeat?: number; scope?: "panel"; note?: string }
  | { expectStatus: string; note?: string };

export type LabWalkthrough = { labId: string; scenario: string; steps: WalkthroughStep[] };

const CHECK = { press: "Check my work" } as const;
const CORRECT = { expectStatus: "Nice work" } as const;

/**
 * Mount Coffee: trip the plant in the dry-season challenge, diagnose and correct it, reset it explicitly (the latched
 * trip, founder decision 2026-10-02), then complete all five direct-manipulation checks in order.
 */
const HYDROPOWER: LabWalkthrough = {
  labId: "mount-coffee-hydropower",
  scenario: "hydro-overview",
  steps: [
    { press: "Challenge", note: "challenge mode: starts dry, four units, hospital only (under-loaded)" },
    { press: "Shops: one block on", repeat: 2, note: "one block too many: 4 + 8 MW of about 10 MW trips the plant" },
    { expectStatus: "Tripped", note: "the trip is reported in the challenge status" },
    { expectStatus: "Reset unavailable: demand is still 2 MW above available generation.", note: "the HUD names the exact shortfall" },
    { press: "Reset plant", note: "reset while still overloaded: focusable but refused (aria-disabled)" },
    { expectStatus: "Tripped", note: "still tripped after the refused reset" },
    { press: "Shops: one block off", note: "correct the overload: 4 + 4 MW fits" },
    { expectStatus: "Demand fits now: press Reset plant", note: "corrected but not reset: power stays off" },
    { press: "Reset plant", note: "explicit recovery" },
    { expectStatus: "Challenge met", note: "dry-season challenge solved by keyboard alone, through trip, diagnosis and reset" },
    { press: "Assessment", note: "assessment starts fresh: rainy season, full load" },
    // trace-water: the panel lists the traceable nodes alphabetically; press them in water order.
    ...["headpond", "intake", "penstock", "turbine", "tailrace", "downstream"].map((label) => ({ press: label, scope: "panel" as const })),
    CHECK, CORRECT,
    // find-generator: open the cutaway, then inspect the generator from the collapsed parts list.
    { press: "Open the powerhouse section" },
    { press: "Parts and traces" },
    { press: "Generator", scope: "panel" },
    CHECK, CORRECT,
    // dry-season-output: four units are already on; the season sets what the river allows.
    { press: "Season: Dry", note: "the full city load in the dry season trips the plant; capability is still about 10 MW" },
    CHECK, CORRECT,
    // dry-season-peak: shed what does not fit (keep the hospital and one shops block).
    { press: "Homes: one block off", repeat: 4 },
    { press: "Shops: one block off", repeat: 3 },
    { press: "Reset plant", note: "the trip from the season change stays latched until reset" },
    CHECK, CORRECT,
    // repair-unit-3: take unit 3 apart and rebuild it in its slots.
    { press: "Take the", match: "prefix" },
    { press: "Runner", scope: "panel" }, { press: "Runner position", match: "prefix", scope: "panel" },
    { press: "Shaft", scope: "panel" }, { press: "Shaft position", match: "prefix", scope: "panel" },
    { press: "Generator", scope: "panel" }, { press: "Generator position", match: "prefix", scope: "panel" },
    CHECK, CORRECT,
  ],
};

export const LAB_WALKTHROUGHS: Readonly<Record<string, LabWalkthrough>> = Object.freeze({ [HYDROPOWER.labId]: HYDROPOWER });
