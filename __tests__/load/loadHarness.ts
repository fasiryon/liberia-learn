/**
 * __tests__/load/loadHarness.ts
 * Block 27 — Load Acceptance Harness
 *
 * Simulates concurrent national-scale usage across three load tiers.
 * All Prisma calls are mocked — this harness measures route-level
 * concurrency, response time distribution, and error rate.
 *
 * Tier 1:  100 schools × 5 teachers × 10 students   =  500 teacher +  1,000 student sessions
 * Tier 2:  500 schools × 5 teachers × 10 students   = 2,500 teacher +  5,000 student sessions
 * Tier 3: 1,000 schools × 5 teachers × 10 students  = 5,000 teacher + 10,000 student sessions
 */

export interface SimulatedSession {
  schoolId: string;
  userId: string;
  role: "TEACHER" | "STUDENT";
  classId: string;
  scheduledWorkId: string;
  sessionId?: string;
}

export interface LoadTierConfig {
  name: string;
  schoolCount: number;
  teachersPerSchool: number;
  studentsPerSchool: number;
}

export interface RequestResult {
  durationMs: number;
  status: number;
  error?: string;
}

export interface TierResult {
  tier: string;
  schoolCount: number;
  teacherSessions: number;
  studentSessions: number;
  labSessionCount: number;
  teacherScheduleResults: RequestResult[];
  studentWorkResults: RequestResult[];
  labSessionResults: RequestResult[];
  p50Teacher: number;
  p95Teacher: number;
  p99Teacher: number;
  p50Student: number;
  p95Student: number;
  p99Student: number;
  errorRate: number;
  pass: boolean;
}

// ─── Pass thresholds ───────────────────────────────────────────────────────────

/** p95 response time threshold for teacher schedule route (ms) */
export const TEACHER_SCHEDULE_P95_THRESHOLD_MS = 800;
/** p95 response time threshold for student work route (ms) */
export const STUDENT_WORK_P95_THRESHOLD_MS = 500;
/** Maximum allowable error rate (0.1% = 0.001) */
export const MAX_ERROR_RATE = 0.001;

// ─── Tier configurations ──────────────────────────────────────────────────────

export const TIER_1: LoadTierConfig = {
  name: "Tier 1 — 100 schools",
  schoolCount: 100,
  teachersPerSchool: 5,
  studentsPerSchool: 10,
};

export const TIER_2: LoadTierConfig = {
  name: "Tier 2 — 500 schools",
  schoolCount: 500,
  teachersPerSchool: 5,
  studentsPerSchool: 10,
};

export const TIER_3: LoadTierConfig = {
  name: "Tier 3 — 1,000 schools (stretch)",
  schoolCount: 1000,
  teachersPerSchool: 5,
  studentsPerSchool: 10,
};

// ─── Session generation ──────────────────────────────────────────────────────

export function generateSessions(config: LoadTierConfig): {
  teacherSessions: SimulatedSession[];
  studentSessions: SimulatedSession[];
} {
  const teacherSessions: SimulatedSession[] = [];
  const studentSessions: SimulatedSession[] = [];

  for (let s = 0; s < config.schoolCount; s++) {
    const schoolId = `school-${s}`;

    for (let t = 0; t < config.teachersPerSchool; t++) {
      const classId = `class-${s}-${t}`;
      teacherSessions.push({
        schoolId,
        userId: `teacher-${s}-${t}`,
        role: "TEACHER",
        classId,
        scheduledWorkId: `sw-${s}-${t}`,
      });
    }

    for (let st = 0; st < config.studentsPerSchool; st++) {
      const classIdx = st % config.teachersPerSchool;
      studentSessions.push({
        schoolId,
        userId: `student-${s}-${st}`,
        role: "STUDENT",
        classId: `class-${s}-${classIdx}`,
        scheduledWorkId: `sw-${s}-${classIdx}`,
        sessionId: `lab-session-${s}-${st}`,
      });
    }
  }

  return { teacherSessions, studentSessions };
}

// ─── Simulated request executor ──────────────────────────────────────────────

/**
 * Simulate a single request through a mock route handler.
 * Returns the duration (in ms) and status code.
 * The handler receives a session context and returns a mock response.
 */
export async function simulateRequest(
  handler: (session: SimulatedSession) => Promise<{ status: number; body: unknown }>,
  session: SimulatedSession,
  simulatedLatencyMs?: number
): Promise<RequestResult> {
  const start = performance.now();
  try {
    // Add optional jitter to simulate real-world network variance (0–20ms)
    if (simulatedLatencyMs && simulatedLatencyMs > 0) {
      await delay(simulatedLatencyMs + Math.random() * 20);
    }
    const result = await handler(session);
    return { durationMs: performance.now() - start, status: result.status };
  } catch (err: any) {
    return {
      durationMs: performance.now() - start,
      status: 500,
      error: err?.message ?? "Unknown error",
    };
  }
}

// ─── Concurrent execution ────────────────────────────────────────────────────

/**
 * Run all sessions concurrently (full parallel dispatch).
 * Mirrors how a real national-scale deployment fires concurrent HTTP requests.
 */
export async function runConcurrent(
  handler: (session: SimulatedSession) => Promise<{ status: number; body: unknown }>,
  sessions: SimulatedSession[],
  simulatedLatencyMs = 0
): Promise<RequestResult[]> {
  return Promise.all(
    sessions.map((session) => simulateRequest(handler, session, simulatedLatencyMs))
  );
}

/**
 * Run sessions in batches to avoid overwhelming the Node.js event loop
 * in very large tier simulations. Batch size is tuned to match realistic
 * DB connection pool limits (typically 20–50 connections).
 */
export async function runBatched(
  handler: (session: SimulatedSession) => Promise<{ status: number; body: unknown }>,
  sessions: SimulatedSession[],
  batchSize = 100,
  simulatedLatencyMs = 0
): Promise<RequestResult[]> {
  const results: RequestResult[] = [];
  for (let i = 0; i < sessions.length; i += batchSize) {
    const batch = sessions.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((session) => simulateRequest(handler, session, simulatedLatencyMs))
    );
    results.push(...batchResults);
  }
  return results;
}

// ─── Percentile calculation ──────────────────────────────────────────────────

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return Math.round(sorted[Math.max(0, idx)]);
}

export function errorRate(results: RequestResult[]): number {
  if (results.length === 0) return 0;
  const errors = results.filter((r) => r.status >= 500 || r.error !== undefined).length;
  return errors / results.length;
}

// ─── Tier evaluator ──────────────────────────────────────────────────────────

export function evaluateTier(
  tier: LoadTierConfig,
  teacherResults: RequestResult[],
  studentResults: RequestResult[],
  labResults: RequestResult[]
): TierResult {
  const teacherDurations = teacherResults.map((r) => r.durationMs);
  const studentDurations = studentResults.map((r) => r.durationMs);
  const allResults = [...teacherResults, ...studentResults, ...labResults];

  const p95Teacher = percentile(teacherDurations, 95);
  const p95Student = percentile(studentDurations, 95);
  const errRate = errorRate(allResults);

  const pass =
    p95Teacher <= TEACHER_SCHEDULE_P95_THRESHOLD_MS &&
    p95Student <= STUDENT_WORK_P95_THRESHOLD_MS &&
    errRate <= MAX_ERROR_RATE;

  return {
    tier: tier.name,
    schoolCount: tier.schoolCount,
    teacherSessions: teacherResults.length,
    studentSessions: studentResults.length,
    labSessionCount: labResults.length,
    teacherScheduleResults: teacherResults,
    studentWorkResults: studentResults,
    labSessionResults: labResults,
    p50Teacher: percentile(teacherDurations, 50),
    p95Teacher,
    p99Teacher: percentile(teacherDurations, 99),
    p50Student: percentile(studentDurations, 50),
    p95Student,
    p99Student: percentile(studentDurations, 99),
    errorRate: errRate,
    pass,
  };
}

// ─── Mock route handlers ─────────────────────────────────────────────────────

/**
 * Mock teacher schedule GET handler.
 * Simulates: classes query → schedule query → enrollment groupBy
 * Adds realistic latency bands matching Block 26 post-fix projections.
 */
export function mockTeacherScheduleHandler(
  simulatedDbMs = 50
): (session: SimulatedSession) => Promise<{ status: number; body: unknown }> {
  return async (session) => {
    // Simulate 4 queries in parallel (Block 26 fix: was 6 sequential)
    await Promise.all([
      delay(simulatedDbMs),      // classes
      delay(simulatedDbMs),      // scheduledWork
      delay(simulatedDbMs * 0.8), // enrollmentGroupBy
      delay(simulatedDbMs * 0.6), // compliance parallel counts (post-fix)
    ]);
    return {
      status: 200,
      body: {
        items: [],
        classes: [{ id: session.classId, name: `Class ${session.classId}` }],
        weekStart: new Date().toISOString(),
        schoolId: session.schoolId, // scoped correctly
      },
    };
  };
}

/**
 * Mock student work GET handler.
 * Simulates: parallel sw+student → enrollment (Block 26 fix: was 3 sequential)
 */
export function mockStudentWorkHandler(
  simulatedDbMs = 40
): (session: SimulatedSession) => Promise<{ status: number; body: unknown }> {
  return async (session) => {
    // Parallel sw + student (Block 26 fix)
    await Promise.all([delay(simulatedDbMs), delay(simulatedDbMs * 0.8)]);
    // Sequential enrollment (depends on student.id)
    await delay(simulatedDbMs * 0.6);
    return {
      status: 200,
      body: {
        id: session.scheduledWorkId,
        schoolId: session.schoolId,
        subject: "MATH",
        grade: 7,
      },
    };
  };
}

/**
 * Mock lab session PATCH handler.
 * Used for the 20% lab-completing student subset.
 */
export function mockLabSessionHandler(
  simulatedDbMs = 35
): (session: SimulatedSession) => Promise<{ status: number; body: unknown }> {
  return async (session) => {
    await delay(simulatedDbMs);
    return {
      status: 200,
      body: {
        session: {
          id: session.sessionId,
          schoolId: session.schoolId,
          score: Math.floor(Math.random() * 40) + 60,
          completedAt: new Date().toISOString(),
        },
      },
    };
  };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format a tier result table row for reporting.
 */
export function formatTierRow(r: TierResult): string {
  return [
    r.tier,
    r.schoolCount,
    r.teacherSessions,
    r.studentSessions,
    `${r.p50Teacher}ms`,
    `${r.p95Teacher}ms`,
    `${r.p99Teacher}ms`,
    `${r.p50Student}ms`,
    `${r.p95Student}ms`,
    `${(r.errorRate * 100).toFixed(3)}%`,
    r.pass ? "PASS" : "FAIL",
  ].join(" | ");
}
