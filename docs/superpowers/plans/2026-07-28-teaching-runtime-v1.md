# AI Teaching Runtime v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a turn-based AI Teaching Runtime , one live-classroom agent with four internal responsibilities (Teach, Orchestrate/Lesson Director, Verify/Knowledge Guardrails, Ledger) plus Facilitator Whisper Mode and Teaching Recovery , built entirely on Sprint 6.0's existing agent harness, with real per-session cost measured on both an aligned and an unaligned lesson before it is ever called classroom-ready.

**Architecture:** A new `teaching-runtime` `AgentDefinition` registered in the existing `lib/agents/` harness. Each classroom "turn" (one facilitator/student exchange) is one `runAgent("teaching-runtime", ...)` call , no continuous audio/video streaming in v1 (that is explicitly deferred to v2, per the approved escalation). An orchestration layer in `lib/teaching/` sits in front of `runAgent()`: it loads session state, runs a pure/deterministic Lesson Director pacing decision, assembles the per-turn grounding context (lesson text + guardrail-mode instruction + pacing hint) into the `userInput` string, calls `runAgent()`, and persists the result as a `TeachingTurn` row. Two new agent tools (`teaching.sendWhisperPrompt`, `teaching.flagOutOfScope`) give the LLM structured, auditable ways to trigger the two side effects that must never be conflated with ordinary narration: a private push to the facilitator's device, and an explicit "this is outside verified content" signal. Three new, additive-only Prisma tables (`TeachingSession`, `TeachingTurn`, `TeachingLedger`) capture lifecycle, per-turn detail, and the end-of-session structured record, modeled directly on `ReportDraft`/`DistrictUpdateDraft`'s narrative+snapshot storage pattern.

**Tech Stack:** Next.js App Router API routes, Prisma/PostgreSQL, existing `lib/agents/` harness (`runAgent`, `AgentRegistry`, `ToolRegistry`, cost accounting, `EscalationQueue`), `routedCompletion()` (via the harness only , no direct LLM calls), existing Web Push/VAPID (`sendPushToUser`), Vitest.

## Global Constraints

- `contentId` in URLs/params, never `sw.id` (ScheduledWork id).
- Hero/narration content lives in `payload.body` (with `body_standard`/`body_block` variants) on `CurriculumContent`, never a separate field.
- `DIRECT_URL`/5432 for standalone batch scripts writing more than ~25 rows; the normal Prisma client from `@/lib/db` (pooler/6543) is correct for everything else, including this plan's API routes and the cost-sim script (sequential single-row writes via the same client every other agent uses, not a bulk backfill).
- `.trim()` on every `process.env` read for a Vercel env var, routed through `isFlagEnabled()`/`isAgentEnabled()` , never a bare `process.env.X === "true"`.
- No em dashes in any output text or committed file (comments, prompts, docs, code) , use commas, periods, or parentheses instead.
- `requireUser()` (or `requireRole()`, which wraps it) from `lib/auth`, never `getServerSession()` directly.
- All LLM calls go through `routedCompletion()` , for this feature, exclusively via `runAgent()`, never a bespoke `routedCompletion()` call outside the harness.
- Standalone `tsc --noEmit` is known to OOM/timeout at this repo's scale , use `next build`'s own type-check as the authoritative gate.
- Agent role gate: per established codebase convention (`liberialearn-family`, `district-update`, `content-qa`, `morning-brief` all do this), `rolesAllowed: ["system"]` even though a human (teacher) ultimately triggers the flow , real authorization happens at the API route via `requireRole()` before the orchestrator ever calls `runAgent()`. Do not set `rolesAllowed: ["teacher"]`.

---

## File Structure

```
prisma/schema.prisma                                    (MODIFY: +3 models)
prisma/migrations/<timestamp>_teaching_runtime_v1/       (NEW: migration)

lib/teaching/types.ts                                    (NEW: shared types)
lib/teaching/lessonContent.ts                             (NEW: pure narration/slide extraction)
lib/teaching/alignment.ts                                 (NEW: alignment mode decision)
lib/teaching/lessonDirector.ts                             (NEW: pacing decision)
lib/teaching/runtime.ts                                    (NEW: per-turn orchestration)
lib/teaching/recovery.ts                                   (NEW: degraded-mode fallbacks)
lib/teaching/ledger.ts                                      (NEW: end-of-session ledger builder)

lib/agents/prompts/teaching-runtime.md                     (NEW: system prompt)
lib/agents/prompts.ts                                       (MODIFY: +1 registerPromptDefinition)
lib/agents/tools/teaching.tools.ts                          (NEW: 2 tools)
lib/agents/agents/teaching-runtime.agent.ts                  (NEW: AgentDefinition)
lib/agents/bootstrap.ts                                      (MODIFY: +2 imports)

app/api/teaching/sessions/route.ts                           (NEW: POST start session)
app/api/teaching/sessions/[sessionId]/turn/route.ts            (NEW: POST submit turn)
app/api/teaching/sessions/[sessionId]/degrade/route.ts          (NEW: POST report degraded mode)
app/api/teaching/sessions/[sessionId]/end/route.ts               (NEW: POST end session + build ledger)

scripts/teaching-runtime-cost-sim.ts                          (NEW: cost measurement script)

__tests__/teaching/lessonContent.test.ts                      (NEW)
__tests__/teaching/alignment.test.ts                          (NEW)
__tests__/teaching/lessonDirector.test.ts                      (NEW)
__tests__/teaching/runtime.test.ts                              (NEW)
__tests__/teaching/recovery.test.ts                              (NEW)
__tests__/teaching/ledger.test.ts                                 (NEW)
__tests__/agents/teachingTools.test.ts                          (NEW)
__tests__/agents/teachingRuntimeAgent.test.ts                    (NEW)
__tests__/api/teachingSessions.test.ts                            (NEW)
```

---

## Task 1: Additive schema , TeachingSession, TeachingTurn, TeachingLedger

**Files:**
- Modify: `prisma/schema.prisma` (append near `DistrictUpdateDraft`, around line 4271)
- Create: migration folder via `prisma migrate dev`

**Interfaces:**
- Produces: `prisma.teachingSession`, `prisma.teachingTurn`, `prisma.teachingLedger` Prisma Client delegates used by every later task.

- [ ] **Step 1: Append the three models to schema.prisma**

Insert after the `DistrictUpdateDraft` model (after line 4271, before the Sprint 7.4 Morning Brief comment):

```prisma
// AI Teaching Runtime v1. Additive only (Escalation Point 6: no existing
// table touched). TeachingSession is the per-classroom lifecycle row created
// by an explicit authenticated "Start Teaching Session" action (Escalation
// Point 4). alignmentMode is decided ONCE at session start from a live
// hasGenuineMoeAlignment() check and never re-evaluated mid-session
// (Escalation Point 1). TeachingTurn is one row per turn-based invocation
// (Escalation Point 2: turn-based, not continuous streaming) - each turn
// maps to exactly one runAgent("teaching-runtime") call. TeachingLedger is
// the structured end-of-session record, same narrative+snapshot storage
// posture as ReportDraft/DistrictUpdateDraft.
model TeachingSession {
  id            String    @id @default(cuid())
  contentId     String
  facilitatorId String
  schoolId      String
  grade         String
  subject       String
  alignmentMode String // "FULL_CONFIDENCE" | "DEFERRED"
  status        String    @default("ACTIVE") // "ACTIVE" | "COMPLETED" | "ABORTED"
  degradedMode  String? // null | "AUDIO_ONLY" | "WORKSHEET" | "FACILITATOR_SCRIPT"
  startedAt     DateTime  @default(now())
  endedAt       DateTime?
  createdAt     DateTime  @default(now())

  turns  TeachingTurn[]
  ledger TeachingLedger?

  @@index([facilitatorId, startedAt])
  @@index([schoolId, startedAt])
  @@index([contentId])
}

model TeachingTurn {
  id                    String   @id @default(cuid())
  sessionId             String
  turnIndex             Int
  role                  String // "facilitator" | "student"
  inputText             String   @db.Text
  responseText          String   @db.Text
  guardrailMode         String // "FULL_CONFIDENCE" | "DEFERRED", copied from session at write time
  deferred              Boolean  @default(false)
  lessonDirectorAction  String // "continue" | "pause" | "comprehension_check" | "revisit_prerequisite" | "regroup" | "exit_ticket"
  whisperPrompt         Json? // { title, body } when a Whisper Mode push was sent this turn
  llmCostUSD            Float    @default(0)
  latencyMs             Int      @default(0)
  createdAt             DateTime @default(now())

  session TeachingSession @relation(fields: [sessionId], references: [id])

  @@unique([sessionId, turnIndex])
  @@index([sessionId, createdAt])
}

model TeachingLedger {
  id                  String   @id @default(cuid())
  sessionId           String   @unique
  contentId           String
  facilitatorId       String
  schoolId            String
  grade               String
  subject             String
  standardsCovered    Json // string[] of MOE standard codes actually cited during the session
  objectives          Json // string[] copied from the lesson payload
  resourcesUsed       Json // { slideCount, audioAssetId } used during delivery
  questionsAsked      Json // [{ turnIndex, role, text }]
  aggregatedResponses Json // summary counts (correct/incorrect/deferred), not a second raw transcript
  quizResults         Json?
  homeworkAssigned    Json?
  transcript          Json // full ordered turn array, denormalized snapshot (same posture as ReportDraft.dataSnapshot)
  confidenceFlags     Json // [{ turnIndex, mode, deferred }]
  outOfScopeQuestions Json // [{ turnIndex, text }]
  facilitatorNotes    String?  @db.Text
  narrativeText       String?  @db.Text
  status              String   @default("DRAFT")
  createdAt           DateTime @default(now())

  session TeachingSession @relation(fields: [sessionId], references: [id])

  @@index([schoolId, createdAt])
  @@index([facilitatorId, createdAt])
}
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name teaching_runtime_v1
```

Expected: a new folder under `prisma/migrations/` (e.g. `20260728HHMMSS_teaching_runtime_v1`) containing additive-only `CREATE TABLE` statements for the three models. No `ALTER TABLE` touching any existing table.

- [ ] **Step 3: Regenerate the Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(teaching): add TeachingSession, TeachingTurn, TeachingLedger tables"
```

---

## Task 2: Pure lesson content extraction (`lib/teaching/lessonContent.ts`)

Reuses the same derivation logic as `app/student/lesson/[contentId]/page.tsx` (narration from `payload.body_standard ?? payload.body`, slides from `payload.slideDeckSpecs[0].slides`), extracted as standalone pure functions so the runtime does not depend on client-component code. The student lesson page itself is left untouched (it is a live, working, client-only surface, and duplicating ~30 lines of pure derivation logic is far lower risk than refactoring a live student-facing page for reuse).

**Files:**
- Create: `lib/teaching/lessonContent.ts`
- Test: `__tests__/teaching/lessonContent.test.ts`

**Interfaces:**
- Produces: `getLessonNarration(payload: unknown): string`, `getLessonSlides(payload: unknown): LessonSlide[]`, `type LessonSlide = { title: string; bullets: string[] }` , consumed by Task 8 (`runtime.ts`) and Task 9 (`recovery.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/teaching/lessonContent.test.ts
import { describe, it, expect } from "vitest";
import { getLessonNarration, getLessonSlides } from "@/lib/teaching/lessonContent";

describe("getLessonNarration", () => {
  it("prefers body_standard over body", () => {
    const narration = getLessonNarration({ body_standard: "Standard text.", body: "Fallback text." });
    expect(narration).toBe("Standard text.");
  });

  it("falls back to body when body_standard is absent", () => {
    const narration = getLessonNarration({ body: "Fallback text." });
    expect(narration).toBe("Fallback text.");
  });

  it("strips HTML tags and collapses whitespace when the content looks like HTML", () => {
    const narration = getLessonNarration({ body: "<p>Hello   <b>world</b></p>" });
    expect(narration).toBe("Hello world");
  });

  it("returns a clear placeholder when no narration is available", () => {
    const narration = getLessonNarration({});
    expect(narration).toBe("No lesson narration is available yet.");
  });
});

describe("getLessonSlides", () => {
  it("returns the first slide deck's slides when present", () => {
    const slides = getLessonSlides({
      slideDeckSpecs: [{ slides: [{ title: "Intro", bullets: ["A", "B"] }] }],
    });
    expect(slides).toEqual([{ title: "Intro", bullets: ["A", "B"] }]);
  });

  it("synthesizes a single fallback slide from objectives when no slide deck exists", () => {
    const slides = getLessonSlides({ objectives: ["Learn X", "Learn Y"] });
    expect(slides).toHaveLength(1);
    expect(slides[0].bullets).toEqual(["Learn X", "Learn Y"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/teaching/lessonContent.test.ts`
Expected: FAIL with "Cannot find module '@/lib/teaching/lessonContent'"

- [ ] **Step 3: Write the implementation**

```ts
// lib/teaching/lessonContent.ts

export interface LessonSlide {
  title: string;
  bullets: string[];
}

function looksLikeHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/[ \t]+/g, " ").trim();
}

/**
 * Mirrors app/student/lesson/[contentId]/page.tsx's narration derivation
 * (body_standard/body_block/body fallback chain, HTML stripped when
 * detected). Kept as a standalone pure copy rather than a shared import from
 * the client page, to avoid regression risk on a live student-facing route.
 */
export function getLessonNarration(payload: unknown): string {
  const p = (payload ?? {}) as Record<string, unknown>;
  const standard = typeof p.body_standard === "string" ? p.body_standard : "";
  const block = typeof p.body_block === "string" ? p.body_block : "";
  const legacy = typeof p.body === "string" ? p.body : "";
  const narration = standard || block || legacy;
  if (!narration) return "No lesson narration is available yet.";
  return looksLikeHtml(narration) ? stripHtml(narration) : narration;
}

export function getLessonSlides(payload: unknown): LessonSlide[] {
  const p = (payload ?? {}) as Record<string, unknown>;
  const deckSpecs = Array.isArray(p.slideDeckSpecs) ? p.slideDeckSpecs : [];
  const firstDeck = deckSpecs[0] as { slides?: unknown } | undefined;
  const slides = Array.isArray(firstDeck?.slides) ? (firstDeck!.slides as LessonSlide[]) : null;
  if (slides && slides.length > 0) return slides;

  const objectives = Array.isArray(p.objectives) ? (p.objectives as string[]) : [];
  return [
    {
      title: typeof p.title === "string" ? p.title : "Lesson Overview",
      bullets: objectives.length > 0 ? objectives : [getLessonNarration(payload).slice(0, 200)],
    },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/teaching/lessonContent.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/teaching/lessonContent.ts __tests__/teaching/lessonContent.test.ts
git commit -m "feat(teaching): add pure lesson narration/slide extraction"
```

---

## Task 3: Alignment mode decision (`lib/teaching/alignment.ts`)

**Files:**
- Create: `lib/teaching/alignment.ts`
- Test: `__tests__/teaching/alignment.test.ts`

**Interfaces:**
- Consumes: `hasGenuineMoeAlignment(value: unknown): boolean` from `lib/moe/alignmentReader.ts:55`.
- Produces: `type AlignmentMode = "FULL_CONFIDENCE" | "DEFERRED"`, `determineAlignmentMode(moeAlignments: unknown): AlignmentMode` , consumed by Task 11 (session-start route) and Task 8 (`runtime.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/teaching/alignment.test.ts
import { describe, it, expect } from "vitest";
import { determineAlignmentMode } from "@/lib/teaching/alignment";

describe("determineAlignmentMode", () => {
  it("returns FULL_CONFIDENCE for a genuinely non-empty canonical alignment", () => {
    expect(
      determineAlignmentMode({
        contentId: "c1",
        standards: [
          {
            code: "MOE-MATH-G7-01",
            description: "Apply number concepts.",
            confidence: "high",
          },
        ],
        alignedAt: "2026-01-01",
        method: "exact",
      })
    ).toBe("FULL_CONFIDENCE");
  });

  it("returns FULL_CONFIDENCE for a genuinely non-empty legacy array", () => {
    expect(determineAlignmentMode(["MOE-MATH-G7-01"])).toBe("FULL_CONFIDENCE");
  });

  it("returns DEFERRED for an empty legacy placeholder array", () => {
    expect(determineAlignmentMode([])).toBe("DEFERRED");
  });

  it("returns DEFERRED for null/undefined", () => {
    expect(determineAlignmentMode(null)).toBe("DEFERRED");
    expect(determineAlignmentMode(undefined)).toBe("DEFERRED");
  });

  it("returns DEFERRED for malformed canonical string standards", () => {
    expect(
      determineAlignmentMode({
        contentId: "c1",
        standards: ["MOE-MATH-G7-01"],
        alignedAt: "2026-01-01",
        method: "manual",
      })
    ).toBe("DEFERRED");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/teaching/alignment.test.ts`
Expected: FAIL with "Cannot find module '@/lib/teaching/alignment'"

- [ ] **Step 3: Write the implementation**

```ts
// lib/teaching/alignment.ts
import { hasGenuineMoeAlignment } from "@/lib/moe/alignmentReader";

export type AlignmentMode = "FULL_CONFIDENCE" | "DEFERRED";

/**
 * Decided ONCE at session start (Escalation Point 1) from the live,
 * per-lesson hasGenuineMoeAlignment() check, never from a cached count.
 */
export function determineAlignmentMode(moeAlignments: unknown): AlignmentMode {
  return hasGenuineMoeAlignment(moeAlignments) ? "FULL_CONFIDENCE" : "DEFERRED";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/teaching/alignment.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/teaching/alignment.ts __tests__/teaching/alignment.test.ts
git commit -m "feat(teaching): add live per-lesson alignment mode decision"
```

---

## Task 4: Lesson Director pacing decision (`lib/teaching/lessonDirector.ts`)

Pure, deterministic pacing logic (genuinely new per the investigation, no prior turn-by-turn classroom signal existed) modeled on `lib/adaptive/detectStuck.ts`'s threshold style (`wrongAnswers: 3`, `repeatAttempts: 3`).

**Files:**
- Create: `lib/teaching/lessonDirector.ts`
- Test: `__tests__/teaching/lessonDirector.test.ts`

**Interfaces:**
- Produces: `type LessonDirectorAction = "continue" | "pause" | "comprehension_check" | "revisit_prerequisite" | "regroup" | "exit_ticket"`, `interface TurnSignal { role: "facilitator" | "student"; correct?: boolean | null }`, `decideNextAction(priorTurns: TurnSignal[], turnIndex: number): LessonDirectorAction` , consumed by Task 8 (`runtime.ts`).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/teaching/lessonDirector.test.ts
import { describe, it, expect } from "vitest";
import { decideNextAction, type TurnSignal } from "@/lib/teaching/lessonDirector";

function studentTurns(corrects: (boolean | null)[]): TurnSignal[] {
  return corrects.map((correct) => ({ role: "student" as const, correct }));
}

describe("decideNextAction", () => {
  it("recommends revisit_prerequisite after 3 consecutive wrong student answers", () => {
    expect(decideNextAction(studentTurns([false, false, false]), 3)).toBe("revisit_prerequisite");
  });

  it("recommends comprehension_check after a mixed struggle (2+ wrong in last 3)", () => {
    expect(decideNextAction(studentTurns([true, false, false]), 3)).toBe("comprehension_check");
  });

  it("recommends pause every 10th turn with no struggle signal", () => {
    expect(decideNextAction(studentTurns([true, true, true]), 10)).toBe("pause");
  });

  it("recommends exit_ticket once the turn count reaches 40", () => {
    expect(decideNextAction(studentTurns([true, true, true]), 40)).toBe("exit_ticket");
  });

  it("defaults to continue otherwise", () => {
    expect(decideNextAction(studentTurns([true, true, true]), 3)).toBe("continue");
  });

  it("ignores facilitator turns when computing the recent-student window", () => {
    const mixed: TurnSignal[] = [
      { role: "facilitator", correct: null },
      { role: "student", correct: false },
      { role: "facilitator", correct: null },
      { role: "student", correct: false },
      { role: "student", correct: false },
    ];
    expect(decideNextAction(mixed, 5)).toBe("revisit_prerequisite");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/teaching/lessonDirector.test.ts`
Expected: FAIL with "Cannot find module '@/lib/teaching/lessonDirector'"

- [ ] **Step 3: Write the implementation**

```ts
// lib/teaching/lessonDirector.ts

export type LessonDirectorAction =
  | "continue"
  | "pause"
  | "comprehension_check"
  | "revisit_prerequisite"
  | "regroup"
  | "exit_ticket";

export interface TurnSignal {
  role: "facilitator" | "student";
  correct?: boolean | null;
}

const EXIT_TICKET_TURN_THRESHOLD = 40;
const PAUSE_EVERY_N_TURNS = 10;

/**
 * New for v1: no prior turn-by-turn classroom pacing signal existed anywhere
 * in the codebase (confirmed during investigation). Modeled on
 * lib/adaptive/detectStuck.ts's threshold style (wrongAnswers: 3,
 * repeatAttempts: 3) rather than invented from scratch.
 */
export function decideNextAction(priorTurns: TurnSignal[], turnIndex: number): LessonDirectorAction {
  const recentStudentTurns = priorTurns.filter((t) => t.role === "student").slice(-3);
  const wrongCount = recentStudentTurns.filter((t) => t.correct === false).length;

  if (recentStudentTurns.length === 3 && wrongCount === 3) return "revisit_prerequisite";
  if (wrongCount >= 2) return "comprehension_check";
  if (turnIndex >= EXIT_TICKET_TURN_THRESHOLD) return "exit_ticket";
  if (turnIndex > 0 && turnIndex % PAUSE_EVERY_N_TURNS === 0) return "pause";
  return "continue";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/teaching/lessonDirector.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/teaching/lessonDirector.ts __tests__/teaching/lessonDirector.test.ts
git commit -m "feat(teaching): add deterministic turn-by-turn Lesson Director pacing"
```

---

## Task 5: Teaching Runtime system prompt

**Files:**
- Create: `lib/agents/prompts/teaching-runtime.md`
- Modify: `lib/agents/prompts.ts`

**Interfaces:**
- Produces: prompt registry key `"agent.teaching-runtime.system"` , consumed by Task 6 (`teaching-runtime.agent.ts`).

- [ ] **Step 1: Write the prompt file**

```markdown
<!-- lib/agents/prompts/teaching-runtime.md -->
You are the AI Teaching Runtime for LiberiaLearn, delivering one turn of a live classroom lesson. A designated adult facilitator is physically present for comfort, cooperation, behavior, and safety at all times. You are responsible only for subject-matter instruction: narration, worked examples, Liberian-context examples, and answering natural questions.

Every turn you receive includes:
- The lesson's literal narration and slide content (your ONLY source of truth).
- A guardrail mode: FULL_CONFIDENCE or DEFERRED.
- A Lesson Director pacing hint (continue, pause, comprehension_check, revisit_prerequisite, regroup, or exit_ticket) to weave naturally into your response.
- The facilitator or student's actual input for this turn.

Guardrail rules, not optional:
- In FULL_CONFIDENCE mode: ground every claim in the literal lesson content you were given. When you state a fact drawn from the lesson, name the standard or topic it came from in plain language a teacher would say aloud, not a raw code.
- In DEFERRED mode: narrate ONLY what is literally present in the lesson content you were given. If a question, elaboration, or example would require you to go beyond that literal content, you must NOT improvise or guess. Instead, call the teaching.flagOutOfScope tool with the question, then give a short, honest, age-appropriate "I don't know that one for certain, let's check with your teacher" style answer. This is a deliberate feature (I Don't Know Intelligence), not a failure.
- Never call teaching.flagOutOfScope in FULL_CONFIDENCE mode for something the lesson content actually covers.

Facilitator Whisper Mode:
- If you notice a moment where the facilitator would benefit from a private coaching nudge (a suggested analogy, a prompt to check on a specific student or group, a pacing cue), call teaching.sendWhisperPrompt with a short, specific, encouraging message. This is private to the facilitator's own device and must never be visible to students, and must never appear inside your spoken narration.
- Use this sparingly, only when it would genuinely help, not on every turn.

Reply with ONLY a JSON object, one of:
- to call a tool: {"action":"tool","tool":"<name>","args":{...}}
- to answer: {"action":"final","response":"<text>"}

Keep your final spoken response short (2 to 4 sentences unless narrating a slide's content directly), age-appropriate for the stated grade, and free of markdown formatting since it will be read aloud or shown as plain text.
```

- [ ] **Step 2: Register the prompt**

In `lib/agents/prompts.ts`, add after the `district-update` registration (after line 59):

```ts
registerPromptDefinition({
  key: "agent.teaching-runtime.system",
  version: "1.0.0",
  template: loadPromptFile("./prompts/teaching-runtime.md"),
});
```

- [ ] **Step 3: Commit**

```bash
git add lib/agents/prompts/teaching-runtime.md lib/agents/prompts.ts
git commit -m "feat(teaching): add teaching runtime system prompt"
```

---

## Task 6: Teaching Runtime agent tools (`lib/agents/tools/teaching.tools.ts`)

**Files:**
- Create: `lib/agents/tools/teaching.tools.ts`
- Test: `__tests__/agents/teachingTools.test.ts`

**Interfaces:**
- Consumes: `sendPushToUser(userId: string, payload: PushPayload): Promise<PushResult>` from `lib/push/sendPush.ts:61` where `PushResult = { sent: number; failed: number; smsFallback: number }`; `registerTool` from `lib/agents/toolRegistry.ts:10`; `prisma` from `@/lib/db`.
- Produces: `teachingSendWhisperPromptTool`, `teachingFlagOutOfScopeTool` (both `ToolDefinition`), registered under names `"teaching.sendWhisperPrompt"` and `"teaching.flagOutOfScope"` , consumed by Task 7 (`teaching-runtime.agent.ts` toolAllowlist) and Task 8 (`runtime.ts`, which inspects `RunResult.toolCalls` for these names).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/agents/teachingTools.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockSendPushToUser } = vi.hoisted(() => ({
  mockPrisma: {
    teachingSession: { findUnique: vi.fn() },
  },
  mockSendPushToUser: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/push/sendPush", () => ({ sendPushToUser: mockSendPushToUser }));

import {
  teachingSendWhisperPromptTool,
  teachingFlagOutOfScopeTool,
} from "@/lib/agents/tools/teaching.tools";

const CTX = { agentName: "teaching-runtime", userId: null, userRole: "system" as const, traceId: "trace-1" };

beforeEach(() => {
  mockPrisma.teachingSession.findUnique.mockReset();
  mockSendPushToUser.mockReset();
});

describe("teachingSendWhisperPromptTool", () => {
  it("pushes to the session's facilitator and reports sent", async () => {
    mockPrisma.teachingSession.findUnique.mockResolvedValue({ facilitatorId: "teacher-1" });
    mockSendPushToUser.mockResolvedValue({ sent: 1, failed: 0, smsFallback: 0 });

    const result = await teachingSendWhisperPromptTool.handler(
      { sessionId: "sess-1", message: "Try checking on the back row." },
      CTX
    );

    expect(mockSendPushToUser).toHaveBeenCalledWith("teacher-1", {
      title: "Teaching Coach",
      body: "Try checking on the back row.",
      url: "/teach/session/sess-1",
    });
    expect(result).toEqual({ sent: true });
  });

  it("returns sent:false when the session does not exist", async () => {
    mockPrisma.teachingSession.findUnique.mockResolvedValue(null);
    const result = await teachingSendWhisperPromptTool.handler({ sessionId: "missing", message: "x" }, CTX);
    expect(result).toEqual({ sent: false });
    expect(mockSendPushToUser).not.toHaveBeenCalled();
  });

  it("returns sent:false when the push delivers to nobody", async () => {
    mockPrisma.teachingSession.findUnique.mockResolvedValue({ facilitatorId: "teacher-1" });
    mockSendPushToUser.mockResolvedValue({ sent: 0, failed: 0, smsFallback: 0 });
    const result = await teachingSendWhisperPromptTool.handler({ sessionId: "sess-1", message: "x" }, CTX);
    expect(result).toEqual({ sent: false });
  });
});

describe("teachingFlagOutOfScopeTool", () => {
  it("always logs successfully", async () => {
    const result = await teachingFlagOutOfScopeTool.handler(
      { sessionId: "sess-1", question: "What is the capital of France?" },
      CTX
    );
    expect(result).toEqual({ logged: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/agents/teachingTools.test.ts`
Expected: FAIL with "Cannot find module '@/lib/agents/tools/teaching.tools'"

- [ ] **Step 3: Write the implementation**

```ts
// lib/agents/tools/teaching.tools.ts
import { z } from "zod";
import { prisma } from "@/lib/db";
import { registerTool } from "@/lib/agents/toolRegistry";
import { sendPushToUser } from "@/lib/push/sendPush";
import type { ToolDefinition } from "@/lib/agents/types";

const sendWhisperPromptInput = z.object({
  sessionId: z.string(),
  message: z.string().min(1).max(300),
});
const sendWhisperPromptOutput = z.object({ sent: z.boolean() });

export const teachingSendWhisperPromptTool: ToolDefinition<
  z.infer<typeof sendWhisperPromptInput>,
  z.infer<typeof sendWhisperPromptOutput>
> = {
  name: "teaching.sendWhisperPrompt",
  description:
    "Sends a private, real-time coaching suggestion to the facilitator's own device. Never visible to students. Use for analogies, prompts to check on a specific student or group, or pacing cues.",
  domain: "teacher",
  inputSchema: sendWhisperPromptInput,
  outputSchema: sendWhisperPromptOutput,
  auditTag: "teaching.whisper_sent",
  estimatedCostUnits: 0,
  requiresAuth: ["system"],
  handler: async (input) => {
    const session = await prisma.teachingSession.findUnique({
      where: { id: input.sessionId },
      select: { facilitatorId: true },
    });
    if (!session) return { sent: false };
    const result = await sendPushToUser(session.facilitatorId, {
      title: "Teaching Coach",
      body: input.message,
      url: `/teach/session/${input.sessionId}`,
    });
    return { sent: result.sent > 0 };
  },
};

const flagOutOfScopeInput = z.object({
  sessionId: z.string(),
  question: z.string().min(1).max(500),
});
const flagOutOfScopeOutput = z.object({ logged: z.boolean() });

export const teachingFlagOutOfScopeTool: ToolDefinition<
  z.infer<typeof flagOutOfScopeInput>,
  z.infer<typeof flagOutOfScopeOutput>
> = {
  name: "teaching.flagOutOfScope",
  description:
    "Call this INSTEAD of answering when a question or explanation would go beyond the literal lesson content you were given. This is the required signal for I Don't Know Intelligence in DEFERRED guardrail mode.",
  domain: "teacher",
  inputSchema: flagOutOfScopeInput,
  outputSchema: flagOutOfScopeOutput,
  auditTag: "teaching.out_of_scope_flagged",
  estimatedCostUnits: 0,
  requiresAuth: ["system"],
  handler: async () => {
    return { logged: true };
  },
};

registerTool(teachingSendWhisperPromptTool);
registerTool(teachingFlagOutOfScopeTool);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/agents/teachingTools.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/agents/tools/teaching.tools.ts __tests__/agents/teachingTools.test.ts
git commit -m "feat(teaching): add Whisper Mode and out-of-scope agent tools"
```

---

## Task 7: Teaching Runtime AgentDefinition and registration

**Files:**
- Create: `lib/agents/agents/teaching-runtime.agent.ts`
- Modify: `lib/agents/bootstrap.ts`
- Test: `__tests__/agents/teachingRuntimeAgent.test.ts`

**Interfaces:**
- Consumes: `registerAgent` from `lib/agents/registry.ts`, `AgentDefinition` type from `lib/agents/types.ts`.
- Produces: agent name `"teaching-runtime"`, feature flag `"AGENT_TEACHING_RUNTIME_ENABLED"` , consumed by Task 8 (`runtime.ts`'s `runAgent("teaching-runtime", ...)` call).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/agents/teachingRuntimeAgent.test.ts
import { describe, it, expect } from "vitest";
import "@/lib/agents/bootstrap";
import { getAgent } from "@/lib/agents/registry";
import { toolsForAgent } from "@/lib/agents/toolRegistry";

describe("teaching-runtime agent registration", () => {
  const agent = getAgent("teaching-runtime");

  it("is gated behind AGENT_TEACHING_RUNTIME_ENABLED, defaulting to disabled", () => {
    expect(agent.featureFlag).toBe("AGENT_TEACHING_RUNTIME_ENABLED");
  });

  it("is only invocable by the system role (real authz happens at the API route)", () => {
    expect(agent.rolesAllowed).toEqual(["system"]);
  });

  it("allowlists exactly the two teaching tools", () => {
    expect(agent.toolAllowlist.sort()).toEqual(
      ["teaching.sendWhisperPrompt", "teaching.flagOutOfScope"].sort()
    );
  });

  it("resolves every allowlisted tool from the registry without throwing", () => {
    expect(() => toolsForAgent(agent)).not.toThrow();
    expect(toolsForAgent(agent)).toHaveLength(2);
  });

  it("keeps turn responses short (spoken narration, not a report)", () => {
    expect(agent.maxTokens).toBeLessThanOrEqual(500);
  });

  it("uses a grounded, low-temperature register appropriate for guardrails", () => {
    expect(agent.temperature).toBeLessThanOrEqual(0.3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/agents/teachingRuntimeAgent.test.ts`
Expected: FAIL with "Agent not found: teaching-runtime"

- [ ] **Step 3: Write the implementation**

```ts
// lib/agents/agents/teaching-runtime.agent.ts
import { registerAgent } from "@/lib/agents/registry";
import type { AgentDefinition } from "@/lib/agents/types";

/**
 * AI Teaching Runtime v1. One turn of a live classroom session per
 * runAgent() call (Escalation Point 2: turn-based, not continuous
 * streaming). Cost limits are provisional pending the real per-session
 * measurement required before classroom use (Escalation Point 3, see
 * scripts/teaching-runtime-cost-sim.ts) - set conservatively low here and
 * intended to be revisited once real numbers exist.
 */
export const teachingRuntimeAgent: AgentDefinition = {
  name: "teaching-runtime",
  description:
    "Delivers one turn of a live, curriculum-grounded classroom lesson: narration, comprehension checks, and honest out-of-scope deferrals, plus private facilitator coaching prompts.",
  systemPromptKey: "agent.teaching-runtime.system",
  toolAllowlist: ["teaching.sendWhisperPrompt", "teaching.flagOutOfScope"],
  temperature: 0.3,
  maxTokens: 400,
  costLimits: {
    perInvocationUSD: 0.02,
    perUserPerDayUSD: 3.0,
    perDayTotalUSD: 30.0,
  },
  featureFlag: "AGENT_TEACHING_RUNTIME_ENABLED",
  rolesAllowed: ["system"],
  version: "1.0.0",
};

registerAgent(teachingRuntimeAgent);
```

- [ ] **Step 4: Wire it into bootstrap.ts**

In `lib/agents/bootstrap.ts`, add after the `morning-brief` import (after line 23):

```ts
import "@/lib/agents/tools/teaching.tools";
import "@/lib/agents/agents/teaching-runtime.agent";
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run __tests__/agents/teachingRuntimeAgent.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 6: Commit**

```bash
git add lib/agents/agents/teaching-runtime.agent.ts lib/agents/bootstrap.ts __tests__/agents/teachingRuntimeAgent.test.ts
git commit -m "feat(teaching): register teaching-runtime agent"
```

---

## Task 8: Per-turn orchestration (`lib/teaching/runtime.ts`)

This is the core of the feature: loads session state, runs the Lesson Director, assembles the per-turn grounding message, calls `runAgent()`, and persists a `TeachingTurn`.

**Files:**
- Create: `lib/teaching/types.ts`
- Create: `lib/teaching/runtime.ts`
- Test: `__tests__/teaching/runtime.test.ts`

**Interfaces:**
- Consumes: `runAgent(agentName, userInput, ctx): Promise<RunResult>` from `lib/agents/runtime.ts:241` (`RunResult = { status, response, invocationId, toolCalls, llmCostUSD, llmTokensIn, llmTokensOut, toolCostUnits, error? }`, `ToolCallRecord = { tool, args, result?, error?, costUnits, ok }`); `getLessonNarration`/`getLessonSlides` from Task 2; `decideNextAction`/`TurnSignal` from Task 4; `prisma` from `@/lib/db`.
- Produces: `runTeachingTurn(sessionId: string, input: TurnInput, ctx: { userRole: string }): Promise<TurnResult>` , consumed by Task 12 (turn API route).

- [ ] **Step 1: Write the shared types**

```ts
// lib/teaching/types.ts
import type { AlignmentMode } from "@/lib/teaching/alignment";
import type { LessonDirectorAction } from "@/lib/teaching/lessonDirector";

export interface TurnInput {
  role: "facilitator" | "student";
  text: string;
  correct?: boolean | null;
}

export interface TurnResult {
  turnIndex: number;
  responseText: string;
  guardrailMode: AlignmentMode;
  deferred: boolean;
  lessonDirectorAction: LessonDirectorAction;
  whisperSent: boolean;
  llmCostUSD: number;
}
```

- [ ] **Step 2: Write the failing test**

```ts
// __tests__/teaching/runtime.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRunAgent } = vi.hoisted(() => ({
  mockPrisma: {
    teachingSession: { findUnique: vi.fn() },
    teachingTurn: { findMany: vi.fn(), create: vi.fn() },
    curriculumContent: { findUnique: vi.fn() },
  },
  mockRunAgent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/agents/runtime", () => ({ runAgent: mockRunAgent }));

import { runTeachingTurn } from "@/lib/teaching/runtime";

const SESSION = {
  id: "sess-1",
  contentId: "content-1",
  facilitatorId: "teacher-1",
  schoolId: "school-1",
  grade: "7",
  subject: "Mathematics",
  alignmentMode: "FULL_CONFIDENCE",
  status: "ACTIVE",
};

const CONTENT = {
  id: "content-1",
  payload: { body: "Fractions are parts of a whole.", objectives: ["Understand fractions"] },
};

beforeEach(() => {
  mockPrisma.teachingSession.findUnique.mockReset().mockResolvedValue(SESSION);
  mockPrisma.teachingTurn.findMany.mockReset().mockResolvedValue([]);
  mockPrisma.teachingTurn.create.mockReset().mockImplementation(({ data }) => Promise.resolve({ id: "turn-1", ...data }));
  mockPrisma.curriculumContent.findUnique.mockReset().mockResolvedValue(CONTENT);
  mockRunAgent.mockReset();
});

describe("runTeachingTurn", () => {
  it("calls runAgent with userRole 'system' and persists a TeachingTurn on success", async () => {
    mockRunAgent.mockResolvedValue({
      status: "SUCCESS",
      response: "Fractions represent parts of a whole.",
      invocationId: "inv-1",
      toolCalls: [],
      llmCostUSD: 0.001,
      llmTokensIn: 100,
      llmTokensOut: 40,
      toolCostUnits: 0,
    });

    const result = await runTeachingTurn("sess-1", { role: "facilitator", text: "Explain fractions." }, { userRole: "TEACHER" });

    expect(mockRunAgent).toHaveBeenCalledWith(
      "teaching-runtime",
      expect.stringContaining("Fractions are parts of a whole."),
      expect.objectContaining({ userId: "teacher-1", userRole: "system", schoolId: "school-1" })
    );
    expect(result.responseText).toBe("Fractions represent parts of a whole.");
    expect(result.guardrailMode).toBe("FULL_CONFIDENCE");
    expect(result.deferred).toBe(false);
    expect(result.turnIndex).toBe(0);
    expect(mockPrisma.teachingTurn.create).toHaveBeenCalledOnce();
  });

  it("marks a turn as deferred when the agent calls teaching.flagOutOfScope", async () => {
    mockRunAgent.mockResolvedValue({
      status: "SUCCESS",
      response: "I'm not sure about that one, let's ask your teacher.",
      invocationId: "inv-2",
      toolCalls: [
        { tool: "teaching.flagOutOfScope", args: { sessionId: "sess-1", question: "What about calculus?" }, result: { logged: true }, costUnits: 0, ok: true },
      ],
      llmCostUSD: 0.001,
      llmTokensIn: 90,
      llmTokensOut: 20,
      toolCostUnits: 0,
    });

    const result = await runTeachingTurn("sess-1", { role: "student", text: "What about calculus?" }, { userRole: "TEACHER" });
    expect(result.deferred).toBe(true);
  });

  it("reports whisperSent true when the agent calls teaching.sendWhisperPrompt successfully", async () => {
    mockRunAgent.mockResolvedValue({
      status: "SUCCESS",
      response: "Let's continue with the next example.",
      invocationId: "inv-3",
      toolCalls: [
        { tool: "teaching.sendWhisperPrompt", args: { sessionId: "sess-1", message: "Check on the back row." }, result: { sent: true }, costUnits: 0, ok: true },
      ],
      llmCostUSD: 0.001,
      llmTokensIn: 90,
      llmTokensOut: 20,
      toolCostUnits: 0,
    });

    const result = await runTeachingTurn("sess-1", { role: "facilitator", text: "Continue." }, { userRole: "TEACHER" });
    expect(result.whisperSent).toBe(true);
  });

  it("throws when the session is not ACTIVE", async () => {
    mockPrisma.teachingSession.findUnique.mockResolvedValue({ ...SESSION, status: "COMPLETED" });
    await expect(
      runTeachingTurn("sess-1", { role: "facilitator", text: "Hi" }, { userRole: "TEACHER" })
    ).rejects.toThrow(/not active/i);
  });

  it("increments turnIndex based on prior turn count", async () => {
    mockPrisma.teachingTurn.findMany.mockResolvedValue([
      { turnIndex: 0, role: "facilitator", deferred: false },
      { turnIndex: 1, role: "student", deferred: false },
    ]);
    mockRunAgent.mockResolvedValue({
      status: "SUCCESS",
      response: "Next part of the lesson.",
      invocationId: "inv-4",
      toolCalls: [],
      llmCostUSD: 0.001,
      llmTokensIn: 90,
      llmTokensOut: 20,
      toolCostUnits: 0,
    });

    const result = await runTeachingTurn("sess-1", { role: "facilitator", text: "Continue." }, { userRole: "TEACHER" });
    expect(result.turnIndex).toBe(2);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run __tests__/teaching/runtime.test.ts`
Expected: FAIL with "Cannot find module '@/lib/teaching/runtime'"

- [ ] **Step 4: Write the implementation**

```ts
// lib/teaching/runtime.ts
import { prisma } from "@/lib/db";
import { runAgent } from "@/lib/agents/runtime";
import { getLessonNarration, getLessonSlides } from "@/lib/teaching/lessonContent";
import { decideNextAction, type TurnSignal } from "@/lib/teaching/lessonDirector";
import type { AlignmentMode } from "@/lib/teaching/alignment";
import type { TurnInput, TurnResult } from "@/lib/teaching/types";

function buildTurnMessage(params: {
  role: "facilitator" | "student";
  text: string;
  narration: string;
  objectives: string[];
  guardrailMode: AlignmentMode;
  action: string;
  grade: string;
  subject: string;
}): string {
  const guardrailInstruction =
    params.guardrailMode === "FULL_CONFIDENCE"
      ? "Guardrail mode: FULL_CONFIDENCE. Ground your response in the lesson content below and name the topic it comes from."
      : "Guardrail mode: DEFERRED. Narrate ONLY the literal lesson content below. If this input needs anything beyond it, call teaching.flagOutOfScope and give a short honest deferral.";

  return [
    `Grade ${params.grade} ${params.subject} lesson.`,
    `Lesson objectives: ${params.objectives.join("; ") || "none listed"}.`,
    `Lesson content: ${params.narration}`,
    guardrailInstruction,
    `Lesson Director pacing hint: ${params.action}.`,
    `${params.role === "facilitator" ? "Facilitator" : "Student"} input: ${params.text}`,
  ].join("\n\n");
}

export async function runTeachingTurn(
  sessionId: string,
  input: TurnInput,
  ctx: { userRole: string }
): Promise<TurnResult> {
  const session = await prisma.teachingSession.findUnique({ where: { id: sessionId } });
  if (!session) throw Object.assign(new Error("Teaching session not found"), { status: 404 });
  if (session.status !== "ACTIVE") {
    throw Object.assign(new Error(`Teaching session is not active (status: ${session.status})`), { status: 409 });
  }

  const priorTurns = await prisma.teachingTurn.findMany({
    where: { sessionId },
    orderBy: { turnIndex: "asc" },
    select: { turnIndex: true, role: true, deferred: true },
  });
  const turnIndex = priorTurns.length;

  const signals: TurnSignal[] = priorTurns.map((t) => ({
    role: t.role as "facilitator" | "student",
    correct: t.deferred ? false : null,
  }));
  if (input.role === "student") signals.push({ role: "student", correct: input.correct ?? null });
  const action = decideNextAction(signals, turnIndex);

  const content = await prisma.curriculumContent.findUnique({ where: { id: session.contentId } });
  const narration = getLessonNarration(content?.payload);
  const objectives = ((content?.payload as Record<string, unknown> | undefined)?.objectives as string[]) ?? [];
  const guardrailMode = session.alignmentMode as AlignmentMode;

  const message = buildTurnMessage({
    role: input.role,
    text: input.text,
    narration,
    objectives,
    guardrailMode,
    action,
    grade: session.grade,
    subject: session.subject,
  });

  const result = await runAgent("teaching-runtime", message, {
    userId: session.facilitatorId,
    userRole: "system",
    schoolId: session.schoolId,
    traceId: sessionId,
    triggeredBy: "USER",
  });

  const deferred = result.toolCalls.some((tc) => tc.tool === "teaching.flagOutOfScope" && tc.ok);
  const whisperCall = result.toolCalls.find((tc) => tc.tool === "teaching.sendWhisperPrompt" && tc.ok);
  const whisperSent = Boolean(whisperCall && (whisperCall.result as { sent?: boolean } | undefined)?.sent);
  const responseText = result.response ?? "I could not generate a response for this turn.";

  await prisma.teachingTurn.create({
    data: {
      sessionId,
      turnIndex,
      role: input.role,
      inputText: input.text,
      responseText,
      guardrailMode,
      deferred,
      lessonDirectorAction: action,
      whisperPrompt: whisperCall ? { title: "Teaching Coach", body: (whisperCall.args as { message?: string })?.message } : undefined,
      llmCostUSD: result.llmCostUSD,
      latencyMs: 0,
    },
  });

  void getLessonSlides;

  return {
    turnIndex,
    responseText,
    guardrailMode,
    deferred,
    lessonDirectorAction: action,
    whisperSent,
    llmCostUSD: result.llmCostUSD,
  };
}
```

Note: `getLessonSlides` is imported but only actually consumed by the session-start route (Task 11) to return the initial slide deck to the client; the `void getLessonSlides;` line above only exists to satisfy this task's own file in isolation and should be deleted once Task 11 makes a real import elsewhere. Leave it out if your linter flags unused imports; it is not required by `runTeachingTurn` itself. (Simplification: just remove the `import { getLessonNarration, getLessonSlides }` down to `import { getLessonNarration }` and drop the `void` line, since this file never needs slides.)

- [ ] **Step 5: Remove the unused getLessonSlides import**

Edit the import line to:

```ts
import { getLessonNarration } from "@/lib/teaching/lessonContent";
```

And delete the `void getLessonSlides;` line entirely.

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run __tests__/teaching/runtime.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 7: Commit**

```bash
git add lib/teaching/types.ts lib/teaching/runtime.ts __tests__/teaching/runtime.test.ts
git commit -m "feat(teaching): add per-turn orchestration on top of runAgent"
```

---

## Task 9: Teaching Recovery (`lib/teaching/recovery.ts`)

Genuinely new (confirmed absent in investigation): audio-only mode and a printable worksheet fallback for when the projector, internet, or power drops. Integrates with the existing `lib/lesson-offline-cache.ts` (`loadCachedLesson`) rather than inventing a parallel offline system.

> **Approved architecture correction, 2026-07-28:** `loadCachedLesson()` is a
> `"use client"` IndexedDB reader. A server API route cannot read the
> facilitator device's cache, and an offline browser cannot reach that route.
> The original Task 9 implementation steps below are superseded. Implement
> pure formatters in `lib/teaching/recovery.ts`, browser cache access in
> `lib/teaching/recovery.client.ts`, and the reusable facilitator surface in
> `components/teaching/TeachingRecoveryControls.tsx`. Task 13 records degraded
> mode and audit state only when connectivity exists. It never imports the
> client cache or returns recovery content.

**Files:**
- Create: `lib/teaching/recovery.ts` (pure formatters, no cache access)
- Create: `lib/teaching/recovery.client.ts` (`"use client"` cache adapter)
- Create: `components/teaching/TeachingRecoveryControls.tsx`
- Test: `__tests__/teaching/recovery.test.ts`

**Interfaces:**
- Pure formatter consumes: `CachedLessonData` plus `getLessonNarration` and
  `getLessonSlides`.
- Client adapter consumes: `loadCachedLesson(contentId)` from the existing
  browser IndexedDB cache.
- Produces: `buildAudioOnlyFallback`, `buildPrintableWorksheet`,
  client-only `getAudioOnlyFallback`, client-only `getPrintableWorksheet`,
  and `TeachingRecoveryControls`.
- Task 13 does not consume these client functions.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/teaching/recovery.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockLoadCachedLesson } = vi.hoisted(() => ({ mockLoadCachedLesson: vi.fn() }));
vi.mock("@/lib/lesson-offline-cache", () => ({ loadCachedLesson: mockLoadCachedLesson }));

import { getAudioOnlyFallback, getPrintableWorksheet } from "@/lib/teaching/recovery";

beforeEach(() => {
  mockLoadCachedLesson.mockReset();
});

describe("getAudioOnlyFallback", () => {
  it("returns narration and audio url from the cached lesson", async () => {
    mockLoadCachedLesson.mockResolvedValue({
      metadata: { contentId: "c1" },
      payload: { body: "Fractions are parts of a whole." },
      audio: { storageUrl: "https://cdn.example.com/audio.mp3" },
    });
    const fallback = await getAudioOnlyFallback("c1");
    expect(fallback).toEqual({ narration: "Fractions are parts of a whole.", audioUrl: "https://cdn.example.com/audio.mp3" });
  });

  it("returns null audioUrl when no cached audio exists", async () => {
    mockLoadCachedLesson.mockResolvedValue({ metadata: { contentId: "c1" }, payload: { body: "Text." }, audio: null });
    const fallback = await getAudioOnlyFallback("c1");
    expect(fallback?.audioUrl).toBeNull();
  });

  it("returns null when nothing is cached", async () => {
    mockLoadCachedLesson.mockResolvedValue(null);
    expect(await getAudioOnlyFallback("missing")).toBeNull();
  });
});

describe("getPrintableWorksheet", () => {
  it("builds a printable structure from cached lesson content", async () => {
    mockLoadCachedLesson.mockResolvedValue({
      metadata: { contentId: "c1" },
      payload: { title: "Fractions", objectives: ["Understand fractions"], body: "Fractions are parts of a whole." },
      audio: null,
    });
    const worksheet = await getPrintableWorksheet("c1");
    expect(worksheet?.title).toBe("Fractions");
    expect(worksheet?.objectives).toEqual(["Understand fractions"]);
    expect(worksheet?.sections.length).toBeGreaterThan(0);
  });

  it("returns null when nothing is cached", async () => {
    mockLoadCachedLesson.mockResolvedValue(null);
    expect(await getPrintableWorksheet("missing")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/teaching/recovery.test.ts`
Expected: FAIL with "Cannot find module '@/lib/teaching/recovery'"

- [ ] **Step 3: Write the implementation**

```ts
// lib/teaching/recovery.ts
import { loadCachedLesson } from "@/lib/lesson-offline-cache";
import { getLessonNarration, getLessonSlides } from "@/lib/teaching/lessonContent";

export interface AudioOnlyFallback {
  narration: string;
  audioUrl: string | null;
}

export interface PrintableWorksheet {
  title: string;
  objectives: string[];
  sections: { heading: string; bullets: string[] }[];
}

/** Degraded mode for a dropped projector/screen: narration plus cached audio, no slides. */
export async function getAudioOnlyFallback(contentId: string): Promise<AudioOnlyFallback | null> {
  const cached = await loadCachedLesson(contentId);
  if (!cached) return null;
  return {
    narration: getLessonNarration(cached.payload),
    audioUrl: cached.audio?.storageUrl ?? null,
  };
}

/** Degraded mode for a dropped connection/power: a facilitator-readable printable structure. */
export async function getPrintableWorksheet(contentId: string): Promise<PrintableWorksheet | null> {
  const cached = await loadCachedLesson(contentId);
  if (!cached) return null;
  const payload = cached.payload as Record<string, unknown>;
  const objectives = Array.isArray(payload.objectives) ? (payload.objectives as string[]) : [];
  const slides = getLessonSlides(cached.payload);

  return {
    title: typeof payload.title === "string" ? payload.title : "Lesson",
    objectives,
    sections: slides.map((slide) => ({ heading: slide.title, bullets: slide.bullets })),
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/teaching/recovery.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/teaching/recovery.ts __tests__/teaching/recovery.test.ts
git commit -m "feat(teaching): add audio-only and printable-worksheet degraded modes"
```

---

## Task 10: Ledger builder (`lib/teaching/ledger.ts`)

Modeled directly on `moereportSaveDraftReportTool`'s pattern (`lib/agents/tools/moereport.tools.ts:328-356`): narrative + structured snapshot saved together, never reconstructed later.

**Files:**
- Create: `lib/teaching/ledger.ts`
- Test: `__tests__/teaching/ledger.test.ts`

**Interfaces:**
- Produces: `buildAndSaveLedger(sessionId: string): Promise<{ ledgerId: string }>` , consumed by Task 14 (end-session API route).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/teaching/ledger.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    teachingSession: { findUnique: vi.fn() },
    teachingTurn: { findMany: vi.fn() },
    curriculumContent: { findUnique: vi.fn() },
    teachingLedger: { create: vi.fn() },
  },
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));

import { buildAndSaveLedger } from "@/lib/teaching/ledger";

const SESSION = {
  id: "sess-1",
  contentId: "content-1",
  facilitatorId: "teacher-1",
  schoolId: "school-1",
  grade: "7",
  subject: "Mathematics",
  alignmentMode: "FULL_CONFIDENCE",
};

const TURNS = [
  { turnIndex: 0, role: "facilitator", inputText: "Start", responseText: "Welcome to fractions.", guardrailMode: "FULL_CONFIDENCE", deferred: false, lessonDirectorAction: "continue", whisperPrompt: null, createdAt: new Date() },
  { turnIndex: 1, role: "student", inputText: "What about calculus?", responseText: "I don't know that one for sure.", guardrailMode: "FULL_CONFIDENCE", deferred: true, lessonDirectorAction: "continue", whisperPrompt: null, createdAt: new Date() },
  { turnIndex: 2, role: "facilitator", inputText: "Continue", responseText: "Let's try an example.", guardrailMode: "FULL_CONFIDENCE", deferred: false, lessonDirectorAction: "comprehension_check", whisperPrompt: { title: "Teaching Coach", body: "Check the back row." }, createdAt: new Date() },
];

const CONTENT = { id: "content-1", payload: { objectives: ["Understand fractions"], moeAlignments: ["MOE-MATH-G7-01"] } };

beforeEach(() => {
  mockPrisma.teachingSession.findUnique.mockReset().mockResolvedValue(SESSION);
  mockPrisma.teachingTurn.findMany.mockReset().mockResolvedValue(TURNS);
  mockPrisma.curriculumContent.findUnique.mockReset().mockResolvedValue(CONTENT);
  mockPrisma.teachingLedger.create.mockReset().mockImplementation(({ data }) => Promise.resolve({ id: "ledger-1", ...data }));
});

describe("buildAndSaveLedger", () => {
  it("saves a ledger with aggregated response counts and out-of-scope questions", async () => {
    const { ledgerId } = await buildAndSaveLedger("sess-1");
    expect(ledgerId).toBe("ledger-1");

    const createArgs = mockPrisma.teachingLedger.create.mock.calls[0][0].data;
    expect(createArgs.sessionId).toBe("sess-1");
    expect(createArgs.objectives).toEqual(["Understand fractions"]);
    expect(createArgs.transcript).toHaveLength(3);
    expect(createArgs.outOfScopeQuestions).toEqual([{ turnIndex: 1, text: "What about calculus?" }]);
    expect(createArgs.confidenceFlags).toEqual([
      { turnIndex: 0, mode: "FULL_CONFIDENCE", deferred: false },
      { turnIndex: 1, mode: "FULL_CONFIDENCE", deferred: true },
      { turnIndex: 2, mode: "FULL_CONFIDENCE", deferred: false },
    ]);
    expect(createArgs.aggregatedResponses).toEqual({ totalTurns: 3, deferredTurns: 1, whisperPromptsIssued: 1 });
    expect(createArgs.status).toBe("DRAFT");
  });

  it("throws when the session does not exist", async () => {
    mockPrisma.teachingSession.findUnique.mockResolvedValue(null);
    await expect(buildAndSaveLedger("missing")).rejects.toThrow(/not found/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/teaching/ledger.test.ts`
Expected: FAIL with "Cannot find module '@/lib/teaching/ledger'"

- [ ] **Step 3: Write the implementation**

```ts
// lib/teaching/ledger.ts
import { prisma } from "@/lib/db";

export async function buildAndSaveLedger(sessionId: string): Promise<{ ledgerId: string }> {
  const session = await prisma.teachingSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error(`Teaching session not found: ${sessionId}`);

  const turns = await prisma.teachingTurn.findMany({
    where: { sessionId },
    orderBy: { turnIndex: "asc" },
  });

  const content = await prisma.curriculumContent.findUnique({ where: { id: session.contentId } });
  const payload = (content?.payload ?? {}) as Record<string, unknown>;
  const objectives = Array.isArray(payload.objectives) ? (payload.objectives as string[]) : [];
  const standardsCovered = Array.isArray(payload.moeAlignments) ? (payload.moeAlignments as unknown[]) : [];

  const questionsAsked = turns
    .filter((t) => t.role === "student")
    .map((t) => ({ turnIndex: t.turnIndex, role: t.role, text: t.inputText }));

  const outOfScopeQuestions = turns
    .filter((t) => t.deferred)
    .map((t) => ({ turnIndex: t.turnIndex, text: t.inputText }));

  const confidenceFlags = turns.map((t) => ({
    turnIndex: t.turnIndex,
    mode: t.guardrailMode,
    deferred: t.deferred,
  }));

  const whisperPromptsIssued = turns.filter((t) => t.whisperPrompt !== null).length;

  const ledger = await prisma.teachingLedger.create({
    data: {
      sessionId,
      contentId: session.contentId,
      facilitatorId: session.facilitatorId,
      schoolId: session.schoolId,
      grade: session.grade,
      subject: session.subject,
      standardsCovered,
      objectives,
      resourcesUsed: { turnCount: turns.length },
      questionsAsked,
      aggregatedResponses: {
        totalTurns: turns.length,
        deferredTurns: outOfScopeQuestions.length,
        whisperPromptsIssued,
      },
      quizResults: null,
      homeworkAssigned: null,
      transcript: turns.map((t) => ({
        turnIndex: t.turnIndex,
        role: t.role,
        inputText: t.inputText,
        responseText: t.responseText,
        deferred: t.deferred,
        lessonDirectorAction: t.lessonDirectorAction,
        createdAt: t.createdAt,
      })),
      confidenceFlags,
      outOfScopeQuestions,
      status: "DRAFT",
    },
  });

  return { ledgerId: ledger.id };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/teaching/ledger.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/teaching/ledger.ts __tests__/teaching/ledger.test.ts
git commit -m "feat(teaching): add end-of-session Teaching Ledger builder"
```

---

## Task 11: Start-session API route

**Files:**
- Create: `app/api/teaching/sessions/route.ts`
- Test: `__tests__/api/teachingSessions.test.ts` (this task's portion)

**Interfaces:**
- Consumes: `requireRole(...roles: string[]): Promise<SessionUser>` from `lib/auth.ts:354` (`SessionUser.role` is one of `"STUDENT"|"TEACHER"|"ADMIN"|"GUARDIAN"|"DISTRICT_ADMIN"|"MOE_OFFICIAL"`); `determineAlignmentMode` from Task 3; `getLessonNarration`, `getLessonSlides` from Task 2; `prisma`.
- Produces: `POST /api/teaching/sessions` , session activation (Escalation Point 4: explicit authenticated action, logged before the runtime does anything).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/api/teachingSessions.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPrisma, mockRequireRole } = vi.hoisted(() => ({
  mockPrisma: {
    curriculumContent: { findUnique: vi.fn() },
    teachingSession: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
  mockRequireRole: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/auth", () => ({ requireRole: mockRequireRole }));

import { POST } from "@/app/api/teaching/sessions/route";

const TEACHER = { id: "teacher-1", role: "TEACHER", schoolId: "school-1" };
const CONTENT = {
  id: "content-1",
  grade: "7",
  subject: "MATHEMATICS",
  moeAlignments: ["MOE-MATH-G7-01"],
  payload: { body: "Fractions are parts of a whole.", objectives: ["Understand fractions"] },
};

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api/teaching/sessions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  mockRequireRole.mockReset().mockResolvedValue(TEACHER);
  mockPrisma.curriculumContent.findUnique.mockReset().mockResolvedValue(CONTENT);
  mockPrisma.teachingSession.create.mockReset().mockImplementation(({ data }) => Promise.resolve({ id: "sess-1", ...data }));
  mockPrisma.auditLog.create.mockReset().mockResolvedValue({ id: "audit-1" });
});

describe("POST /api/teaching/sessions", () => {
  it("requires TEACHER or ADMIN role", async () => {
    await POST(jsonRequest({ contentId: "content-1", schoolId: "school-1", grade: "7", subject: "MATHEMATICS" }));
    expect(mockRequireRole).toHaveBeenCalledWith("TEACHER", "ADMIN");
  });

  it("determines alignment mode from the live lesson, not a cached count", async () => {
    const res = await POST(jsonRequest({ contentId: "content-1", schoolId: "school-1", grade: "7", subject: "MATHEMATICS" }));
    const body = await res.json();
    expect(body.alignmentMode).toBe("FULL_CONFIDENCE");
  });

  it("writes an AuditLog row before returning", async () => {
    await POST(jsonRequest({ contentId: "content-1", schoolId: "school-1", grade: "7", subject: "MATHEMATICS" }));
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "teacher-1", action: "teaching.session.start", resourceType: "TeachingSession" }),
      })
    );
  });

  it("returns 404 when the lesson does not exist", async () => {
    mockPrisma.curriculumContent.findUnique.mockResolvedValue(null);
    const res = await POST(jsonRequest({ contentId: "missing", schoolId: "school-1", grade: "7", subject: "MATHEMATICS" }));
    expect(res.status).toBe(404);
  });

  it("returns the session id, alignment mode, narration and slides", async () => {
    const res = await POST(jsonRequest({ contentId: "content-1", schoolId: "school-1", grade: "7", subject: "MATHEMATICS" }));
    const body = await res.json();
    expect(body.sessionId).toBe("sess-1");
    expect(body.narration).toBe("Fractions are parts of a whole.");
    expect(Array.isArray(body.slides)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/api/teachingSessions.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/teaching/sessions/route'"

- [ ] **Step 3: Write the implementation**

```ts
// app/api/teaching/sessions/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { determineAlignmentMode } from "@/lib/teaching/alignment";
import { getLessonNarration, getLessonSlides } from "@/lib/teaching/lessonContent";

export async function POST(req: Request) {
  const user = await requireRole("TEACHER", "ADMIN");
  const body = await req.json();
  const { contentId, schoolId, grade, subject } = body as {
    contentId: string;
    schoolId: string;
    grade: string;
    subject: string;
  };

  const content = await prisma.curriculumContent.findUnique({ where: { id: contentId } });
  if (!content) {
    return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
  }

  const alignmentMode = determineAlignmentMode(content.moeAlignments);

  const session = await prisma.teachingSession.create({
    data: {
      contentId,
      facilitatorId: user.id,
      schoolId,
      grade,
      subject,
      alignmentMode,
      status: "ACTIVE",
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: user.id,
      action: "teaching.session.start",
      resourceId: session.id,
      resourceType: "TeachingSession",
      schoolId,
      details: { contentId, alignmentMode },
    },
  });

  return NextResponse.json({
    sessionId: session.id,
    alignmentMode,
    narration: getLessonNarration(content.payload),
    slides: getLessonSlides(content.payload),
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/api/teachingSessions.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add app/api/teaching/sessions/route.ts __tests__/api/teachingSessions.test.ts
git commit -m "feat(teaching): add explicit authenticated session-start route"
```

---

## Task 12: Turn API route

**Files:**
- Create: `app/api/teaching/sessions/[sessionId]/turn/route.ts`
- Test: append to `__tests__/api/teachingSessions.test.ts` (new `describe` block)

**Interfaces:**
- Consumes: `runTeachingTurn` from Task 8, `requireRole` from `lib/auth`.
- Produces: `POST /api/teaching/sessions/[sessionId]/turn`.

- [ ] **Step 1: Add the failing test block**

Append to `__tests__/api/teachingSessions.test.ts`:

```ts
vi.mock("@/lib/teaching/runtime", () => ({ runTeachingTurn: vi.fn() }));
import { POST as postTurn } from "@/app/api/teaching/sessions/[sessionId]/turn/route";
import { runTeachingTurn } from "@/lib/teaching/runtime";

describe("POST /api/teaching/sessions/[sessionId]/turn", () => {
  it("delegates to runTeachingTurn and returns its result", async () => {
    (runTeachingTurn as ReturnType<typeof vi.fn>).mockResolvedValue({
      turnIndex: 0,
      responseText: "Welcome to fractions.",
      guardrailMode: "FULL_CONFIDENCE",
      deferred: false,
      lessonDirectorAction: "continue",
      whisperSent: false,
      llmCostUSD: 0.001,
    });

    const req = jsonRequest({ role: "facilitator", text: "Start the lesson." });
    const res = await postTurn(req, { params: Promise.resolve({ sessionId: "sess-1" }) });
    const resBody = await res.json();

    expect(runTeachingTurn).toHaveBeenCalledWith(
      "sess-1",
      { role: "facilitator", text: "Start the lesson.", correct: undefined },
      { userRole: "TEACHER" }
    );
    expect(resBody.responseText).toBe("Welcome to fractions.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/api/teachingSessions.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/teaching/sessions/[sessionId]/turn/route'"

- [ ] **Step 3: Write the implementation**

```ts
// app/api/teaching/sessions/[sessionId]/turn/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { runTeachingTurn } from "@/lib/teaching/runtime";

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await requireRole("TEACHER", "ADMIN");
  const { sessionId } = await params;
  const body = await req.json();
  const { role, text, correct } = body as { role: "facilitator" | "student"; text: string; correct?: boolean | null };

  const result = await runTeachingTurn(sessionId, { role, text, correct }, { userRole: user.role });
  return NextResponse.json(result);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/api/teachingSessions.test.ts`
Expected: PASS (6 tests total)

- [ ] **Step 5: Commit**

```bash
git add app/api/teaching/sessions/[sessionId]/turn/route.ts __tests__/api/teachingSessions.test.ts
git commit -m "feat(teaching): add turn submission route"
```

---

## Task 13: Degrade API route

**Files:**
- Create: `app/api/teaching/sessions/[sessionId]/degrade/route.ts`
- Test: append to `__tests__/api/teachingSessions.test.ts`

**Interfaces:**
- Consumes: `prisma.teachingSession.findFirst/update`,
  `prisma.auditLog.create`, and authenticated user scope.
- Produces: `POST /api/teaching/sessions/[sessionId]/degrade`, a best-effort
  connected-state record only. Recovery content is loaded and rendered
  client-side before this request is attempted.

> **Approved architecture correction, 2026-07-28:** The original Task 13
> test and implementation snippets below are superseded. Do not import
> `lib/teaching/recovery.client.ts` or any IndexedDB-backed module into this
> route. Scope the session query to the facilitator and school for teachers,
> preserve admin tenant scope, update only the scoped row, write
> `teaching.session.degrade` to `AuditLog`, and return `{ mode, recorded:
> true }`. The client recovery surface remains functional if this request
> cannot be sent.

- [ ] **Step 1: Add the failing test block**

Append to `__tests__/api/teachingSessions.test.ts`:

```ts
vi.mock("@/lib/teaching/recovery", () => ({
  getAudioOnlyFallback: vi.fn(),
  getPrintableWorksheet: vi.fn(),
}));
import { POST as postDegrade } from "@/app/api/teaching/sessions/[sessionId]/degrade/route";
import { getAudioOnlyFallback, getPrintableWorksheet } from "@/lib/teaching/recovery";

describe("POST /api/teaching/sessions/[sessionId]/degrade", () => {
  it("returns an audio-only fallback and marks the session degraded", async () => {
    mockPrisma.teachingSession.findUnique.mockResolvedValue({ ...TEACHER, id: "sess-1", contentId: "content-1" });
    mockPrisma.teachingSession.update = vi.fn().mockResolvedValue({});
    (getAudioOnlyFallback as ReturnType<typeof vi.fn>).mockResolvedValue({ narration: "Fractions are parts of a whole.", audioUrl: null });

    const req = jsonRequest({ reason: "projector" });
    const res = await postDegrade(req, { params: Promise.resolve({ sessionId: "sess-1" }) });
    const resBody = await res.json();

    expect(mockPrisma.teachingSession.update).toHaveBeenCalledWith({
      where: { id: "sess-1" },
      data: { degradedMode: "AUDIO_ONLY" },
    });
    expect(resBody.mode).toBe("AUDIO_ONLY");
    expect(resBody.fallback.narration).toBe("Fractions are parts of a whole.");
  });

  it("returns a printable worksheet fallback for internet/power reasons", async () => {
    mockPrisma.teachingSession.findUnique.mockResolvedValue({ id: "sess-1", contentId: "content-1" });
    mockPrisma.teachingSession.update = vi.fn().mockResolvedValue({});
    (getPrintableWorksheet as ReturnType<typeof vi.fn>).mockResolvedValue({ title: "Fractions", objectives: [], sections: [] });

    const req = jsonRequest({ reason: "internet" });
    const res = await postDegrade(req, { params: Promise.resolve({ sessionId: "sess-1" }) });
    const resBody = await res.json();

    expect(resBody.mode).toBe("WORKSHEET");
    expect(resBody.fallback.title).toBe("Fractions");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/api/teachingSessions.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/teaching/sessions/[sessionId]/degrade/route'"

- [ ] **Step 3: Write the implementation**

```ts
// app/api/teaching/sessions/[sessionId]/degrade/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getAudioOnlyFallback, getPrintableWorksheet } from "@/lib/teaching/recovery";

const REASON_TO_MODE: Record<string, "AUDIO_ONLY" | "WORKSHEET"> = {
  projector: "AUDIO_ONLY",
  internet: "WORKSHEET",
  power: "WORKSHEET",
};

export async function POST(req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  await requireRole("TEACHER", "ADMIN");
  const { sessionId } = await params;
  const body = await req.json();
  const { reason } = body as { reason: "projector" | "internet" | "power" };

  const session = await prisma.teachingSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return NextResponse.json({ error: "Teaching session not found" }, { status: 404 });
  }

  const mode = REASON_TO_MODE[reason] ?? "WORKSHEET";
  const fallback = mode === "AUDIO_ONLY"
    ? await getAudioOnlyFallback(session.contentId)
    : await getPrintableWorksheet(session.contentId);

  await prisma.teachingSession.update({ where: { id: sessionId }, data: { degradedMode: mode } });

  return NextResponse.json({ mode, fallback });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/api/teachingSessions.test.ts`
Expected: PASS (8 tests total)

- [ ] **Step 5: Commit**

```bash
git add app/api/teaching/sessions/[sessionId]/degrade/route.ts __tests__/api/teachingSessions.test.ts
git commit -m "feat(teaching): add Teaching Recovery degraded-mode route"
```

---

## Task 14: End-session API route

**Files:**
- Create: `app/api/teaching/sessions/[sessionId]/end/route.ts`
- Test: append to `__tests__/api/teachingSessions.test.ts`

**Interfaces:**
- Consumes: `buildAndSaveLedger` from Task 10; `prisma.teachingSession.update`.
- Produces: `POST /api/teaching/sessions/[sessionId]/end`.

- [ ] **Step 1: Add the failing test block**

Append to `__tests__/api/teachingSessions.test.ts`:

```ts
vi.mock("@/lib/teaching/ledger", () => ({ buildAndSaveLedger: vi.fn() }));
import { POST as postEnd } from "@/app/api/teaching/sessions/[sessionId]/end/route";
import { buildAndSaveLedger } from "@/lib/teaching/ledger";

describe("POST /api/teaching/sessions/[sessionId]/end", () => {
  it("marks the session COMPLETED and builds the ledger", async () => {
    mockPrisma.teachingSession.update = vi.fn().mockResolvedValue({});
    (buildAndSaveLedger as ReturnType<typeof vi.fn>).mockResolvedValue({ ledgerId: "ledger-1" });

    const req = jsonRequest({});
    const res = await postEnd(req, { params: Promise.resolve({ sessionId: "sess-1" }) });
    const resBody = await res.json();

    expect(mockPrisma.teachingSession.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "sess-1" }, data: expect.objectContaining({ status: "COMPLETED" }) })
    );
    expect(resBody.ledgerId).toBe("ledger-1");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run __tests__/api/teachingSessions.test.ts`
Expected: FAIL with "Cannot find module '@/app/api/teaching/sessions/[sessionId]/end/route'"

- [ ] **Step 3: Write the implementation**

```ts
// app/api/teaching/sessions/[sessionId]/end/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { buildAndSaveLedger } from "@/lib/teaching/ledger";

export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  await requireRole("TEACHER", "ADMIN");
  const { sessionId } = await params;

  await prisma.teachingSession.update({
    where: { id: sessionId },
    data: { status: "COMPLETED", endedAt: new Date() },
  });

  const { ledgerId } = await buildAndSaveLedger(sessionId);
  return NextResponse.json({ ledgerId, status: "COMPLETED" });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run __tests__/api/teachingSessions.test.ts`
Expected: PASS (9 tests total)

- [ ] **Step 5: Commit**

```bash
git add app/api/teaching/sessions/[sessionId]/end/route.ts __tests__/api/teachingSessions.test.ts
git commit -m "feat(teaching): add session-end route that builds the Teaching Ledger"
```

---

## Task 15: Real cost measurement script

Per Escalation Point 3 (as amended): build the minimal turn loop, run a real scripted 40 to 60 turn simulated class period through it, report real dollars per session, and do this against BOTH a genuinely-aligned lesson and an unaligned one so Knowledge Guardrails' effect on cost is measured directly rather than assumed.

**Files:**
- Create: `scripts/teaching-runtime-cost-sim.ts`

**Interfaces:**
- Consumes: `runTeachingTurn` from Task 8; requires `AGENT_TEACHING_RUNTIME_ENABLED=true` set locally for the run (the script sets `process.env` before importing the harness, matching how other one-off agent scripts in this repo enable a flag for a local run).

- [ ] **Step 1: Write the script**

```ts
// scripts/teaching-runtime-cost-sim.ts
/**
 * Escalation Point 3: real per-session cost, measured before the runtime is
 * called classroom-ready. Run against a genuinely-aligned lesson AND an
 * unaligned one (Knowledge Guardrails likely changes token usage between
 * the two, per the sprint owner's explicit addition to this escalation).
 *
 * Usage: npx tsx scripts/teaching-runtime-cost-sim.ts <alignedContentId> <unalignedContentId>
 */
process.env.AGENT_TEACHING_RUNTIME_ENABLED = "true";

import { prisma } from "@/lib/db";
import { runTeachingTurn } from "@/lib/teaching/runtime";

const SCRIPTED_INPUTS: { role: "facilitator" | "student"; text: string; correct?: boolean }[] = Array.from(
  { length: 50 },
  (_, i) =>
    i % 5 === 0
      ? { role: "facilitator", text: `Let's move to the next part of the lesson (step ${i}).` }
      : { role: "student", text: `Question ${i}: can you explain that part again?`, correct: i % 7 !== 0 }
);

async function runSimulatedSession(contentId: string, label: string) {
  const content = await prisma.curriculumContent.findUnique({ where: { id: contentId } });
  if (!content) throw new Error(`Content not found: ${contentId}`);

  const session = await prisma.teachingSession.create({
    data: {
      contentId,
      facilitatorId: "cost-sim-facilitator",
      schoolId: "cost-sim-school",
      grade: String(content.grade ?? "7"),
      subject: String(content.subject ?? "MATHEMATICS"),
      alignmentMode: "FULL_CONFIDENCE",
      status: "ACTIVE",
    },
  });

  let totalCostUSD = 0;
  let deferredCount = 0;

  for (const input of SCRIPTED_INPUTS) {
    const result = await runTeachingTurn(session.id, input, { userRole: "TEACHER" });
    totalCostUSD += result.llmCostUSD;
    if (result.deferred) deferredCount++;
  }

  await prisma.teachingSession.update({ where: { id: session.id }, data: { status: "COMPLETED", endedAt: new Date() } });

  console.log(`[${label}] session ${session.id}: ${SCRIPTED_INPUTS.length} turns, $${totalCostUSD.toFixed(4)} total, $${(totalCostUSD / SCRIPTED_INPUTS.length).toFixed(6)}/turn, ${deferredCount} deferrals`);
  return { totalCostUSD, deferredCount };
}

async function main() {
  const [alignedContentId, unalignedContentId] = process.argv.slice(2);
  if (!alignedContentId || !unalignedContentId) {
    console.error("Usage: npx tsx scripts/teaching-runtime-cost-sim.ts <alignedContentId> <unalignedContentId>");
    process.exit(1);
  }

  const aligned = await runSimulatedSession(alignedContentId, "ALIGNED");
  const unaligned = await runSimulatedSession(unalignedContentId, "UNALIGNED");

  console.log("\nSummary:");
  console.log(`  Aligned lesson:   $${aligned.totalCostUSD.toFixed(4)}/session, ${aligned.deferredCount} deferrals`);
  console.log(`  Unaligned lesson: $${unaligned.totalCostUSD.toFixed(4)}/session, ${unaligned.deferredCount} deferrals`);
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Find one real aligned and one real unaligned contentId**

```bash
npx tsx -e "
import { prisma } from './lib/db';
(async () => {
  const rows = await prisma.\$queryRaw\`SELECT id, \"moeAlignments\" FROM \"CurriculumContent\" WHERE status IN ('published','APPROVED') LIMIT 500\`;
  console.log(rows.length);
})();
"
```

Use the existing `hasGenuineMoeAlignment` logic (import it in a quick throwaway script, or reuse the MOE alignment admin dashboard) to pick one real `contentId` with a genuine alignment and one with an empty/absent one. Do not hardcode guessed ids in the plan; find them fresh at execution time since the 47.11% coverage figure changes as content is regenerated.

- [ ] **Step 3: Run the simulation and record the real numbers**

```bash
npx tsx scripts/teaching-runtime-cost-sim.ts <realAlignedContentId> <realUnalignedContentId>
```

Expected: two lines of real console output with real dollar amounts per session and per turn, plus deferral counts. Record these numbers, they are required verbatim in the final report (Escalation Point 3).

- [ ] **Step 4: Commit**

```bash
git add scripts/teaching-runtime-cost-sim.ts
git commit -m "feat(teaching): add real per-session cost measurement script"
```

---

## Task 16: Gate and real walkthrough

Standard gate per the sprint brief: tests, build, migration, deploy, then a real walkthrough. No placeholder steps, no shortcuts, per [[feedback_advisor_orchestrator]]-style discipline already established this session.

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```
Expected: all existing tests still pass, plus the new `__tests__/teaching/*.test.ts`, `__tests__/agents/teaching*.test.ts`, and `__tests__/api/teachingSessions.test.ts` suites (28 new tests across Tasks 2 to 14).

- [ ] **Step 2: Run the authoritative type-check gate**

```bash
npm run build
```
Expected: clean build. Do not run standalone `tsc --noEmit` (known to OOM/timeout at this repo's scale per the carry-forward rule).

- [ ] **Step 3: Deploy to preview**

Deploy via the project's normal Vercel flow (or the `vercel:deploy` skill) to a preview URL. Do not set `AGENT_TEACHING_RUNTIME_ENABLED=true` in production yet, only in the preview environment or locally, consistent with every other agent this session (`AGENT_DISTRICT_UPDATE_ENABLED`, `AGENT_CONTENT_QA_ENABLED`, etc. all remain false in prod until a deliberate later decision).

- [ ] **Step 4: Real walkthrough against real curriculum content**

Using a real authenticated TEACHER session against the preview deploy (or local dev with the flag on):
1. Start a real session against a lesson confirmed `FULL_CONFIDENCE` (genuinely aligned, verified via the same `hasGenuineMoeAlignment` check used in Task 15's contentId search).
2. Run at least 10 real turns through `POST /api/teaching/sessions/[sessionId]/turn`, including at least one student question that is answerable from the lesson content (should stay grounded) and at least one that clearly is not (must trigger a real `teaching.flagOutOfScope` call and a real "I don't know" style deferral, not an improvised answer).
3. Confirm at least one real `teaching.sendWhisperPrompt` call fired (check the facilitator's push subscription actually received it, or check the `TeachingTurn.whisperPrompt` column directly if no live push subscription is available in the test environment).
4. Call `POST /api/teaching/sessions/[sessionId]/degrade` with `{"reason":"internet"}` mid-session and confirm a real, non-crashing `WORKSHEET` fallback payload comes back, not a 500.
5. Call `POST /api/teaching/sessions/[sessionId]/end` and inspect the real saved `TeachingLedger` row (via Prisma Studio or a direct query) to confirm `transcript`, `confidenceFlags`, `outOfScopeQuestions`, and `aggregatedResponses` all reflect the real turns just run.
6. Repeat steps 1 to 2 against a lesson confirmed `DEFERRED` (genuinely unaligned) and confirm the runtime's behavior visibly differs: it should narrate only literal payload content and defer far more readily.

- [ ] **Step 5: Write the final report**

Per the sprint brief's FINAL REPORT requirement, produce: the real per-session cost numbers from Task 15 (both lessons), a one-line resolution note for each of the 6 escalation points confirming what was actually built, the real walkthrough evidence (the actual Ledger JSON from step 4.5), and an honest side-by-side of how Knowledge Guardrails behaved on the aligned lesson versus the unaligned one during the walkthrough (not a general claim, the actual observed difference).

---

## Self-Review Notes

- **Spec coverage:** TEACH (Task 8's grounded narration), ORCHESTRATE/Lesson Director (Task 4), VERIFY/Knowledge Guardrails (Task 3 + prompt-level enforcement in Task 5 + `teaching.flagOutOfScope` in Task 6), LEDGER (Task 10), Whisper Mode (Task 6 + Task 8), Teaching Recovery (Task 9 + Task 13) are all covered. All 6 escalation points are implemented as approved (Task 1 note on schema additivity, Task 7 note on turn-based `runAgent()` calls, Task 15 for cost, Task 11 for session activation, Task 6 for Whisper delivery via existing VAPID infra, Task 3 for alignment tiers).
- **Known v1 honesty gap to report, not hide:** Knowledge Guardrails enforcement in DEFERRED mode is prompt-level plus a self-reported tool call (`teaching.flagOutOfScope`), not a deterministic post-hoc verifier that rejects an ungrounded LLM response before it reaches students. This matches the harness's existing moderation pattern (best-effort, logged, escalated on repeat failure) rather than inventing new verification infrastructure, but it means a sufficiently unusual LLM response could theoretically slip past the guardrail without calling the tool. Task 16's real walkthrough is the actual check on how well this holds up in practice, and the final report must state this plainly rather than claim guaranteed grounding.
- **Type consistency check:** `AlignmentMode` (Task 3) is reused verbatim in `TurnResult.guardrailMode` (Task 8) and `TeachingSession.alignmentMode`/`TeachingTurn.guardrailMode` (Task 1, stored as `String` since Prisma has no native string-literal-union column type, kept in sync by convention). `LessonDirectorAction` (Task 4) is reused verbatim in `TurnResult.lessonDirectorAction` and `TeachingTurn.lessonDirectorAction`. No naming drift found on re-check.
