"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type School = {
  id: string;
  name: string;
  status: string;
  county: string | null;
  district: string | null;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  motto: string | null;
  logoUrl: string | null;
  primaryHex: string | null;
  createdAt: string;
  _count: { users: number; classes: number };
};

export default function PlatformSchoolsPage() {
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({
    name: "",
    county: "",
    district: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
    motto: "",
  });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSchools() {
    setLoading(true);
    try {
      const res = await fetch("/api/platform/schools", { cache: "no-store" });
      if (res.status === 401 || res.status === 403) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      setSchools(data.schools ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSchools();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/schools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create school");
      setShowCreate(false);
      setForm({ name: "", county: "", district: "", contactName: "", contactEmail: "", contactPhone: "", motto: "" });
      loadSchools();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleStatusChange(id: string, status: string) {
    try {
      const res = await fetch("/api/platform/schools", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
      loadSchools();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">School Management</h1>
          <p className="text-sm text-slate-400 mt-1">
            Create, activate, or suspend schools across the platform.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-xl bg-violet-500 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-400"
        >
          {showCreate ? "Cancel" : "Create School"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <form
          onSubmit={handleCreate}
          className="rounded-2xl border border-white/10 bg-slate-900/70 p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold">New School</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { key: "name", label: "School Name *", required: true },
              { key: "county", label: "County" },
              { key: "district", label: "District" },
              { key: "contactName", label: "Contact Name" },
              { key: "contactEmail", label: "Contact Email" },
              { key: "contactPhone", label: "Contact Phone" },
              { key: "motto", label: "Motto" },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  {field.label}
                </label>
                <input
                  type="text"
                  required={field.required}
                  value={(form as any)[field.key]}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, [field.key]: e.target.value }))
                  }
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-violet-500"
                />
              </div>
            ))}
          </div>
          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={creating}
            className="rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-400 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create School"}
          </button>
        </form>
      )}

      {/* Schools table */}
      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
        {loading ? (
          <p className="text-sm text-slate-400">Loading...</p>
        ) : schools.length === 0 ? (
          <p className="text-sm text-slate-400">No schools registered.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 text-left text-xs text-slate-500">
                  <th className="pb-2 pr-3">Name</th>
                  <th className="pb-2 pr-3">County</th>
                  <th className="pb-2 pr-3">Contact</th>
                  <th className="pb-2 pr-3">Users</th>
                  <th className="pb-2 pr-3">Classes</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-slate-800/50 text-slate-300"
                  >
                    <td className="py-3 pr-3 font-medium text-slate-100">
                      {s.name}
                      {s.motto && (
                        <span className="block text-[11px] text-slate-500 mt-0.5">
                          {s.motto}
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-3">{s.county ?? "--"}</td>
                    <td className="py-3 pr-3 text-xs">
                      {s.contactName ?? "--"}
                      {s.contactEmail && (
                        <span className="block text-slate-500">{s.contactEmail}</span>
                      )}
                    </td>
                    <td className="py-3 pr-3">{s._count.users}</td>
                    <td className="py-3 pr-3">{s._count.classes}</td>
                    <td className="py-3 pr-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] ${
                          s.status === "ACTIVE"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : s.status === "PENDING"
                            ? "bg-amber-500/20 text-amber-300"
                            : "bg-red-500/20 text-red-300"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-3">
                      <div className="flex gap-1">
                        {s.status !== "ACTIVE" && (
                          <button
                            onClick={() => handleStatusChange(s.id, "ACTIVE")}
                            className="rounded-lg bg-emerald-500/20 px-2 py-1 text-[11px] text-emerald-300 hover:bg-emerald-500/30"
                          >
                            Activate
                          </button>
                        )}
                        {s.status !== "SUSPENDED" && (
                          <button
                            onClick={() => handleStatusChange(s.id, "SUSPENDED")}
                            className="rounded-lg bg-red-500/20 px-2 py-1 text-[11px] text-red-300 hover:bg-red-500/30"
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
