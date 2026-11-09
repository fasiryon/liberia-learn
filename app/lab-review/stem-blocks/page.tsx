import type { Metadata } from "next";
import { notFound } from "next/navigation";
import "@/components/experience/day/day.css";
import { CodeRunnerBlock, CodeTraceBlock, type CodeRunnerData, type CodeTraceData } from "@/components/experience/blocks/stem/CodeTraceBlock";
import { GridRobotBlock } from "@/components/experience/blocks/stem/GridRobotBlock";
import { DesignCycleBlock } from "@/components/experience/blocks/stem/DesignCycleBlock";
import { MeasurementTableBlock } from "@/components/experience/blocks/stem/MeasurementTableBlock";
import { ActivityScope } from "@/components/experience/blocks/stem/ActivityScope";
import { GraphBuilderBlock } from "@/components/experience/blocks/stem/GraphBuilderBlock";
import { ObservationLogBlock, type ObservationLogData } from "@/components/experience/blocks/stem/ObservationLogBlock";
import { AudioPromptBlock, type AudioPromptData } from "@/components/experience/blocks/stem/AudioPromptBlock";
import type { GraphBuilderData } from "@/lib/learner-experience/stem/graphBuilder";
import type { DesignCycleData } from "@/lib/learner-experience/stem/designCycle";
import type { MeasurementTableData } from "@/lib/learner-experience/stem/measurementTable";
import type { GridRobotData } from "@/lib/learner-experience/stem/gridRobot";
import { isLearnerExperiencePrototypeEnabled } from "@/lib/learner-experience/prototypeRoute";

// Reviewer bench for teaching-blocks/1.2.0 DRAFT STEM renderers. Dev-only and reviewer-only (same gate as
// /lab-review/v4-lessons). The examples are T1 component fixtures for testing the renderers; they are not lesson
// content, not factory output and not shown to students.
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "STEM block bench · LiberiaLearn", robots: { index: false, follow: false } };

const TRACE: CodeTraceData = { type: "CODE_TRACE", id: "fixture-trace", language: "llcode/1.0.0", watch: ["count", "r"], maxTraceSteps: 40,
  prompt: "Component fixture: a loop counts readings at or above the limit.", inputs: { readings: [12, 30, 7, 41], limit: 30 },
  program: "count = 0\nfor r in readings:\n    if r >= limit:\n        count += 1\nprint(count)" };
const RUNNER: CodeRunnerData = { type: "CODE_RUNNER", id: "fixture-runner", language: "llcode/1.0.0", title: "Find and fix the bug",
  prompt: "Component fixture: this should count readings at or above the limit, but one test fails. Fix it.",
  starter: "count = 0\nfor r in readings:\n    if r > limit:\n        count += 1\nprint(count)",
  visibleTests: [{ id: "at-limit", label: "limit 30 counts 30 and 41", inputs: { readings: [12, 30, 7, 41], limit: 30 }, expectedStdout: "2" },
    { id: "above-all", label: "limit 50 counts nothing", inputs: { readings: [12, 30, 7, 41], limit: 50 }, expectedStdout: "0" }],
  limits: { sourceChars: 4000, astNodes: 800, steps: 50_000, timeoutMs: 1500, callDepth: 16, listLength: 200, stringLength: 400, allocatedCells: 20_000, outputLines: 50, outputBytes: 4096, traceEntries: 500 } };
const ROBOT: GridRobotData = { type: "GRID_ROBOT_PROGRAM", id: "fixture-robot", prompt: "Component fixture: move the robot to the flag without touching a rock.",
  grid: { rows: 4, columns: 5 }, start: { row: 0, column: 0 }, goal: { row: 3, column: 4 }, obstacles: [{ row: 1, column: 1 }, { row: 2, column: 3 }],
  allowedMoves: ["NORTH", "SOUTH", "EAST", "WEST"], maxSteps: 12, starter: ["EAST", "SOUTH", "SOUTH"] };

const DESIGN: DesignCycleData = { type: "DESIGN_CYCLE", id: "fixture-design", brief: "Component fixture: design a cover that keeps rain out of a water bucket.",
  criteria: [{ id: "leak", description: "Keeps water out", measure: "Water that got through", unit: "ml", comparison: "AT_MOST", target: 20 },
    { id: "hold", description: "Stays on in wind", measure: "Seconds it stays on under the fan", unit: "s", comparison: "AT_LEAST", target: 30 }],
  constraints: ["Use only paper, plastic and string.", "It must fit the class bucket."], safety: ["Wipe up spilled water at once.", "Keep the fan cable away from water."],
  testPlan: ["Pour one cup of water over the cover.", "Measure the water in the bucket.", "Run the fan and time how long the cover stays on."], maxIterations: 3 };
const TABLE: MeasurementTableData = { type: "MEASUREMENT_TABLE", id: "fixture-table", title: "Component fixture: water that got through each cover", origin: "MEASURED_BY_LEARNER",
  originNote: "Measure with the class cup.", columns: [{ id: "ml", label: "Water that got through", unit: "ml", precision: 0, minimum: 0, maximum: 250 },
    { id: "secs", label: "Time to soak", unit: "s", precision: 1, minimum: 0, maximum: 600 }],
  trials: [{ ml: null, secs: null }, { ml: null, secs: null }, { ml: null, secs: null }], derived: ["MEAN", "RANGE"] };

const GRAPH: GraphBuilderData = { type: "GRAPH_BUILDER", id: "fixture-graph", prompt: "Component fixture: graph the water that got through in each trial.", sourceBlockId: "fixture-table",
  allowedKinds: ["BAR", "LINE"], axisRules: { xColumn: "secs", yColumn: "ml", zeroBaselineRequired: true } };
const OBSERVE: ObservationLogData = { type: "OBSERVATION_LOG", id: "fixture-observe", prompt: "Component fixture: what happened to the ice in the sun?", origin: "MEASURED_BY_LEARNER",
  fields: [{ id: "saw", label: "What I saw" }, { id: "think", label: "What I think happened" }], maxEntries: 3, responseModes: ["ORAL_WITH_SCRIBE", "DRAWING", "TEXT"] };
const AUDIO: AudioPromptData = { type: "AUDIO_PROMPT", id: "fixture-audio", text: "Component fixture: put the ice in the sun, then watch it for five minutes.", lang: "en-LR", fallback: "TEXT_AND_TEACHER_READ_ALOUD", autoplay: false };

export default function StemBlockBench() {
  if (!isLearnerExperiencePrototypeEnabled(process.env)) notFound();
  return <main className="ll7-day ll3-scope" data-stem-bench>
    <h1 className="ll7-day-title">STEM block bench (registry 1.2.0 draft)</h1>
    <p className="ll7-day-rehearsal">Reviewer bench. The examples below are component test fixtures, not lessons.</p>
    <CodeTraceBlock block={TRACE} />
    <CodeRunnerBlock block={RUNNER} />
    <GridRobotBlock block={ROBOT} />
    <DesignCycleBlock block={DESIGN} />
    <ActivityScope>
      <MeasurementTableBlock block={TABLE} />
      <GraphBuilderBlock block={GRAPH} />
    </ActivityScope>
    <AudioPromptBlock block={AUDIO} />
    <ObservationLogBlock block={OBSERVE} />
  </main>;
}
