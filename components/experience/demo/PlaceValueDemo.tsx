"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronRight, Pause, Volume2 } from "lucide-react";
import { FocusedHeader, LearningStage, StageFooter } from "@/components/experience/FocusedLearning";
import { LearnerTask, TeachingPoints, TeachingScene, WorkedExample } from "@/components/experience/TeachingScene";
import { StateNotice } from "@/components/experience/StateNotice";
import { Chip } from "@/components/experience/Frame";
import { NumberBuilder, PlaceValueChart } from "./PlaceValueTools";
import { formatNumber } from "@/lib/learner-experience/demo/placeValue";

/**
 * DEMO — Grade 7 Number Sense: Place value (Student Experience V3 design preview).
 *
 * Synthetic preview content, clearly labelled. It is NOT a released or governed Grade 7 lesson, is not
 * delivered through the lesson delivery seam, makes no network request, writes no storage, sends no
 * evidence, records no completion and never changes mastery. Practice answers are checked on this
 * device only so the feedback pattern can be reviewed.
 */

type Practice = { id: string; prompt: string; options: string[]; correct: number; why: string; misconception: Record<number, string> };
const PRACTICE: Practice[] = [
  { id: "q1", prompt: "What is the value of the 7 in 1,742,009?", options: ["7,000", "700,000", "70,000"], correct: 1, why: "The 7 is in the hundred-thousands place, so it is worth 7 × 100,000 = 700,000.", misconception: { 0: "7,000 would need the 7 in the thousands place. Count the places from the right: ones, tens, hundreds, thousands, ten thousands, hundred thousands.", 2: "70,000 is one place too far right. The 7 sits next to the millions digit." } },
  { id: "q2", prompt: "Which is 3,060,500 in expanded form?", options: ["3,000,000 + 60,000 + 500", "3,000,000 + 600,000 + 50", "300,000 + 60,000 + 500"], correct: 0, why: "3 millions, 6 ten-thousands and 5 hundreds. Zeros hold the empty places and are not written in expanded form.", misconception: { 1: "Check where the 6 is: it is in the ten-thousands place, not the hundred-thousands place.", 2: "The first digit is in the millions place, so it is worth 3,000,000." } },
  { id: "q3", prompt: "Which number is “five million, forty thousand, nine”?", options: ["5,409", "5,400,009", "5,040,009"], correct: 2, why: "Five million → 5,000,000; forty thousand → 40,000; nine → 9. Together: 5,040,009.", misconception: { 0: "Each group name (million, thousand) needs its own group of three digits.", 1: "“Forty thousand” is 40,000, not 400,000." } },
];

const SCENES = [
  { id: "intro", kind: "Introduction", title: "Big numbers are all around us" },
  { id: "explain", kind: "Learn", title: "Every place is worth ten times more" },
  { id: "build", kind: "Explore", title: "Build a number" },
  { id: "example", kind: "Worked example", title: "Musu's library fund" },
  { id: "practice", kind: "Practice", title: "Your turn" },
  { id: "review", kind: "Review", title: "Key ideas" },
] as const;

const NARRATION: Record<(typeof SCENES)[number]["id"], string> = {
  intro: "Big numbers are all around us. A school raising money, a county's population, the cost of building a road. Today you will read numbers up to the millions and explain what each digit is worth.",
  explain: "Every place is worth ten times the place to its right. Group the digits in threes from the right: ones, thousands, millions. In 4,205,316 the 4 is in the millions place, so it is worth 4 million.",
  build: "Build a number. Use the plus and minus buttons to change each digit. Watch the expanded form and the number in words change with it.",
  example: "Musu's school collected 2,350,480 Liberian dollars. What is the value of the digit 3? Find the 3. It is in the hundred-thousands place. Its value is 3 times 100,000, which is 300,000.",
  practice: "Your turn. Answer three questions. Each answer is checked on this device so you can see why.",
  review: "Key ideas. The value of a digit depends on its place. Each place is ten times the place to its right. Group digits in threes to read large numbers.",
};

/** Read aloud with this device's own voice, only when the browser offers one. Never autoplays. */
function ReadAloud({ text, sceneId }: { text: string; sceneId: string }) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => { setSupported(typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance === "function"); }, []);
  // Stop on scene change and when leaving: narration never carries over to a different scene.
  useEffect(() => () => { if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); setSpeaking(false); }, [sceneId]);
  if (supported === null) return null;
  if (!supported) return <p className="text-sm text-[var(--ll-text-muted)]">Read aloud is not available on this device. All narration is shown as text.</p>;
  const toggle = () => {
    if (speaking) { window.speechSynthesis.cancel(); setSpeaking(false); return; }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  };
  return <div className="grid gap-2">
    <button type="button" className="ll3-btn w-full" aria-pressed={speaking} onClick={toggle}>{speaking ? <><Pause size={18} aria-hidden="true" /> Stop reading</> : <><Volume2 size={18} aria-hidden="true" /> Read this scene aloud</>}</button>
    <p className="text-sm text-[var(--ll-text-muted)]">Uses this device&apos;s voice. Some voices need a connection. The same words are on the screen.</p>
  </div>;
}

export function PlaceValueDemo() {
  const [index, setIndex] = useState(0);
  const [built, setBuilt] = useState(2_350_480);
  const [explored, setExplored] = useState(false);
  const [guidedStep, setGuidedStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [finished, setFinished] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const [footerHeight, setFooterHeight] = useState(96);
  const footerObserver = useRef<ResizeObserver | null>(null);
  const footerRef = useCallback((node: HTMLElement | null) => {
    footerObserver.current?.disconnect();
    if (!node) return;
    const sync = () => setFooterHeight(Math.ceil(node.getBoundingClientRect().height));
    sync();
    if (typeof ResizeObserver === "function") { footerObserver.current = new ResizeObserver(sync); footerObserver.current.observe(node); }
  }, []);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
    window.scrollTo({ top: 0 });
  }, [index]);

  const scene = SCENES[index];
  const answeredAll = PRACTICE.every((question) => answers[question.id] !== undefined);
  const correctCount = PRACTICE.filter((question) => answers[question.id] === question.correct).length;
  const blocked = scene.id === "example" && guidedStep < 3 ? "Show every step of the example to continue." : scene.id === "practice" && !answeredAll ? "Answer all three questions to continue." : null;
  const isLast = index === SCENES.length - 1;
  const titleId = "demo-scene-title";

  let content: ReactNode;
  switch (scene.id) {
    case "intro":
      content = <TeachingScene kind={scene.kind} title={scene.title} titleId={titleId} titleRef={headingRef} headingLevel={1}
        lead={<>A school raising money for books, the people living in a county, the cost of a new road: these are <strong>large numbers</strong>. Today you will read numbers up to the millions and explain what each digit is worth.</>}
        visual={<figure className="ll3-figure">
          <p className="ll3-support-label">One number, three groups</p>
          <p className="sr-only">2,350,480: 2 millions, 350 thousands, 480 ones.</p>
          <div className="ll3-pv-hero" aria-hidden="true">{[["2", "millions"], ["350", "thousands"], ["480", "ones"]].map(([digits, group]) => <div key={group}><span>{digits}</span><span>{group}</span></div>)}</div>
          <figcaption>Commas split a large number into groups of three digits, read from the left.</figcaption>
        </figure>}>
        <TeachingPoints label="In this lesson you will" items={["Read and write whole numbers up to the millions.", "Explain the value of each digit from its place.", "Write a number in expanded form and in words."]} />
      </TeachingScene>;
      break;
    case "explain":
      content = <TeachingScene kind={scene.kind} title={scene.title} titleId={titleId} titleRef={headingRef} headingLevel={1}
        lead={<>The <strong>place</strong> of a digit is its position. Its <strong>value</strong> is what it is worth in that place. Moving one place to the left multiplies the value by 10.</>}
        visual={<figure className="ll3-figure"><PlaceValueChart value={4_205_316} highlight={0} caption="Place-value chart for 4,205,316" /><figcaption>4,205,316: the 4 is in the millions place, so it is worth 4,000,000. The 0 holds the ten-thousands place.</figcaption></figure>}>
        <TeachingPoints items={["Group digits in threes from the right: ones, thousands, millions.", "Read each group, then say its group name.", "A zero holds a place that is empty."]} />
        <p className="ll3-measure text-lg leading-relaxed">Read it aloud: “four million, two hundred five thousand, three hundred sixteen”.</p>
      </TeachingScene>;
      break;
    case "build":
      content = <TeachingScene kind={scene.kind} title={scene.title} titleId={titleId} titleRef={headingRef} headingLevel={1}
        lead="Change any digit with + and −. Watch the expanded form and the words change with it."
        visual={<figure className="ll3-figure"><PlaceValueChart value={built} caption={`Place-value chart for ${formatNumber(built)}`} /><figcaption>The chart shows the value of every digit in the number you build.</figcaption></figure>}>
        <NumberBuilder value={built} onChange={(next) => { setBuilt(next); setExplored(true); }} />
        <LearnerTask label="Try this"><p>Make the number <strong>5,040,009</strong>. Which places hold zeros?</p></LearnerTask>
        {explored && <p className="text-sm text-[var(--ll-text-muted)]">Exploring is not marked. Your number stays only on this page.</p>}
      </TeachingScene>;
      break;
    case "example": {
      const steps = ["Find the 3. Count places from the left: millions (2), then hundred thousands (3).", "The 3 is in the hundred-thousands place.", "Its value is 3 × 100,000 = 300,000. The 3 is worth three hundred thousand Liberian dollars."];
      content = <TeachingScene kind={scene.kind} title={scene.title} titleId={titleId} titleRef={headingRef} headingLevel={1}
        lead={<>Musu&apos;s school collected <strong>L$2,350,480</strong> for a new library. What is the value of the digit 3?</>}
        visual={<figure className="ll3-figure"><PlaceValueChart value={2_350_480} highlight={guidedStep >= 2 ? 1 : null} caption="Place-value chart for 2,350,480" /><figcaption>{guidedStep >= 2 ? "The 3 is marked in the hundred-thousands place." : "Show the steps to find the 3 in the chart."}</figcaption></figure>}>
        <WorkedExample label="Step by step" steps={steps.slice(0, guidedStep)} />
        <div aria-live="polite" className="sr-only">{guidedStep > 0 ? `Step ${guidedStep}: ${steps[guidedStep - 1]}` : ""}</div>
        {guidedStep < steps.length
          ? <div><button type="button" className="ll3-btn" data-primary="" onClick={() => setGuidedStep((step) => step + 1)}>Show step {guidedStep + 1} of {steps.length}</button></div>
          : <p className="flex items-center gap-2 font-semibold text-[var(--ll-success)]"><Check size={18} aria-hidden="true" /> All steps shown</p>}
      </TeachingScene>;
      break;
    }
    case "practice":
      content = <TeachingScene kind={scene.kind} title={scene.title} titleId={titleId} titleRef={headingRef} headingLevel={1}
        lead="Answer each question. You will see why each answer is right or not.">
        <StateNotice kind="preview" compact title="Checked on this device · demo only">These answers are not sent, saved or marked, and they do not change your mastery.</StateNotice>
        <div className="grid gap-5">
          {PRACTICE.map((question, questionIndex) => {
            const chosen = answers[question.id];
            const answered = chosen !== undefined;
            const right = chosen === question.correct;
            return <fieldset key={question.id} className="ll3-panel grid gap-3" data-practice={question.id}>
              <legend className="sr-only">Question {questionIndex + 1}: {question.prompt}</legend>
              <p aria-hidden="true" className="text-lg font-semibold leading-snug">{questionIndex + 1}. {question.prompt}</p>
              <div className="grid gap-2">{question.options.map((option, optionIndex) => <label key={option} className="ll3-choice" data-selected={chosen === optionIndex ? "" : undefined}>
                <input type="radio" name={question.id} checked={chosen === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))} />
                <span>{option}</span>
              </label>)}</div>
              <p role="status" className={answered ? "ll3-feedback" : "sr-only"} data-result={answered ? (right ? "right" : "retry") : undefined}>
                {!answered ? "" : right ? <><strong>Correct.</strong> {question.why}</> : <><strong>Not yet.</strong> {question.misconception[chosen] ?? question.why} Try another answer.</>}
              </p>
            </fieldset>;
          })}
        </div>
      </TeachingScene>;
      break;
    case "review":
      content = <TeachingScene kind={scene.kind} title={scene.title} titleId={titleId} titleRef={headingRef} headingLevel={1}
        lead="Three ideas to remember from this lesson.">
        <TeachingPoints label="Key takeaways" items={["The value of a digit depends on its place.", "Each place is worth ten times the place to its right.", "Group digits in threes to read large numbers: millions, thousands, ones."]} />
        <p className="text-base">Your practice answers now: {correctCount} of {PRACTICE.length} correct. This demo does not keep that result.</p>
        {finished && <StateNotice kind="preview" title="Demo finished">Nothing was saved, sent or marked. A released lesson would hand your work to your school&apos;s systems; this preview does not.</StateNotice>}
      </TeachingScene>;
      break;
  }

  const support = <>
    <section aria-labelledby="demo-about"><h2 id="demo-about">About this demo</h2>
      <p className="mt-2 text-[15px] leading-6">Synthetic Grade 7 preview content showing the V3 lesson layout. It is not a released lesson. No answers, progress or completion are recorded.</p>
    </section>
    <section aria-labelledby="demo-listen"><h2 id="demo-listen">Listen</h2><div className="mt-2"><ReadAloud text={NARRATION[scene.id]} sceneId={scene.id} /></div></section>
    <section aria-labelledby="demo-goal"><h2 id="demo-goal">This scene helps you</h2>
      <p className="mt-2 text-[15px] leading-6">{scene.id === "practice" || scene.id === "review" ? "Explain the value of each digit from its place." : scene.id === "build" ? "Write a number in expanded form and in words." : "Read and write whole numbers up to the millions."}</p>
    </section>
  </>;

  return <div className="ll3-scope ll3-focus" data-age-band="middle" data-demo-lesson data-scene-id={scene.id}>
    <FocusedHeader backHref="/student/learn" backLabel="Back to Learn" title="Place value: reading large numbers"
      context="Grade 7 · Mathematics · Number sense"
      extra={<Chip tone="demo">DEMO · not a released lesson</Chip>}
      progress={{ value: ((index + 1) / SCENES.length) * 100, label: "Position in this demo" }} />
    <LearningStage bottomSpace={footerHeight} mainLabelledBy={titleId} supportLabel="Lesson help" support={support}
      outline={<ol className="ll3-outline-list">{SCENES.map((candidate, position) => <li key={candidate.id}>
        <button type="button" aria-current={position === index ? "step" : undefined} data-done={position < index ? "" : undefined} onClick={() => setIndex(position)} disabled={position > index && Boolean(blocked)}>
          <span className="ll3-outline-num" aria-hidden="true">{position < index ? <Check size={14} /> : position + 1}</span><span className="min-w-0">{candidate.title}</span>
        </button>
      </li>)}</ol>}>
      {index === 0 && <div className="mb-6"><StateNotice kind="preview" title="Design demo with synthetic content">This preview shows how a Grade 7 lesson can teach with visuals and practice. It is not an authorized Grade 7 lesson: nothing here is saved, sent, marked or counted as completion or mastery.</StateNotice></div>}
      {content}
    </LearningStage>
    <StageFooter footerRef={footerRef} index={index} total={SCENES.length}
      onPrevious={() => setIndex((current) => Math.max(0, current - 1))} previousDisabled={index === 0}
      hint={blocked ?? undefined} hintId="demo-continue-hint"
      states={SCENES.map((_, position) => position < index ? "done" : position === index ? "current" : "todo")}
      next={isLast
        ? <button type="button" className="ll3-btn" data-primary="" disabled={finished} onClick={() => setFinished(true)}>{finished ? "Demo finished" : "Finish demo"} <Check size={18} aria-hidden="true" /></button>
        : <button type="button" className="ll3-btn" data-primary="" disabled={Boolean(blocked)} aria-describedby={blocked ? "demo-continue-hint" : undefined} onClick={() => setIndex((current) => current + 1)}>Continue <ChevronRight size={18} aria-hidden="true" /></button>} />
  </div>;
}
