"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Dashboard = {
  school: {
    id: string;
    name: string;
    code: string | null;
    county: string | null;
    district: string | null;
    schoolType: string | null;
    logoUrl: string | null;
    contactEmail: string | null;
    contactName: string | null;
    contactPhone: string | null;
  };
  metrics: {
    totalStudents: number;
    totalTeachers: number;
    activeThisWeek: number;
    avgQuizScore: number;
    completionRate: number;
  };
  gradeBreakdown: Array<{ id: string; name: string; subject: string; gradeLevel: number | null; studentCount: number }>;
  teachers: Array<{ id: string; name: string; email: string; active: boolean; classesAssigned: Array<{ name: string }>; lastLoginAt: string | null }>;
  registrationLink: string;
};

type ClassRow = { id: string; name: string; subject: string; gradeLevel: number | null };
type StudentRow = { id: string; name: string; currentGrade: number | null; className: string | null };

const SUBJECTS = ["MATH", "SCIENCE", "COMPUTER_SCIENCE", "ENGINEERING", "LITERACY", "CIVICS", "ARTS", "PE", "CAREER"];

export default function PrincipalSchoolPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [teacherForm, setTeacherForm] = useState({ fullName: "", email: "", phone: "" });
  const [classForm, setClassForm] = useState({ name: "", subject: "LITERACY", gradeLevel: "1", teacherId: "" });
  const [moveForm, setMoveForm] = useState({ studentId: "", targetClassId: "" });

  async function load() {
    const [dashboardRes, classesRes, studentsRes] = await Promise.all([
      fetch("/api/admin/school", { cache: "no-store" }),
      fetch("/api/admin/classes", { cache: "no-store" }),
      fetch("/api/admin/students", { cache: "no-store" }),
    ]);
    const dashboardData = await dashboardRes.json();
    const classData = await classesRes.json();
    const studentData = await studentsRes.json();
    if (dashboardData.dashboard) setDashboard(dashboardData.dashboard);
    setClasses(classData.classes ?? []);
    setStudents(studentData.students ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function patch(payload: Record<string, unknown>, success: string) {
    setMessage(null);
    const res = await fetch("/api/admin/school", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error || "Action failed");
      return;
    }
    setMessage(success);
    await load();
  }

  async function uploadLogo(file?: File | null) {
    if (!file) return;
    const body = new FormData();
    body.set("logo", file);
    const res = await fetch("/api/admin/school/logo", { method: "POST", body });
    const data = await res.json();
    setMessage(res.ok ? "Logo uploaded." : data.error || "Logo upload failed");
    if (res.ok) await load();
  }

  if (!dashboard) {
    return <main className="min-h-screen bg-slate-950 p-6 text-slate-50">Loading school dashboard...</main>;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6">
        <Link href="/admin" className="text-xs font-semibold text-emerald-300">Back to admin</Link>
        <header className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Principal school dashboard</p>
              <h1 className="mt-2 text-3xl font-bold">{dashboard.school.name}</h1>
              <p className="mt-2 text-sm text-slate-300">{dashboard.school.county ?? "County missing"} - {dashboard.school.district ?? "District missing"}</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
              <p className="text-xs text-emerald-200">School code</p>
              <p className="mt-1 text-2xl font-black tracking-widest">{dashboard.school.code ?? "Pending approval"}</p>
              <button onClick={() => navigator.clipboard?.writeText(dashboard.registrationLink)} className="mt-3 rounded-xl bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-950">
                Copy registration link
              </button>
              <p className="mt-2 break-all text-xs text-slate-300">{dashboard.registrationLink}</p>
            </div>
          </div>
        </header>

        {message ? <p className="rounded-xl border border-white/10 bg-slate-900 p-3 text-sm">{message}</p> : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            ["Students", dashboard.metrics.totalStudents],
            ["Teachers", dashboard.metrics.totalTeachers],
            ["Active this week", dashboard.metrics.activeThisWeek],
            ["Avg quiz score", `${dashboard.metrics.avgQuizScore}%`],
            ["Completion rate", `${dashboard.metrics.completionRate}%`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-white/10 bg-slate-900/80 p-4">
              <p className="text-xs text-slate-400">{label}</p>
              <p className="mt-2 text-3xl font-bold text-emerald-300">{value}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <h2 className="text-lg font-semibold">Grade breakdown</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs text-slate-500"><tr><th className="py-2">Class</th><th>Grade</th><th>Subject</th><th>Students</th></tr></thead>
                <tbody>
                  {dashboard.gradeBreakdown.map((row) => (
                    <tr key={row.id} className="border-t border-white/10">
                      <td className="py-3">{row.name}</td>
                      <td>{row.gradeLevel ?? "-"}</td>
                      <td>{row.subject}</td>
                      <td>{row.studentCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <h2 className="text-lg font-semibold">Teachers</h2>
            <div className="mt-3 space-y-3">
              {dashboard.teachers.map((teacher) => (
                <div key={teacher.id} className="rounded-2xl bg-slate-950/70 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{teacher.name}</p>
                      <p className="text-xs text-slate-400">{teacher.email}</p>
                      <p className="text-xs text-slate-500">Classes: {teacher.classesAssigned.map((item) => item.name).join(", ") || "None"} - Last login: {teacher.lastLoginAt ? new Date(teacher.lastLoginAt).toLocaleDateString("en-LR") : "Not available"}</p>
                    </div>
                    <button onClick={() => patch({ action: "deactivateTeacher", teacherId: teacher.id }, "Teacher deactivated.")} className="rounded-xl border border-red-400/40 px-3 py-2 text-xs text-red-200">
                      Deactivate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-3">
          <form onSubmit={(e) => { e.preventDefault(); patch({ action: "inviteTeacher", ...teacherForm }, "Teacher invited."); }} className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <h2 className="text-lg font-semibold">Invite teacher</h2>
            <input placeholder="Full name" value={teacherForm.fullName} onChange={(e) => setTeacherForm({ ...teacherForm, fullName: e.target.value })} className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" />
            <input placeholder="Email" type="email" value={teacherForm.email} onChange={(e) => setTeacherForm({ ...teacherForm, email: e.target.value })} className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" />
            <input placeholder="Phone optional" value={teacherForm.phone} onChange={(e) => setTeacherForm({ ...teacherForm, phone: e.target.value })} className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" />
            <button className="mt-3 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950">Invite teacher</button>
          </form>

          <form onSubmit={(e) => { e.preventDefault(); patch({ action: "createClass", ...classForm, gradeLevel: Number(classForm.gradeLevel), teacherId: classForm.teacherId || undefined }, "Class created."); }} className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <h2 className="text-lg font-semibold">Create class</h2>
            <input placeholder="Class name" value={classForm.name} onChange={(e) => setClassForm({ ...classForm, name: e.target.value })} className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" />
            <select value={classForm.gradeLevel} onChange={(e) => setClassForm({ ...classForm, gradeLevel: e.target.value })} className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm">{Array.from({ length: 12 }, (_, i) => <option key={i + 1}>{i + 1}</option>)}</select>
            <select value={classForm.subject} onChange={(e) => setClassForm({ ...classForm, subject: e.target.value })} className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm">{SUBJECTS.map((s) => <option key={s}>{s}</option>)}</select>
            <select value={classForm.teacherId} onChange={(e) => setClassForm({ ...classForm, teacherId: e.target.value })} className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="">Unassigned</option>{dashboard.teachers.filter((t) => t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <button className="mt-3 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950">Create class</button>
          </form>

          <form onSubmit={(e) => { e.preventDefault(); patch({ action: "moveStudent", ...moveForm }, "Student moved."); }} className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
            <h2 className="text-lg font-semibold">Move student</h2>
            <select value={moveForm.studentId} onChange={(e) => setMoveForm({ ...moveForm, studentId: e.target.value })} className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="">Select student</option>{students.map((s) => <option key={s.id} value={s.id}>{s.name} - {s.className ?? "Unassigned"}</option>)}</select>
            <select value={moveForm.targetClassId} onChange={(e) => setMoveForm({ ...moveForm, targetClassId: e.target.value })} className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm"><option value="">Target class</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <button className="mt-3 w-full rounded-xl bg-emerald-400 px-4 py-3 text-sm font-bold text-slate-950">Move student</button>
          </form>
        </section>

        <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-5">
          <h2 className="text-lg font-semibold">School profile and logo</h2>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input type="file" accept="image/*" onChange={(e) => uploadLogo(e.target.files?.[0])} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-3 text-sm" />
            <Link href="/admin/students/import" className="rounded-xl border border-emerald-400/40 px-4 py-3 text-center text-sm font-bold text-emerald-200">Bulk import students</Link>
          </div>
        </section>
      </div>
    </main>
  );
}
