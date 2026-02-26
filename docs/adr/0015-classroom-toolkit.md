# ADR 0015: Classroom Toolkit

- Date: 2026-02-26
- Status: Accepted

## Context

LiberiaLearn serves low-bandwidth classrooms with mixed device capabilities. Students need quick access to subject tools during lessons and assessments without leaving the learning flow.

## Decision 1: Context-aware Toolkit (not always-on)

Toolkit tools are shown only when lesson context matches subject, grade band, lesson type, and optional strand key.

Rationale:
- Reduces cognitive load for young learners.
- Prevents irrelevant UI clutter in assessments.

## Decision 2: Draggable Panels (not blocking modals)

Tools open as draggable floating panels.

Rationale:
- Students can reference lesson content while using tools.
- Assessment flow is not interrupted by modal lock-in.

## Decision 3: Bundled Tool Data (not API-dependent)

Tools with datasets (Periodic Table, Dictionary) ship data inline.

Rationale:
- Guarantees offline operation.
- Removes network latency and dependency risk.

## Decision 4: Registry Pattern

Tool discovery and context matching use a central registry (`lib/toolkit/toolRegistry.ts`).

Rationale:
- New tools are added without changing overlay/provider core logic.
- Matching logic is deterministic and testable.

## Decision 5: Category Feature Flags

Toolkit rollout is controlled by master and category-level server flags.

Rationale:
- Progressive rollout safety.
- Fast operational kill-switch by category.

## Decision 6: No localStorage for toolkit state

Panel state remains in component memory only.

Rationale:
- Avoids privacy persistence concerns.
- Maintains SSR compatibility and deterministic render behavior.
