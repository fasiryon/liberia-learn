"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type StudentOption = {
  id: string;
  name: string;
  currentGrade: number | null;
};

type AcademicYearOption = {
  id: string;
  yearLabel: string;
  isActive: boolean;
};

type EnrollmentRecord = {
  id: string;
  studentId: string;
  academicYearId: string;
  academicYearLabel: string | null;
  grade: number;
  status: "ACTIVE" | "PROMOTED" | "GRADUATED" | "TRANSFERRED";
  createdAt: string;
  student: {
    id: string;
    name: string;
    currentGrade: number | null;
  } | null;
};

const statusOptions: EnrollmentRecord["status"][] = ["ACTIVE", "PROMOTED", "GRADUATED", "TRANSFERRED"];

export default function EnrollmentManagementPage() {
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearOption[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    studentId: "",
    academicYearId: "",
    grade: 1,
    status: "ACTIVE" as EnrollmentRecord["status"],
  });

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [studentsRes, academicYearsRes, enrollmentsRes] = await Promise.all([
        fetch("/api/admin/students", { cache: "no-store" }),
        fetch("/api/admin/academic-year", { cache: "no-store" }),
        fetch("/api/admin/enrollment", { cache: "no-store" }),
      ]);

      const [studentsData, academicYearsData, enrollmentsData] = await Promise.all([
        studentsRes.json(),
        academicYearsRes.json(),
        enrollmentsRes.json(),
      ]);

      if (!studentsRes.ok) throw new Error(studentsData.error ?? "Failed to load students");
      if (!academicYearsRes.ok) throw new Error(academicYearsData.error ?? "Failed to load academic years");
      if (!enrollmentsRes.ok) throw new Error(enrollmentsData.error ?? "Failed to load enrollments");

      setStudents((studentsData.students ?? []).map((student: any) => ({
        id: student.id,
        name: student.name,
        currentGrade: student.currentGrade ?? null,
      })));
      setAcademicYears(academicYearsData.academicYears ?? []);
      setEnrollments(enrollmentsData.enrollments ?? []);

      const activeYear = (academicYearsData.academicYears ?? []).find((year: any) => year.isActive);
      setForm((current) => ({
        ...current,
        academicYearId: current.academicYearId || activeYear?.id || "",
      }));
    } catch (err: any) {
      setError(err.message ?? "Failed to load enrollment data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/enrollment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create enrollment");
      setMessage("Enrollment recorded.");
      await loadData();
      setForm((current) => ({
        ...current,
        studentId: "",
      }));
    } catch (err: any) {
      setError(err.message ?? "Failed to create enrollment");
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(enrollmentId: string, status: EnrollmentRecord["status"]) {
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/enrollment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, status }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update enrollment");
      setEnrollments((current) =>
        current.map((item) => (item.id === enrollmentId ? data.enrollment : item))
      );
      setMessage(`Enrollment moved to ${status.toLowerCase()}.`);
    } catch (err: any) {
      setError(err.message ?? "Failed to update enrollment");
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <header>
          <Link href="/admin" className="text-xs text-emerald-300 hover:text-emerald-200">
            Back to Admin Console
          </Link>
          <h1 className="mt-2 text-2xl font-bold">Enrollment Management</h1>
          <p className="mt-1 text-sm text-slate-400">Track student school-year enrollment and status changes without disturbing class rosters.</p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="mb-4 text-lg font-semibold">Create Enrollment Record</h2>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-4">
            <div>
              <label className="block text-xs text-slate-400">Student</label>
              <select
                value={form.studentId}
                onChange={(e) => setForm((current) => ({ ...current, studentId: e.target.value }))}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm"
                required
              >
                <option value="">Select student...</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.name} {student.currentGrade ? `(Grade ${student.currentGrade})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400">Academic Year</label>
              <select
                value={form.academicYearId}
                onChange={(e) => setForm((current) => ({ ...current, academicYearId: e.target.value }))}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm"
                required
              >
                <option value="">Select year...</option>
                {academicYears.map((year) => (
                  <option key={year.id} value={year.id}>
                    {year.yearLabel} {year.isActive ? "(Active)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400">Grade</label>
              <input
                type="number"
                min={1}
                max={12}
                value={form.grade}
                onChange={(e) => setForm((current) => ({ ...current, grade: Number(e.target.value) }))}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((current) => ({ ...current, status: e.target.value as EnrollmentRecord["status"] }))}
                className="mt-1 min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-4 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Create Enrollment"}
              </button>
              {message ? <p className="text-xs text-emerald-300">{message}</p> : null}
              {error ? <p className="text-xs text-red-300">{error}</p> : null}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Enrollment Records</h2>
            <span className="text-xs text-slate-500">{enrollments.length} total</span>
          </div>

          {loading ? (
            <div className="rounded-xl border border-white/10 bg-black/10 p-6 text-sm text-slate-400">Loading enrollments...</div>
          ) : enrollments.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/10 p-6 text-sm text-slate-400">No academic enrollments recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                    <th className="pb-2 pr-4">Student</th>
                    <th className="pb-2 pr-4">Academic Year</th>
                    <th className="pb-2 pr-4">Grade</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Change Status</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((enrollment) => (
                    <tr key={enrollment.id} className="border-b border-white/5 text-slate-200">
                      <td className="py-3 pr-4">{enrollment.student?.name ?? "Student"}</td>
                      <td className="py-3 pr-4">{enrollment.academicYearLabel ?? "-"}</td>
                      <td className="py-3 pr-4">Grade {enrollment.grade}</td>
                      <td className="py-3 pr-4">
                        <span className="rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-200">
                          {enrollment.status}
                        </span>
                      </td>
                      <td className="py-3">
                        <select
                          value={enrollment.status}
                          onChange={(e) => updateStatus(enrollment.id, e.target.value as EnrollmentRecord["status"])}
                          className="min-h-10 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
                        >
                          {statusOptions.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
