"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

interface Props {
  currentAction: string;
  currentActorEmail: string;
  currentRole: string;
  currentFrom: string;
  currentTo: string;
  currentResourceType: string;
  schoolId: string | null;
  isPlatformAdmin: boolean;
}

export default function AuditLogSearch({
  currentAction,
  currentActorEmail,
  currentRole,
  currentFrom,
  currentTo,
  currentResourceType,
  schoolId,
  isPlatformAdmin,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleClear = useCallback(() => {
    router.push("/admin/compliance");
  }, [router]);

  const buildCsvUrl = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("format", "csv");
    params.delete("page");
    return `/api/admin/compliance/audit-log?${params.toString()}`;
  };

  return (
    <div className="mb-6 rounded-2xl border border-slate-800 bg-slate-900/80 p-5">
      <h2 className="mb-4 text-base font-semibold">Search Records</h2>
      <form method="get" action="/admin/compliance" className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="action" className="mb-1 block text-xs text-slate-400">
              Action Type
            </label>
            <input
              id="action"
              name="action"
              type="text"
              defaultValue={currentAction}
              placeholder="e.g. export, login"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="actorEmail" className="mb-1 block text-xs text-slate-400">
              Actor Email
            </label>
            <input
              id="actorEmail"
              name="actorEmail"
              type="text"
              defaultValue={currentActorEmail}
              placeholder="e.g. admin@school.lr"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="role" className="mb-1 block text-xs text-slate-400">
              Actor Role
            </label>
            <select
              id="role"
              name="role"
              defaultValue={currentRole}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All roles</option>
              <option value="ADMIN">ADMIN</option>
              <option value="DISTRICT_ADMIN">DISTRICT_ADMIN</option>
              <option value="MOE_OFFICIAL">MOE_OFFICIAL</option>
              <option value="TEACHER">TEACHER</option>
              <option value="STUDENT">STUDENT</option>
              <option value="GUARDIAN">GUARDIAN</option>
            </select>
          </div>
          <div>
            <label htmlFor="resourceType" className="mb-1 block text-xs text-slate-400">
              Record Type
            </label>
            <input
              id="resourceType"
              name="resourceType"
              type="text"
              defaultValue={currentResourceType}
              placeholder="e.g. export, school"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="from" className="mb-1 block text-xs text-slate-400">
              From Date
            </label>
            <input
              id="from"
              name="from"
              type="date"
              defaultValue={currentFrom}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label htmlFor="to" className="mb-1 block text-xs text-slate-400">
              To Date
            </label>
            <input
              id="to"
              name="to"
              type="date"
              defaultValue={currentTo}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          {isPlatformAdmin ? (
            <div>
              <label htmlFor="schoolId" className="mb-1 block text-xs text-slate-400">
                School ID
              </label>
              <input
                id="schoolId"
                name="schoolId"
                type="text"
                defaultValue={schoolId ?? ""}
                placeholder="Optional school scope"
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          ) : null}
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
            Download as Spreadsheet
          </a>
        </div>
      </form>
    </div>
  );
}
