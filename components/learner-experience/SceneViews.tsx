"use client";

import { Fragment, type ReactNode } from "react";
import type { AgeBand, Scene } from "@/lib/learner-experience/types";
import type { ExperienceProgress } from "@/lib/learner-experience/progress";
import { sceneBodyFor } from "@/lib/learner-experience/sceneContract";

/** Paragraphs and **bold** only, rendered as React nodes (no HTML injection). */
export function SceneText({ text }: { text: string }) {
  const inline = (line: string): ReactNode[] => line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={index} className="font-semibold text-[var(--ll-text)]">{part.slice(2, -2)}</strong> : <Fragment key={index}>{part}</Fragment>);
  return <>{text.split(/\n{2,}/).map((paragraph, index) => <p key={index} className="mt-4 first:mt-0 text-[1.0625rem] leading-8 text-[var(--ll-text)]">{inline(paragraph)}</p>)}</>;
}

export function SceneBody({ scene, ageBand }: { scene: Scene; ageBand: AgeBand }) {
  const { body, keyPoints } = sceneBodyFor(scene, ageBand);
  return (
    <div>
      <SceneText text={body} />
      {keyPoints.length > 0 && (
        <ul className="mt-5 space-y-3">
          {keyPoints.map((point) => (
            <li key={point} className="flex gap-3 rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-3 text-base leading-7 text-[var(--ll-text)]">
              <span aria-hidden="true" className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[var(--ll-accent)]" />
              <span><SceneText text={point} /></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** INTERACTIVE_DIAGRAM: reveal each stage in order. Buttons, not hover, so keyboard, touch and screen readers work. */
export function DiagramReveal({ scene, progress, onReveal }: { scene: Scene; progress: ExperienceProgress; onReveal: (stepId: string) => void }) {
  if (scene.interaction.kind !== "DIAGRAM_REVEAL") return null;
  const revealed = progress.revealed[scene.id] ?? [];
  const steps = scene.interaction.steps;
  const nextIndex = steps.findIndex((step) => !revealed.includes(step.id));
  return (
    <ol className="mt-6 grid gap-3" aria-label={scene.media?.[0]?.alt ?? "Diagram"}>
      {steps.map((step, index) => {
        const open = revealed.includes(step.id);
        const available = open || index === nextIndex;
        return (
          <li key={step.id} className="relative">
            <button
              type="button"
              aria-expanded={open}
              aria-controls={`step-${step.id}`}
              disabled={!available}
              onClick={() => onReveal(step.id)}
              className={`flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-base font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ll-accent)] ${open ? "border-[var(--ll-accent)] bg-[var(--ll-surface)] text-[var(--ll-text)]" : available ? "border-[var(--ll-accent)] border-dashed text-[var(--ll-text)]" : "border-[var(--ll-border)] text-[var(--ll-text-faint)]"}`}
            >
              <span aria-hidden="true" className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${open ? "bg-[var(--ll-accent)] text-[var(--ll-bg)]" : "border border-current"}`}>{index + 1}</span>
              <span className="flex-1">{step.label}</span>
              <span className="text-sm font-normal text-[var(--ll-text-muted)]">{open ? "Open" : available ? "Tap to open" : "Locked"}</span>
            </button>
            <div id={`step-${step.id}`} hidden={!open} className="mx-4 border-l-2 border-[var(--ll-accent)] px-4 py-2 text-base leading-7 text-[var(--ll-text)]">{step.description}</div>
            {index < steps.length - 1 && <div aria-hidden="true" className="ml-8 h-3 w-0.5 bg-[var(--ll-border)]" />}
          </li>
        );
      })}
    </ol>
  );
}

/** CHECK_UNDERSTANDING: formative, instant, local feedback. Not scored evidence. */
export function FormativeCheck({ scene, progress, onAnswer }: { scene: Scene; progress: ExperienceProgress; onAnswer: (itemId: string, index: number) => void }) {
  if (scene.interaction.kind !== "MULTIPLE_CHOICE") return null;
  const responses = progress.responses[scene.id] ?? {};
  return (
    <div className="mt-6 space-y-6">
      {scene.interaction.items.map((item, itemIndex) => {
        const selected = typeof responses[item.id] === "number" ? (responses[item.id] as number) : null;
        const correct = selected === item.correctIndex;
        return (
          <fieldset key={item.id} className="rounded-2xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
            <legend className="px-1 text-base font-semibold leading-7 text-[var(--ll-text)]">{itemIndex + 1}. {item.prompt}</legend>
            <div className="mt-3 grid gap-2">
              {item.options.map((option, index) => (
                <label key={option} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 text-base ${selected === index ? "border-[var(--ll-accent)] bg-[var(--ll-bg)]" : "border-[var(--ll-border)]"}`}>
                  <input type="radio" name={item.id} checked={selected === index} onChange={() => onAnswer(item.id, index)} className="h-5 w-5 accent-[var(--ll-accent)]" />
                  <span>{option}</span>
                </label>
              ))}
            </div>
            <p role="status" className={`mt-3 text-sm leading-6 ${selected === null ? "sr-only" : correct ? "text-[var(--ll-success,#4ade80)]" : "text-[var(--ll-warning,#facc15)]"}`}>
              {selected === null ? "" : item.optionFeedback?.[selected] ?? (correct ? item.feedback.correct : item.feedback.incorrect)}
            </p>
          </fieldset>
        );
      })}
    </div>
  );
}

/** REFLECTION: the learner's own words. */
export function ReflectionPrompts({ scene, progress, onWrite }: { scene: Scene; progress: ExperienceProgress; onWrite: (promptId: string, text: string) => void }) {
  if (scene.interaction.kind !== "FREE_RESPONSE") return null;
  const responses = progress.responses[scene.id] ?? {};
  return (
    <div className="mt-6 space-y-5">
      {scene.interaction.prompts.map((prompt) => {
        const value = String(responses[prompt.id] ?? "");
        const remaining = Math.max(0, prompt.minLength - value.trim().length);
        return (
          <div key={prompt.id}>
            <label htmlFor={`reflect-${prompt.id}`} className="block text-base font-semibold leading-7 text-[var(--ll-text)]">{prompt.prompt}</label>
            <textarea
              id={`reflect-${prompt.id}`}
              value={value}
              onChange={(event) => onWrite(prompt.id, event.target.value)}
              rows={4}
              aria-describedby={`reflect-${prompt.id}-hint`}
              className="mt-2 w-full rounded-xl border border-[var(--ll-border)] bg-[var(--ll-surface)] px-4 py-3 text-base leading-7 text-[var(--ll-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ll-accent)]"
            />
            <p id={`reflect-${prompt.id}-hint`} className="mt-1 text-sm text-[var(--ll-text-muted)]">{remaining > 0 ? `Write a little more (${remaining} more characters).` : "Thanks — that is enough to continue."}</p>
          </div>
        );
      })}
    </div>
  );
}

/**
 * MASTERY_CHECK → Assessment Player V2 seam. Phase A collects responses only:
 * no answer key reaches this device, nothing is scored here, and submission
 * goes through the governed evidence handoff.
 */
export function AssessmentHandoffSeam({ scene, progress, onAnswer, submitted }: { scene: Scene; progress: ExperienceProgress; onAnswer: (itemId: string, index: number) => void; submitted: boolean }) {
  if (scene.interaction.kind !== "ASSESSMENT_HANDOFF") return null;
  const responses = progress.responses[scene.id] ?? {};
  return (
    <div className="mt-6 space-y-6" data-assessment-player={scene.interaction.assessment.player}>
      {scene.interaction.assessment.items.map((item, itemIndex) => (
        <fieldset key={item.itemId} disabled={submitted} className="rounded-2xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <legend className="px-1 text-base font-semibold leading-7 text-[var(--ll-text)]">{itemIndex + 1}. {item.prompt}</legend>
          <div className="mt-3 grid gap-2">
            {item.options.map((option, index) => (
              <label key={option} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 text-base ${responses[item.itemId] === index ? "border-[var(--ll-accent)] bg-[var(--ll-bg)]" : "border-[var(--ll-border)]"}`}>
                <input type="radio" name={item.itemId} checked={responses[item.itemId] === index} onChange={() => onAnswer(item.itemId, index)} className="h-5 w-5 accent-[var(--ll-accent)]" />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
