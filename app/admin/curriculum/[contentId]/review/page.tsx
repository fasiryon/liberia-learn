"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

type PackData = {
  contentId: string;
  grade: number;
  subject: string;
  status: string;
  payload: any;
};

function statusBadge(status: string) {
  if (status === "published" || status === "APPROVED")
    return <span className="rounded-full bg-emerald-500/20 text-emerald-300 px-2.5 py-0.5 text-[11px]">Approved</span>;
  if (status === "pending_approval" || status === "PENDING_APPROVAL")
    return <span className="rounded-full bg-amber-500/20 text-amber-300 px-2.5 py-0.5 text-[11px]">Pending</span>;
  return <span className="rounded-full bg-slate-500/20 text-slate-400 px-2.5 py-0.5 text-[11px]">{status}</span>;
}

export default function PackReviewPage() {
  const params = useParams();
  const router = useRouter();
  const contentId = params.contentId as string;

  const [data, setData] = useState<PackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUnits, setExpandedUnits] = useState<Set<number>>(new Set());
  const [expandedLessons, setExpandedLessons] = useState<Set<string>>(new Set());
  const [approving, setApproving] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [classes, setClasses] = useState<Array<{ id: string; name: string }>>([]);
  const [scheduleClassId, setScheduleClassId] = useState("");
  const [scheduleDate, setScheduleDate] = useState(new Date().toISOString().slice(0, 10));
  const [scheduleMsg, setScheduleMsg] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/curriculum/${contentId}`).then((r) => {
        if (r.status === 401 || r.status === 403) { router.push("/login"); return null; }
        if (!r.ok) throw new Error("Failed to load pack");
        return r.json();
      }),
      fetch("/api/admin/classes").then((r) => r.json()).catch(() => ({ classes: [] })),
    ])
      .then(([packData, classData]) => {
        if (packData) setData(packData);
        setClasses(classData?.classes ?? []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [contentId, router]);

  function toggleUnit(idx: number) {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  function toggleLesson(key: string) {
    setExpandedLessons((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  async function handleApprove() {
    setApproving(true);
    try {
      const res = await fetch("/api/admin/curriculum/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Approval failed");
      setData((prev) => prev ? { ...prev, status: "published", payload: { ...prev.payload, approvalStatus: "APPROVED" } } : prev);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setApproving(false);
    }
  }

  async function handleSchedule() {
    if (!scheduleClassId) { setScheduleMsg("Select a class"); return; }
    setScheduling(true);
    setScheduleMsg(null);
    try {
      const res = await fetch("/api/admin/curriculum/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentId, classId: scheduleClassId, scheduledDate: scheduleDate }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Scheduling failed");
      setScheduleMsg("Scheduled successfully!");
    } catch (err: any) {
      setScheduleMsg(err.message);
    } finally {
      setScheduling(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 flex items-center justify-center">
        <p className="text-sm text-slate-400">Loading pack...</p>
      </main>
    );
  }

  if (error || !data) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-50 px-4 py-8">
        <p className="text-red-400">{error || "Pack not found"}</p>
        <Link href="/admin/curriculum" className="text-xs text-emerald-300 mt-4 inline-block">Back</Link>
      </main>
    );
  }

  const payload = data.payload ?? {};
  const units = payload.units ?? [];
  const termPlan = payload.termPlan;
  const meta = payload.metadata ?? {};
  const isPending = data.status === "pending_approval";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e22,_transparent_60%)]" />
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        <div>
          <Link href="/admin/curriculum" className="text-xs text-emerald-300 hover:text-emerald-200">
            &larr; Back to Curriculum
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-2xl font-bold">{payload.title || contentId}</h1>
            {statusBadge(data.status)}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Grade {data.grade} &middot; {data.subject} &middot;
            {meta.unitCount} units &middot; {meta.lessonCount} lessons &middot; {meta.labCount} labs &middot; {meta.assessmentItemCount} assessment items
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          {isPending && (
            <button
              onClick={handleApprove}
              disabled={approving}
              className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
            >
              {approving ? "Approving..." : "Approve & Publish"}
            </button>
          )}

          {data.status === "published" && (
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/70 px-4 py-2">
              <select
                value={scheduleClassId}
                onChange={(e) => setScheduleClassId(e.target.value)}
                className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-slate-100"
              >
                <option value="">Select class...</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="rounded-lg bg-slate-950 border border-slate-700 px-2 py-1.5 text-xs text-slate-100"
              />
              <button
                onClick={handleSchedule}
                disabled={scheduling}
                className="rounded-lg bg-blue-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-blue-400 disabled:opacity-50"
              >
                {scheduling ? "..." : "Schedule"}
              </button>
              {scheduleMsg && (
                <span className={`text-xs ${scheduleMsg.includes("success") ? "text-emerald-400" : "text-red-400"}`}>
                  {scheduleMsg}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Term Plan */}
        {termPlan && (
          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <h2 className="text-lg font-semibold mb-3">Term Plan</h2>
            <p className="text-sm text-slate-300 mb-2">{termPlan.title}</p>
            <div className="grid gap-1 text-xs text-slate-400">
              {(termPlan.weeks ?? []).map((w: any) => (
                <div key={w.week} className="flex gap-2">
                  <span className="text-slate-500 w-16 shrink-0">Week {w.week}</span>
                  <span className="text-slate-300">{w.topic}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Units */}
        {units.map((unit: any, uIdx: number) => {
          const isExpanded = expandedUnits.has(uIdx);
          return (
            <section key={uIdx} className="rounded-2xl border border-white/10 bg-slate-900/70">
              <button
                onClick={() => toggleUnit(uIdx)}
                className="w-full text-left p-5 flex items-center justify-between"
              >
                <div>
                  <h3 className="text-base font-semibold text-slate-100">
                    Unit {unit.unitNumber}: {unit.unitPlan?.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {unit.lessons?.length ?? 0} lessons &middot; {unit.assessment?.items?.length ?? 0} assessment items &middot; {unit.masteryChecks?.length ?? 0} mastery checks
                  </p>
                </div>
                <span className="text-slate-500 text-sm">{isExpanded ? "▼" : "▶"}</span>
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 space-y-4 border-t border-slate-800 pt-4">
                  {/* Objectives */}
                  {unit.unitPlan?.objectives?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 mb-1">Objectives</p>
                      <ul className="list-disc ml-4 text-xs text-slate-300 space-y-0.5">
                        {unit.unitPlan.objectives.map((o: string, i: number) => (
                          <li key={i}>{o}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Lessons */}
                  <div>
                    <p className="text-xs font-medium text-slate-400 mb-2">Lessons</p>
                    <div className="space-y-2">
                      {(unit.lessons ?? []).map((lesson: any, lIdx: number) => {
                        const lessonKey = `${uIdx}-${lIdx}`;
                        const lessonExpanded = expandedLessons.has(lessonKey);
                        return (
                          <div key={lIdx} className="rounded-lg border border-slate-700 bg-slate-950/60">
                            <button
                              onClick={() => toggleLesson(lessonKey)}
                              className="w-full text-left px-3 py-2 flex items-center justify-between text-xs"
                            >
                              <span className="text-slate-200">
                                Day {lesson.day}: {lesson.title}
                                <span className="text-slate-500 ml-2">({lesson.focus})</span>
                              </span>
                              <span className="text-slate-500">{lessonExpanded ? "▼" : "▶"}</span>
                            </button>
                            {lessonExpanded && lesson.labs?.length > 0 && (
                              <div className="px-3 pb-3 space-y-2">
                                {lesson.labs.map((lab: any, labIdx: number) => (
                                  <div key={labIdx} className="rounded-md border border-slate-600 bg-slate-900/40 p-2 text-xs space-y-1">
                                    <p className="font-semibold text-slate-100">{lab.title}</p>
                                    <p className="text-slate-400"><strong>Objective:</strong> {lab.objective}</p>
                                    <p className="text-slate-400"><strong>Materials:</strong> {lab.materials?.join(", ")}</p>
                                    <ol className="list-decimal ml-4 text-slate-400 space-y-0.5">
                                      {lab.steps?.map((s: string, si: number) => <li key={si}>{s}</li>)}
                                    </ol>
                                    <p className="text-slate-400"><strong>Assessment:</strong> {lab.assessment}</p>
                                    {lab.safetyNotes && <p className="text-amber-400"><strong>Safety:</strong> {lab.safetyNotes}</p>}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Assessment */}
                  {unit.assessment?.items?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 mb-1">Assessment Items</p>
                      <div className="space-y-1">
                        {unit.assessment.items.map((item: any, i: number) => (
                          <div key={i} className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-xs">
                            <p className="text-slate-200">{item.question}</p>
                            <div className="mt-1 grid grid-cols-2 gap-1 text-slate-400">
                              {item.options?.map((opt: any) => (
                                <span key={opt.label} className={opt.label === item.correctAnswer ? "text-emerald-400" : ""}>
                                  {opt.label}. {opt.text}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Rubric */}
                  {unit.assessment?.rubric && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 mb-1">Rubric: {unit.assessment.rubric.title}</p>
                      <div className="text-xs text-slate-400">
                        {unit.assessment.rubric.criteria?.map((c: any, ci: number) => (
                          <div key={ci} className="mb-1">
                            <span className="text-slate-200 font-medium">{c.name}:</span>{" "}
                            {c.levels?.map((l: any) => `${l.label} (${l.points}pts)`).join(" | ")}
                          </div>
                        ))}
                        <p className="text-slate-500 mt-1">Total: {unit.assessment.rubric.totalPossible} points</p>
                      </div>
                    </div>
                  )}

                  {/* Mastery Checks */}
                  {unit.masteryChecks?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-slate-400 mb-1">Mastery Checks</p>
                      <div className="space-y-1">
                        {unit.masteryChecks.map((mc: any, mi: number) => (
                          <div key={mi} className="rounded-md border border-slate-700 bg-slate-950/40 px-3 py-2 text-xs">
                            <p className="text-slate-200">{mc.skill}</p>
                            <p className="text-slate-400 mt-0.5">{mc.prompt}</p>
                            <p className="text-slate-500 mt-0.5 italic">Pass: {mc.passThreshold}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
