"use client";

import { useEffect, useMemo, useState } from "react";

type ClassRow = { id: string; name: string; subject: string; createdAt: string };
type HwRow = {
  id: string;
  classId: string;
  title: string;
  description: string | null;
  instructions: string | null;
  dueAt: string | null;
  createdAt: string;
  createdById: string;
};

export default function AdminHomeworkPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [rows, setRows] = useState<HwRow[]>([]);
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const selectedClass = useMemo(
    () => classes.find((c) => c.id === classId),
    [classes, classId]
  );

  async function loadClasses() {
    setStatus("Loading classes...");
    const r = await fetch("/api/admin/classes", { cache: "no-store" });
    const j = await r.json();
    const list = (j?.classes ?? []) as ClassRow[];
    setClasses(list);
    if (!classId && list.length) setClassId(list[0].id);
    setStatus("");
  }

  async function loadHomework(cid: string) {
    if (!cid) return;
    setBusy(true);
    setStatus("Loading homework...");
    try {
      const _classId = (typeof classId === "string" && classId) ? classId : "";
if (!_classId) throw new Error("Missing classId");
const r = await fetch(`/api/homework?classId=${encodeURIComponent(_classId)}`, { cache: "no-store" });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error ?? "Failed");
      setRows((j?.homework ?? []) as HwRow[]);
      setStatus("");
    } catch (e: any) {
      setStatus(String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (classId) loadHomework(classId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  return (
    <main className="min-h-screen bg-[#070811] text-white">
      <div className="max-w-3xl mx-auto p-8">
        <h1 className="text-3xl font-bold">Homework</h1>
        <p className="text-white/60 mt-1">Quick admin viewer (tenant-safe).</p>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
          <label className="grid gap-1">
            <span className="text-sm text-white/80">Class</span>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              className="rounded-xl bg-[#0b0d14] border border-white/10 px-3 py-2 outline-none focus:border-emerald-500"
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.subject})
                </option>
              ))}
            </select>
          </label>

          <div className="text-xs text-white/60">
            Selected: {selectedClass ? `${selectedClass.name} (${selectedClass.subject})` : "--"}
          </div>

          <button
            onClick={() => loadHomework(classId)}
            disabled={busy || !classId}
            className="rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-black font-semibold px-4 py-3"
          >
            {busy ? "..." : "Refresh"}
          </button>

          {status && (
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm whitespace-pre-wrap">
              {status}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-white/80 font-semibold mb-2">Latest homework</div>

          {rows.length === 0 ? (
            <div className="text-white/60 text-sm">No homework yet.</div>
          ) : (
            <div className="space-y-2">
              {rows.map((h) => (
                <div key={h.id} className="rounded-xl border border-white/10 bg-[#0b0d14] p-3 text-sm">
                  <div className="text-white/90 font-semibold">{h.title}</div>
                  {h.description && <div className="text-white/70 mt-1">desc: {h.description}</div>}
                  <div className="text-white/60 text-xs mt-1">
                    id: {h.id} - due: {h.dueAt ? new Date(h.dueAt).toLocaleString() : "--"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-6 text-xs text-white/60">
          Tip: this page uses GET /api/homework?classId=... which verifies the class belongs to your tenant schoolId.
        </div>
      </div>
    </main>
  );
}
