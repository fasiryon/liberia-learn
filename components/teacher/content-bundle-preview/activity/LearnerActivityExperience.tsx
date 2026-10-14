"use client";

/**
 * Learner-facing activity experience. Receives ONLY the learner projection
 * (LearnerActivityExperience), so teacher facilitation cannot render here. All state is local
 * React state: there is no fetch, storage or submission, and nothing a learner does is recorded.
 */
import { useState } from "react";
import type { ExperienceItem, ExperienceProfile, LearnerActivityExperience, WorkedExample } from "@/lib/content-bundle/v1/activityExperience";
import { evaluateTask, type Feedback, type TaskResponse } from "@/lib/content-bundle/preview/fractionFeedback";
import { FractionPicture, SetPicker, StripPicker } from "./FractionVisuals";

const PROFILE_COPY: Readonly<Record<ExperienceProfile, { badge: string; tone: string }>> = {
  GUIDED_PRACTICE: { badge: "Guided practice · with help", tone: "guided" },
  INDEPENDENT_PRACTICE: { badge: "Independent practice · on your own", tone: "independent" },
  CLASSWORK: { badge: "Classwork · with your teacher", tone: "classwork" },
  HOMEWORK: { badge: "Homework · at home, no internet needed", tone: "homework" },
};

const COLLAB_COPY: Readonly<Record<string, string>> = { Individual: "On your own", Pair: "With a partner", "Small group": "In a small group", "Whole class": "With the whole class" };

function WorkedExampleStepper({ example }: { example: WorkedExample }) {
  const [step, setStep] = useState(0);
  const current = example.steps[step];
  const last = step === example.steps.length - 1;
  const headingId = `cbx-we-${example.exampleKey}`;
  return (
    <section className="cbx-card cbx-worked" aria-labelledby={headingId} data-testid="worked-example">
      <p className="cbx-kicker">Watch first</p>
      <h4 id={headingId} className="cbx-h4">{example.title}</h4>
      <p className="cbx-prompt">{example.prompt}</p>
      <ol className="cbx-step-dots" aria-hidden="true">
        {example.steps.map((s, i) => <li key={s.stepKey} className={i <= step ? "cbx-dot cbx-dot-on" : "cbx-dot"} />)}
      </ol>
      <div className="cbx-stage">
        <FractionPicture visual={current.visual} />
      </div>
      <p className="cbx-step-text" aria-live="polite">
        <span className="cbx-step-count">Step {step + 1} of {example.steps.length}.</span> {current.text}
      </p>
      <div className="cbx-actions">
        <button type="button" className="cbx-btn cbx-btn-quiet" onClick={() => setStep(step - 1)} disabled={step === 0}>Back</button>
        {last ? (
          <button type="button" className="cbx-btn" onClick={() => setStep(0)}>Watch again</button>
        ) : (
          <button type="button" className="cbx-btn cbx-btn-primary" onClick={() => setStep(step + 1)}>Next step</button>
        )}
      </div>
    </section>
  );
}

function initialResponse(item: ExperienceItem): TaskResponse | null {
  switch (item.task.kind) {
    case "SHADE_STRIP": case "MARK_SET": return { kind: "SELECTION", selected: [] };
    case "NAME_FRACTION": return { kind: "FRACTION", numerator: 0, denominator: 0 };
    case "EQUAL_PARTS": return { kind: "EQUAL_CHOICE", equal: null };
    case "ON_PAPER": return null;
  }
}

function Stepper({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="cbx-stepper" role="group" aria-label={label}>
      <span className="cbx-stepper-label">{label}</span>
      <div className="cbx-stepper-row">
        <button type="button" className="cbx-btn cbx-btn-icon" aria-label={`${label}: one less`} onClick={() => onChange(Math.max(0, value - 1))} disabled={value === 0}>−</button>
        <output className="cbx-stepper-value" aria-live="polite" aria-label={`${label} is ${value}`}>{value}</output>
        <button type="button" className="cbx-btn cbx-btn-icon" aria-label={`${label}: one more`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value === max}>+</button>
      </div>
    </div>
  );
}

function FeedbackLine({ feedback }: { feedback: Feedback | null }) {
  return (
    <p className={`cbx-feedback${feedback ? ` cbx-feedback-${feedback.state.toLowerCase().replace("_", "-")}` : ""}`} role="status" aria-live="polite" data-testid="item-feedback">
      {feedback ? <><span className="cbx-feedback-icon" aria-hidden="true">{feedback.state === "MATCH" ? "✓" : feedback.state === "NOT_YET" ? "↻" : "•"}</span> {feedback.message}</> : null}
    </p>
  );
}

function PracticeItem({ item, index, guided }: { item: ExperienceItem; index: number; guided: boolean }) {
  const [response, setResponse] = useState<TaskResponse | null>(() => initialResponse(item));
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [hintsShown, setHintsShown] = useState(0);
  const task = item.task;
  const headingId = `cbx-item-${item.itemKey}`;

  const update = (next: TaskResponse) => { setResponse(next); setFeedback(null); };
  const toggle = (i: number) => {
    if (response?.kind !== "SELECTION") return;
    update({ kind: "SELECTION", selected: response.selected.includes(i) ? response.selected.filter((x) => x !== i) : [...response.selected, i] });
  };
  const reset = () => { setResponse(initialResponse(item)); setFeedback(null); };
  const check = () => { if (response) setFeedback(evaluateTask(task, response)); };
  const canHint = hintsShown < item.hints.length;

  return (
    <li className="cbx-card cbx-item" aria-labelledby={headingId} data-testid="practice-item" data-task={task.kind}>
      <p className="cbx-kicker"><span className="cbx-num" aria-hidden="true">{index + 1}</span> Question {index + 1}</p>
      <p id={headingId} className="cbx-prompt">{item.prompt}</p>

      {task.kind === "SHADE_STRIP" && response?.kind === "SELECTION" ? <StripPicker parts={task.parts} selected={response.selected} onToggle={toggle} label="Strip parts. Tap a part to shade it." /> : null}
      {task.kind === "MARK_SET" && response?.kind === "SELECTION" ? <SetPicker objects={task.objects} object={task.object} groups={task.groups} selected={response.selected} onToggle={toggle} label="Set. Tap an object to mark it." /> : null}
      {task.kind === "NAME_FRACTION" && response?.kind === "FRACTION" ? (
        <div className="cbx-name">
          <div className="cbx-stage"><FractionPicture visual={task.visual} /></div>
          <div className="cbx-fraction-builder">
            <Stepper label="Top number" value={response.numerator} max={12} onChange={(n) => update({ ...response, numerator: n })} />
            <span className="cbx-fraction-bar" aria-hidden="true" />
            <Stepper label="Bottom number" value={response.denominator} max={12} onChange={(n) => update({ ...response, denominator: n })} />
          </div>
        </div>
      ) : null}
      {task.kind === "EQUAL_PARTS" && response?.kind === "EQUAL_CHOICE" ? (
        <div className="cbx-name">
          <div className="cbx-stage"><FractionPicture visual={task.visual} /></div>
          <div className="cbx-choices" role="group" aria-label="Your answer">
            <button type="button" className="cbx-choice" aria-pressed={response.equal === true} onClick={() => update({ kind: "EQUAL_CHOICE", equal: true })}>Yes, equal parts</button>
            <button type="button" className="cbx-choice" aria-pressed={response.equal === false} onClick={() => update({ kind: "EQUAL_CHOICE", equal: false })}>No, not equal parts</button>
          </div>
        </div>
      ) : null}

      <div className="cbx-actions">
        <button type="button" className="cbx-btn cbx-btn-primary" onClick={check}>Check</button>
        <button type="button" className="cbx-btn cbx-btn-quiet" onClick={reset}>Start again</button>
        {item.hints.length > 0 ? (
          <button type="button" className="cbx-btn cbx-btn-quiet" onClick={() => setHintsShown(hintsShown + 1)} disabled={!canHint} aria-describedby={`${headingId}-hints`}>
            {!canHint ? "No more hints" : guided ? `Show hint ${hintsShown + 1} of ${item.hints.length}` : "Show a hint"}
          </button>
        ) : null}
      </div>
      <FeedbackLine feedback={feedback} />
      {guided && feedback?.state === "NOT_YET" && canHint ? <p className="cbx-nudge">Stuck? Open the next hint.</p> : null}
      <ol id={`${headingId}-hints`} className="cbx-hints" aria-live="polite">
        {item.hints.slice(0, hintsShown).map((hint, i) => <li key={hint}><span className="cbx-hint-label">Hint {i + 1}</span> {hint}</li>)}
      </ol>
    </li>
  );
}

function PaperItem({ item, index }: { item: ExperienceItem; index: number }) {
  const visual = item.task.kind === "ON_PAPER" ? item.task.visual : null;
  return (
    <li className="cbx-card cbx-item cbx-item-paper" data-testid="paper-item">
      <p className="cbx-kicker"><span className="cbx-num" aria-hidden="true">{index + 1}</span> Question {index + 1} · in your exercise book</p>
      <p className="cbx-prompt">{item.prompt}</p>
      {visual ? <div className="cbx-stage"><FractionPicture visual={visual} size="sm" /></div> : null}
      {item.hints.length > 0 ? (
        <details className="cbx-details">
          <summary>Need a hint?</summary>
          <ul className="cbx-hints">{item.hints.map((h) => <li key={h}>{h}</li>)}</ul>
        </details>
      ) : null}
    </li>
  );
}

export function LearnerActivityExperience({ experience, minutes, collaboration, steps }: { experience: LearnerActivityExperience; minutes: number; collaboration: string; steps: readonly string[] }) {
  const copy = PROFILE_COPY[experience.profile];
  const guided = experience.profile === "GUIDED_PRACTICE";
  const onPaper = experience.items.every((it) => it.task.kind === "ON_PAPER");
  return (
    <div className={`cbx-root cbx-tone-${copy.tone}`} data-testid="learner-experience" data-profile={experience.profile}>
      <div className="cbx-hero">
        <p className="cbx-badge">{copy.badge}</p>
        <p className="cbx-goal">{experience.goal}</p>
        <ul className="cbx-meta" aria-label="About this activity">
          <li>About {minutes} minutes</li>
          <li>{COLLAB_COPY[collaboration] ?? collaboration}</li>
          {experience.offline.worksOffline ? <li data-testid="offline-badge">Works offline</li> : null}
        </ul>
        <p className="cbx-intro">{experience.intro}</p>
        <p className="cbx-purpose" role="note" data-testid="purpose-note">{experience.purposeNote}</p>
      </div>

      {steps.length > 0 ? (
        <section className="cbx-block" aria-labelledby="cbx-steps">
          <h4 id="cbx-steps" className="cbx-h4">What to do</h4>
          <ol className="cbx-numbered" data-testid="learner-steps">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
        </section>
      ) : null}

      {experience.materials.length > 0 ? (
        <section className="cbx-block" aria-labelledby="cbx-materials">
          <h4 id="cbx-materials" className="cbx-h4">You need</h4>
          <ul className="cbx-bullets">{experience.materials.map((m) => <li key={m}>{m}</li>)}</ul>
        </section>
      ) : null}

      {experience.roles.length > 0 ? (
        <section className="cbx-block" aria-labelledby="cbx-roles">
          <h4 id="cbx-roles" className="cbx-h4">Partner jobs</h4>
          <ul className="cbx-roles">{experience.roles.map((r) => <li key={r.role} className="cbx-role"><span className="cbx-role-name">{r.role}</span> {r.text}</li>)}</ul>
        </section>
      ) : null}

      {experience.workedExamples.map((example) => <WorkedExampleStepper key={example.exampleKey} example={example} />)}

      <section className="cbx-block" aria-labelledby="cbx-items">
        <h4 id="cbx-items" className="cbx-h4">{guided ? "Your turn, with help" : onPaper ? "Questions" : "Your turn"}</h4>
        <ol className="cbx-items">
          {experience.items.map((item, i) => (item.task.kind === "ON_PAPER" ? <PaperItem key={item.itemKey} item={item} index={i} /> : <PracticeItem key={item.itemKey} item={item} index={i} guided={guided} />))}
        </ol>
      </section>

      {experience.selfCheck.length > 0 ? (
        <section className="cbx-block" aria-labelledby="cbx-selfcheck">
          <h4 id="cbx-selfcheck" className="cbx-h4">Check your work</h4>
          <ul className="cbx-checklist">
            {experience.selfCheck.map((line, i) => (
              <li key={line}><label className="cbx-check"><input type="checkbox" name={`cbx-self-${i}`} /> <span>{line}</span></label></li>
            ))}
          </ul>
        </section>
      ) : null}

      {experience.familyNote ? <p className="cbx-family" data-testid="family-note">{experience.familyNote}</p> : null}
      <p className="cbx-offline" data-testid="offline-note">{experience.offline.note}</p>
    </div>
  );
}
