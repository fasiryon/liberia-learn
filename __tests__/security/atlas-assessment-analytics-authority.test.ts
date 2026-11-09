// Batch 2a: actual route and authority service, synthetic persistence only.
import { beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ role: vi.fn(), lesson: vi.fn(), details: vi.fn(), count: vi.fn(), aggregate: vi.fn(), classes: vi.fn(), assignments: vi.fn() }));
vi.mock('@/lib/auth', () => ({ requireRole: m.role }));
vi.mock('@/lib/db', () => ({ prisma: {
  curriculumContent: { findUnique: m.lesson },
  assessmentAttemptDetail: { findMany: m.details },
  assessmentAttempt: { count: m.count, aggregate: m.aggregate },
  class: { findMany: m.classes, findUnique: m.classes },
  teacherAssignment: { findMany: m.assignments },
} }));
import { GET } from '@/app/api/teacher/analytics/assessment/[contentId]/route';

const attempts = [
  { id: 'attempt-A', schoolId: 'school-A', classId: 'class-A', studentId: 'learner-A', subject: 'SCIENCE', score: 0.8, metadata: { contentId: 'content-A' } },
  { id: 'attempt-B', schoolId: 'school-A', classId: 'class-B', studentId: 'learner-B', subject: 'SCIENCE', score: 0.2, metadata: { contentId: 'content-A' } },
  { id: 'attempt-C', schoolId: 'school-B', classId: 'class-C', studentId: 'learner-C', subject: 'SCIENCE', score: 0.1, metadata: { contentId: 'content-A' } },
];
// Deliberately honor actual query constraints, not the viewer's expected authority.
// Unknown predicates fail loudly so a future repair cannot pass through an ignored constraint.
function matches(row: Record<string, unknown>, where: Record<string, unknown> = {}): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (value === undefined) return true; // Prisma omits undefined predicates: the null-school bug.
    if (key === 'AND' && Array.isArray(value)) return value.every(w => matches(row, w));
    if (key === 'OR' && Array.isArray(value)) return value.some(w => matches(row, w));
    if (key === 'metadata') return row.metadata !== null && typeof row.metadata === 'object' && 'contentId' in row.metadata && row.metadata.contentId === 'content-A';
    if (!(key in row)) throw new Error(`Unsupported fixture predicate: ${key}`);
    if (value !== null && typeof value === 'object' && 'in' in value && Array.isArray(value.in)) return value.in.includes(row[key]);
    if (value !== null && typeof value === 'object' && 'equals' in value) return row[key] === value.equals;
    return row[key] === value;
  });
}
let actor: { id: string; role: string; schoolId: string | null };
async function read() { return GET(new Request('http://atlas.invalid/analytics'), { params: { contentId: 'content-A' } }); }
beforeEach(() => {
  vi.resetAllMocks();
  actor = { id: 'teacher-A', role: 'TEACHER', schoolId: 'school-A' };
  m.role.mockImplementation(async (...roles: string[]) => { if (!roles.includes(actor.role)) throw Object.assign(new Error('Forbidden'), { status: 403 }); return actor; });
  m.lesson.mockResolvedValue({ contentId: 'content-A', title: 'Synthetic assessment', subject: 'SCIENCE', grade: 8 });
  m.classes.mockImplementation(async ({ where }: { where: { id?: string; schoolId?: string; teacherId?: string } }) => where.id
    ? { id: where.id, schoolId: where.id === 'class-C' ? 'school-B' : 'school-A', teacherId: where.id === 'class-A' ? 'teacher-A' : 'teacher-B' }
    : [{ id: 'class-A', schoolId: 'school-A', teacherId: 'teacher-A' }].filter(c => (!where.teacherId || c.teacherId === where.teacherId) && (!where.schoolId || c.schoolId === where.schoolId)));
  m.assignments.mockResolvedValue([]);
  m.details.mockImplementation(async ({ where }: { where: { attempt?: Record<string, unknown> } }) => attempts.filter(a => matches(a, where.attempt)).map(a => ({ questionIdx: 0, questionText: 'Synthetic question', selectedAnswer: `answer-${a.id}`, isCorrect: a.score > 0.5 })));
  m.count.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => attempts.filter(a => matches(a, where)).length);
  m.aggregate.mockImplementation(async ({ where }: { where: Record<string, unknown> }) => { const rows = attempts.filter(a => matches(a, where)); return { _avg: { score: rows.length ? rows.reduce((sum, a) => sum + a.score, 0) / rows.length : null } }; });
});

describe('AT-GRADE-01 batch 2a assessment analytics boundaries', () => {
  it.each(['TEACHER', 'ADMIN'])('denies a null-school %s before any attempt query', async role => {
    actor = { ...actor, role, schoolId: null };
    const response = await read();
    expect.soft(response.status).toBe(403);
    expect.soft(m.details).not.toHaveBeenCalled(); expect.soft(m.count).not.toHaveBeenCalled(); expect.soft(m.aggregate).not.toHaveBeenCalled();
  });
  it('returns only the primary teacher class in details, count and average', async () => {
    const response = await read(); expect(response.status).toBe(200);
    const body = await response.json();
    expect.soft(body.totalAttempts).toBe(1); expect.soft(body.avgScore).toBe(80);
    expect.soft(body.questions[0].totalAnswered).toBe(1); expect.soft(body.questions[0].mostCommonWrongAnswer).toBeNull();
    expect(JSON.stringify(body)).not.toContain('answer-attempt-B');
  });
  it('discloses no aggregates or answers to a same-school teacher with no class basis', async () => {
    actor.id = 'unassigned-teacher';
    m.classes.mockResolvedValue([]);
    const response = await read();
    expect([200, 403]).toContain(response.status);
    if (response.status === 200) {
      const body = await response.json();
      expect.soft(body.totalAttempts).toBe(0); expect.soft(body.avgScore).toBeNull(); expect.soft(body.questions).toEqual([]);
    }
  });
  it('retains justified ADMIN oversight of its own school while excluding the other school', async () => {
    actor.role = 'ADMIN';
    const response = await read(); expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.totalAttempts).toBe(2); expect(body.avgScore).toBe(50); expect(body.questions[0].totalAnswered).toBe(2);
    expect(JSON.stringify(body)).not.toContain('answer-attempt-C');
  });
  it('denies a student role without querying attempt data', async () => {
    actor.role = 'STUDENT'; expect((await read()).status).toBe(403);
    expect(m.details).not.toHaveBeenCalled(); expect(m.count).not.toHaveBeenCalled(); expect(m.aggregate).not.toHaveBeenCalled();
  });
  it('fixture honors class and school filters rather than returning a canned leak', () => {
    expect(attempts.filter(a => matches(a, { classId: { in: ['class-A'] }, schoolId: 'school-A' })).map(a => a.id)).toEqual(['attempt-A']);
  });
});
