"use client";

/**
 * AuditLogSearch — client component
 *
 * Plain-language search form for the compliance audit log.
 * Uses native form GET to update URL search params (works without JS,
 * fully keyboard-navigable per national usability requirements).
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Props {
  currentAction: string;
  currentFrom: string;
  currentTo: string;
  currentResourceType: string;
  schoolId: string | null;
  isPlatformAdmin: boolean;
}

export default function AuditLogSearch({
  currentAction,
  currentFrom,
  currentTo,
  currentResourceType,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleClear = useCallback(() => {
    router.push("/admin/compliance");
  }, [router]);

  // Build current CSV download URL from the same filters
  const buildCsvUrl = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", "csv");
    params.delete("page");
    return `/api/admin/compliance/audit-log?${params.toString()}`;
  };

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 mb-6">
      <h2 className="text-base font-semibold mb-4">Search Records</h2>
      {/* Plain form GET — server re-renders with filtered data */}
      <form method="get" action="/admin/compliance" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="action" className="block text-xs text-slate-400 mb-1">
              Action Type
            </label>
            <input
              id="action"
              name="action"
              type="text"
              defaultValue={currentAction}
              placeholder="e.g. export, login"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="resourceType" className="block text-xs text-slate-400 mb-1">
              Record Type
            </label>
            <input
              id="resourceType"
              name="resourceType"
              type="text"
              defaultValue={currentResourceType}
              placeholder="e.g. export, school"
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="from" className="block text-xs text-slate-400 mb-1">
              From Date
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={currentFrom}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="to" className="block text-xs text-slate-400 mb-1">
              To Date
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={currentTo}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="submit"
            className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            Search
          </button>
          <button
            type="button"
            onClick={handleClear}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500"
          >
            Clear Filters
          </button>
          <a
            href={buildCsvUrl()}
            className="ml-auto rounded-xl border border-emerald-700 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-900/40 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            aria-label="Download audit log as spreadsheet (CSV)"
          >
            ↓ Download as Spreadsheet
          </a>
        </div>
      </form>
    </div>
  );
}
