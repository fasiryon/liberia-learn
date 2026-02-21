"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Settings = {
  approvalRequired: boolean;
  allowTeacherPublish: boolean;
  allowBlueprintAdoption: boolean;
};

const TOGGLES: Array<{ key: keyof Settings; label: string; help: string }> = [
  {
    key: "approvalRequired",
    label: "Require Admin Approval",
    help: "Teacher-generated content must be approved by an admin before publishing to students.",
  },
  {
    key: "allowTeacherPublish",
    label: "Allow Teacher Direct Publish",
    help: "Teachers can publish curriculum content without admin approval. Only applies when approval is not required.",
  },
  {
    key: "allowBlueprintAdoption",
    label: "Allow Blueprint Adoption",
    help: "Teachers can adopt pre-built national curriculum blueprints for their classes.",
  },
];

export default function SchoolSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<Settings>({
    approvalRequired: true,
    allowTeacherPublish: false,
    allowBlueprintAdoption: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/school-settings")
      .then((res) => {
        if (res.status === 401 || res.status === 403) { router.push("/login"); return null; }
        return res.json();
      })
      .then((data) => {
        if (data && !data.error) setSettings(data);
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/school-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      setMessage("Settings saved successfully.");
    } catch (err: any) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#3b82f622,_transparent_60%)]" />
      <div className="mx-auto max-w-2xl px-4 py-6 space-y-8">
        <div>
          <Link href="/admin" className="text-xs text-emerald-300 hover:text-emerald-200">
            &larr; Back to Admin Console
          </Link>
          <h1 className="text-2xl font-bold mt-2">School Settings</h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure curriculum policies for your school.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 space-y-6">
          {TOGGLES.map(({ key, label, help }) => (
            <div key={key} className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-100">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{help}</p>
              </div>
              <button
                type="button"
                onClick={() => setSettings({ ...settings, [key]: !settings[key] })}
                className={`relative h-7 w-12 rounded-full transition-colors shrink-0 ${
                  settings[key]
                    ? "bg-emerald-500"
                    : "bg-slate-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
                    settings[key] ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))}

          <div className="pt-4 border-t border-slate-800 flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
            {message && (
              <p className={`text-sm ${message.includes("success") ? "text-emerald-400" : "text-red-400"}`}>
                {message}
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

