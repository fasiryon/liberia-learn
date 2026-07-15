import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { put, list, del } from "@vercel/blob";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function toCSV(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return s.includes(",") || s.includes('"') || s.includes("\n")
      ? `"${s.replace(/"/g, '""')}"`
      : s;
  };
  return [headers, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}

export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = new Date().toISOString().split("T")[0];

  const [students, grades, attendance, users, studentGuardians, escalations, agentInvocations] = await Promise.all([
    prisma.student.findMany({
      select: {
        id: true,
        currentGrade: true,
        createdAt: true,
        user: { select: { name: true, schoolId: true } },
      },
    }),
    prisma.grade.findMany({
      select: {
        id: true,
        studentId: true,
        classId: true,
        percent: true,
        letter: true,
        computedAt: true,
      },
      take: 50000,
      orderBy: { computedAt: "desc" },
    }),
    prisma.attendance.findMany({
      select: {
        id: true,
        studentId: true,
        date: true,
        status: true,
        classId: true,
      },
      take: 50000,
      orderBy: { date: "desc" },
    }),
    // Stopgap coverage (2026-07-15) beyond the free Supabase tier having no
    // platform backups at all: auth records, guardian contact info, and the
    // safeguarding escalation/invocation history - not a replacement for a
    // real database-level backup, just the highest-consequence tables to
    // not lose while the platform-tier decision is pending.
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        loginId: true,
        hashedPwd: true,
        name: true,
        role: true,
        schoolId: true,
        isPlatformAdmin: true,
        guardianCountryCode: true,
        guardianPhone: true,
        guardianPhoneE164: true,
        preferredChannel: true,
        smsOptIn: true,
        mustChangePIN: true,
        createdAt: true,
      },
    }),
    prisma.studentGuardian.findMany({
      select: { id: true, studentId: true, guardianId: true, relation: true },
    }),
    prisma.escalationQueue.findMany({
      select: {
        id: true,
        agentName: true,
        invocationId: true,
        goalId: true,
        userId: true,
        reason: true,
        priority: true,
        assignedTo: true,
        status: true,
        createdAt: true,
        resolvedAt: true,
        resolution: true,
      },
    }),
    prisma.agentInvocation.findMany({
      select: {
        id: true,
        agentName: true,
        agentVersion: true,
        goalId: true,
        userId: true,
        triggeredBy: true,
        input: true,
        output: true,
        status: true,
        errorMessage: true,
        escalationReason: true,
        createdAt: true,
      },
      take: 50000,
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const studentsCsv = toCSV(
    ["id", "name", "grade", "schoolId", "createdAt"],
    students.map((s) => [s.id, s.user?.name ?? "", s.currentGrade ?? "", s.user?.schoolId ?? "", s.createdAt.toISOString()])
  );

  const gradesCsv = toCSV(
    ["id", "studentId", "classId", "percent", "letter", "computedAt"],
    grades.map((g) => [g.id, g.studentId ?? "", g.classId ?? "", g.percent ?? "", g.letter ?? "", g.computedAt.toISOString()])
  );

  const attendanceCsv = toCSV(
    ["id", "studentId", "classId", "date", "status"],
    attendance.map((a) => [a.id, a.studentId ?? "", a.classId ?? "", a.date?.toISOString() ?? "", a.status ?? ""])
  );

  const usersCsv = toCSV(
    ["id", "email", "loginId", "hashedPwd", "name", "role", "schoolId", "isPlatformAdmin", "guardianCountryCode", "guardianPhone", "guardianPhoneE164", "preferredChannel", "smsOptIn", "mustChangePIN", "createdAt"],
    users.map((u) => [
      u.id, u.email, u.loginId ?? "", u.hashedPwd ?? "", u.name ?? "", u.role, u.schoolId ?? "",
      String(u.isPlatformAdmin), u.guardianCountryCode, u.guardianPhone ?? "", u.guardianPhoneE164 ?? "",
      u.preferredChannel, String(u.smsOptIn), String(u.mustChangePIN), u.createdAt.toISOString(),
    ])
  );

  const studentGuardiansCsv = toCSV(
    ["id", "studentId", "guardianId", "relation"],
    studentGuardians.map((sg) => [sg.id, sg.studentId, sg.guardianId, sg.relation ?? ""])
  );

  const escalationsCsv = toCSV(
    ["id", "agentName", "invocationId", "goalId", "userId", "reason", "priority", "assignedTo", "status", "createdAt", "resolvedAt", "resolution"],
    escalations.map((e) => [
      e.id, e.agentName, e.invocationId ?? "", e.goalId ?? "", e.userId ?? "", e.reason, e.priority,
      e.assignedTo ?? "", e.status, e.createdAt.toISOString(), e.resolvedAt?.toISOString() ?? "", e.resolution ?? "",
    ])
  );

  const agentInvocationsCsv = toCSV(
    ["id", "agentName", "agentVersion", "goalId", "userId", "triggeredBy", "input", "output", "status", "errorMessage", "escalationReason", "createdAt"],
    agentInvocations.map((a) => [
      a.id, a.agentName, a.agentVersion, a.goalId ?? "", a.userId ?? "", a.triggeredBy,
      JSON.stringify(a.input), a.output ? JSON.stringify(a.output) : "", a.status,
      a.errorMessage ?? "", a.escalationReason ?? "", a.createdAt.toISOString(),
    ])
  );

  const uploads = await Promise.allSettled([
    put(`backups/${date}/students.csv`, studentsCsv, { access: "private", contentType: "text/csv" }),
    put(`backups/${date}/grades.csv`, gradesCsv, { access: "private", contentType: "text/csv" }),
    put(`backups/${date}/attendance.csv`, attendanceCsv, { access: "private", contentType: "text/csv" }),
    put(`backups/${date}/users.csv`, usersCsv, { access: "private", contentType: "text/csv" }),
    put(`backups/${date}/student_guardians.csv`, studentGuardiansCsv, { access: "private", contentType: "text/csv" }),
    put(`backups/${date}/escalation_queue.csv`, escalationsCsv, { access: "private", contentType: "text/csv" }),
    put(`backups/${date}/agent_invocations.csv`, agentInvocationsCsv, { access: "private", contentType: "text/csv" }),
  ]);

  // Prune blobs older than 90 days
  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const { blobs } = await list({ prefix: "backups/" });
    const old = blobs.filter((b) => new Date(b.uploadedAt) < cutoff);
    if (old.length > 0) {
      await del(old.map((b) => b.url));
    }
  } catch {
    // Prune failure is non-fatal
  }

  const backed_up = uploads
    .map((r, i) =>
      r.status === "fulfilled"
        ? ["students", "grades", "attendance", "users", "student_guardians", "escalation_queue", "agent_invocations"][i]
        : null
    )
    .filter(Boolean);

  return NextResponse.json({ backed_up, date });
}

// Vercel Cron Jobs invoke via GET, not POST - see docs/ops/CRON_MIDDLEWARE_FIX.md.
export const GET = POST;
