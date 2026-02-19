"use client";

import { useEffect, useState } from "react";

const COUNTIES = [
  "Bomi", "Bong", "Gbarpolu", "Grand Bassa", "Grand Cape Mount", "Grand Gedeh",
  "Grand Kru", "Lofa", "Margibi", "Maryland", "Montserrado", "Nimba",
  "River Cess", "River Gee", "Sinoe",
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [school, setSchool] = useState<any>(null);
  const [teacherCount, setTeacherCount] = useState(0);
  const [classCount, setClassCount] = useState(0);

  // Step 1 fields
  const [name, setName] = useState("");
  const [county, setCounty] = useState("");
  const [district, setDistrict] = useState("");
  const [motto, setMotto] = useState("");
  const [principal, setPrincipal] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [step1Error, setStep1Error] = useState<string | null>(null);

  // Step 2 fields
  const [primaryHex, setPrimaryHex] = useState("#10b981");
  const [logoUrl, setLogoUrl] = useState("");

  // Step 3 fields
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");
  const [teacherAdded, setTeacherAdded] = useState(false);

  // Step 4 fields
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
          setDistrict(d.school.district || "");
          setMotto(d.school.motto || "");
          setPrincipal(d.school.contactName || "");
          setContactEmail(d.school.contactEmail || "");
          setContactPhone(d.school.contactPhone || "");
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
    setStep1Error(null);
    if (!name.trim()) { setStep1Error("School name is required"); return; }
    if (!county.trim()) { setStep1Error("County is required"); return; }
    if (!district.trim()) { setStep1Error("District is required"); return; }
    if (!contactEmail.trim()) { setStep1Error("Contact email is required"); return; }
    if (!/^\S+@\S+\.\S+$/.test(contactEmail.trim())) { setStep1Error("Contact email is invalid"); return; }
    if (!contactPhone.trim()) { setStep1Error("Contact phone is required"); return; }
    const ok = await saveStep(1, { name, county, district, motto, contactName: principal, contactEmail, contactPhone });
    if (ok) setStep(2);
  }
  async function handleStep2() {
    const ok = await saveStep(2, { primaryHex, logoUrl });
    if (ok) setStep(3);
  }
  async function handleAddTeacher() {
    if (!teacherName || !teacherEmail) return;
    try {
      await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: teacherEmail, name: teacherName, role: "TEACHER" }),
      });
      setTeacherAdded(true);
      setTeacherCount((c) => c + 1);
    } catch {}
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

  if (loading) return <div className="p-8"><div className="h-40 rounded-2xl bg-slate-800/50 animate-pulse" /></div>;

  const STEPS = ["School Identity", "Branding", "Add Teacher", "Create Class", "Ready!"];

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">School Setup</h1>
        <p className="text-sm text-slate-400 mt-1">Get your school ready in 5 easy steps</p>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1">
        {STEPS.map((s, i) => (
          <div key={i} className="flex-1">
            <div className={`h-1.5 rounded-full ${i + 1 <= step ? "bg-emerald-500" : "bg-slate-800"}`} />
            <p className={`text-[10px] mt-1 ${i + 1 === step ? "text-emerald-400" : "text-slate-500"}`}>{s}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Step 1: School Identity</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">School Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400">County</label>
                <select value={county} onChange={(e) => setCounty(e.target.value)} className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100">
                  <option value="">Select county...</option>
                  {COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">District</label>
                <input value={district} onChange={(e) => setDistrict(e.target.value)} className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400">School Motto</label>
                <input value={motto} onChange={(e) => setMotto(e.target.value)} className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Principal Name</label>
                <input value={principal} onChange={(e) => setPrincipal(e.target.value)} className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Contact Email</label>
                <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} type="email" className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Contact Phone</label>
                <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100" />
              </div>
            </div>
            {step1Error && <p className="text-xs text-red-400">{step1Error}</p>}
            <button onClick={handleStep1} disabled={saving || !name} className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50">
              {saving ? "Saving..." : "Continue"}
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Step 2: School Branding</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Primary Color</label>
                <div className="flex items-center gap-3 mt-1">
                  <input type="color" value={primaryHex} onChange={(e) => setPrimaryHex(e.target.value)} className="h-10 w-10 rounded cursor-pointer" />
                  <span className="text-sm text-slate-300">{primaryHex}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400">Logo URL (optional)</label>
                <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100" />
              </div>
              {/* Preview */}
              <div className="rounded-xl border border-slate-800 p-4" style={{ borderColor: primaryHex + "40" }}>
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: primaryHex }}>
                    {name?.[0] || "S"}
                  </div>
                  <span className="text-sm font-semibold" style={{ color: primaryHex }}>{name || "Your School"}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { saveStep(2, {}); setStep(3); }} className="flex-1 rounded-xl border border-slate-700 px-6 py-3 text-sm text-slate-400 hover:text-slate-200">Skip</button>
              <button onClick={handleStep2} disabled={saving} className="flex-1 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50">
                {saving ? "Saving..." : "Continue"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Step 3: Add Your First Teacher</h2>
            <p className="text-xs text-slate-400">{teacherCount} teacher(s) already added</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Teacher Name</label>
                <input value={teacherName} onChange={(e) => setTeacherName(e.target.value)} className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Teacher Email</label>
                <input value={teacherEmail} onChange={(e) => setTeacherEmail(e.target.value)} type="email" className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100" />
              </div>
              {teacherAdded && <p className="text-xs text-emerald-400">Teacher invited!</p>}
              <button onClick={handleAddTeacher} disabled={!teacherName || !teacherEmail} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50">
                Add Teacher
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { saveStep(3, {}); setStep(4); }} className="flex-1 rounded-xl border border-slate-700 px-6 py-3 text-sm text-slate-400 hover:text-slate-200">Skip</button>
              <button onClick={handleStep3} disabled={saving} className="flex-1 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50">Continue</button>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Step 4: Create Your First Class</h2>
            <p className="text-xs text-slate-400">{classCount} class(es) already created</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Class Name</label>
                <input value={className} onChange={(e) => setClassName(e.target.value)} placeholder="e.g. Grade 7A" className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Grade Level</label>
                <select value={gradeLevel} onChange={(e) => setGradeLevel(e.target.value)} className="w-full mt-1 rounded-xl border border-slate-700 bg-slate-950 px-4 py-2.5 text-sm text-slate-100">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </div>
              {classCreated && <p className="text-xs text-emerald-400">Class created!</p>}
              <button onClick={handleCreateClass} disabled={!className} className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50">
                Create Class
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { saveStep(4, {}); setStep(5); }} className="flex-1 rounded-xl border border-slate-700 px-6 py-3 text-sm text-slate-400 hover:text-slate-200">Skip</button>
              <button onClick={handleStep4} disabled={saving} className="flex-1 rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400 disabled:opacity-50">Continue</button>
            </div>
          </div>
        )}

        {/* Step 5 */}
        {step === 5 && (
          <div className="space-y-4 text-center">
            <div className="text-4xl">&#127891;</div>
            <h2 className="text-lg font-semibold">You&apos;re Ready!</h2>
            <p className="text-sm text-slate-400">Your school is set up and ready for the pilot.</p>
            <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-left space-y-2">
              <p className="text-sm text-slate-300"><span className="text-emerald-400">School:</span> {name}</p>
              <p className="text-sm text-slate-300"><span className="text-emerald-400">County:</span> {county || "Not set"}</p>
              <p className="text-sm text-slate-300"><span className="text-emerald-400">Teachers:</span> {teacherCount}</p>
              <p className="text-sm text-slate-300"><span className="text-emerald-400">Classes:</span> {classCount}</p>
            </div>
            <button onClick={handleFinish} className="w-full rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-400">
              Go to Admin Console
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
