import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
// core.autocrlf checkouts use CRLF; normalise so contract phrases match on every platform.
const read = (file: string) => readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");

function parseAgent(file: string) {
  const text = read(file);
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`${file} has no frontmatter`);
  const fields = Object.fromEntries(match[1].split(/\r?\n/).map((line) => { const index = line.indexOf(":"); return [line.slice(0, index).trim(), line.slice(index + 1).trim()]; }));
  const tools = (fields.tools ?? "").replace(/^\[|\]$/g, "").split(",").map((tool: string) => tool.trim()).filter(Boolean);
  return { fields, tools, body: match[2] };
}

const TEAM = {
  "lab-pedagogy-director": ["LEARNING GOAL", "WHAT STUDENT SHOULD UNDERSTAND", "WHY SIMULATION HELPS", "WHAT MUST REMAIN PHYSICAL/PRACTICAL", "MISCONCEPTIONS", "GUIDED EXPERIENCE", "EXPLORE EXPERIENCE", "CHALLENGE", "DIRECT-MANIPULATION ASSESSMENT", "EVIDENCE BOUNDARY", "BLOCKED_ON_AUTHORITY", "TIER", "PROPOSED — NOT GOVERNED"],
  "lab-experience-director": ["EXPERIENCE SHOT LIST / INTERACTION STORYBOARD", "REFERENCE BENCHMARK", "3–6 reference captures", "visual hierarchy", "camera", "pacing", "discoverability", "moments of delight", "Never propose copying proprietary", "RUNTIME_GAP"],
  "lab-asset-director": ["procedural", "glTF/GLB", "generated asset", "ART DIRECTION", "BUDGETS PER PROFILE", "LOD STRATEGY", "COMPRESSION AND OFFLINE PACKAGING", "REUSABLE LIBRARY", "PROVENANCE TABLE", "No proprietary, unlicensed"],
  "lab-simulation-architect": ["STATE VARIABLES", "SIMULATION RULES", "CONSTRAINTS AND INVALID STATES", "COMPONENT RELATIONSHIPS", "PROCESS FLOWS", "EXPECTED CONSEQUENCES", "DETERMINISTIC TEST FIXTURES", "Simulation truth is separate from renderer behaviour"],
  "lab-visual-reviewer": ["Review the rendered result, not the source", "FALLBACK_2D", "P0", "P1", "P2", "NOT REVIEWED"],
  "lab-interaction-reviewer": ["touch", "mouse", "keyboard", "Never target a deployed", "reset/recovery", "P0", "NOT REVIEWED"],
  "lab-science-reviewer": ["ACCURATE", "PEDAGOGICAL_SIMPLIFICATION", "MISLEADING", "INCORRECT", "Any INCORRECT scientific or mathematical behaviour, label or explanation is P0"],
  "lab-performance-reviewer": ["HIGH", "STANDARD", "LOW", "FALLBACK_2D", "OFFLINE PACKAGE", "Never claim physical-device performance", "NOT MEASURED", "STATIC_BUDGETS", "valid for composition and labels only", "RUNTIME EXTENSION PROPOSALS"],
  "lab-design-director": ["WOULD A STUDENT WANT TO USE THIS?", "IS THE LEARNING PURPOSE OBVIOUS?", "TECH DEMO", "IS THE SIMULATION MEMORABLE?", "DOES IT SHIP?", "VERDICT: SHIP | DO_NOT_SHIP", "REVIEW_ROUNDS_INCOMPLETE", "not curriculum approval", "BEATS", "BELOW", "SHIP_CANDIDATE", "RUNTIME EXTENSION PROPOSALS"],
} as const;
const EDIT_TOOLS = ["Edit", "Write", "NotebookEdit", "MultiEdit"];

describe("interactive lab production team", () => {
  it("defines every team agent with matching name, description and high effort", () => {
    for (const name of Object.keys(TEAM)) {
      const { fields } = parseAgent(`.claude/agents/${name}.md`);
      expect(fields.name, name).toBe(name);
      expect(fields.description.length, name).toBeGreaterThan(40);
      expect(fields.effort, name).toBe("high");
    }
  });

  it("no team agent can edit files; only the main-session builder edits", () => {
    for (const name of Object.keys(TEAM)) {
      const { tools, body } = parseAgent(`.claude/agents/${name}.md`);
      expect(tools.length, name).toBeGreaterThan(0);
      expect(tools.filter((tool) => EDIT_TOOLS.includes(tool)), name).toEqual([]);
      expect(body, name).toMatch(/never (write or )?edit|never edits|you never edit|Never edits|Review only/i);
    }
  });

  it("each agent carries its required output contract", () => {
    for (const [name, required] of Object.entries(TEAM)) {
      const { body, fields } = parseAgent(`.claude/agents/${name}.md`);
      for (const phrase of required) expect(`${fields.description}\n${body}`, `${name}: ${phrase}`).toContain(phrase);
    }
  });

  it("reviewers use the shared finding format", () => {
    for (const name of ["lab-visual-reviewer", "lab-interaction-reviewer", "lab-science-reviewer", "lab-performance-reviewer", "lab-design-director"]) {
      expect(parseAgent(`.claude/agents/${name}.md`).body, name).toMatch(/shared format|Lens: VISUAL/);
    }
  });

  it("the builder playbook runs the three rounds with the right reviewers and checkpoints", () => {
    const command = read(".claude/commands/lab-production.md");
    expect(command).toMatch(/Round 1: `lab-visual-reviewer`, `lab-interaction-reviewer`, `lab-science-reviewer`/);
    expect(command).toMatch(/Round 2: `lab-visual-reviewer`, `lab-interaction-reviewer`, `lab-pedagogy-director`/);
    expect(command).toMatch(/Round 3: `lab-design-director`, `lab-performance-reviewer`, `lab-science-reviewer`/);
    expect(command).toContain("commit a checkpoint");
    expect(command).toContain("Never reset, clean\n   or stash");
    expect(command).toContain("No bespoke parallel lab engine");
    expect(command).toContain("capture-lab-review.ts");
  });

  it("the production-team doc names every agent and the protocol pieces", () => {
    const doc = read("docs/architecture/INTERACTIVE_LAB_PRODUCTION_TEAM.md");
    for (const name of Object.keys(TEAM)) expect(doc, name).toContain(`\`${name}\``);
    for (const phrase of ["/lab-production", "P0", "P1", "P2", "Disagreements", "Checkpoints and rollback", "virtual clock", "FALLBACK_2D", "OFFLINE PACKAGE", "PHYSICAL PRACTICAL WHEN AVAILABLE", "Review log template", "Review tiers", "Reference benchmark and ship rule", "SHIP_VERIFIED", "Runtime extension path", "Numeric budgets (locked 2026-09-28)", "TARGET_LOW_DEVICE", "compare-lab-captures.ts"]) expect(doc, phrase).toContain(phrase);
    expect(read("docs/agents/CONTEXT_ROUTING.md")).toContain("INTERACTIVE_LAB_PRODUCTION_TEAM.md");
  });

  it("every lab-* agent file belongs to the documented team", () => {
    const labAgents = readdirSync(path.join(root, ".claude/agents")).filter((file) => file.startsWith("lab-")).map((file) => file.replace(/\.md$/, ""));
    expect(labAgents.sort()).toEqual(Object.keys(TEAM).sort());
  });
});

describe("review harness cannot expose unapproved labs to learners", () => {
  it("the harness page is gated before it renders anything", () => {
    const page = read("app/lab-review/[labId]/page.tsx");
    expect(page.indexOf("isLabReviewHarnessEnabled(process.env)")).toBeGreaterThan(-1);
    expect(page.indexOf("isLabReviewHarnessEnabled(process.env)")).toBeLessThan(page.indexOf("getInteractiveLabDefinition(params.labId)"));
    expect(page).toContain("notFound()");
  });

  it("only the review harness passes reviewPreview to the player", () => {
    const learnerPage = read("app/student/interactive-labs/[labId]/page.tsx");
    expect(learnerPage).not.toContain("reviewPreview");
    expect(learnerPage).toContain('definition.reviewState !== "APPROVED"');
    expect(read("components/interactive-labs/v2/review/LabReviewHarness.tsx")).toContain("reviewPreview={preview}");
  });

  it("middleware exempts the harness from login only outside production builds", () => {
    expect(read("middleware.ts")).toContain('...(process.env.NODE_ENV !== "production" ? ["/lab-review"] : [])');
  });
});
