"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, FileJson, RefreshCw, Upload } from "lucide-react";

type OneRosterPreview = {
  valid: boolean;
  counts: Record<string, number>;
  errors: string[];
  warnings: string[];
};

type ImportResult = {
  batchId: string;
  status: string;
  accepted?: number;
  successCount?: number;
  errorCount?: number;
  hasCredentials?: boolean;
};

function isoDateInput(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString().slice(0, 10);
}

async function readJson(response: Response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }
  return data;
}

export default function InteroperabilityClient() {
  const [rosterFile, setRosterFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<OneRosterPreview | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [rosterBusy, setRosterBusy] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [since, setSince] = useState(isoDateInput(30));
  const [until, setUntil] = useState(isoDateInput(0));
  const [source, setSource] = useState("all");
  const [limit, setLimit] = useState(1000);

  const xapiUrl = useMemo(() => {
    const params = new URLSearchParams({ since, until, source, limit: String(limit) });
    return `/api/admin/interoperability/xapi/export?${params.toString()}`;
  }, [limit, since, source, until]);

  async function submitRoster(mode: "preview" | "commit") {
    if (!rosterFile) return;
    setRosterBusy(true);
    setRosterError(null);
    if (mode === "commit") setImportResult(null);

    try {
      const body = new FormData();
      body.set("file", rosterFile);
      body.set("mode", mode);
      const data = await readJson(
        await fetch("/api/admin/interoperability/oneroster/import", { method: "POST", body })
      );

      if (mode === "preview") {
        setPreview(data.preview);
      } else {
        const next = data as ImportResult;
        setImportResult(next);
        if (next.status === "QUEUED" || next.status === "PROCESSING") {
          await pollBatch(next.batchId);
        }
      }
    } catch (error) {
      setRosterError(error instanceof Error ? error.message : "OneRoster request failed");
    } finally {
      setRosterBusy(false);
    }
  }

  async function pollBatch(batchId: string) {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const data = await readJson(await fetch(`/api/admin/import/batches/${batchId}`, { cache: "no-store" }));
      const batch = data.batch ?? data;
      setImportResult({
        batchId,
        status: batch.status,
        successCount: batch.successCount,
        errorCount: batch.errorCount,
        hasCredentials: batch.hasCredentials,
      });
      if (batch.status === "COMPLETED" || batch.status === "FAILED") return;
    }
    throw new Error("Import is still running. Its batch status remains available from this page.");
  }

  return (
    <div className="divide-y divide-[var(--ll-border)]">
      <section className="grid gap-6 py-7 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
        <div>
          <h2 className="text-xl font-semibold">OneRoster 1.2 Bulk Exchange</h2>
          <p className="mt-2 max-w-3xl text-sm text-[var(--ll-text-muted)]">
            School roster exchange for students, teachers, classes, and enrollments. Packages include
            the supporting manifest, organization, role, course, and academic-session files required
            by the OneRoster 1.2 CSV binding. This implementation has not been independently certified
            by 1EdTech.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href="/api/admin/interoperability/oneroster/export"
              className="inline-flex items-center gap-2 rounded-md bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-black"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export ZIP
            </a>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[var(--ll-border)] px-4 py-2 text-sm font-semibold">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Select ZIP
              <input
                type="file"
                accept=".zip,application/zip"
                className="sr-only"
                onChange={(event) => {
                  setRosterFile(event.target.files?.[0] ?? null);
                  setPreview(null);
                  setImportResult(null);
                  setRosterError(null);
                }}
              />
            </label>
            <button
              type="button"
              disabled={!rosterFile || rosterBusy}
              onClick={() => void submitRoster("preview")}
              className="inline-flex items-center gap-2 rounded-md border border-[var(--ll-border)] px-4 py-2 text-sm font-semibold disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${rosterBusy ? "animate-spin" : ""}`} aria-hidden="true" />
              Validate
            </button>
            <button
              type="button"
              disabled={!preview?.valid || rosterBusy}
              onClick={() => void submitRoster("commit")}
              className="inline-flex items-center gap-2 rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Import Valid Package
            </button>
          </div>
          {rosterFile ? <p className="mt-3 text-xs text-[var(--ll-text-muted)]">{rosterFile.name}</p> : null}
          {rosterError ? <p className="mt-3 text-sm text-red-400">{rosterError}</p> : null}
        </div>

        <aside className="rounded-md border border-[var(--ll-border)] p-4" aria-live="polite">
          <h3 className="text-sm font-semibold">Package Status</h3>
          {!preview && !importResult ? (
            <p className="mt-3 text-sm text-[var(--ll-text-muted)]">No package validated.</p>
          ) : null}
          {preview ? (
            <div className="mt-3 space-y-3 text-sm">
              <p className={preview.valid ? "text-emerald-400" : "text-red-400"}>
                {preview.valid ? "Valid bulk package" : "Validation failed"}
              </p>
              <dl className="grid grid-cols-2 gap-2 text-xs">
                {Object.entries(preview.counts).map(([name, count]) => (
                  <div key={name} className="flex justify-between gap-3 border-b border-[var(--ll-border)] pb-1">
                    <dt>{name}</dt>
                    <dd className="font-semibold">{count}</dd>
                  </div>
                ))}
              </dl>
              {preview.errors.map((error) => <p key={error} className="text-xs text-red-400">{error}</p>)}
              {preview.warnings.map((warning) => <p key={warning} className="text-xs text-amber-300">{warning}</p>)}
            </div>
          ) : null}
          {importResult ? (
            <div className="mt-4 border-t border-[var(--ll-border)] pt-3 text-sm">
              <p className="font-semibold">{importResult.status}</p>
              <p className="mt-1 text-xs text-[var(--ll-text-muted)]">
                {importResult.successCount ?? importResult.accepted ?? 0} succeeded, {importResult.errorCount ?? 0} failed
              </p>
              {importResult.status === "COMPLETED" && importResult.hasCredentials ? (
                <a
                  href={`/api/admin/import/batches/${importResult.batchId}/credentials`}
                  className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-[var(--ll-yellow)]"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Download New Account Credentials
                </a>
              ) : null}
            </div>
          ) : null}
        </aside>
      </section>

      <section className="py-7">
        <h2 className="text-xl font-semibold">xAPI Learning Event Export</h2>
        <p className="mt-2 max-w-3xl text-sm text-[var(--ll-text-muted)]">
          xAPI 1.0.3 statement JSON from tenant-scoped learning and performance events. Learner
          identities are stable pseudonyms; raw event metadata and direct personal identifiers are excluded.
          This is a file export for an external LRS, not an LRS or an automatic push integration.
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-semibold">
            Since
            <input type="date" value={since} onChange={(event) => setSince(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold">
            Until
            <input type="date" value={until} onChange={(event) => setUntil(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm" />
          </label>
          <label className="text-xs font-semibold">
            Source
            <select value={source} onChange={(event) => setSource(event.target.value)} className="mt-1 w-full rounded-md border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm">
              <option value="all">Both event streams</option>
              <option value="learning">Learning events</option>
              <option value="performance">Performance events</option>
            </select>
          </label>
          <label className="text-xs font-semibold">
            Statement limit
            <input type="number" min={1} max={5000} value={limit} onChange={(event) => setLimit(Number(event.target.value))} className="mt-1 w-full rounded-md border border-[var(--ll-border)] bg-[var(--ll-bg)] px-3 py-2 text-sm" />
          </label>
        </div>
        <a href={xapiUrl} className="mt-5 inline-flex items-center gap-2 rounded-md bg-[var(--ll-yellow)] px-4 py-2 text-sm font-semibold text-black">
          <FileJson className="h-4 w-4" aria-hidden="true" />
          Export xAPI JSON
        </a>
      </section>

      <section className="py-7">
        <h2 className="text-xl font-semibold">Partner-Gated Standards</h2>
        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <div className="border-l-2 border-amber-400 pl-4">
            <h3 className="font-semibold">LTI</h3>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              Scoped and ready to build once a specific partner/requirement is named. Delivery requires
              an agreed LTI version, platform registration, OIDC login, key management, deployment IDs,
              and the required Advantage services.
            </p>
          </div>
          <div className="border-l-2 border-amber-400 pl-4">
            <h3 className="font-semibold">SCORM</h3>
            <p className="mt-1 text-sm text-[var(--ll-text-muted)]">
              Scoped and ready to build once a specific partner/requirement is named. Delivery requires
              the target SCORM edition, packaging and manifest rules, run-time API behavior, completion
              semantics, and a named LMS validation target.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
