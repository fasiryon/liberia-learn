"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ClassInfo = {
  id: string;
  name: string;
  subject: string;
};

type StudentRow = {
  id: string;
  name: string;
  email: string;
  currentGrade: number | null;
  className: string | null;
  classId: string | null;
  subject: string | null;
};

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    grade: 1,
    classId: "",
    dateOfBirth: "",
    gender: "",
    studentId: "",
    email: "",
  });

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    Promise.all([
      fetch("/api/admin/students", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/classes", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([studentData, classData]) => {
        if (!active) return;
        if (studentData?.error) {
          setError(studentData.error);
        } else {
          setStudents(studentData.students ?? []);
        }
        if (!classData?.ok) {
          setClasses([]);
        } else {
          setClasses(classData.classes ?? []);
        }
      })
      .catch(() => {
        if (!active) return;
        setError("Unable to load students. Please refresh.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === form.classId) ?? null,
    [classes, form.classId]
  );

  const requiredMissing =
    !form.firstName.trim() ||
    !form.lastName.trim() ||
    !form.classId ||
    !form.grade;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requiredMissing) {
      setError("Please complete all required fields.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          grade: Number(form.grade),
          classId: form.classId,
          dateOfBirth: form.dateOfBirth || undefined,
          gender: form.gender || undefined,
          studentId: form.studentId || undefined,
          email: form.email || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add student");
      }

      setStudents((prev) => [
        {
          id: data.student.id,
          name: data.student.name,
          email: data.student.email,
          currentGrade: data.student.currentGrade ?? null,
          className: selectedClass?.name ?? null,
          classId: data.student.classId ?? null,
          subject: selectedClass?.subject ?? null,
        },
        ...prev,
      ]);

      setSuccess(
        `Student added. Login ID: ${data.loginId} · Temporary PIN: ${data.tempPin}`
      );
      setForm({
        firstName: "",
        lastName: "",
        grade: 1,
        classId: "",
        dateOfBirth: "",
        gender: "",
        studentId: "",
        email: "",
      });
    } catch (err: any) {
      setError(err.message || "Failed to add student");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/admin"
              className="text-xs text-emerald-300 hover:text-emerald-200"
            >
              ← Back to Admin Console
            </Link>
            <h1 className="mt-2 text-2xl font-bold">Students</h1>
            <p className="text-sm text-slate-400">
              Enroll students and assign them to classes.
            </p>
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold mb-4">Add Student</h2>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-slate-400">First Name *</label>
              <input
                value={form.firstName}
                onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400">Last Name *</label>
              <input
                value={form.lastName}
                onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400">Grade *</label>
              <select
                value={form.grade}
                onChange={(e) => setForm((f) => ({ ...f, grade: Number(e.target.value) }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                required
              >
                {GRADES.map((g) => (
                  <option key={g} value={g}>
                    Grade {g}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400">Class Section *</label>
              <select
                value={form.classId}
                onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                required
              >
                <option value="">Select class...</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} · {c.subject}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400">Date of Birth</label>
              <input
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400">Gender</label>
              <select
                value={form.gender}
                onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              >
                <option value="">Select...</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400">Student ID (optional)</label>
              <input
                value={form.studentId}
                onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                placeholder="LBR-2024-001"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400">Email (optional)</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                placeholder="student@school.lr"
              />
              <p className="mt-1 text-[10px] text-slate-500">
                If omitted, the system will generate a login ID.
              </p>
            </div>

            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Add Student"}
              </button>
              {error && <p className="text-xs text-red-300">{error}</p>}
              {success && <p className="text-xs text-emerald-300">{success}</p>}
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Enrolled Students</h2>
            <span className="text-xs text-slate-500">{students.length} total</span>
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="h-10 rounded-xl bg-slate-800/50 animate-pulse" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/10 p-6 text-sm text-slate-400">
              No students enrolled yet. Add your first student.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-xs text-slate-500">
                    <th className="pb-2 pr-4">Name</th>
                    <th className="pb-2 pr-4">Grade</th>
                    <th className="pb-2 pr-4">Class</th>
                    <th className="pb-2 pr-4">Status</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr key={s.id} className="border-b border-white/5 text-slate-200">
                      <td className="py-3 pr-4">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-[11px] text-slate-500">{s.email}</div>
                      </td>
                      <td className="py-3 pr-4">{s.currentGrade ?? "—"}</td>
                      <td className="py-3 pr-4">{s.className ?? "—"}</td>
                      <td className="py-3 pr-4">
                        <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
                          Active
                        </span>
                      </td>
                      <td className="py-3">
                        <button
                          type="button"
                          className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-300 hover:text-slate-100"
                        >
                          View
                        </button>
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
