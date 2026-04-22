"use client";

import { useState } from "react";
import Link from "next/link";

type ImportRow = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  grade: number;
  dateOfBirth: string;
  guardianPhone?: string | null;
};

type BatchResult = {
  id: string;
  status: string;
  successCount: number;
  errorCount: number;
  resultSummary?: { errors?: Array<{ rowNumber: number; message: string }> };
};

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0]?.split(",").map((item) => item.trim());
  const expected = ["firstName", "lastName", "grade", "dateOfBirth", "guardianPhone"];
  const missing = expected.slice(0, 4).filter((name) => !header?.includes(name));
  if (missing.length > 0) {
    return { rows: [] as ImportRow[], errors: [`Missing headers: ${missing.join(", ")}`] };
  }

  const errors: string[] = [];
  const rows: ImportRow[] = [];
  for (let index = 1; index < lines.length; index += 1) {
    const raw = lines[index];
    if (!raw.trim()) continue;
    const cols = raw.split(",").map((item) => item.trim());
    const record = Object.fromEntries(header.map((key, i) => [key, cols[i] ?? ""]));
    const rowNumber = index + 1;
    const grade = Number(record.grade);
    if (!record.firstName || !record.lastName) errors.push(`Row ${rowNumber}: firstName and lastName are required.`);
    if (!Number.isInteger(grade) || grade < 1 || grade > 12) errors.push(`Row ${rowNumber}: grade must be 1-12.`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(record.dateOfBirth)) errors.push(`Row ${rowNumber}: dateOfBirth must be YYYY-MM-DD.`);
    rows.push({
      rowNumber,
      firstName: record.firstName,
      lastName: record.lastName,
      grade,
      dateOfBirth: record.dateOfBirth,
      guardianPhone: record.guardianPhone || null,
    });
  }

  if (rows.length > 500) errors.push("Maximum 500 students per batch.");
  return { rows, errors };
}

export default function StudentImportPage() {
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [batch, setBatch] = useState<BatchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function loadFile(file?: File | null) {
    setBatch(null);
    if (!file) return;
    const parsed = parseCsv(await file.text());
    setRows(parsed.rows);
    setErrors(parsed.errors);
  }

  async function submit() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: "student-import.csv", rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");

      const batchRes = await fetch(`/api/admin/import/batches/${data.batchId}`);
      const batchData = await batchRes.json();
      setBatch(batchData.batch ?? { id: data.batchId, status: data.status, successCount: 0, errorCount: 0 });
      setMessage(data.status === "QUEUED" ? "Large import queued for processing." : "Import processed.");
    } catch (error: any) {
      setMessage(error.message || "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Link href="/admin/school" className="text-xs font-semibold text-[var(--ll-yellow)]">Back to school dashboard</Link>
        <header className="mt-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--ll-yellow)]">Bulk student import</p>
          <h1 className="mt-2 text-3xl font-bold">Import students by CSV</h1>
          <p className="mt-2 text-sm text-[var(--ll-text)]">
            Format: firstName,lastName,grade,dateOfBirth,guardianPhone. Batches over 50 students use the existing SQS FIFO queue when configured.
          </p>
        </header>

        <section className="mt-5 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
          <input type="file" accept=".csv,text/csv" onChange={(e) => loadFile(e.target.files?.[0])} className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm" />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--ll-text)]">{rows.length} rows parsed.</p>
            <button disabled={busy || rows.length === 0 || errors.length > 0} onClick={submit} className="rounded-xl bg-[var(--ll-yellow-soft)] px-4 py-3 text-sm font-bold text-[var(--ll-text-faint)] disabled:opacity-50">
              {busy ? "Importing..." : "Start import"}
            </button>
          </div>
          {errors.length > 0 ? (
            <div className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100">
              {errors.map((error) => <p key={error}>{error}</p>)}
            </div>
          ) : null}
          {message ? <p className="mt-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] p-3 text-sm">{message}</p> : null}
        </section>

        {batch ? (
          <section className="mt-5 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
            <h2 className="text-xl font-semibold">Import results</h2>
            <p className="mt-2 text-sm text-[var(--ll-text)]">Status: {batch.status} - Created: {batch.successCount} - Errors: {batch.errorCount}</p>
            {batch.resultSummary?.errors?.length ? (
              <div className="mt-4 rounded-xl border border-amber-400/30 bg-[var(--ll-yellow-soft)] p-4 text-sm text-[var(--ll-yellow)]">
                {batch.resultSummary.errors.map((error) => <p key={`${error.rowNumber}-${error.message}`}>Row {error.rowNumber}: {error.message}</p>)}
              </div>
            ) : null}
            {batch.status === "COMPLETED" || batch.successCount > 0 ? (
              <a href={`/api/admin/import/batches/${batch.id}/credentials`} className="mt-4 inline-flex rounded-xl bg-[var(--ll-yellow-soft)] px-4 py-3 text-sm font-bold text-[var(--ll-text-faint)]">
                Download credentials CSV once
              </a>
            ) : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
