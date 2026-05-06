"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CredentialDeliveryActions } from "@/components/CredentialDeliveryActions";

type ClassInfo = {
  id: string;
  name: string;
  subject: string;
};

type StudentRow = {
  id: string;
  userId: string;
  name: string;
  email: string;
  loginId: string | null;
  phone: string | null;
  currentGrade: number | null;
  className: string | null;
  classId: string | null;
  subject: string | null;
};

type CreatedCredential = {
  userId: string;
  loginId: string;
  tempPin: string;
  phone: string | null;
};

const GRADES = Array.from({ length: 12 }, (_, i) => i + 1);

const PAGE_SIZE = 15;

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [createdCredential, setCreatedCredential] = useState<CreatedCredential | null>(null);
  const [studentSearch, setStudentSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    grade: 1,
    classId: "",
    dateOfBirth: "",
    gender: "",
    studentId: "",
    email: "",
    phone: "",
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

  const selectedClass = useMemo(() => classes.find((c) => c.id === form.classId) ?? null, [classes, form.classId]);

  const filteredStudents = useMemo(() => {
    const q = studentSearch.toLowerCase().trim();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.className ?? "").toLowerCase().includes(q) ||
        (s.loginId ?? "").toLowerCase().includes(q)
    );
  }, [students, studentSearch]);

  const visibleStudents = filteredStudents.slice(0, visibleCount);
  const hasMoreStudents = filteredStudents.length > visibleCount;

  const requiredMissing = !form.firstName.trim() || !form.lastName.trim() || !form.classId || !form.grade;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (requiredMissing) {
      setError("Please complete all required fields.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    setCreatedCredential(null);

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
          phone: form.phone || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add student");
      }

      setStudents((prev) => [
        {
          id: data.student.id,
          userId: data.student.userId,
          name: data.student.name,
          email: data.student.email,
          loginId: data.student.loginId ?? null,
          phone: data.student.phone ?? null,
          currentGrade: data.student.currentGrade ?? null,
          className: selectedClass?.name ?? null,
          classId: data.student.classId ?? null,
          subject: selectedClass?.subject ?? null,
        },
        ...prev,
      ]);

      setSuccess("Student added successfully");
      setCreatedCredential({
        userId: data.userId,
        loginId: data.loginId,
        tempPin: data.tempPin,
        phone: data.phone ?? null,
      });
      setForm({
        firstName: "",
        lastName: "",
        grade: 1,
        classId: "",
        dateOfBirth: "",
        gender: "",
        studentId: "",
        email: "",
        phone: "",
      });
    } catch (err: any) {
      setError(err.message || "Failed to add student");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin" className="text-xs text-[var(--ll-yellow)] hover:text-[var(--ll-yellow)]">
              Back to Admin Console
            </Link>
            <h1 className="mt-2 text-2xl font-bold">Students</h1>
            <p className="text-sm text-[var(--ll-text-muted)]">Enroll students and assign them to classes.</p>
          </div>
        </header>

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <h2 className="mb-4 text-lg font-semibold">Add Student</h2>
          <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-xs text-[var(--ll-text-muted)]">First Name *</label>
              <input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm text-[var(--ll-text)]" required />
            </div>
            <div>
              <label className="block text-xs text-[var(--ll-text-muted)]">Last Name *</label>
              <input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm text-[var(--ll-text)]" required />
            </div>
            <div>
              <label className="block text-xs text-[var(--ll-text-muted)]">Grade *</label>
              <select value={form.grade} onChange={(e) => setForm((f) => ({ ...f, grade: Number(e.target.value) }))} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm text-[var(--ll-text)]" required>
                {GRADES.map((g) => (
                  <option key={g} value={g}>Grade {g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--ll-text-muted)]">Class Section *</label>
              <select value={form.classId} onChange={(e) => setForm((f) => ({ ...f, classId: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm text-[var(--ll-text)]" required>
                <option value="">Select class...</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} · {c.subject}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--ll-text-muted)]">Date of Birth</label>
              <input type="date" value={form.dateOfBirth} onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm text-[var(--ll-text)]" />
            </div>
            <div>
              <label className="block text-xs text-[var(--ll-text-muted)]">Gender</label>
              <select value={form.gender} onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm text-[var(--ll-text)]">
                <option value="">Select...</option>
                <option value="female">Female</option>
                <option value="male">Male</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-[var(--ll-text-muted)]">Student ID (optional)</label>
              <input value={form.studentId} onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm text-[var(--ll-text)]" placeholder="LBR-2024-001" />
            </div>
            <div>
              <label className="block text-xs text-[var(--ll-text-muted)]">Phone Number (optional)</label>
              <input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm text-[var(--ll-text)]" placeholder="+231 XX XXX XXXX" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-[var(--ll-text-muted)]">Email (optional)</label>
              <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="mt-1 min-h-11 w-full rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm text-[var(--ll-text)]" placeholder="student@school.lr" />
              <p className="mt-1 text-[10px] text-[var(--ll-text-faint)]">If omitted, LiberiaLearn will create a local account and Student ID.</p>
            </div>

            <div className="md:col-span-2 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={saving} className="rounded-xl bg-[var(--ll-yellow)] px-6 py-3 text-sm font-semibold text-[var(--ll-text-faint)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-60">
                {saving ? "Saving..." : "Add Student"}
              </button>
              {error && <p className="text-xs text-red-300">{error}</p>}
              {success && <p className="text-xs text-[var(--ll-yellow)]">{success}</p>}
            </div>
          </form>
        </section>

        {createdCredential && (
          <section className="rounded-xl border border-emerald-500/30 bg-[var(--ll-yellow)]/10 p-6">
            <h2 className="text-xl font-semibold text-[var(--ll-yellow)]">Student added successfully</h2>
            <p className="mt-3 text-sm text-[var(--ll-text)]">Student ID: <span className="font-semibold text-[var(--ll-text)]">{createdCredential.loginId}</span></p>
            <p className="mt-1 text-sm text-[var(--ll-text)]">Temporary PIN: <span className="font-semibold text-[var(--ll-text)]">{createdCredential.tempPin}</span></p>
            <div className="mt-4">
              <CredentialDeliveryActions userId={createdCredential.userId} pin={createdCredential.tempPin} phone={createdCredential.phone} />
            </div>
          </section>
        )}

        <section className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Enrolled Students</h2>
              <span className="text-xs text-[var(--ll-text-faint)]">{students.length} total</span>
            </div>
            {!loading && students.length > 0 && (
              <input
                type="search"
                value={studentSearch}
                onChange={(e) => {
                  setStudentSearch(e.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="Search by name, class, or ID…"
                className="w-full max-w-xs rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm text-[var(--ll-text)] placeholder:text-[var(--ll-text-faint)] outline-none focus:border-[var(--ll-yellow)]/50"
              />
            )}
          </div>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, idx) => (
                <div key={idx} className="h-10 animate-pulse rounded-xl bg-[var(--ll-surface)]/50" />
              ))}
            </div>
          ) : students.length === 0 ? (
            <div className="rounded-xl border border-[var(--ll-border)] bg-black/10 p-6 text-sm text-[var(--ll-text-muted)]">No students enrolled yet. Add your first student.</div>
          ) : filteredStudents.length === 0 ? (
            <p className="text-sm text-[var(--ll-text-faint)]">No students match your search.</p>
          ) : (
            <div className="space-y-3">
              {filteredStudents.length > PAGE_SIZE && (
                <p className="text-xs text-[var(--ll-text-faint)]">
                  Showing {Math.min(visibleCount, filteredStudents.length)} of {filteredStudents.length} students
                </p>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--ll-border)] text-left text-xs text-[var(--ll-text-faint)]">
                      <th className="pb-2 pr-4">Name</th>
                      <th className="pb-2 pr-4">Grade</th>
                      <th className="pb-2 pr-4">Class</th>
                      <th className="pb-2 pr-4">Login ID</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleStudents.map((s) => (
                      <tr key={s.id} className="border-b border-white/5 text-[var(--ll-text)]">
                        <td className="py-3 pr-4">
                          <Link
                            href={`/admin/students/${s.id}`}
                            className="font-medium text-[var(--ll-text)] hover:text-[var(--ll-yellow)] transition-colors"
                          >
                            {s.name}
                          </Link>
                          <div className="text-[11px] text-[var(--ll-text-faint)]">{s.email}</div>
                        </td>
                        <td className="py-3 pr-4">{s.currentGrade ?? "-"}</td>
                        <td className="py-3 pr-4">{s.className ?? "-"}</td>
                        <td className="py-3 pr-4">{s.loginId ?? "-"}</td>
                        <td className="py-3">
                          <Link
                            href={`/admin/students/${s.id}`}
                            className="inline-flex rounded-full border border-[var(--ll-border)] px-2.5 py-1 text-[11px] text-[var(--ll-text)] hover:text-[var(--ll-text)]"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hasMoreStudents && (
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-surface)]/50 px-4 py-2 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-surface)] transition-colors"
                >
                  Load more ({filteredStudents.length - visibleCount} remaining)
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

