"use client";

import { useMemo, useState } from "react";

const dimensions = [
  "standards_alignment", "factual_correctness", "age_appropriateness",
  "instructional_clarity_quality", "assessment_alignment", "localization_cultural_accuracy",
  "accessibility", "safety", "evidence_source_quality", "language_quality",
] as const;

export function ReviewWorkspace({ initialTask }: { initialTask: any }) {
  const [task, setTask] = useState(initialTask);
  const [assignment, setAssignment] = useState<any>(() => initialTask.assignments.find((item: any) => item.leaseToken));
  const [responses, setResponses] = useState<Record<string, { value: string; note?: string }>>({});
  const [recommendation, setRecommendation] = useState("RETURN_FOR_REVISION");
  const [rationale, setRationale] = useState("");
  const [evidence, setEvidence] = useState("");
  const [message, setMessage] = useState("");
  const snapshot = task.revision.contentSnapshot ?? {};
  const stale = task.provenance.currentRevisionId !== task.revisionId;
  const leaseMinutes = useMemo(() => assignment ? Math.max(0, Math.floor((new Date(assignment.leaseExpiresAt).getTime() - Date.now()) / 60000)) : null, [assignment]);

  async function claim() {
    const response = await fetch(`/api/review/tasks/${task.id}/claim`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: "{}" });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error ?? "Claim failed");
    setAssignment(data.assignment); setMessage("Task claimed.");
  }
  async function heartbeat() {
    const response = await fetch(`/api/review/claims/${assignment.id}/heartbeat`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ leaseToken: assignment.leaseToken, version: assignment.version }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error ?? "Heartbeat failed");
    setAssignment(data.assignment); setMessage("Lease renewed.");
  }
  async function release(recusal: boolean) {
    const response = await fetch(`/api/review/claims/${assignment.id}/release`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ leaseToken: assignment.leaseToken, version: assignment.version, recusal, reason: recusal ? "DECLARED_CONFLICT" : "RELEASED" }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error ?? "Release failed");
    setAssignment(null); setMessage(recusal ? "Conflict recorded and claim released." : "Claim released.");
  }
  async function submit() {
    const evidenceRefs = evidence.split("\n").map((value) => value.trim()).filter(Boolean).map((uri) => ({ uri }));
    const response = await fetch(`/api/review/claims/${assignment.id}/submit`, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ leaseToken: assignment.leaseToken, assignmentVersion: assignment.version, rubricResponses: responses, recommendation, rationale, evidenceRefs }) });
    const data = await response.json();
    if (!response.ok) return setMessage(data.error ?? "Submission failed");
    setMessage(`Assessment submitted. Workflow: ${data.completion.status}`);
    const refreshed = await fetch(`/api/review/tasks/${task.id}`).then((item) => item.json());
    if (refreshed.task) setTask(refreshed.task);
    setAssignment(null);
  }

  return <main className="mx-auto max-w-7xl p-6">
    <div className="mb-4 flex items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold">{snapshot.title ?? task.provenance.curriculumContent.title ?? "Curriculum review"}</h1><p className="text-sm text-slate-600">Exact revision {task.revisionId}</p></div><span className="rounded bg-slate-100 px-3 py-1 text-sm font-medium">{task.status}</span></div>
    {stale && <div className="mb-4 rounded border border-red-400 bg-red-50 p-3 text-red-800">Stale revision. Submission is blocked.</div>}
    {task.blinding.active && <div className="mb-4 rounded border border-blue-400 bg-blue-50 p-3 text-blue-900">Independent blind review is active. The first reviewer&apos;s recommendation, rationale, and rubric are hidden until you submit.</div>}
    {assignment && <div className="mb-4 flex items-center gap-3 rounded border border-amber-400 bg-amber-50 p-3"><strong>Claim active</strong><span>About {leaseMinutes} minute(s) remain.</span><button className="rounded border px-2 py-1" onClick={heartbeat}>Renew 15 minutes</button><button className="rounded border px-2 py-1" onClick={() => release(false)}>Release</button><button className="rounded border border-red-400 px-2 py-1" onClick={() => release(true)}>Declare conflict</button></div>}
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded border bg-white p-4"><h2 className="font-semibold">Revision and provenance</h2><dl className="grid grid-cols-2 gap-2 text-sm"><dt>Subject</dt><dd>{snapshot.subject ?? task.provenance.curriculumContent.subject}</dd><dt>Grade</dt><dd>{snapshot.grade ?? task.provenance.curriculumContent.grade}</dd><dt>Authority</dt><dd>{task.requiredAuthority}</dd><dt>Risk</dt><dd>{task.priorityBand} ({task.priorityScore})</dd><dt>Policy</dt><dd>{task.policyKey} v{task.policyVersion}</dd><dt>Rubric</dt><dd>{task.rubricKey} v{task.rubricVersion}</dd></dl><div><h3 className="font-medium">Risk rationale</h3><ul className="list-disc pl-5 text-sm">{task.priorityReasons.map((reason: string) => <li key={reason}>{reason}</li>)}</ul></div><div><h3 className="font-medium">Evidence</h3><ul className="text-sm">{task.provenance.currentRevision?.evidence?.map((item: any) => <li key={item.id}>{item.title}: {item.uri ?? item.documentRef ?? "recorded evidence"}</li>)}</ul></div><pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs">{JSON.stringify(snapshot, null, 2)}</pre></section>
      <section className="space-y-4 rounded border bg-white p-4"><div className="flex justify-between"><h2 className="font-semibold">Rubric workspace</h2>{!assignment && !stale && <button className="rounded bg-blue-700 px-3 py-2 text-white" onClick={claim}>Claim task</button>}</div>{dimensions.map((dimension) => <label key={dimension} className="block text-sm"><span className="mb-1 block font-medium">{dimension.replaceAll("_", " ")}</span><select className="w-full rounded border p-2" value={responses[dimension]?.value ?? ""} disabled={!assignment} onChange={(event) => setResponses({ ...responses, [dimension]: { value: event.target.value } })}><option value="">Select</option><option>PASS</option><option>CONCERN</option><option>FAIL</option><option>NOT_APPLICABLE</option></select></label>)}<label className="block text-sm"><span className="mb-1 block font-medium">Recommendation</span><select className="w-full rounded border p-2" disabled={!assignment} value={recommendation} onChange={(event) => setRecommendation(event.target.value)}><option>APPROVE</option><option>REJECT</option><option>RETURN_FOR_REVISION</option><option>ESCALATE</option><option>ABSTAIN_CONFLICT</option></select></label><label className="block text-sm"><span className="mb-1 block font-medium">Rationale</span><textarea className="min-h-28 w-full rounded border p-2" disabled={!assignment} value={rationale} onChange={(event) => setRationale(event.target.value)} /></label><label className="block text-sm"><span className="mb-1 block font-medium">Evidence references, one per line when policy requires</span><textarea className="min-h-20 w-full rounded border p-2" disabled={!assignment} value={evidence} onChange={(event) => setEvidence(event.target.value)} /></label><button className="rounded bg-emerald-700 px-4 py-2 text-white disabled:opacity-50" disabled={!assignment || stale} onClick={submit}>Submit immutable assessment</button>{message && <p className="rounded bg-slate-100 p-2 text-sm">{message}</p>}</section>
    </div>
  </main>;
}
