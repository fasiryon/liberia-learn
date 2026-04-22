"use client";

import { useEffect, useState } from "react";
import { CredentialDeliveryActions } from "@/components/CredentialDeliveryActions";

const COUNTIES = [
  "Bomi", "Bong", "Gbarpolu", "Grand Bassa", "Grand Cape Mount", "Grand Gedeh",
  "Grand Kru", "Lofa", "Margibi", "Maryland", "Montserrado", "Nimba",
  "River Cess", "River Gee", "Sinoe",
];

type TeacherCredential = {
  userId: string;
  loginId: string;
  tempPin: string;
  phone: string | null;
};

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [teacherSaving, setTeacherSaving] = useState(false);
  const [school, setSchool] = useState<any>(null);
  const [teacherCount, setTeacherCount] = useState(0);
  const [classCount, setClassCount] = useState(0);

  const [name, setName] = useState("");
  const [county, setCounty] = useState("");
  const [motto, setMotto] = useState("");
  const [principal, setPrincipal] = useState("");

  const [primaryHex, setPrimaryHex] = useState("#10b981");
  const [logoUrl, setLogoUrl] = useState("");

  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherPhone, setTeacherPhone] = useState("");
  const [teacherLoginId, setTeacherLoginId] = useState("");
  const [teacherAdded, setTeacherAdded] = useState(false);
  const [teacherError, setTeacherError] = useState<string | null>(null);
  const [teacherCredential, setTeacherCredential] = useState<TeacherCredential | null>(null);

  const [className, setClassName] = useState("");
  const [gradeLevel, setGradeLevel] = useState("7");
  const [classCreated, setClassCreated] = useState(false);

  useEffect(() => {
    fetch("/api/admin/onboarding")
      .then((r) => r.json())
      .then((d) => {
        if (d.school) {
          setSchool(d.school);
          setName(d.school.name || "");
          setCounty(d.school.county || "");
          setMotto(d.school.motto || "");
          setPrincipal(d.school.contactName || "");
          setPrimaryHex(d.school.primaryHex || "#10b981");
          setLogoUrl(d.school.logoUrl || "");
          setTeacherCount(d.teacherCount || 0);
          setClassCount(d.classCount || 0);
          if (d.school.onboardingStep > 0 && d.school.onboardingStep < 5) {
            setStep(d.school.onboardingStep + 1);
          } else if (d.school.onboardingStep >= 5) {
            setStep(5);
          }
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function saveStep(stepNum: number, data: any) {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ step: stepNum, data }),
      });
      if (!res.ok) throw new Error("Save failed");
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleStep1() {
    const ok = await saveStep(1, { name, county, motto, contactName: principal });
    if (ok) setStep(2);
  }

  async function handleStep2() {
    const ok = await saveStep(2, { primaryHex, logoUrl });
    if (ok) setStep(3);
  }

  async function handleAddTeacher() {
    if (!teacherName) return;
    setTeacherSaving(true);
    setTeacherError(null);
    setTeacherCredential(null);
    try {
      const res = await fetch("/api/admin/teachers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: teacherName,
          email: teacherEmail || undefined,
          phone: teacherPhone || undefined,
          loginId: teacherLoginId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setTeacherError(data.error ?? "Could not add teacher.");
        return;
      }
      setTeacherAdded(true);
      setTeacherCount((c) => c + 1);
      setTeacherCredential({
        userId: data.userId,
        loginId: data.loginId,
        tempPin: data.tempPin,
        phone: data.phone ?? null,
      });
      setTeacherName("");
      setTeacherEmail("");
      setTeacherPhone("");
      setTeacherLoginId("");
    } catch {
      setTeacherError("Could not add teacher.");
    } finally {
      setTeacherSaving(false);
    }
  }

  async function handleStep3() {
    const ok = await saveStep(3, {});
    if (ok) setStep(4);
  }

  async function handleCreateClass() {
    if (!className) return;
    try {
      await fetch("/api/admin/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: className, grade: parseInt(gradeLevel), subject: "MATH" }),
      });
      setClassCreated(true);
      setClassCount((c) => c + 1);
    } catch {}
  }

  async function handleStep4() {
    const ok = await saveStep(4, {});
    if (ok) setStep(5);
  }

  async function handleFinish() {
    await saveStep(5, {});
    window.location.href = "/admin";
  }

  if (loading) return <div className="p-8"><div className="h-40 animate-pulse rounded-xl bg-[var(--ll-surface)]/50" /></div>;

  const STEPS = ["School Identity", "Branding", "Add Teacher", "Create Class", "Ready!"];

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">School Setup</h1>
        <p className="mt-1 text-sm text-[var(--ll-text-muted)]">Get your school ready in 5 easy steps</p>
      </div>

      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div key={i} className="flex-1">
            <div className={`h-1.5 rounded-full ${i + 1 <= step ? "bg-[var(--ll-yellow)]" : "bg-[var(--ll-surface)]"}`} />
            <p className={`mt-1 text-[10px] ${i + 1 === step ? "text-[var(--ll-yellow)]" : "text-[var(--ll-text-faint)]"}`}>{s}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/70 p-6">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Step 1: School Identity</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">School Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">County</label>
                <select value={county} onChange={(e) => setCounty(e.target.value)} className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]">
                  <option value="">Select county...</option>
                  {COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">School Motto</label>
                <input value={motto} onChange={(e) => setMotto(e.target.value)} className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">Principal Name</label>
                <input value={principal} onChange={(e) => setPrincipal(e.target.value)} className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]" />
              </div>
            </div>
            <button onClick={handleStep1} disabled={saving || !name} className="w-full rounded-xl bg-[var(--ll-yellow)] px-6 py-3 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-50">
              {saving ? "Saving..." : "Continue"}
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Step 2: School Branding</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">Primary Color</label>
                <div className="mt-1 flex items-center gap-3">
                  <input type="color" value={primaryHex} onChange={(e) => setPrimaryHex(e.target.value)} className="h-10 w-10 cursor-pointer rounded" />
                  <span className="text-sm text-[var(--ll-text)]">{primaryHex}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">Logo URL (optional)</label>
                <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]" />
              </div>
              <div className="rounded-xl border border-[var(--ll-border)] p-4" style={{ borderColor: `${primaryHex}40` }}>
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-[var(--ll-text)]" style={{ backgroundColor: primaryHex }}>
                    {name?.[0] || "S"}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: primaryHex }}>{name || "Your School"}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { saveStep(2, {}); setStep(3); }} className="flex-1 rounded-xl border border-[var(--ll-border)] px-6 py-3 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">Skip</button>
              <button onClick={handleStep2} disabled={saving} className="flex-1 rounded-xl bg-[var(--ll-yellow)] px-6 py-3 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-50">
                {saving ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Step 3: Add Your First Teacher</h2>
            <p className="text-xs text-[var(--ll-text-muted)]">{teacherCount} teacher(s) already added</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">Teacher Name</label>
                <input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">Teacher ID (optional)</label>
                <input value={teacherLoginId} onChange={(e) => setTeacherLoginId(e.target.value)} placeholder="TCH-2026-001" className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">Phone Number (optional)</label>
                <input value={teacherPhone} onChange={(e) => setTeacherPhone(e.target.value)} placeholder="+231 XX XXX XXXX" className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">Email (optional)</label>
                <input value={teacherEmail} onChange={(e) => setTeacherEmail(e.target.value)} type="email" className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]" />
              </div>
              {teacherAdded && <p className="text-xs text-[var(--ll-yellow)]">Teacher added successfully.</p>}
              {teacherError && <p className="text-xs text-red-400">{teacherError}</p>}
              <button onClick={handleAddTeacher} disabled={!teacherName || teacherSaving} className="rounded-xl border border-emerald-500/30 bg-[var(--ll-yellow)]/10 px-4 py-3 text-sm text-[var(--ll-yellow)] hover:bg-[var(--ll-yellow)]/20 disabled:opacity-50">
                {teacherSaving ? "Adding Teacher..." : "Add Teacher"}
              </button>
            </div>
            {teacherCredential && (
              <div className="rounded-xl border border-emerald-500/30 bg-[var(--ll-yellow)]/10 p-4">
                <h3 className="text-lg font-semibold text-[var(--ll-yellow)]">Teacher added successfully</h3>
                <p className="mt-2 text-sm text-[var(--ll-text)]">Teacher ID: <span className="font-semibold text-[var(--ll-text)]">{teacherCredential.loginId}</span></p>
                <p className="mt-1 text-sm text-[var(--ll-text)]">Temporary PIN: <span className="font-semibold text-[var(--ll-text)]">{teacherCredential.tempPin}</span></p>
                <div className="mt-4">
                  <CredentialDeliveryActions userId={teacherCredential.userId} pin={teacherCredential.tempPin} phone={teacherCredential.phone} />
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { saveStep(3, {}); setStep(4); }} className="flex-1 rounded-xl border border-[var(--ll-border)] px-6 py-3 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">Skip</button>
              <button onClick={handleStep3} disabled={saving} className="flex-1 rounded-xl bg-[var(--ll-yellow)] px-6 py-3 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-50">Continue</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Step 4: Create Your First Class</h2>
            <p className="text-xs text-[var(--ll-text-muted)]">{classCount} class(es) already created</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">Class Name</label>
                <input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. Grade 7A" className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]" />
              </div>
              <div>
                <label className="text-xs text-[var(--ll-text-muted)]">Grade Level</label>
                <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="mt-1 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-4 py-3 text-sm text-[var(--ll-text)]">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </div>
              {classCreated && <p className="text-xs text-[var(--ll-yellow)]">Class created!</p>}
              <button onClick={handleCreateClass} disabled={!className} className="rounded-xl border border-emerald-500/30 bg-[var(--ll-yellow)]/10 px-4 py-3 text-sm text-[var(--ll-yellow)] hover:bg-[var(--ll-yellow)]/20 disabled:opacity-50">
                Create Class
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { saveStep(4, {}); setStep(5); }} className="flex-1 rounded-xl border border-[var(--ll-border)] px-6 py-3 text-sm text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]">Skip</button>
              <button onClick={handleStep4} disabled={saving} className="flex-1 rounded-xl bg-[var(--ll-yellow)] px-6 py-3 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-yellow-soft)] disabled:opacity-50">Continue</button>
            </div>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-4 text-center">
            <div className="text-4xl">Graduation</div>
            <h2 className="text-lg font-semibold">You&apos;re Ready!</h2>
            <p className="text-sm text-[var(--ll-text-muted)]">Your school is set up and ready for the pilot.</p>
            <div className="space-y-2 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/50 p-4 text-left">
              <p className="text-sm text-[var(--ll-text)]"><span className="text-[var(--ll-yellow)]">School:</span> {name}</p>
              <p className="text-sm text-[var(--ll-text)]"><span className="text-[var(--ll-yellow)]">County:</span> {county || "Not set"}</p>
              <p className="text-sm text-[var(--ll-text)]"><span className="text-[var(--ll-yellow)]">Teachers:</span> {teacherCount}</p>
              <p className="text-sm text-[var(--ll-text)]"><span className="text-[var(--ll-yellow)]">Classes:</span> {classCount}</p>
            </div>
            <button onClick={handleFinish} className="w-full rounded-xl bg-[var(--ll-yellow)] px-6 py-3 text-sm font-semibold text-[var(--ll-text)] hover:bg-[var(--ll-yellow-soft)]">
              Go to Admin Console
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


