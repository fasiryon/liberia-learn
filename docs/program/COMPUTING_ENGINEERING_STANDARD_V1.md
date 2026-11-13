# Computing and Engineering Instructional Standard V1

Status: **program standard (CoS), 2026-10-23.** It responds to founder item 9: Computing and Engineering get their own teaching standards and are never filed as Science because the generator lacks a pattern.

Machine-readable contract: `curriculum/program/stem-v1/source/standards.cjs`. Each part has a consumer:

- **T2 (Content Factory)** generates to the contract. Every Computing or Engineering generation order in `curriculum/program/stem-v1/generation-backlog.json` carries the pattern, the subject code, the band competencies and the block needs.
- **T1 (Student Experience)** implements the two patterns in `lib/learner-experience/teaching/instruction.ts` as an additive `liberialearn-v4-instruction/1.1.0`, and the blocks below in the teaching-block registry. Each change is proposed in a T1-*.md file first and acknowledged by T2.
- **CoS** audits every package against it (`scripts/cos-stem/g3-audit.cjs`; checks `SUBJECT_RECORDED_WRONG` and `PATTERN_MISMATCH`).

## Why this is needed now

All four Computing and Engineering lessons in the current factory batch (`schoolday.1-draft.2`) record subject `SCIENCE` and follow the science pattern (PREDICT > EXPERIMENT > OBSERVE > EXPLAIN > APPLY). Their content can be good, but their structure does not ask learners to decompose, debug, define criteria or refine a design. The current V4 standard knows only four families, so it cannot check them.

## Teaching patterns

| Family | Pattern (in order) | Recorded subject |
| --- | --- | --- |
| COMPUTING | PREDICT → DECOMPOSE → DEMONSTRATE → BUILD_WITH_SUPPORT → BUILD_INDEPENDENTLY → TEST → DEBUG → APPLY | `COMPUTER_SCIENCE` |
| ENGINEERING | DEFINE → RESEARCH_CONSTRAINTS → DESIGN → BUILD_OR_MODEL → TEST → REFINE → COMMUNICATE | `ENGINEERING_FOUNDATIONS` |

These patterns reconcile T2's proposals (`T2-STEM-K12-ACK.md`):

- **Computing:** T2 proposed ALGORITHM → TRACE → IMPLEMENT → TEST → DEBUG. Mapping: ALGORITHM = DECOMPOSE plus a worked DEMONSTRATE trace; IMPLEMENT = BUILD_WITH_SUPPORT then BUILD_INDEPENDENTLY. TEST was adopted from T2. The guided/independent split stays because V4 independence rules need it.
- **Engineering:** T2 proposed DEFINE → DESIGN → BUILD → TEST → IMPROVE. It is covered by the pattern above (IMPROVE = REFINE).

T1 may choose final identifiers when implementing instruction 1.1.0, provided every function above is a distinct phase. The CoS updates this contract to match.

**Runnable code, Grades 6-12.** T2 requires coding beyond paper tracing for older grades, and the CoS agrees. `CODE_RUNNER` must be a deterministic, offline, bounded interpreter for a specified language subset with:

- no `eval`, `Function`, network, filesystem or ambient globals;
- step and memory limits;
- multiple test cases;
- accessible editing;
- observable output.

T1 defines it, T2 acknowledges validation, and a security review is required before any learner uses it.

The shared phases ORIENT, RETRIEVE and ASSESS may appear as in V4. Independence rules match V4: independent phases (BUILD_INDEPENDENTLY, TEST, REFINE) carry no worked steps and no hints.

## What the learner must do, by band

| Band | Computing: the learner… | Engineering: the learner… |
| --- | --- | --- |
| K-2 | gives and follows exact instructions, programs a grid robot with arrows, replaces a repeat with a loop, finds and fixes a wrong step (unplugged or grid) | builds from local materials for a stated need, tests it safely, says what worked and changes one thing |
| 3-5 | writes block programs with sequence, loops and conditionals, names and reuses a procedure, traces, debugs a logic error, represents collected data | states criteria and constraints first, makes two designs, runs a fair test with measurements, improves the design from the data |
| 6-8 | designs an algorithm (flowchart or pseudocode), writes text code with variables, conditionals, loops and functions, traces boundary cases, writes edge-case tests, debugs with evidence, analyses data | writes a brief with measurable criteria, constraints and a budget, predicts performance with maths or science, prototypes or models, tests against criteria, iterates and justifies trade-offs |
| 9-12 | decomposes a real problem into functions and data structures, implements and tests to a specification, compares efficiency with evidence, reasons about security, privacy and fairness, works with real data | specifies requirements for a Liberian problem, analyses with quantitative models (forces, circuits, flow, energy), evaluates alternatives with a decision matrix, tests, analyses failure and documents |

Evidence the lesson must leave is listed per band in `standards.cjs`. For example, in 6-8 Computing: code or pseudocode with tests, a trace table, and a corrected bug with the failing test.

## Interactive blocks

| Block | For | Status | Interim, until it exists |
| --- | --- | --- | --- |
| `GRID_ROBOT_PROGRAM` | Computing K-5 | Proposed (T1) | SEQUENCE plus an unplugged floor grid, labelled |
| `BLOCK_PROGRAM` | Computing 3-8 | Proposed (T1) | SEQUENCE / MISTAKE_ANALYSIS with paper programs, labelled |
| `CODE_TRACE` | Computing 6-12 | Proposed (T1) | NUMERIC_RESPONSE trace values plus WRITING_ORGANIZER (as in `g7-computing-water-monitor-algorithms`) |
| `CODE_RUNNER` | Computing 6-12 | Proposed (T1). Needs a security review: sandboxed, offline, no network, no student data. | Paper-traced programs only. Never claim code was executed. |
| `DESIGN_CYCLE` | Engineering K-12 | Proposed (T1) | WRITING_ORGANIZER brief + DATA_PLOT test results |
| `MEASUREMENT_TABLE` | Engineering and Science 3-12 | Proposed (T1) | NUMERIC_RESPONSE + DATA_PLOT (illustrative data labelled) |
| `BUDGET_CONSTRAINT_TABLE` | Engineering 6-12 | Proposed (T1) | NUMERIC_RESPONSE cost rows |
| `OBSERVATION_LOG`, `AUDIO_PROMPT` | K-2 all subjects | Proposed (T1) | Teacher read-aloud; picture SORT and SEQUENCE |

Interim lessons are allowed, but they must use the Computing or Engineering pattern and subject code now. A missing block is never a reason to file the lesson as Science.

## Acceptance (G3, CoS)

A Computing or Engineering lesson passes the standard's part of G3 when all four hold:

1. The recorded subject is `COMPUTER_SCIENCE` or `ENGINEERING_FOUNDATIONS`.
2. At least 60% of its non-shared phases come from its family pattern.
3. It produces the band's required evidence.
4. It passes every general G3 check.

G4 human review then decides whether it actually teaches computing or engineering well.
