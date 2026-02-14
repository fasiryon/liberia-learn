"use client";

import { useState } from "react";

export default function OnboardPage() {
  const [schoolName, setSchoolName] = useState("Barnesville Academy");
  const [timezone, setTimezone] = useState("Africa/Monrovia");
  const [adminName, setAdminName] = useState("Farquema Siryon");
  const [adminEmail, setAdminEmail] = useState("admin+barnesville@test.com");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  async function submit() {
    setStatus(null);
    const res = await fetch("/api/onboard/school", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ schoolName, timezone, adminName, adminEmail, password }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(data?.error ? `Error: ${data.error}` : "Error: Failed");
      return;
    }
    setStatus(`✅ Created school "${data.schoolName}". Now sign in as admin.`);
  }

  return (
    <main className="min-h-screen bg-[#05060a] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6 shadow">
        <h1 className="text-2xl font-semibold">Create School & Admin</h1>
        <p className="text-white/70 mt-1">This registers a new school and the first ADMIN user.</p>

        <div className="mt-6 grid gap-3">
          <Field label="School name" value={schoolName} onChange={setSchoolName} />
          <Field label="Timezone" value={timezone} onChange={setTimezone} />
          <Field label="Admin name" value={adminName} onChange={setAdminName} />
          <Field label="Admin email" value={adminEmail} onChange={setAdminEmail} />
          <Field label="Password" value={password} onChange={setPassword} type="password" />

          <button
            onClick={submit}
            className="mt-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold px-4 py-3"
          >
            Create School & Admin
          </button>

          {status && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm whitespace-pre-wrap">
              {status}
            </div>
          )}

          <div className="text-xs text-white/60">
            After creating: go to <code className="text-white/80">/login</code> and sign in with the admin email + password.
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-sm text-white/80">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-xl bg-[#0b0d14] border border-white/10 px-3 py-2 outline-none focus:border-emerald-500"
      />
    </label>
  );
}