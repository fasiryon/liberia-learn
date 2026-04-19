"use client";

import { useEffect, useState } from "react";
import { get, set, del } from "idb-keyval";
import { enqueueOfflineRequest } from "@/lib/offline-queue";

type ProcedureStep = {
  stepNumber: number;
  instruction: string;
  teacherNote: string | null;
  durationMinutes: number;
};

type ObservationField = {
  field: string;
  prompt: string;
  inputType: "text" | "number" | "choice";
  choices: string[] | null;
};

type AnalysisQuestion = {
  question: string;
  expectedAnswer?: string;
  scoringRubric?: string;
};

type LabDefinition = {
  labId: string;
  title: string;
  estimatedMinutes: number;
  payload: {
    labObjective?: string;
    materialsNeeded?: string[];
    safetyNotes?: string | null;
    procedure?: ProcedureStep[];
    observationForm?: ObservationField[];
    analysisQuestions?: AnalysisQuestion[];
  };
};

type LabSessionClientProps = {
  lab: LabDefinition;
  sessionId: string;
  initialCompleted: boolean;
};

const draftKey = (sessionId: string) => `lab-draft:${sessionId}`;
const pendingKey = (sessionId: string) => `lab-pending:${sessionId}`;

export function LabSessionClient({ lab, sessionId, initialCompleted }: LabSessionClientProps) {
  const procedure = lab.payload.procedure ?? [];
  const observationFields = lab.payload.observationForm ?? [];
  const analysisQuestions = lab.payload.analysisQuestions ?? [];

  const [started, setStarted] = useState(initialCompleted);
  const [stepIndex, setStepIndex] = useState(0);
  const [observations, setObservations] = useState<Record<string, string>>({});
  const [analysisAnswers, setAnalysisAnswers] = useState<Record<number, string>>({});
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(initialCompleted);

  useEffect(() => {
    async function loadDraft() {
      const saved = await get<{
        observations?: Record<string, string>;
        analysisAnswers?: Record<number, string>;
      }>(draftKey(sessionId));
      if (saved?.observations) setObservations(saved.observations);
      if (saved?.analysisAnswers) setAnalysisAnswers(saved.analysisAnswers);
    }

    async function flushPending() {
      if (typeof navigator !== "undefined" && !navigator.onLine) return;
      const pending = await get<any>(pendingKey(sessionId));
      if (!pending) return;
      const response = await fetch(`/api/student/labs/${lab.labId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pending),
      });
      if (response.ok) {
        await del(pendingKey(sessionId));
        await del(draftKey(sessionId));
        setCompleted(true);
        setStatusMessage("Lab submitted. Your teacher will review your observations.");
      }
    }

    loadDraft().catch(() => {});
    flushPending().catch(() => {});
  }, [lab.labId, sessionId]);

  async function beginLab() {
    const response = await fetch(`/api/student/labs/${lab.labId}/session`, { method: "POST" });
    if (response.ok) {
      setStarted(true);
    } else {
      setStatusMessage("Unable to start the lab right now.");
    }
  }

  async function saveProgress() {
    await set(draftKey(sessionId), { observations, analysisAnswers });
    setStatusMessage("Progress saved on this device.");
  }

  async function submitLab() {
    const conclusions = analysisQuestions.map((question, index) => ({
      question: question.question,
      answer: analysisAnswers[index] ?? "",
    }));

    const payload = { observations, conclusions };

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      await set(draftKey(sessionId), { observations, analysisAnswers });
      await set(pendingKey(sessionId), payload);
      await enqueueOfflineRequest({
        type: "lab-submission",
        endpoint: `/api/student/labs/${lab.labId}/session`,
        payload,
        dedupeKey: `lab-submission:${sessionId}`,
      });
      setStatusMessage("Lab saved offline. Will sync when you reconnect.");
      return;
    }

    setSubmitting(true);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/student/labs/${lab.labId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Unable to submit the lab.");
      }

      await del(draftKey(sessionId));
      await del(pendingKey(sessionId));
      setCompleted(true);
      setStatusMessage("Lab submitted. Your teacher will review your observations.");
    } catch (error: any) {
      setStatusMessage(error?.message ?? "Unable to submit the lab.");
    } finally {
      setSubmitting(false);
    }
  }

  const showProcedure = started && !completed;
  const procedureComplete = stepIndex >= procedure.length;

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-white/10 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">{lab.title}</h1>
            <p className="mt-2 text-sm text-slate-400">{lab.payload.labObjective ?? "Complete the lab carefully and record your evidence."}</p>
          </div>
          <span className="rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
            {lab.estimatedMinutes} min
          </span>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Materials needed</h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-300">
              {(lab.payload.materialsNeeded ?? []).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          {lab.payload.safetyNotes ? (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">
              <p className="font-semibold">Safety notes</p>
              <p className="mt-2">{lab.payload.safetyNotes}</p>
            </div>
          ) : null}
        </div>

        {!started && !completed ? (
          <button
            type="button"
            onClick={beginLab}
            className="ll-interactive mt-6 rounded-xl bg-[var(--ll-accent)] px-5 py-3 text-sm font-semibold text-slate-950"
          >
            Begin Lab
          </button>
        ) : null}
      </section>

      {showProcedure && procedure.length > 0 && !procedureComplete ? (
        <section className="rounded-xl border border-white/10 bg-slate-900/70 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Procedure</h2>
            <span className="text-xs text-slate-400">
              Step {stepIndex + 1} of {procedure.length}
            </span>
          </div>
          <div className="mb-4 h-2 rounded-full bg-slate-800">
            <div
              className="h-2 rounded-full bg-emerald-500"
              style={{ width: `${((stepIndex + 1) / procedure.length) * 100}%` }}
            />
          </div>
          <div className="space-y-3">
            <p className="text-lg text-slate-100">{procedure[stepIndex].instruction}</p>
            {procedure[stepIndex].teacherNote ? (
              <p className="text-sm italic text-slate-400">{procedure[stepIndex].teacherNote}</p>
            ) : null}
            <p className="text-sm text-slate-400">Timer: {procedure[stepIndex].durationMinutes} minutes</p>
          </div>
          <button
            type="button"
            onClick={() => setStepIndex((current) => current + 1)}
            className="ll-interactive mt-5 rounded-xl bg-[var(--ll-accent)] px-5 py-3 text-sm font-semibold text-slate-950"
          >
            Next Step
          </button>
        </section>
      ) : null}

      {showProcedure && procedureComplete ? (
        <section className="rounded-xl border border-white/10 bg-slate-900/70 p-6">
          <h2 className="text-lg font-semibold text-slate-100">Observation Form</h2>
          <div className="mt-4 space-y-4">
            {observationFields.map((field) => (
              <label key={field.field} className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">{field.prompt}</span>
                {field.inputType === "choice" ? (
                  <select
                    value={observations[field.field] ?? ""}
                    onChange={(event) => setObservations((current) => ({ ...current, [field.field]: event.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  >
                    <option value="">Select one</option>
                    {(field.choices ?? []).map((choice) => (
                      <option key={choice} value={choice}>
                        {choice}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={field.inputType === "number" ? "number" : "text"}
                    value={observations[field.field] ?? ""}
                    onChange={(event) => setObservations((current) => ({ ...current, [field.field]: event.target.value }))}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                  />
                )}
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={saveProgress}
            className="ll-interactive mt-5 rounded-xl border border-[var(--ll-border-strong)] px-5 py-3 text-sm font-semibold text-[var(--ll-text)]"
          >
            Save progress
          </button>

          <div className="mt-8 space-y-4">
            <h3 className="text-lg font-semibold text-slate-100">Analysis Questions</h3>
            {analysisQuestions.map((question, index) => (
              <label key={`${question.question}-${index}`} className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">{question.question}</span>
                <textarea
                  rows={4}
                  value={analysisAnswers[index] ?? ""}
                  onChange={(event) => setAnalysisAnswers((current) => ({ ...current, [index]: event.target.value }))}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                />
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={submitLab}
            disabled={submitting}
            className="ll-interactive mt-5 rounded-xl bg-[var(--ll-accent)] px-5 py-3 text-sm font-semibold text-slate-950 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Submitting Lab..." : "Submit Lab"}
          </button>
        </section>
      ) : null}

      {statusMessage ? (
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          {statusMessage}
        </div>
      ) : null}

      {completed ? (
        <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
          Lab submitted. Your teacher will review your observations.
        </div>
      ) : null}
    </div>
  );
}
