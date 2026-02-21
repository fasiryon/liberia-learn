"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Branding = {
  primaryHex: string;
  secondaryHex: string;
  accentHex: string;
  logoUrl: string;
  motto: string;
  welcomeMsg: string;
};

export default function SchoolBrandingPage() {
  const router = useRouter();
  const [branding, setBranding] = useState<Branding>({
    primaryHex: "#10b981",
    secondaryHex: "#8b5cf6",
    accentHex: "#10b981",
    logoUrl: "",
    motto: "",
    welcomeMsg: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/school-branding")
      .then((res) => {
        if (res.status === 401 || res.status === 403) { router.push("/login"); return null; }
        return res.json();
      })
      .then((data) => {
        if (data) {
          setBranding({
            primaryHex: data.primaryHex || "#10b981",
            secondaryHex: data.secondaryHex || "#8b5cf6",
            accentHex: data.accentHex || "#10b981",
            logoUrl: data.logoUrl || "",
            motto: data.motto || "",
            welcomeMsg: data.welcomeMsg || "",
          });
        }
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/school-branding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branding),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Save failed");
      }
      setMessage("Branding saved successfully.");
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
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#ec489922,_transparent_60%)]" />
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-8">
        <div>
          <Link href="/admin" className="text-xs text-emerald-300 hover:text-emerald-200">
            &larr; Back to Admin Console
          </Link>
          <h1 className="text-2xl font-bold mt-2">School Branding</h1>
          <p className="text-sm text-slate-400 mt-1">
            Customize your school's colors, logo, and messaging.
          </p>
        </div>

        <form onSubmit={handleSave} className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 space-y-6">
          <div className="grid gap-5 sm:grid-cols-3">
            {[
              { label: "Primary Color", key: "primaryHex" as const },
              { label: "Secondary Color", key: "secondaryHex" as const },
              { label: "Accent Color", key: "accentHex" as const },
            ].map(({ label, key }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-slate-400 mb-1">{label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={branding[key]}
                    onChange={(e) => setBranding({ ...branding, [key]: e.target.value })}
                    className="h-10 w-10 rounded-lg border border-slate-700 cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={branding[key]}
                    onChange={(e) => setBranding({ ...branding, [key]: e.target.value })}
                    className="flex-1 rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Logo URL</label>
            <input
              type="url"
              value={branding.logoUrl}
              onChange={(e) => setBranding({ ...branding, logoUrl: e.target.value })}
              placeholder="https://example.com/logo.png"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">School Motto</label>
            <input
              type="text"
              value={branding.motto}
              onChange={(e) => setBranding({ ...branding, motto: e.target.value })}
              placeholder="Excellence in Education"
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1">Welcome Message</label>
            <textarea
              value={branding.welcomeMsg}
              onChange={(e) => setBranding({ ...branding, welcomeMsg: e.target.value })}
              rows={3}
              placeholder="Welcome to our school..."
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          {/* Live preview */}
          <div>
            <p className="text-xs font-medium text-slate-400 mb-2">Preview</p>
            <div
              className="rounded-xl border border-white/10 p-4 flex items-center gap-3"
              style={{ background: branding.primaryHex + "22" }}
            >
              {branding.logoUrl ? (
                <img
                  src={branding.logoUrl}
                  alt="Logo"
                  className="h-10 w-10 rounded-lg object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
              ) : (
                <div
                  className="h-10 w-10 rounded-lg flex items-center justify-center text-white font-bold text-sm"
                  style={{ background: branding.primaryHex }}
                >
                  S
                </div>
              )}
              <div>
                <p className="text-sm font-semibold" style={{ color: branding.primaryHex }}>
                  Your School Name
                </p>
                {branding.motto && (
                  <p className="text-xs text-slate-400 italic">{branding.motto}</p>
                )}
              </div>
              <div className="ml-auto flex gap-2">
                <span
                  className="h-5 w-5 rounded-full border border-white/20"
                  style={{ background: branding.primaryHex }}
                  title="Primary"
                />
                <span
                  className="h-5 w-5 rounded-full border border-white/20"
                  style={{ background: branding.secondaryHex }}
                  title="Secondary"
                />
                <span
                  className="h-5 w-5 rounded-full border border-white/20"
                  style={{ background: branding.accentHex }}
                  title="Accent"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-emerald-500 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Branding"}
          </button>

          {message && (
            <p className={`text-sm ${message.includes("success") ? "text-emerald-400" : "text-red-400"}`}>
              {message}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}

