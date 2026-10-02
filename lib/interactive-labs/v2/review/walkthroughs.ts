// Keyboard-only walkthroughs for the review harness: every step is reached with Tab and activated with Enter, so a
// passing walkthrough proves the lab's challenge and checks can be completed without a pointer. Data only; the runner
// is scripts/labs/interaction-walkthrough.ts.

export type WalkthroughStep =
  | { press: string; match?: "exact" | "prefix"; repeat?: number; note?: string }
  | { expectStatus: string; note?: string };

export type LabWalkthrough = { labId: string; scenario: string; steps: WalkthroughStep[] };

const CHECK = { press: "Check my work" } as const;
const CORRECT = { expectStatus: "Nice work" } as const;

/** Mount Coffee: solve the dry-season challenge, then complete all five direct-manipulation checks in order. */
const HYDROPOWER: LabWalkthrough = {
  labId: "mount-coffee-hydropower",
  scenario: "hydro-overview",
  steps: [
    { press: "Challenge", note: "challenge mode: starts dry, four units, hospital only (under-loaded)" },
    { press: "Shops: one block on", note: "add what fits: 4 + 4 MW of about 10 MW" },
    { expectStatus: "Challenge met", note: "dry-season challenge solved by keyboard alone" },
    { press: "Assessment", note: "assessment starts fresh: rainy season, full load" },
    // trace-water: the panel lists the traceable nodes alphabetically; press them in water order.
    ...["headpond", "intake", "penstock", "turbine", "tailrace", "downstream"].map((label) => ({ press: label })),
    CHECK, CORRECT,
    // find-generator: open the cutaway, then inspect the generator from the collapsed parts list.
    { press: "Open the powerhouse section" },
    { press: "Parts and traces" },
    { press: "Generator" },
    CHECK, CORRECT,
    // dry-season-output: four units are already on; the season sets what the river allows.
    { press: "Season: Dry" },
    CHECK, CORRECT,
    // dry-season-peak: shed what does not fit (keep the hospital and one shops block).
    { press: "Homes: one block off", repeat: 4 },
    { press: "Shops: one block off", repeat: 3 },
    CHECK, CORRECT,
    // repair-unit-3: take unit 3 apart and rebuild it in its slots.
    { press: "Take the", match: "prefix" },
    { press: "Runner" }, { press: "Runner position", match: "prefix" },
    { press: "Shaft" }, { press: "Shaft position", match: "prefix" },
    { press: "Generator" }, { press: "Generator position", match: "prefix" },
    CHECK, CORRECT,
  ],
};

export const LAB_WALKTHROUGHS: Readonly<Record<string, LabWalkthrough>> = Object.freeze({ [HYDROPOWER.labId]: HYDROPOWER });
