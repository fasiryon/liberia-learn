"use client";

import { useState } from "react";

const LANGUAGES = [
  { code: "en", label: "English", flag: "🇺🇸" },
  { code: "kpe", label: "Kpelle", flag: "🇱🇷" },
  { code: "bss", label: "Bassa", flag: "🇱🇷" },
];

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const [saving, setSaving] = useState(false);
  const current = typeof document !== "undefined"
    ? document.cookie.match(/NEXT_LOCALE=([^;]+)/)?.[1] ?? "en"
    : "en";

  async function handleChange(code: string) {
    setSaving(true);
    try {
      document.cookie = `NEXT_LOCALE=${code}; path=/; max-age=${60 * 60 * 24 * 365}`;
      await fetch("/api/user/language-preference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: code }),
      });
      window.location.reload();
    } catch {
      setSaving(false);
    }
  }

  if (compact) {
    return (
      <select
        value={current}
        onChange={(e) => handleChange(e.target.value)}
        disabled={saving}
        aria-label="Language"
        className="rounded-lg border border-[var(--ll-border)] bg-[var(--ll-bg)] px-2 py-1 text-xs text-[var(--ll-text-muted)] disabled:opacity-40"
      >
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          onClick={() => handleChange(l.code)}
          disabled={saving}
          title={l.label}
          className={`rounded-lg px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
            current === l.code
              ? "bg-[var(--ll-yellow)] text-[var(--ll-text)] font-semibold"
              : "text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
          }`}
        >
          {l.flag} {l.label}
        </button>
      ))}
    </div>
  );
}
