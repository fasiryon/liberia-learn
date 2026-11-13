// Batch 2b: real route/service; only DB, session and feature-flag boundaries mocked.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const m = vi.hoisted(() => ({ role: vi.fn(), work: vi.fn(), lab: vi.fn(), roster: vi.fn(), create: vi.fn(), update: vi.fn(), audit: vi.fn(), cls: vi.fn(), assignments: vi.fn() }));
vi.mock('@/lib/auth', () => ({ requireRole: m.role }));
vi.mock('@/lib/serverFlags', () => ({ isVirtualLabsEnabled: () => true }));
vi.mock('@/lib/audit', () => ({ logAudit: m.audit, logAuditRequired: m.audit }));
vi.mock('@/lib/db', () => ({ prisma: {
  scheduledWork: { findUnique: m.work, update: m.update }, virtualLab: { findUnique: m.lab },
  enrollment: { findMany: m.roster }, labSession: { createMany: m.create },
  class: { findUnique: m.cls }, teacherAssignment: { findMany: m.assignments },
} }));
import { POST } from '@/app/api/teacher/schedule/[id]/lab/route';
let actor: { id: string; role: string; schoolId: string | null };
const cls = { id: 'class-A', schoolId: 'school-A', teacherId: 'teacher-A' };
async function link() { return POST(new NextRequest('http://atlas.invalid/lab', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ labId: 'lab-A' }) }), { params: { id: 'work-A' } }); }
function noWrites() { expect.soft(m.create).not.toHaveBeenCalled(); expect.soft(m.update).not.toHaveBeenCalled(); expect.soft(m.audit).not.toHaveBeenCalled(); }
beforeEach(() => {
  vi.resetAllMocks(); actor = { id: 'teacher-A', role: 'TEACHER', schoolId: 'school-A' };
  m.role.mockImplementation(async (...roles: string[]) => { if (!roles.includes(actor.role)) throw Object.assign(new Error('Forbidden'), { status: 403 }); return actor; });
  m.work.mockResolvedValue({ id: 'work-A', classId: cls.id, class: cls, suggestedLabs: [] }); m.cls.mockResolvedValue(cls);
  m.assignments.mockResolvedValue([]);
  m.lab.mockResolvedValue({ id: 'lab-row-A', labId: 'lab-A', schoolId: null, status: 'published', subject: 'SCIENCE', title: 'Synthetic lab', labType: 'SIMULATION', estimatedMinutes: 10 });
  m.roster.mockResolvedValue([{ Student: { userId: 'learner-A' } }]);
  m.create.mockResolvedValue({ count: 1 }); m.update.mockResolvedValue({ id: 'work-A' }); m.audit.mockResolvedValue(true);
});
describe('AT-GRADE-01 batch 2b scheduled lab write authority', () => {
  it.each(['TEACHER', 'ADMIN'])('preserves the class primary teacher and same-school %s path', async role => {
    actor.role = role; expect((await link()).status).toBe(200);
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ studentId: 'learner-A', schoolId: 'school-A', scheduledWorkId: 'work-A', labId: 'lab-A' })] }));
    expect(m.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'work-A' } }));
  });
  it('denies an unrelated same-school teacher before roster disclosure or writes', async () => {
    actor.id = 'unassigned-teacher'; const response = await link();
    expect.soft(response.status).toBe(403); expect.soft(m.roster).not.toHaveBeenCalled(); noWrites();
  });
  it.each(['school-B', null])('denies a viewer bound to %s before roster disclosure or writes', async schoolId => {
    actor.schoolId = schoolId; expect((await link()).status).toBe(403); expect(m.roster).not.toHaveBeenCalled(); noWrites();
  });
  it('denies null-school equality between viewer and scheduled class', async () => {
    actor.schoolId = null; m.work.mockResolvedValue({ id: 'work-A', classId: cls.id, class: { ...cls, schoolId: null }, suggestedLabs: [] });
    m.cls.mockResolvedValue({ ...cls, schoolId: null });
    expect.soft((await link()).status).toBe(403); expect.soft(m.roster).not.toHaveBeenCalled(); noWrites();
  });
  it('denies a co-teacher assigned another subject', async () => {
    actor.id = 'co-teacher'; m.assignments.mockResolvedValue([{ subject: 'MATH' }]);
    expect.soft((await link()).status).toBe(403); noWrites();
  });
  it('denies a student role before any scheduled-work read or write', async () => {
    actor.role = 'STUDENT'; expect((await link()).status).toBe(403); expect(m.work).not.toHaveBeenCalled(); noWrites();
  });
});
