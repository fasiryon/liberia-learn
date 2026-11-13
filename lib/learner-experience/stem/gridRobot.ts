/**
 * GRID_ROBOT_PROGRAM logic (teaching-blocks/1.2.0 DRAFT), field shapes from T2's proposed contract
 * (stemBlockContracts.ts), plus the optional `starter` T1 has asked T2 to add for debugging tasks. A program is a
 * flat list of compass moves (repeats and revisits allowed; CoS ruling removed allowRepeat); running it is a pure,
 * deterministic walk on a bounded grid. Nothing is evaluated.
 */
export type Move = "NORTH" | "SOUTH" | "EAST" | "WEST";
export type Cell = Readonly<{ row: number; column: number }>;
export type GridRobotData = Readonly<{
  type: "GRID_ROBOT_PROGRAM"; id: string; prompt: string; grid: Readonly<{ rows: number; columns: number }>; start: Cell; goal: Cell;
  obstacles: readonly Cell[]; allowedMoves: readonly Move[]; maxSteps: number;
  /** Optional starting program, e.g. one with a bug to find (accepted amendment). */
  starter?: readonly Move[];
}>;
export type RobotStep = Readonly<{ index: number; move: Move; from: Cell; to: Cell; outcome: "MOVED" | "WALL" | "OBSTACLE" }>;
export type RobotRun = Readonly<{ steps: readonly RobotStep[]; end: Cell; reachedGoal: boolean; stoppedAt: number | null; reason: "GOAL" | "WALL" | "OBSTACLE" | "OUT_OF_MOVES" }>;

/** Contract maxima (teaching-blocks/1.2.0): grid 2-10 x 2-10, up to 30 rocks, 1-40 moves. */
export const GRID_LIMITS = Object.freeze({ maxRows: 10, maxColumns: 10, maxObstacles: 30, maxSteps: 40 });
const DELTA: Record<Move, readonly [number, number]> = { NORTH: [-1, 0], SOUTH: [1, 0], WEST: [0, -1], EAST: [0, 1] };
/** North is up on the screen. Learners see both words. */
export const MOVE_WORDS: Record<Move, string> = { NORTH: "north (up)", SOUTH: "south (down)", WEST: "west (left)", EAST: "east (right)" };
const same = (a: Cell, b: Cell) => a.row === b.row && a.column === b.column;

/** Mirrors the contract's refinements and adds the T1 render checks (solvable, starter legal). */
export function validateGridRobot(data: GridRobotData) {
  const { rows, columns } = data.grid ?? ({} as never);
  const inside = (c: Cell) => Number.isInteger(c?.row) && Number.isInteger(c?.column) && c.row >= 0 && c.column >= 0 && c.row < rows && c.column < columns;
  if (data.type !== "GRID_ROBOT_PROGRAM") throw Error("grid_type");
  if (!Number.isInteger(rows) || !Number.isInteger(columns) || rows < 2 || columns < 2 || rows > GRID_LIMITS.maxRows || columns > GRID_LIMITS.maxColumns) throw Error("grid_size");
  if (!inside(data.start) || !inside(data.goal) || same(data.start, data.goal)) throw Error("grid_endpoints");
  if (data.obstacles.length > GRID_LIMITS.maxObstacles || data.obstacles.some((o) => !inside(o) || same(o, data.start) || same(o, data.goal))) throw Error("grid_obstacles");
  if (new Set(data.obstacles.map((o) => `${o.row}:${o.column}`)).size !== data.obstacles.length || new Set(data.allowedMoves).size !== data.allowedMoves.length) throw Error("grid_duplicates");
  if (!data.allowedMoves.length || data.allowedMoves.some((m) => !(m in DELTA))) throw Error("grid_moves");
  if (!Number.isInteger(data.maxSteps) || data.maxSteps < 1 || data.maxSteps > GRID_LIMITS.maxSteps) throw Error("grid_max_steps");
  if ((data.starter ?? []).length > data.maxSteps || (data.starter ?? []).some((m) => !data.allowedMoves.includes(m))) throw Error("grid_starter");
  if (!shortestPath(data)) throw Error("grid_unsolvable");
  return data;
}

/** Runs a program. A move into an edge or a rock stops the robot there (the failing step is reported). */
export function runRobot(data: GridRobotData, program: readonly Move[]): RobotRun {
  const steps: RobotStep[] = [];
  let at = data.start;
  for (const [index, move] of program.slice(0, data.maxSteps).entries()) {
    const [dr, dc] = DELTA[move], to = { row: at.row + dr, column: at.column + dc };
    const wall = to.row < 0 || to.column < 0 || to.row >= data.grid.rows || to.column >= data.grid.columns, blocked = !wall && data.obstacles.some((o) => same(o, to));
    if (wall || blocked) { steps.push({ index, move, from: at, to: at, outcome: wall ? "WALL" : "OBSTACLE" }); return { steps, end: at, reachedGoal: false, stoppedAt: index, reason: wall ? "WALL" : "OBSTACLE" }; }
    steps.push({ index, move, from: at, to, outcome: "MOVED" });
    at = to;
    if (same(at, data.goal)) return { steps, end: at, reachedGoal: true, stoppedAt: index, reason: "GOAL" };
  }
  return { steps, end: at, reachedGoal: false, stoppedAt: null, reason: "OUT_OF_MOVES" };
}

/** Breadth-first shortest move count, used to validate tasks and to say "you could do it in fewer moves". */
export function shortestPath(data: GridRobotData): number | null {
  const key = (c: Cell) => c.row * data.grid.columns + c.column, seen = new Set([key(data.start)]);
  let frontier: Cell[] = [data.start];
  for (let depth = 1; frontier.length && depth <= data.maxSteps; depth++) {
    const next: Cell[] = [];
    for (const c of frontier) for (const m of data.allowedMoves) {
      const [dr, dc] = DELTA[m], to = { row: c.row + dr, column: c.column + dc };
      if (to.row < 0 || to.column < 0 || to.row >= data.grid.rows || to.column >= data.grid.columns || data.obstacles.some((o) => same(o, to)) || seen.has(key(to))) continue;
      if (same(to, data.goal)) return depth;
      seen.add(key(to)); next.push(to);
    }
    frontier = next;
  }
  return null;
}

/** Formative feedback in plain words. Never a score. */
export function robotFeedback(data: GridRobotData, run: RobotRun, programLength: number) {
  const best = shortestPath(data), move = (i: number) => MOVE_WORDS[run.steps[i].move];
  if (run.reachedGoal) return programLength > (run.stoppedAt ?? 0) + 1 ? `The robot reached the goal at move ${run.stoppedAt! + 1}. The moves after that are not needed.`
    : best !== null && programLength > best ? `The robot reached the goal. Can you find a way with only ${best} moves?` : "The robot reached the goal.";
  if (run.reason === "WALL") return `Move ${run.stoppedAt! + 1} (${move(run.stoppedAt!)}) runs into the edge. Change that move.`;
  if (run.reason === "OBSTACLE") return `Move ${run.stoppedAt! + 1} (${move(run.stoppedAt!)}) runs into a rock. Change that move.`;
  return "The robot stopped before the goal. Add more moves.";
}
