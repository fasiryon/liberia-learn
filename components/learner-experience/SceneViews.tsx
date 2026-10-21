"use client";

import { isKeylessFormative, type AgeBand, type FormativeItem, type KeylessFormativeItem, type LessonExperience, type Scene } from "@/lib/learner-experience/types";
import type { ExperienceProgress } from "@/lib/learner-experience/progress";
import { sceneBodyFor } from "@/lib/learner-experience/sceneContract";
import { InlineText } from "@/components/experience/LessonText";
import { TeachingBlockView } from "@/components/experience/teaching/TeachingBlocks";
import type { BlockDone } from "@/components/experience/teaching/v4/shared";

/** Paragraphs with inline **bold** and typeset mathematics (V4), rendered as React nodes (no HTML injection). */
export function SceneText({ text }: { text: string }) {
  return <>{text.split(/\n{2,}/).map((paragraph, index) => <p key={index} className="mt-4 max-w-[68ch] first:mt-0 text-[1.125rem] leading-8 text-[var(--ll-text)]"><InlineText text={paragraph} /></p>)}</>;
}

/**
 * Interactive Learning V4: the scene's visual teaching blocks in the text column (the scene's primary visual is
 * placed in the visual column by the player). Formative only; a finished block only opens Continue.
 */
export function SceneTeachingBlocks({ scene, onDone }: { scene: Scene; onDone: BlockDone }) {
  if (!scene.teaching || scene.teaching.blocks.length === 0) return null;
  return <div className="ll5-scene-blocks" data-phase={scene.teaching.phase}>{scene.teaching.blocks.map((block, index) => <TeachingBlockView key={`${scene.id}-${index}`} block={block} onDone={onDone} />)}</div>;
}

/** Reading passages in a lesson, by block id, for writing blocks that check quotations. */
export function teachingSources(experience: LessonExperience): Record<string, string> {
  const sources: Record<string, string> = {};
  for (const scene of experience.scenes) for (const block of [...(scene.teaching?.blocks ?? []), ...(scene.teaching?.visual ? [scene.teaching.visual] : [])]) {
    if (block.type === "READING_PASSAGE") sources[block.id] = `${block.title}. ${block.paragraphs.join(" ")}`;
  }
  return sources;
}

export function SceneBody({ scene, ageBand }: { scene: Scene; ageBand: AgeBand }) {
  const { body, keyPoints } = sceneBodyFor(scene, ageBand);
  return (
    <div>
      <SceneText text={body} />
      {keyPoints.length > 0 && (
        <ul data-key-points className="ll3-points mt-6" aria-label="Key points">
          {keyPoints.map((point, pointIndex) => (
            <li key={`${pointIndex}:${point}`}><SceneText text={point} /></li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * INTERACTIVE_DIAGRAM: reveal each stage in order. Buttons, not hover, so keyboard, touch and screen readers
 * work. On a wide stage the stages are a connected left-to-right flow (each card opens in place); on a narrow
 * one they stack with connectors. Open/next/locked is stated in text, never by colour alone.
 */
export function DiagramReveal({ scene, progress, onReveal }: { scene: Scene; progress: ExperienceProgress; onReveal: (stepId: string) => void }) {
  if (scene.interaction.kind !== "DIAGRAM_REVEAL") return null;
  const revealed = progress.revealed[scene.id] ?? [];
  const steps = scene.interaction.steps;
  const nextIndex = steps.findIndex((step) => !revealed.includes(step.id));
  const openCount = steps.filter((step) => revealed.includes(step.id)).length;
  return (
    <div className="ll4-diagram" data-diagram-reveal data-steps={steps.length}>
      <p className="ll4-diagram-meta" aria-live="polite"><span>{scene.media?.[0]?.alt ?? "Diagram"}</span><span>{openCount} of {steps.length} open</span></p>
      <ol className="ll4-diagram-steps" aria-label={scene.media?.[0]?.alt ?? "Diagram"}>
        {steps.map((step, index) => {
          const open = revealed.includes(step.id);
          const available = open || index === nextIndex;
          return (
            <li key={step.id} data-state={open ? "open" : available ? "next" : "locked"}>
              <button type="button" aria-expanded={open} aria-controls={`step-${step.id}`} disabled={!available} onClick={() => onReveal(step.id)} className="ll4-diagram-node">
                <span aria-hidden="true" className="ll4-diagram-num">{index + 1}</span>
                <span className="ll4-diagram-label">{step.label}</span>
                <span className="ll4-diagram-status">{open ? "Open" : available ? "Tap to open" : "Locked"}</span>
              </button>
              <div id={`step-${step.id}`} hidden={!open} className="ll4-diagram-text">{step.description}</div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * CHECK_UNDERSTANDING: formative, local feedback when the item carries an authored key. A keyless item
 * (server-judged delivery) records the choice and says so; the device never decides it is right or wrong.
 */
export function FormativeCheck({ scene, progress, onAnswer }: { scene: Scene; progress: ExperienceProgress; onAnswer: (itemId: string, index: number) => void }) {
  if (scene.interaction.kind !== "MULTIPLE_CHOICE") return null;
  const responses = progress.responses[scene.id] ?? {};
  const keyless = isKeylessFormative(scene.interaction);
  const items = scene.interaction.items as readonly (FormativeItem | KeylessFormativeItem)[];
  return (
    <div className="ll4-checks mt-6" data-formative-feedback={keyless ? "SERVER_REQUIRED" : "LOCAL"}>
      {items.map((item, itemIndex) => {
        const selected = typeof responses[item.id] === "number" ? (responses[item.id] as number) : null;
        const keyed = "correctIndex" in item ? item : null;
        const correct = keyed !== null && selected === keyed.correctIndex;
        return (
          <fieldset key={item.id} className="ll3-panel ll4-question">
            <legend className="ll4-question-prompt"><span className="ll4-question-num" aria-hidden="true">{itemIndex + 1}</span><span><InlineText text={item.prompt} /></span></legend>
            <div className="ll4-options">
              {item.options.map((option, index) => (
                <label key={`${index}:${option}`} className="ll3-choice" data-selected={selected === index ? "" : undefined} data-verdict={selected === index && keyed ? (correct ? "right" : "retry") : undefined}>
                  <input type="radio" name={item.id} checked={selected === index} onChange={() => onAnswer(item.id, index)} />
                  <span className="ll4-option-letter" aria-hidden="true">{String.fromCharCode(65 + index)}</span>
                  <span><InlineText text={option} /></span>
                </label>
              ))}
            </div>
            {keyed ? (
              <p role="status" className={selected === null ? "sr-only" : "ll3-feedback"} data-result={selected === null ? undefined : correct ? "right" : "retry"}>
                {selected === null ? "" : <InlineText text={keyed.optionFeedback?.[selected] ?? (correct ? keyed.feedback.correct : keyed.feedback.incorrect)} />}
              </p>
            ) : (
              <p role="status" className={selected === null ? "sr-only" : "ll3-feedback"}>
                {selected === null ? "" : "Your choice is saved. This lesson does not mark it."}
              </p>
            )}
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
 * MEDIA: text first. Every item shows its required text alternative (and transcript), so the scene teaches
 * without the asset. An image or diagram renders only from a same-origin path; other refs are never fetched.
 */
export function SceneMediaList({ scene }: { scene: Scene }) {
  if (!scene.media?.length) return null;
  return (
    <div className="mt-6 space-y-4">
      {scene.media.map((media, index) => {
        const sameOrigin = media.ref.startsWith("/") && !media.ref.startsWith("//");
        return (
          <figure key={`${media.ref}-${index}`} data-media-kind={media.kind} className="overflow-hidden rounded-2xl border border-[var(--ll-border)] bg-[var(--ll-surface)]">
            {(media.kind === "IMAGE" || media.kind === "DIAGRAM") && sameOrigin
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={media.ref} alt={media.alt} className="block h-auto w-full max-w-full" loading="lazy" />
              : null}
            <figcaption className="px-4 py-3 text-base leading-7 text-[var(--ll-text)]">
              {(media.kind === "IMAGE" || media.kind === "DIAGRAM") && sameOrigin ? <span className="sr-only">Description: </span> : <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ll-text-muted)]">{media.kind === "VIDEO" ? "Video, as text" : media.kind === "AUDIO" ? "Audio, as text" : "Picture, described"}</span>}
              <span>{media.alt}</span>
              {media.transcript && <span className="mt-2 block whitespace-pre-line text-sm leading-6 text-[var(--ll-text-muted)]">{media.transcript}</span>}
            </figcaption>
          </figure>
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
export function AssessmentHandoffSeam({ scene, progress, onAnswer, submitted, note }: { scene: Scene; progress: ExperienceProgress; onAnswer: (itemId: string, index: number) => void; submitted: boolean; note?: string }) {
  if (scene.interaction.kind !== "ASSESSMENT_HANDOFF") return null;
  const responses = progress.responses[scene.id] ?? {};
  const { assessment } = scene.interaction;
  return (
    <div className="mt-6 space-y-6" data-assessment-player={assessment.player} data-assessment-id={assessment.assessmentId} data-assessment-version={assessment.assessmentVersion} data-assessment-scoring={assessment.scoring}>
      {note && (
        <section aria-labelledby={`handoff-${scene.id}`} className="rounded-2xl border border-[var(--ll-border)] p-4">
          <h2 id={`handoff-${scene.id}`} className="text-base font-semibold text-[var(--ll-text)]">Final check · {assessment.items.length} {assessment.items.length === 1 ? "question" : "questions"}</h2>
          <p className="mt-1 text-sm leading-6 text-[var(--ll-text-muted)]">{note}</p>
        </section>
      )}
      {assessment.items.map((item, itemIndex) => (
        <fieldset key={item.itemId} disabled={submitted} className="rounded-2xl border border-[var(--ll-border)] bg-[var(--ll-surface)] p-4">
          <legend className="px-1 text-base font-semibold leading-7 text-[var(--ll-text)]">{itemIndex + 1}. {item.prompt}</legend>
          <div className="mt-3 grid gap-2">
            {item.options.map((option, index) => (
              <label key={`${index}:${option}`} className={`flex min-h-[var(--pdv2-target,48px)] cursor-pointer items-center gap-3 rounded-xl border px-4 py-2 text-base ${responses[item.itemId] === index ? "border-[var(--ll-accent)] bg-[var(--ll-bg)]" : "border-[var(--ll-border)]"}`}>
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
