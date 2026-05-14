"use client";

import { useEffect, useState, useRef } from "react";
import { CheckCircle2, Circle, AlertTriangle, Upload } from "lucide-react";

const SUBJECTS = ["MATH", "SCIENCE", "ENGLISH", "CIVICS", "COMPUTER_SCIENCE", "HISTORY", "ART", "PE"] as const;
const SCHOOL_TYPES = ["PRIMARY", "SECONDARY", "BOTH"];

type OnboardingData = {
  school: {
    id: string; name: string; county: string | null; motto: string | null;
    contactName: string | null; primaryHex: string | null; logoUrl: string | null;
    onboardingStep: number; contactPhone: string | null; schoolType: string | null;
  } | null;
  teacherCount: number;
  classCount: number;
  studentCount: number;
  onboarding: { step: number; completed: boolean };
};

function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-[var(--ll-text-muted)]">
        <span>Step {step} of {total}</span>
        <span>{Math.round((step / total) * 100)}% complete</span>
      </div>
      <div className="h-2 w-full rounded-full bg-[var(--ll-surface)]">
        <div
          className="h-2 rounded-full bg-[var(--ll-yellow)] transition-all duration-300"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Step 1 fields
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [principal, setPrincipal] = useState("");
  const [phone, setPhone] = useState("");
  const [schoolType, setSchoolType] = useState("");
  const [grades, setGrades] = useState<number[]>([]);
  const [logoUrl, setLogoUrl] = useState("");

  // Step 2 fields
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherSubject, setTeacherSubject] = useState("");
  const [teacherSaving, setTeacherSaving] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [csvImporting, setCsvImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | null>(null);
  const teacherCsvRef = useRef<HTMLInputElement>(null);

  // Step 3 fields
  const [studentCsv, setStudentCsv] = useState("");
  const [csvPreview, setCsvPreview] = useState<any[] | null>(null);
  const [csvTotal, setCsvTotal] = useState(0);
  const [studentImporting, setStudentImporting] = useState(false);
  const studentCsvRef = useRef<HTMLInputElement>(null);

  // Step 4 fields — timetable: grade → subject
  const [timetable, setTimetable] = useState<Record<number, string>>({});
  const [timetableSaving, setTimetableSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/onboarding")
      .then((r) => r.json())
      .then((d: OnboardingData) => {
        setData(d);
        if (d.school) {
          setName(d.school.name || "");
          setAddress(d.school.county || "");
          setPrincipal(d.school.contactName || "");
          setPhone(d.school.contactPhone || "");
          setSchoolType(d.school.schoolType || "");
          setLogoUrl(d.school.logoUrl || "");
        }
        const savedStep = d.onboarding?.step ?? 1;
        setStep(Math.min(savedStep, 5));
      })
      .finally(() => setLoading(false));
  }, []);

  async function advanceStep(n: number, body: object = {}) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/onboarding/step/${n}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Save failed"); return false; }
      setStep(n + 1);
      setData((prev) => prev ? { ...prev, onboarding: { ...prev.onboarding, step: n } } : prev);
      return true;
    } catch {
      setError("Save failed. Please try again.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleStep1() {
    await advanceStep(1, { name, address, principalName: principal, phone, schoolType, grades, logoUrl });
  }

  async function handleAddTeacher() {
    if (!teacherName) return;
    setTeacherSaving(true);
    setTeacherError(null);
    try {
      const res = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: teacherName, email: teacherEmail || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { setTeacherError(json.error ?? "Could not add teacher"); return; }
      setTeacherName("");
      setTeacherEmail("");
      setTeacherSubject("");
      setData((prev) => prev ? { ...prev, teacherCount: prev.teacherCount + 1 } : prev);
      setImportResult(`Teacher "${teacherName}" added.`);
    } catch {
      setTeacherError("Could not add teacher.");
    } finally {
      setTeacherSaving(false);
    }
  }

  async function handleTeacherCsvImport() {
    const file = teacherCsvRef.current?.files?.[0];
    if (!file) return;
    setCsvImporting(true);
    setImportResult(null);
    const text = await file.text();
    try {
      const res = await fetch("/api/admin/onboarding/import-teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: text }),
      });
      const json = await res.json();
      if (!res.ok) { setImportResult(`Error: ${json.error}`); return; }
      setData((prev) => prev ? { ...prev, teacherCount: prev.teacherCount + json.created } : prev);
      setImportResult(`Imported ${json.created} teachers. Skipped: ${json.skipped}. ${json.errors?.length ? `Errors: ${json.errors.join(", ")}` : ""}`);
    } catch {
      setImportResult("Import failed.");
    } finally {
      setCsvImporting(false);
    }
  }

  async function handleStep2() {
    await advanceStep(2);
  }

  async function handleStudentCsvPreview() {
    const file = studentCsvRef.current?.files?.[0];
    if (!file) return;
    const text = await file.text();
    setStudentCsv(text);
    const res = await fetch("/api/admin/onboarding/import-students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: text, preview: true }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error); return; }
    setCsvPreview(json.rows);
    setCsvTotal(json.total);
  }

  async function handleStudentCsvImport() {
    if (!studentCsv) return;
    setStudentImporting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/onboarding/import-students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv: studentCsv }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error); return; }
      setData((prev) => prev ? { ...prev, studentCount: prev.studentCount + json.created } : prev);
      setCsvPreview(null);
      setSuccessMsg(`${json.created} students imported successfully.`);
    } catch {
      setError("Import failed.");
    } finally {
      setStudentImporting(false);
    }
  }

  async function handleStep3() {
    await advanceStep(3);
  }

  async function handleSaveTimetable() {
    if (Object.keys(timetable).length === 0) return;
    setTimetableSaving(true);
    setError(null);
    try {
      // Create a Class record for each grade+subject entry
      for (const [gradeStr, subject] of Object.entries(timetable)) {
        const gradeLevel = parseInt(gradeStr, 10);
        if (!subject) continue;
        await fetch("/api/admin/classes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: `Grade ${gradeLevel} ${subject}`, grade: gradeLevel, subject }),
        }).catch(() => {});
      }
      setData((prev) => prev ? { ...prev, classCount: prev.classCount + Object.keys(timetable).length } : prev);
      setSuccessMsg("Timetable saved — classes created.");
    } finally {
      setTimetableSaving(false);
    }
  }

  async function handleStep4() {
    await advanceStep(4);
  }

  async function handleComplete() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/onboarding/complete", { method: "POST" });
      if (!res.ok) { const j = await res.json(); setError(j.error); return; }
      window.location.href = "/admin?onboarding=done";
    } finally {
      setSaving(false);
    }
  }

  function toggleGrade(g: number) {
    setGrades((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  }

  if (loading) {
    return (
      <main className="ll-dashboard-shell">
        <div className="ll-page-enter mx-auto max-w-2xl px-4 py-5">
          <div className="h-64 animate-pulse rounded-xl bg-[var(--ll-surface)]/50" />
        </div>
      </main>
    );
  }

  const STEPS = ["School Profile", "Add Teachers", "Import Students", "Set Timetable", "Go Live"];

  return (
    <main className="ll-dashboard-shell">
      <div className="ll-page-enter mx-auto max-w-2xl space-y-6 px-4 py-5">
        <div>
          <a href="/admin" className="text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">← Back to Admin</a>
          <h1 className="mt-2 text-2xl font-bold text-[var(--ll-text)]">School Setup Wizard</h1>
          <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Get your school ready for Day 1 in 5 steps</p>
        </div>

        <ProgressBar step={step} total={STEPS.length} />

        <div className="flex gap-1">
          {STEPS.map((s, i) => (
            <div key={i} className="flex-1">
              <div className={`h-1 rounded-full ${i + 1 < step ? "bg-[var(--ll-yellow)]" : i + 1 === step ? "bg-[var(--ll-yellow)]/60" : "bg-[var(--ll-surface)]"}`} />
              <p className={`mt-1 hidden text-[10px] sm:block ${i + 1 === step ? "text-[var(--ll-yellow)]" : "text-[var(--ll-text-faint)]"}`}>{s}</p>
            </div>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            <p className="text-sm text-emerald-400">{successMsg}</p>
          </div>
        )}

        <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">

          {/* STEP 1 — School Profile */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-[var(--ll-text)]">Step 1: School Profile</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs text-[var(--ll-text-muted)]">School Name *</label>
                  <input value={name} onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]" />
                </div>
                <div>
                  <label className="text-xs text-[var(--ll-text-muted)]">School Address</label>
                  <input value={address} onChange={(e) => setAddress(e.target.value)}
                    placeholder="County, District"
                    className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]" />
                </div>
                <div>
                  <label className="text-xs text-[var(--ll-text-muted)]">Principal Name</label>
                  <input value={principal} onChange={(e) => setPrincipal(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]" />
                </div>
                <div>
                  <label className="text-xs text-[var(--ll-text-muted)]">School Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="+231 XX XXX XXXX"
                    className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]" />
                </div>
                <div>
                  <label className="text-xs text-[var(--ll-text-muted)]">School Type</label>
                  <select value={schoolType} onChange={(e) => setSchoolType(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]">
                    <option value="">Select type...</option>
                    {SCHOOL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--ll-text-muted)]">Logo URL (optional)</label>
                  <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]" />
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">Grades Offered</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleGrade(g)}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${grades.includes(g) ? "border-[var(--ll-yellow)] bg-[var(--ll-yellow)]/10 text-[var(--ll-yellow)]" : "border-[var(--ll-border)] text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"}`}
                    >
                      G{g}
                    </button>
                  ))}
                </div>
              </div>
              <button
                onClick={handleStep1}
                disabled={saving || !name}
                className="w-full rounded-xl bg-[var(--ll-yellow)] px-6 py-3 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-50"
              >
                {saving ? "Saving..." : "Continue →"}
              </button>
            </div>
          )}

          {/* STEP 2 — Add Teachers */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-[var(--ll-text)]">Step 2: Add Teachers</h2>
              <p className="text-xs text-[var(--ll-text-muted)]">
                {data?.teacherCount ?? 0} teacher(s) added. At least 1 required to proceed.
              </p>

              <div className="rounded-xl border border-[var(--ll-border)] p-4 space-y-3">
                <h3 className="text-sm font-semibold text-[var(--ll-text)]">Add Teacher</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs text-[var(--ll-text-muted)]">Name *</label>
                    <input value={teacherName} onChange={(e) => setTeacherName(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-sm text-[var(--ll-text)]" />
                  </div>
                  <div>
                    <label className="text-xs text-[var(--ll-text-muted)]">Email (optional)</label>
                    <input value={teacherEmail} onChange={(e) => setTeacherEmail(e.target.value)}
                      type="email"
                      className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-sm text-[var(--ll-text)]" />
                  </div>
                </div>
                {teacherError && <p className="text-xs text-red-400">{teacherError}</p>}
                {importResult && <p className="text-xs text-[var(--ll-yellow)]">{importResult}</p>}
                <button
                  onClick={handleAddTeacher}
                  disabled={!teacherName || teacherSaving}
                  className="rounded-xl border border-[var(--ll-border)] px-4 py-2.5 text-sm font-medium text-[var(--ll-text)] hover:border-[var(--ll-border-strong)] disabled:opacity-50"
                >
                  {teacherSaving ? "Adding..." : "Add Teacher"}
                </button>
              </div>

              <div className="rounded-xl border border-[var(--ll-border)] p-4 space-y-3">
                <h3 className="text-sm font-semibold text-[var(--ll-text)]">Import from CSV</h3>
                <p className="text-xs text-[var(--ll-text-muted)]">Columns: <code>name, email, subject, grades</code>. Temp password: <code>School@2026!</code></p>
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--ll-border)] px-4 py-2.5 text-sm text-[var(--ll-text)] hover:border-[var(--ll-border-strong)]">
                    <Upload className="h-4 w-4" />
                    Choose CSV
                    <input ref={teacherCsvRef} type="file" accept=".csv" className="hidden" onChange={handleTeacherCsvImport} />
                  </label>
                  {csvImporting && <span className="text-xs text-[var(--ll-text-muted)]">Importing...</span>}
                </div>
              </div>

              <button
                onClick={handleStep2}
                disabled={saving || (data?.teacherCount ?? 0) < 1}
                className="w-full rounded-xl bg-[var(--ll-yellow)] px-6 py-3 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-50"
              >
                {saving ? "Saving..." : (data?.teacherCount ?? 0) < 1 ? "Add at least 1 teacher first" : "Continue →"}
              </button>
            </div>
          )}

          {/* STEP 3 — Import Students */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-[var(--ll-text)]">Step 3: Import Student Roster</h2>
              <p className="text-xs text-[var(--ll-text-muted)]">
                {data?.studentCount ?? 0} student(s) imported. At least 1 required to proceed.
              </p>
              <p className="text-xs text-[var(--ll-text-muted)]">Columns: <code>firstName, lastName, grade, guardianEmail, guardianPhone</code>. Student temp password: <code>Student@2026!</code></p>

              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-[var(--ll-border)] px-4 py-2.5 text-sm text-[var(--ll-text)] hover:border-[var(--ll-border-strong)]">
                  <Upload className="h-4 w-4" />
                  Choose CSV
                  <input ref={studentCsvRef} type="file" accept=".csv" className="hidden" onChange={handleStudentCsvPreview} />
                </label>
              </div>

              {csvPreview && csvPreview.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs text-[var(--ll-text-muted)]">Preview — first 5 of {csvTotal} rows:</p>
                  <div className="ll-scroll-table">
                    <table className="min-w-full text-xs">
                      <thead>
                        <tr className="border-b border-[var(--ll-border)] text-left text-[var(--ll-text-faint)]">
                          <th className="px-3 py-2">First Name</th>
                          <th className="px-3 py-2">Last Name</th>
                          <th className="px-3 py-2">Grade</th>
                          <th className="px-3 py-2">Guardian Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.map((row, i) => (
                          <tr key={i} className="border-b border-[var(--ll-border)]/60 text-[var(--ll-text-muted)]">
                            <td className="px-3 py-2">{row.firstName}</td>
                            <td className="px-3 py-2">{row.lastName}</td>
                            <td className="px-3 py-2">{row.grade}</td>
                            <td className="px-3 py-2">{row.guardianEmail || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <button
                    onClick={handleStudentCsvImport}
                    disabled={studentImporting}
                    className="rounded-xl bg-[var(--ll-yellow)] px-6 py-2.5 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-50"
                  >
                    {studentImporting ? `Importing ${csvTotal} students...` : `Confirm Import (${csvTotal} students)`}
                  </button>
                </div>
              )}

              <button
                onClick={handleStep3}
                disabled={saving || (data?.studentCount ?? 0) < 1}
                className="w-full rounded-xl bg-[var(--ll-yellow)] px-6 py-3 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-50"
              >
                {saving ? "Saving..." : (data?.studentCount ?? 0) < 1 ? "Import at least 1 student first" : "Continue →"}
              </button>
            </div>
          )}

          {/* STEP 4 — Timetable */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-[var(--ll-text)]">Step 4: Set Timetable</h2>
              <p className="text-xs text-[var(--ll-text-muted)]">
                Assign a primary subject per grade. A class will be created for each grade+subject pair.
              </p>

              <div className="space-y-2">
                {(grades.length > 0 ? grades : [7, 8, 9]).map((g) => (
                  <div key={g} className="flex items-center gap-3">
                    <span className="w-16 text-sm font-medium text-[var(--ll-text)]">Grade {g}</span>
                    <select
                      value={timetable[g] ?? ""}
                      onChange={(e) => setTimetable((prev) => ({ ...prev, [g]: e.target.value }))}
                      className="flex-1 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-2.5 text-sm text-[var(--ll-text)]"
                    >
                      <option value="">Select subject...</option>
                      {SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  const defaults: Record<number, string> = {};
                  (grades.length > 0 ? grades : [7, 8, 9]).forEach((g) => {
                    defaults[g] = g <= 6 ? "MATH" : g <= 9 ? "SCIENCE" : "ENGLISH";
                  });
                  setTimetable(defaults);
                }}
                className="rounded-xl border border-[var(--ll-border)] px-4 py-2 text-xs text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
              >
                Use default timetable
              </button>

              <div className="flex gap-3">
                <button
                  onClick={handleSaveTimetable}
                  disabled={timetableSaving || Object.keys(timetable).length === 0}
                  className="rounded-xl border border-[var(--ll-border)] px-4 py-2.5 text-sm font-medium text-[var(--ll-text)] hover:border-[var(--ll-border-strong)] disabled:opacity-50"
                >
                  {timetableSaving ? "Saving..." : "Save Timetable"}
                </button>
                <button
                  onClick={handleStep4}
                  disabled={saving}
                  className="flex-1 rounded-xl bg-[var(--ll-yellow)] px-6 py-3 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Continue →"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5 — Verify + Go Live */}
          {step === 5 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-[var(--ll-text)]">Step 5: Verify &amp; Go Live</h2>

              <div className="space-y-3 rounded-xl border border-[var(--ll-border)] p-4">
                {[
                  { label: "School profile saved", done: !!data?.school?.name },
                  { label: `${data?.teacherCount ?? 0} teacher(s) added`, done: (data?.teacherCount ?? 0) >= 1 },
                  { label: `${data?.studentCount ?? 0} student(s) enrolled`, done: (data?.studentCount ?? 0) >= 1 },
                  { label: `${data?.classCount ?? 0} class(es) configured`, done: (data?.classCount ?? 0) >= 1 },
                  { label: "First lesson delivery verified", done: false },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {item.done
                      ? <CheckCircle2 className="h-5 w-5 text-[var(--ll-yellow)] shrink-0" />
                      : <Circle className="h-5 w-5 text-[var(--ll-text-faint)] shrink-0" />}
                    <span className={`text-sm ${item.done ? "text-[var(--ll-text)]" : "text-[var(--ll-text-muted)]"}`}>{item.label}</span>
                  </div>
                ))}
              </div>

              <a
                href="/student/today"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--ll-border)] px-6 py-3 text-sm font-medium text-[var(--ll-text)] hover:border-[var(--ll-border-strong)]"
              >
                Preview Student Experience ↗
              </a>

              <button
                onClick={handleComplete}
                disabled={saving}
                className="w-full rounded-xl bg-[var(--ll-yellow)] px-6 py-3 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-50"
              >
                {saving ? "Completing..." : "Mark Setup Complete"}
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
