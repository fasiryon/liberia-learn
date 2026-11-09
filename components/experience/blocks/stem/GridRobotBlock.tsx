"use client";

/**
 * GRID_ROBOT_PROGRAM (teaching-blocks/1.2.0 DRAFT prototype), K-5. Build a sequence of arrow moves, run it one step
 * at a time, and debug the move that fails. Large targets; every state is also stated in text for screen readers.
 * Formative only: nothing is scored, saved or recorded.
 */
import "./stem.css";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Flag, Bot } from "lucide-react";
import { MOVE_WORDS, robotFeedback, runRobot, validateGridRobot, type Cell, type GridRobotData, type Move } from "@/lib/learner-experience/stem/gridRobot";

const ARROW = { NORTH: ArrowUp, SOUTH: ArrowDown, WEST: ArrowLeft, EAST: ArrowRight } as const;
const WORD: Record<Move, string> = MOVE_WORDS;
const cellName = (c: Cell) => `row ${c.row + 1}, column ${c.column + 1}`;

export function GridRobotBlock({ block }: { block: GridRobotData }) {
  const data = useMemo(() => validateGridRobot(block), [block]);
  const [program, setProgram] = useState<Move[]>([...(data.starter ?? [])]);
  const [shown, setShown] = useState(-1); // index of the last step shown while stepping
  const [announce, setAnnounce] = useState("");
  const run = useMemo(() => runRobot(data, program), [data, program]);
  const visible = shown < 0 ? [] : run.steps.slice(0, shown + 1);
  const robot = visible.length ? visible[visible.length - 1].to : data.start;
  const done = shown >= run.steps.length - 1 && shown >= 0;
  const id = `gr-${data.id}`;
  const edit = (next: Move[]) => { setProgram(next); setShown(-1); };
  const stepOnce = () => {
    const i = Math.min(shown + 1, run.steps.length - 1);
    if (i < 0) { setAnnounce("Add a move first."); return; }
    setShown(i);
    const s = run.steps[i];
    setAnnounce(s.outcome === "MOVED" ? `Move ${i + 1}: ${WORD[s.move]}. The robot is at ${cellName(s.to)}.${i === run.steps.length - 1 ? ` ${robotFeedback(data, run, program.length)}` : ""}`
      : robotFeedback(data, run, program.length));
  };

  return (
    <section className="ll8-block ll8-robot" aria-labelledby={`${id}-title`} data-block-type="GRID_ROBOT_PROGRAM">
      <h3 id={`${id}-title`} className="ll8-title">Program the robot</h3>
      <p>{data.prompt}</p>
      <p className="ll8-muted">The robot starts at {cellName(data.start)}. The flag is at {cellName(data.goal)}.{data.obstacles.length ? ` Rocks at ${data.obstacles.map(cellName).join("; ")}.` : ""}</p>
      <div className="ll8-grid" role="img" aria-label={`Grid ${data.grid.rows} by ${data.grid.columns}. Robot at ${cellName(robot)}. Flag at ${cellName(data.goal)}.`}
        style={{ gridTemplateColumns: `repeat(${data.grid.columns}, minmax(0, 1fr))` }} data-robot-at={`${robot.row},${robot.column}`}>
        {Array.from({ length: data.grid.rows * data.grid.columns }, (_, i) => {
          const c = { row: Math.floor(i / data.grid.columns), column: i % data.grid.columns };
          const rock = data.obstacles.some((o) => o.row === c.row && o.column === c.column), here = robot.row === c.row && robot.column === c.column, flag = data.goal.row === c.row && data.goal.column === c.column;
          const path = visible.some((s) => s.to.row === c.row && s.to.column === c.column);
          return <div key={i} className="ll8-cell" data-rock={rock ? "" : undefined} data-path={path ? "" : undefined} aria-hidden="true">
            {here ? <Bot size={26} /> : flag ? <Flag size={24} /> : rock ? "▲" : null}
          </div>;
        })}
      </div>

      <div className="ll8-palette" role="group" aria-label="Add a move">
        {data.allowedMoves.map((m) => { const Icon = ARROW[m];
          return <button key={m} type="button" className="ll3-btn ll8-move" disabled={program.length >= data.maxSteps} onClick={() => { edit([...program, m]); setAnnounce(`Added ${WORD[m]}. ${program.length + 1} moves.`); }}>
            <Icon aria-hidden="true" size={26} /><span>{WORD[m]}</span></button>; })}
      </div>
      <ol className="ll8-program" aria-label={`Your program, ${program.length} of ${data.maxSteps} moves`}>
        {program.map((m, i) => { const Icon = ARROW[m], failed = run.stoppedAt === i && !run.reachedGoal && shown >= i;
          return <li key={i} data-failed={failed ? "" : undefined} aria-current={shown === i ? "step" : undefined}>
            <span><Icon aria-hidden="true" size={20} /> {i + 1}. {WORD[m]}</span>
            <button type="button" className="ll8-remove" aria-label={`Remove move ${i + 1}, ${WORD[m]}`} onClick={() => { edit(program.filter((_, j) => j !== i)); setAnnounce(`Removed move ${i + 1}.`); }}>×</button>
          </li>; })}
      </ol>
      <div className="ll8-controls">
        <button type="button" className="ll3-btn" data-primary="" onClick={stepOnce} disabled={!program.length || done}>Step</button>
        <button type="button" className="ll3-btn" onClick={() => { setShown(run.steps.length - 1); setAnnounce(robotFeedback(data, run, program.length)); }} disabled={!program.length}>Run all</button>
        <button type="button" className="ll3-btn" onClick={() => { setShown(-1); setAnnounce("The robot is back at the start."); }}>Back to start</button>
        <button type="button" className="ll3-btn" onClick={() => { edit([...(data.starter ?? [])]); setAnnounce("Program reset."); }}>Reset program</button>
      </div>
      {done && <p role="status" className="ll8-feedback" data-robot-result={run.reason}>{robotFeedback(data, run, program.length)}</p>}
      <p className="ll8-sr" aria-live="polite">{announce}</p>
    </section>
  );
}
