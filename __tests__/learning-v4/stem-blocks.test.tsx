// teaching-blocks/1.2.0 DRAFT STEM renderers on T2's proposed field shapes (stemBlockContracts.ts):
// GRID_ROBOT_PROGRAM logic, CODE_TRACE / CODE_RUNNER render contract, presets and limit mapping.
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { robotFeedback, runRobot, shortestPath, validateGridRobot, type GridRobotData } from "@/lib/learner-experience/stem/gridRobot";
import { GridRobotBlock } from "@/components/experience/blocks/stem/GridRobotBlock";
import { CodeRunnerBlock, CodeTraceBlock, toInterpreterLimits, type CodeRunnerLimits } from "@/components/experience/blocks/stem/CodeTraceBlock";
import { LLCODE_LIMITS, runLLCode } from "@/lib/learner-experience/stem/llcode";

const task: GridRobotData = { type: "GRID_ROBOT_PROGRAM", id: "t", prompt: "Reach the flag.", grid: { rows: 3, columns: 4 }, start: { row: 0, column: 0 }, goal: { row: 2, column: 3 },
  obstacles: [{ row: 1, column: 1 }], allowedMoves: ["NORTH", "SOUTH", "EAST", "WEST"], maxSteps: 10 };
const limits: CodeRunnerLimits = { sourceChars: 4000, astNodes: 800, steps: 50_000, timeoutMs: 1500, callDepth: 16, listLength: 200, stringLength: 400,
  allocatedCells: 20_000, outputLines: 50, outputBytes: 4096, traceEntries: 500 };

describe("GRID_ROBOT_PROGRAM", () => {
  it("walks a correct program to the goal and suggests the shortest route", () => {
    expect(shortestPath(task)).toBe(5);
    const run = runRobot(task, ["EAST", "EAST", "SOUTH", "SOUTH", "EAST"]);
    expect(run).toMatchObject({ reachedGoal: true, reason: "GOAL", stoppedAt: 4, end: { row: 2, column: 3 } });
    expect(robotFeedback(task, run, 5)).toBe("The robot reached the goal.");
    expect(robotFeedback(task, runRobot(task, ["SOUTH", "SOUTH", "EAST", "EAST", "EAST", "NORTH"]), 6)).toContain("moves after that are not needed");
  });
  it("stops at edges and rocks and names the move to change", () => {
    const wall = runRobot(task, ["NORTH"]);
    expect(wall).toMatchObject({ reason: "WALL", stoppedAt: 0, end: { row: 0, column: 0 } });
    expect(robotFeedback(task, wall, 1)).toBe("Move 1 (north (up)) runs into the edge. Change that move.");
    expect(runRobot(task, ["SOUTH", "EAST"])).toMatchObject({ reason: "OBSTACLE", stoppedAt: 1 });
    expect(robotFeedback(task, runRobot(task, ["EAST"]), 1)).toContain("Add more moves");
  });
  it("mirrors the contract refinements and rejects tasks it cannot show faithfully", () => {
    expect(() => validateGridRobot({ ...task, grid: { rows: 11, columns: 4 } })).toThrow("grid_size");
    expect(() => validateGridRobot({ ...task, obstacles: [{ row: 0, column: 0 }] })).toThrow("grid_obstacles");
    expect(() => validateGridRobot({ ...task, obstacles: [{ row: 1, column: 1 }, { row: 1, column: 1 }] })).toThrow("grid_duplicates");
    expect(() => validateGridRobot({ ...task, obstacles: [{ row: 1, column: 3 }, { row: 2, column: 2 }] })).toThrow("grid_unsolvable");
    expect(() => validateGridRobot({ ...task, starter: Array(11).fill("NORTH") })).toThrow("grid_starter");
    expect(validateGridRobot(task)).toBe(task);
  });
  it("renders a text description of the grid and large compass move buttons", () => {
    const html = renderToStaticMarkup(<GridRobotBlock block={task} />);
    expect(html).toContain("The robot starts at row 1, column 1. The flag is at row 3, column 4. Rocks at row 2, column 2.");
    expect(html.match(/ll8-move/g)?.length).toBe(4);
    expect(html).toContain("north (up)");
  });
});

describe("CODE_TRACE / CODE_RUNNER", () => {
  it("CODE_TRACE shows the program and starting values as text, never as markup", () => {
    const html = renderToStaticMarkup(<CodeTraceBlock block={{ type: "CODE_TRACE", id: "x", prompt: "Trace it.", language: "llcode/1.0.0",
      program: 'print("<b>hi</b>")\nx = 1', inputs: { limit: 30 }, watch: ["x"], maxTraceSteps: 20 }} />);
    expect(html).toContain("&lt;b&gt;hi&lt;/b&gt;");
    expect(html).not.toContain("<b>hi</b>");
    expect(html).toContain("Starting values: limit = 30");
    expect(html).toContain('data-line="2"');
  });
  it("CODE_RUNNER offers an editor and its visible tests", () => {
    const html = renderToStaticMarkup(<CodeRunnerBlock block={{ type: "CODE_RUNNER", id: "y", title: "Fix the counter", prompt: "Fix it.", language: "llcode/1.0.0",
      starter: "print(1)", visibleTests: [{ id: "a", label: "two", inputs: {}, expectedStdout: "2" }, { id: "b", label: "three", inputs: {}, expectedStdout: "3" }], limits }} />);
    expect(html).toContain("<textarea");
    expect(html).toContain("Run the tests");
  });
  it("block limits map onto the interpreter and can only tighten it", () => {
    expect(toInterpreterLimits(limits)).toMatchObject({ steps: 50_000, timeoutMs: 1500, listLength: 200, stringLength: 400, outputBytes: 4096 });
    const loose = toInterpreterLimits({ ...limits, stringLength: 4096 });
    expect(runLLCode("s = 'x' * 2000\nprint(len(s))", { limits: loose }).error?.kind).toBe("LIMIT"); // clamped to 1,000
    expect(LLCODE_LIMITS.stringLength).toBe(1_000);
  });
  it("named inputs become bounded preset variables", () => {
    expect(runLLCode("count = 0\nfor r in readings:\n    if r >= limit:\n        count += 1\nprint(count)", { presets: { readings: [12, 30, 7, 41], limit: 30 } }).output).toEqual(["2"]);
    for (const bad of [{ __proto__x: 1 }, { print: 1 }, { "constructor": 1 }, { if: 1 }, { x: 1.5 }, { "a b": 1 }] as Array<Record<string, number>>) expect(runLLCode("print(1)", { presets: bad }).ok).toBe(false);
    expect(runLLCode("print(len(xs))", { presets: { xs: Array(1001).fill(0) } }).error?.kind).toBe("LIMIT");
  });
});
