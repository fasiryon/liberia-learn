"use client";

import { useState } from "react";

const EXAMPLES: Record<string, string> = {
  students: "firstName,lastName,grade,className,email,phone\nMartha,Johnson,7,Grade 7A,martha@example.com,+231770000001",
  teachers: "fullName,email,loginId,phone,subjectSpecialty\nJames Doe,james@example.com,TCH-2026-001,+231770000002,MATH",
  classes: "name,subject,teacherLoginId\nGrade 7A,MATH,TCH-2026-001",
  enrollments: "studentLoginId,className,academicYearLabel,grade\nCHA-2026-0001,Grade 7A,2026-2027,7",
};

export default function AdminImportPage() {
  const [entity, setEntity] = useState<keyof typeof EXAMPLES>("students");
  const [csv, setCsv] = useState(EXAMPLES.students);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [errors, setErrors] = useState<Array<{ row: number; field: string; error: string }>>([]);

  async function handleSubmit() {
    setSaving(true);
    setResult(null);
    setErrors([]);
    try {
      const response = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, csv }),
      });
      const data = await response.json();
      if (!response.ok) {
        setErrors(data.rowErrors ?? []);
        throw new Error(data.error ?? "Import failed");
      }
      setResult(`Imported ${data.importedCount} ${entity} row(s).`);
    } catch (error: any) {
      setResult(error.message ?? "Import failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-50">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-emerald-300">Admin Import</p>
          <h1 className="mt-2 text-3xl font-semibold">School Onboarding CSV Import</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-300">
            Use one CSV file at a time. Imports are school-scoped, audited, and validated before any write happens.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[0.8fr,1.2fr]">
          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <label className="text-xs uppercase tracking-wide text-slate-400">Import type</label>
            <select
              value={entity}
              onChange={(event) => {
                const next = event.target.value as keyof typeof EXAMPLES;
                setEntity(next);
                setCsv(EXAMPLES[next]);
              }}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm"
            >
              <option value="students">Students</option>
              <option value="teachers">Teachers</option>
              <option value="classes">Classes</option>
              <option value="enrollments">Enrollments</option>
            </select>

            <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4 text-sm text-cyan-100">
              <p className="font-semibold">Authoritative path</p>
              <p className="mt-2 text-cyan-50/90">
                Start with classes, then teachers or students, then enrollments. The importer fails loudly on missing school-scoped references.
              </p>
            </div>

            {result ? (
              <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                {result}
              </div>
            ) : null}
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <label className="text-xs uppercase tracking-wide text-slate-400">CSV content</label>
            <textarea
              value={csv}
              onChange={(event) => setCsv(event.target.value)}
              className="mt-2 min-h-[320px] w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 font-mono text-sm"
            />
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-500">Quoted CSV is supported. Every row is validated before import.</p>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={saving || !csv.trim()}
                className="rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {saving ? "Importing..." : "Run Import"}
              </button>
            </div>
          </section>
        </div>

        {errors.length > 0 ? (
          <section className="rounded-3xl border border-amber-500/20 bg-amber-500/10 p-6">
            <h2 className="text-lg font-semibold text-amber-100">Validation errors</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full text-sm text-amber-50">
                <thead className="text-left text-xs uppercase tracking-wide text-amber-200/80">
                  <tr>
                    <th className="px-3 py-2">Row</th>
                    <th className="px-3 py-2">Field</th>
                    <th className="px-3 py-2">Error</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((error, index) => (
                    <tr key={`${error.row}-${error.field}-${index}`} className="border-t border-amber-500/10">
                      <td className="px-3 py-2">{error.row}</td>
                      <td className="px-3 py-2">{error.field}</td>
                      <td className="px-3 py-2">{error.error}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
