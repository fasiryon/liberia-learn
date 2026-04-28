"use client";

import { useState } from "react";
import Link from "next/link";

type ImportType = "students" | "teachers" | "guardians";
type Step = 1 | 2 | 3 | 4;

type ImportRow = Record<string, string>;

type InvalidRow = {
  row: ImportRow;
  rowNumber: number;
  errors: string[];
};

type ValidationSummary = {
  total: number;
  validCount: number;
  invalidCount: number;
  duplicateEmails: string[];
  warnings: string[];
};

type ConfirmResult = {
  imported: number;
  skipped: number;
  errors: Array<{ row: ImportRow; reason: string }>;
  failedRowsCsv: string | null;
  summary: ValidationSummary;
};

const IMPORT_LABELS: Record<ImportType, string> = {
  students: "Students",
  teachers: "Teachers",
  guardians: "Guardians",
};

const SAMPLE_URLS: Record<ImportType, string> = {
  students: "/sample-student-import.csv",
  teachers: "/sample-teacher-import.csv",
  guardians: "/sample-guardian-import.csv",
};

function parseCsv(text: string): ImportRow[] {
  const lines = text.trim().split(/\r?\n/);
  const header = lines[0]?.split(",").map((h) => h.trim()) ?? [];
  return lines
    .slice(1)
    .filter((line) => line.trim())
    .map((line) => {
      const cols = line.split(",").map((c) => c.trim());
      return Object.fromEntries(header.map((h, i) => [h, cols[i] ?? ""]));
    });
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportPage() {
  const [step, setStep] = useState<Step>(1);
  const [importType, setImportType] = useState<ImportType>("students");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);

  // Step 2 state
  const [validRows, setValidRows] = useState<ImportRow[]>([]);
  const [invalidRows, setInvalidRows] = useState<InvalidRow[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Step 3 state
  const [confirmed, setConfirmed] = useState(false);

  // Step 4 state
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function loadFile(file?: File | null) {
    setFileError(null);
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setFileError("File must be under 5 MB.");
      return;
    }
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) {
      setFileError("No rows found in this file. Check the format and try again.");
      return;
    }
    setRows(parsed);
  }

  async function runValidation() {
    if (rows.length === 0) return;
    setValidating(true);
    setPreviewError(null);
    try {
      const res = await fetch("/api/admin/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importType, rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Validation failed");
      setValidRows(data.preview ?? []);
      setInvalidRows(data.errors ?? []);
      setWarnings(data.summary?.warnings ?? []);
      setStep(2);
    } catch (err: any) {
      setPreviewError(err.message ?? "Validation failed");
    } finally {
      setValidating(false);
    }
  }

  async function runConfirm() {
    setImporting(true);
    setImportError(null);
    try {
      const res = await fetch("/api/admin/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ importType, rows }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import failed");
      setResult(data);
      setStep(4);
    } catch (err: any) {
      setImportError(err.message ?? "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function reset() {
    setStep(1);
    setRows([]);
    setValidRows([]);
    setInvalidRows([]);
    setWarnings([]);
    setConfirmed(false);
    setResult(null);
    setFileError(null);
    setPreviewError(null);
    setImportError(null);
  }

  return (
    <main className="min-h-screen bg-[var(--ll-bg)] text-[var(--ll-text)]">
      <div className="mx-auto max-w-5xl px-4 py-6">
        <Link href="/admin" className="text-xs font-semibold text-[var(--ll-yellow)]">
          Back to Admin Console
        </Link>

        <header className="mt-4 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--ll-yellow)]">Bulk Import</p>
          <h1 className="mt-2 text-3xl font-bold">Import Users by CSV</h1>
          <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
            Import students, teachers, or guardians. Preview errors before anything is written.
          </p>
          {/* Step indicator */}
          <div className="mt-4 flex items-center gap-2 text-xs">
            {([1, 2, 3, 4] as Step[]).map((s) => (
              <span
                key={s}
                className={`flex h-6 w-6 items-center justify-center rounded-full font-bold ${
                  step === s
                    ? "bg-[var(--ll-yellow)] text-[var(--ll-text-faint)]"
                    : step > s
                    ? "bg-[var(--ll-yellow)]/30 text-[var(--ll-yellow)]"
                    : "border border-[var(--ll-border)] text-[var(--ll-text-muted)]"
                }`}
              >
                {s}
              </span>
            ))}
            <span className="ml-1 text-[var(--ll-text-muted)]">
              {step === 1 && "Select & Upload"}
              {step === 2 && "Preview"}
              {step === 3 && "Confirm"}
              {step === 4 && "Done"}
            </span>
          </div>
        </header>

        {/* ── STEP 1 ── */}
        {step === 1 ? (
          <section className="mt-5 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <h2 className="text-lg font-semibold">Step 1 — Select Import Type and Upload</h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {(["students", "teachers", "guardians"] as ImportType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setImportType(t); setRows([]); }}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                    importType === t
                      ? "border-[var(--ll-yellow)] bg-[var(--ll-yellow)]/10 text-[var(--ll-yellow)]"
                      : "border-[var(--ll-border)] text-[var(--ll-text-muted)] hover:border-[var(--ll-yellow)]/40"
                  }`}
                >
                  {IMPORT_LABELS[t]}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <a
                href={`/api/admin/import/template/${importType}`}
                download
                className="rounded-lg border border-[var(--ll-border)] px-3 py-2 text-xs font-medium text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
              >
                Download {IMPORT_LABELS[importType]} Template
              </a>
              <a
                href={SAMPLE_URLS[importType]}
                download
                className="rounded-lg border border-[var(--ll-border)] px-3 py-2 text-xs font-medium text-[var(--ll-text-muted)] hover:text-[var(--ll-text)]"
              >
                Download Sample CSV
              </a>
            </div>

            <div className="mt-5">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => loadFile(e.target.files?.[0])}
                className="w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-3 text-sm"
              />
              {fileError ? <p className="mt-2 text-xs text-red-300">{fileError}</p> : null}
              {rows.length > 0 ? (
                <p className="mt-2 text-sm text-[var(--ll-text-muted)]">{rows.length} rows loaded.</p>
              ) : null}
              {previewError ? (
                <p className="mt-2 text-xs text-red-300">{previewError}</p>
              ) : null}
            </div>

            <div className="mt-5">
              <button
                type="button"
                disabled={rows.length === 0 || validating}
                onClick={runValidation}
                className="rounded-xl bg-[var(--ll-yellow)] px-6 py-3 text-sm font-bold text-[var(--ll-text-faint)] disabled:opacity-50"
              >
                {validating ? "Validating..." : "Validate →"}
              </button>
            </div>
          </section>
        ) : null}

        {/* ── STEP 2 ── */}
        {step === 2 ? (
          <section className="mt-5 space-y-5">
            <div className="rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
              <h2 className="text-lg font-semibold">Step 2 — Preview</h2>

              {warnings.length > 0 ? (
                <div className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  {warnings.map((w, i) => <p key={i}>{w}</p>)}
                </div>
              ) : null}

              {/* Valid rows */}
              <div className="mt-4">
                <div className="flex items-center justify-between rounded-t-xl border border-[var(--ll-border)] bg-emerald-900/20 px-4 py-2">
                  <p className="text-sm font-semibold text-emerald-300">
                    {validRows.length} row{validRows.length !== 1 ? "s" : ""} ready to import
                  </p>
                </div>
                {validRows.length > 0 ? (
                  <div className="overflow-x-auto rounded-b-xl border border-t-0 border-[var(--ll-border)]">
                    <table className="w-full text-xs">
                      <thead className="bg-[var(--ll-bg)] text-[var(--ll-text-muted)]">
                        <tr>
                          {Object.keys(validRows[0]).map((h) => (
                            <th key={h} className="px-3 py-2 text-left font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {validRows.slice(0, 20).map((row, i) => (
                          <tr key={i} className="border-t border-[var(--ll-border)]">
                            {Object.values(row).map((v, j) => (
                              <td key={j} className="px-3 py-2">{v}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {validRows.length > 20 ? (
                      <p className="px-4 py-2 text-xs text-[var(--ll-text-muted)]">
                        …and {validRows.length - 20} more rows
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Invalid rows */}
              {invalidRows.length > 0 ? (
                <div className="mt-5">
                  <div className="flex items-center justify-between rounded-t-xl border border-[var(--ll-border)] bg-red-900/20 px-4 py-2">
                    <p className="text-sm font-semibold text-red-300">
                      {invalidRows.length} row{invalidRows.length !== 1 ? "s" : ""} have errors — they will be skipped
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        const headers = Object.keys(invalidRows[0].row);
                        const csv = [
                          [...headers, "error_reason"].join(","),
                          ...invalidRows.map((item) => {
                            const vals = headers.map((h) => `"${(item.row[h] ?? "").replace(/"/g, '""')}"`);
                            vals.push(`"${item.errors.join("; ").replace(/"/g, '""')}"`);
                            return vals.join(",");
                          }),
                        ].join("\n");
                        downloadCsv(csv, `import-errors-${Date.now()}.csv`);
                      }}
                      className="text-xs text-[var(--ll-yellow)] hover:underline"
                    >
                      Download failed rows
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-b-xl border border-t-0 border-[var(--ll-border)]">
                    <table className="w-full text-xs">
                      <thead className="bg-[var(--ll-bg)] text-[var(--ll-text-muted)]">
                        <tr>
                          <th className="px-3 py-2 text-left">Row #</th>
                          <th className="px-3 py-2 text-left">Name</th>
                          <th className="px-3 py-2 text-left">Error</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invalidRows.map((item, i) => (
                          <tr key={i} className="border-t border-[var(--ll-border)]">
                            <td className="px-3 py-2 text-[var(--ll-text-muted)]">{item.rowNumber}</td>
                            <td className="px-3 py-2">
                              {item.row.firstName} {item.row.lastName}
                            </td>
                            <td className="px-3 py-2 text-red-300">{item.errors.join(" · ")}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="rounded-xl border border-[var(--ll-border)] px-5 py-2.5 text-sm"
                >
                  ← Back
                </button>
                {validRows.length === 0 ? (
                  <p className="self-center text-sm text-red-300">
                    Fix the errors and re-upload.
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="rounded-xl bg-[var(--ll-yellow)] px-6 py-2.5 text-sm font-bold text-[var(--ll-text-faint)]"
                  >
                    Continue to Confirm →
                  </button>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {/* ── STEP 3 ── */}
        {step === 3 ? (
          <section className="mt-5 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <h2 className="text-lg font-semibold">Step 3 — Confirm Import</h2>
            <p className="mt-2 text-sm text-[var(--ll-text-muted)]">
              You are about to import{" "}
              <strong className="text-[var(--ll-text)]">
                {validRows.length} {IMPORT_LABELS[importType].toLowerCase()}
              </strong>
              .{" "}
              {invalidRows.length > 0
                ? `${invalidRows.length} row${invalidRows.length !== 1 ? "s" : ""} with errors will be skipped.`
                : ""}
            </p>

            <label className="mt-5 flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span className="text-sm">I have reviewed the preview and confirm this import.</span>
            </label>

            {importError ? (
              <p className="mt-3 text-xs text-red-300">{importError}</p>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-xl border border-[var(--ll-border)] px-5 py-2.5 text-sm"
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={!confirmed || importing}
                onClick={runConfirm}
                className="rounded-xl bg-[var(--ll-yellow)] px-6 py-2.5 text-sm font-bold text-[var(--ll-text-faint)] disabled:opacity-50"
              >
                {importing ? "Importing..." : `Confirm Import ${validRows.length} ${IMPORT_LABELS[importType]}`}
              </button>
            </div>
          </section>
        ) : null}

        {/* ── STEP 4 ── */}
        {step === 4 && result ? (
          <section className="mt-5 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-bg)]/80 p-6">
            <h2 className="text-lg font-semibold">Step 4 — Results</h2>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-900/10 p-4 text-center">
                <p className="text-3xl font-bold text-emerald-300">{result.imported}</p>
                <p className="mt-1 text-xs text-[var(--ll-text-muted)]">Imported</p>
              </div>
              <div className="rounded-xl border border-amber-400/30 bg-amber-900/10 p-4 text-center">
                <p className="text-3xl font-bold text-amber-300">{result.skipped}</p>
                <p className="mt-1 text-xs text-[var(--ll-text-muted)]">Skipped (invalid rows)</p>
              </div>
              <div className="rounded-xl border border-red-400/30 bg-red-900/10 p-4 text-center">
                <p className="text-3xl font-bold text-red-300">{result.errors.length}</p>
                <p className="mt-1 text-xs text-[var(--ll-text-muted)]">Write errors</p>
              </div>
            </div>

            {result.summary?.warnings?.length ? (
              <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                {result.summary.warnings.map((w, i) => <p key={i}>{w}</p>)}
              </div>
            ) : null}

            {result.failedRowsCsv ? (
              <button
                type="button"
                onClick={() => downloadCsv(result.failedRowsCsv!, `import-errors-${Date.now()}.csv`)}
                className="mt-4 rounded-xl border border-red-400/30 px-4 py-2 text-sm text-red-300 hover:bg-red-900/20"
              >
                Download Error Report
              </button>
            ) : null}

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-xl bg-[var(--ll-yellow)] px-5 py-2.5 text-sm font-bold text-[var(--ll-text-faint)]"
              >
                Import Another File
              </button>
              <Link
                href="/admin/students"
                className="rounded-xl border border-[var(--ll-border)] px-5 py-2.5 text-sm"
              >
                View Students
              </Link>
              <Link
                href="/admin/teachers"
                className="rounded-xl border border-[var(--ll-border)] px-5 py-2.5 text-sm"
              >
                View Teachers
              </Link>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}
