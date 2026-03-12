"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { sanitizePin } from "@/lib/login-identifiers";

type RegisterFormProps = {
  token: string;
  defaultName: string;
  phone: string;
};

const FIELD = "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-950 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200";

export default function RegisterForm({ token, defaultName, phone }: RegisterFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(defaultName);
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/guardian/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fullName, pin, confirmPin }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "We could not create your account. Please try again.");
        return;
      }
      router.push(data.redirectTo ?? "/login?message=Account%20created.%20Log%20in%20with%20your%20phone%20and%20PIN.");
    } catch {
      setError("We could not create your account. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">Full Name</label>
        <input className={FIELD} value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">Phone Number</label>
        <input className={`${FIELD} bg-slate-100`} value={phone} readOnly aria-readonly="true" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">Create PIN</label>
        <input
          className={`${FIELD} text-lg tracking-[0.2em]`}
          value={pin}
          onChange={(e) => setPin(sanitizePin(e.target.value))}
          inputMode="numeric"
          pattern="\\d{4,6}"
          placeholder="4 to 6 digits"
          required
          type="password"
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-semibold text-slate-700">Confirm PIN</label>
        <input
          className={`${FIELD} text-lg tracking-[0.2em]`}
          value={confirmPin}
          onChange={(e) => setConfirmPin(sanitizePin(e.target.value))}
          inputMode="numeric"
          pattern="\\d{4,6}"
          placeholder="Type the same PIN again"
          required
          type="password"
        />
      </div>
      {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={saving} className="min-h-11 w-full rounded-xl bg-emerald-600 px-4 py-3 text-lg font-semibold text-white hover:bg-emerald-500 disabled:opacity-60">
        {saving ? "Creating account..." : "Create My Account"}
      </button>
    </form>
  );
}

