$ErrorActionPreference="Stop"

Write-Host "RUNNING fix-tutorchat.ps1..." -ForegroundColor Cyan

# 1) Show TutorChat-related files
Write-Host "`nTutorChat files found:" -ForegroundColor Cyan
Get-ChildItem -Recurse -File -Path . -Include "*TutorChat*.ts","*TutorChat*.tsx" |
  Where-Object { $_.FullName -notmatch "\\node_modules\\|\\\.next\\" } |
  Select-Object FullName | Format-Table -AutoSize

# 2) DELETE the wrong-cased duplicate if it exists
$canon = ".\components\AiTutorChat.tsx"
$wrong = ".\components\AITutorChat.tsx"

if(Test-Path -LiteralPath $wrong){
  Write-Host "Found duplicate with wrong casing: $wrong" -ForegroundColor Yellow
  if(Test-Path -LiteralPath $canon){
    Write-Host "Canonical already exists. Deleting wrong-cased duplicate." -ForegroundColor Yellow
    Remove-Item -LiteralPath $wrong -Force
  } else {
    # rename via temp to force casing on Windows
    $tmp = ".\components\__TMP_TutorChat__.tsx"
    Write-Host "Renaming $wrong -> $tmp -> $canon" -ForegroundColor Yellow
    Rename-Item -LiteralPath $wrong -NewName (Split-Path -Leaf $tmp) -Force
    Rename-Item -LiteralPath $tmp -NewName (Split-Path -Leaf $canon) -Force
  }
}

# 3) Ensure canonical component exists (and make it safe)
$dir = Split-Path -Parent $canon
if(!(Test-Path -LiteralPath $dir)){ New-Item -ItemType Directory -Force -Path $dir | Out-Null }

$component = @"
"use client";

import { useMemo, useState } from "react";

export type Msg = { role: "user" | "assistant"; content: string };

export default function AiTutorChat() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm your LiberiaLearn tutor. Ask me anything." },
  ]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"Ready" | "Thinking">("Ready");
  const canSend = useMemo(() => input.trim().length > 0 && status === "Ready", [input, status]);

  async function runAnalysis() {
    const text = input.trim();
    if (!text) return;

    setStatus("Thinking");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setInput("");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: `⚠️ Error: ${data?.error ?? "Request failed"}` },
        ]);
        return;
      }

      setMessages((m) => [...m, { role: "assistant", content: data?.message ?? "No response" }]);
    } finally {
      setStatus("Ready");
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">AI Tutor</h1>
        <span
          className={`text-xs px-3 py-1 rounded-full border ${
            status === "Thinking"
              ? "border-amber-700 bg-amber-950/30 text-amber-200"
              : "border-emerald-700 bg-emerald-950/30 text-emerald-200"
          }`}
        >
          {status}
        </span>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/30 h-[520px] overflow-y-auto p-4 space-y-3">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
              m.role === "user"
                ? "ml-auto bg-emerald-500 text-slate-950"
                : "bg-slate-950/60 border border-slate-800 text-slate-100"
            }`}
          >
            {m.content}
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          className="flex-1 rounded-xl bg-slate-950/60 border border-slate-800 px-3 py-3"
          placeholder="Ask a question (example: Explain fractions like I'm in Grade 4)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runAnalysis();
          }}
        />
        <button
          disabled={!canSend}
          onClick={runAnalysis}
          className="rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 px-4 py-3 font-semibold text-slate-950"
        >
          Run Analysis
        </button>
      </div>
    </div>
  );
}

# Named export alias so BOTH styles work:
# import AiTutorChat from "@/components/AiTutorChat"
# import { AITutorChat } from "@/components/AiTutorChat"
export function AITutorChat() {
  return <AiTutorChat />;
}
"@

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText((Resolve-Path -LiteralPath $dir).Path + "\" + (Split-Path -Leaf $canon), $component, $utf8NoBom)
Write-Host "✅ Wrote canonical component: $canon" -ForegroundColor Green

# 4) Fix imports everywhere
Write-Host "`nFixing import casing across codebase..." -ForegroundColor Cyan
$files = Get-ChildItem -Recurse -File -Path . -Include "*.ts","*.tsx" |
  Where-Object { $_.FullName -notmatch "\\node_modules\\|\\\.next\\" }

foreach($f in $files){
  $p = $f.FullName
  $c = Get-Content -LiteralPath $p -Raw
  $orig = $c

  $c = $c -replace "@/components/AITutorChat", "@/components/AiTutorChat"

  if($c -ne $orig){
    [System.IO.File]::WriteAllText($p, $c, $utf8NoBom)
    Write-Host "✅ Patched: $p" -ForegroundColor DarkGreen
  }
}

# 5) Clear Next cache
if(Test-Path -LiteralPath ".\.next"){
  Remove-Item -Recurse -Force ".\.next"
  Write-Host "🧹 Deleted .next cache" -ForegroundColor Green
}

Write-Host "`n✅ DONE. Restart:" -ForegroundColor Green
Write-Host "taskkill /IM node.exe /F" -ForegroundColor Gray
Write-Host "npm run dev" -ForegroundColor Gray
