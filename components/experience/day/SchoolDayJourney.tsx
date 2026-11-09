"use client";

/**
 * One learner's school day (school-day/1.0.0). The age band changes the interface, not the facts:
 * K-2 sees one picture card at a time with read-aloud; 3-5 a now/next timeline; 6-8 a period list beside the
 * current period; 9-12 a full timetable. Every lesson opens in the one lesson player through `lessonHref`.
 * All state here is React memory only: no attendance, completion, grade or mastery is read from or written to
 * any record by this component. A period with no approved lesson shows the resolved day's own label, never filler.
 */
import "./day.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Calculator, Clock, Code, FlaskConical, Landmark, LifeBuoy, Map as MapIcon, Palette, Sparkles, Sprout, Sun, Users, Utensils, Volume2, Wrench } from "lucide-react";
import { blockAt, courseName, dayCoverage, type DayBlock, type Practice, type SchoolDay } from "@/lib/learner-experience/day/schoolDay";

export type LessonLink = Readonly<{ href: string | null; unavailable: string | null }>;
export type DayAttendance = Readonly<{ status: "PRESENT" | "LATE" | "ABSENT" | "EXCUSED" | "NOT_RECORDED"; note: string }>;
type Props = {
  day: SchoolDay;
  /** Server-resolved per block id: a playable player route, or why the bound lesson cannot open here. */
  lessons: Readonly<Record<string, LessonLink>>;
  attendance: DayAttendance;
  /** "HH:MM" to pin the school clock (reviewer rehearsal); omitted, the device clock is used. */
  clockAt?: string | null;
  /** B1/B2: the period to open when returning from a lesson (validated by the route against the admitted day). */
  initialBlockId?: string | null;
  initialAnnouncement?: string | null;
  /** The period whose lesson was just finished or left (from ?after / ?at), counted as opened in this browser session. */
  returnedFromBlockId?: string | null;
  /**
   * Plan + hashed signed-in user: scopes the display-only browser-session state (periods opened, day ended) in
   * sessionStorage. Never sent anywhere and never a completion record; without it, state stays in memory.
   */
  sessionKey?: string | null;
};

type DaySession = { opened: string[]; ended: boolean };
const sessionStorageKey = (key: string) => `ll-day-session:${key}`;
function readDaySession(key: string | null): DaySession | null {
  if (!key) return null;
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(sessionStorageKey(key)) ?? "null");
    if (!raw || !Array.isArray(raw.opened)) return null;
    return { opened: raw.opened.filter((id: unknown): id is string => typeof id === "string").slice(0, 64), ended: raw.ended === true };
  } catch { return null; }
}
function writeDaySession(key: string | null, value: DaySession) {
  if (!key) return;
  try { window.sessionStorage.setItem(sessionStorageKey(key), JSON.stringify(value)); } catch { /* memory only */ }
}
/** True only when this page load is a browser reload (Navigation Timing Level 2); false when unknown. */
function isReloadNavigation(): boolean {
  try {
    const entry = performance.getEntriesByType("navigation")[0] as { type?: string } | undefined;
    return entry?.type === "reload";
  } catch { return false; }
}
const toMinutes = (hhmm: string) => (/^\d{2}:\d{2}$/.test(hhmm) ? Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) : null);
/** Pilot periods are not time-gated: say so outside the day, and say "Between periods" in a gap (never "over"). */
function nowFallback(day: SchoolDay, now: string, phase: string): string {
  if (day.source === "PILOT_TIMETABLE") {
    const at = toMinutes(now), first = toMinutes(day.blocks[0]?.start ?? ""), last = toMinutes(day.blocks[day.blocks.length - 1]?.end ?? "");
    if (at !== null && first !== null && last !== null) return at < first || at >= last ? "Outside school hours. Your periods are open for practice." : "Between periods.";
  }
  return phase === "BEFORE_SCHOOL" ? "School has not started yet." : "School is over for today.";
}

const ICONS: Record<string, typeof BookOpen> = { MATH: Calculator, SCIENCE: FlaskConical, BIOLOGY: Sprout, CHEMISTRY: FlaskConical, PHYSICS: Sparkles, ENGLISH: BookOpen,
  CIVICS: MapIcon, SOCIAL_STUDIES: Landmark, COMPUTING: Code, COMPUTER_SCIENCE: Code, ENGINEERING: Wrench, ARTS_PE: Palette, ARTS: Palette };
const KIND_ICON = { ARRIVAL: Sun, ASSEMBLY: Users, BREAK: Sun, LUNCH: Utensils, SUPPORT: LifeBuoy, END_OF_DAY: Sparkles, DISMISSAL: Clock, PERIOD: Clock } as const;
const PRACTICE_LABEL: Record<Practice, string> = { CONCEPT: "Explore", GUIDED: "Guided practice", INDEPENDENT: "On your own", EXTENSION: "Challenge", REFLECTION: "Think back" };
const STAGE_LABEL: Record<string, string> = { PLANNED: "planned", GENERATED: "generated, not yet checked", FACTORY_VALIDATED: "checked by the factory, not approved" };
const YOUNG_PRACTICE: Record<Practice, string> = { CONCEPT: "Look", GUIDED: "Try with help", INDEPENDENT: "Try alone", EXTENSION: "Big challenge", REFLECTION: "Tell" };

export function blockTitle(block: DayBlock) {
  if (block.kind !== "PERIOD") return { ARRIVAL: "Arrival", ASSEMBLY: "Assembly", BREAK: "Break", LUNCH: "Lunch", SUPPORT: "Support time", END_OF_DAY: "End of the day", DISMISSAL: "Going home" }[block.kind];
  return courseName(block.course) ?? block.slot;
}
const clockNow = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };

export function SchoolDayJourney({ day, lessons, attendance, clockAt = null, initialBlockId = null, initialAnnouncement = null, returnedFromBlockId = null, sessionKey = null }: Props) {
  const [now, setNow] = useState(clockAt ?? "07:30");
  useEffect(() => {
    if (clockAt) { setNow(clockAt); return; }
    setNow(clockNow());
    const timer = window.setInterval(() => setNow(clockNow()), 30_000);
    return () => window.clearInterval(timer);
  }, [clockAt]);
  const { current, next, phase } = blockAt(day, now);
  const [selectedId, setSelectedId] = useState<string | null>(initialBlockId && day.blocks.some((b) => b.id === initialBlockId) ? initialBlockId : null);
  const selected = day.blocks.find((b) => b.id === (selectedId ?? current?.id)) ?? current ?? day.blocks[0];
  const [checks, setChecks] = useState<Record<string, readonly number[]>>({});
  const [visited, setVisited] = useState<readonly string[]>([]);
  const [reflection, setReflection] = useState("");
  const [ended, setEndedState] = useState(false);
  // Display-only: periods whose lesson was opened in THIS browser session (each Finish is a new page load).
  const [opened, setOpened] = useState<readonly string[]>([]);
  const session = useRef<DaySession>({ opened: [], ended: false });
  const persist = (next: DaySession) => { session.current = next; setOpened(next.opened); setEndedState(next.ended); writeDaySession(sessionKey, next); };
  useEffect(() => {
    const stored = readDaySession(sessionKey) ?? { opened: [], ended: false };
    const known = (id: string | null) => !!id && day.blocks.some((b) => b.id === id);
    const opened = known(returnedFromBlockId) && !stored.opened.includes(returnedFromBlockId!) ? [...stored.opened, returnedFromBlockId!] : stored.opened;
    // Returning from a lesson continues the day: the end-of-day view only reopens when chosen again. A RELOAD of the
    // return URL (?after=/?at= persist in the address) is not a new return, so it keeps the stored end-of-day state
    // (Atlas Phase 2 browser P2). Without Navigation Timing, every load is treated as a fresh return (previous behaviour).
    const freshReturn = !!returnedFromBlockId && !isReloadNavigation();
    persist({ opened: opened.filter((id) => known(id)), ended: freshReturn ? false : stored.ended });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per page load and session key
  }, [sessionKey, day.planId]);
  const setEnded = (value: boolean) => persist({ ...session.current, ended: value });
  const recordOpened = (blockId: string) => { if (!session.current.opened.includes(blockId)) persist({ ...session.current, opened: [...session.current.opened, blockId] }); };
  const [announce, setAnnounce] = useState(initialBlockId && initialAnnouncement ? initialAnnouncement : "");
  const detailHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { setVisited((v) => (v.includes(selected.id) ? v : [...v, selected.id])); }, [selected.id]);
  const young = day.band === "K_2";
  const coverage = useMemo(() => dayCoverage(day), [day]);
  const index = day.blocks.findIndex((b) => b.id === selected.id);

  const go = (block: DayBlock, how: "jump" | "next") => {
    setSelectedId(block.id); setEnded(false);
    setAnnounce(`${how === "next" ? "Moved on to" : "Showing"} ${blockTitle(block)}, ${block.start} to ${block.end}.`);
    window.requestAnimationFrame(() => detailHeading.current?.focus());
  };
  const toggle = (blockId: string, i: number) => setChecks((c) => {
    const have = c[blockId] ?? [];
    return { ...c, [blockId]: have.includes(i) ? have.filter((x) => x !== i) : [...have, i] };
  });

  return (
    <div className="ll7-day ll3-scope" data-school-day={day.planId} data-day-band={day.band} data-age-band={day.ageBand} data-day-source={day.source} data-clock={now}>
      <header className="ll7-day-head">
        <p className="ll7-day-eyebrow">{day.gradeLabel ? `Grade ${day.gradeLabel} · ` : ""}{day.section ? `Section ${day.section} · ` : ""}School day</p>
        <h1 className="ll7-day-title">{young ? "My school day" : day.theme ? day.theme.title : "Today at school"}</h1>
        <p className="ll7-day-rehearsal" role="note">Rehearsal day. Nothing here is saved, graded or sent to your school record.</p>
        <dl className="ll7-day-status">
          <div><dt>Attendance</dt><dd data-attendance={attendance.status}>{attendance.status === "NOT_RECORDED" ? "Not recorded here" : attendance.status.toLowerCase()} · {attendance.note}</dd></div>
          <div><dt>School clock</dt><dd>{now}{clockAt ? " (rehearsal time)" : ""}</dd></div>
          {!young && <div><dt>Today</dt><dd>{coverage.lessons} lesson periods · {coverage.gaps} without a lesson yet{coverage.teacherLed ? ` · ${coverage.teacherLed} teacher-led` : ""}</dd></div>}
        </dl>
      </header>

      <section className="ll7-day-now" aria-labelledby="day-now-title" data-day-now={current?.slot ?? phase}>
        <h2 id="day-now-title" className="ll7-sr">Now and next</h2>
        <NowCard label="Now" block={current} fallback={nowFallback(day, now, phase)} young={young} />
        <NowCard label="Next" block={next} fallback="Nothing else today." young={young} />
        {current && selected.id !== current.id && <button type="button" className="ll3-btn" onClick={() => go(current, "jump")}>Go to now</button>}
      </section>

      <div className="ll7-day-body">
        <nav className="ll7-day-schedule" aria-label="Today's schedule">
          {day.band === "G9_12" ? <ScheduleTable day={day} selectedId={selected.id} currentId={current?.id ?? null} visited={visited} onPick={(b) => go(b, "jump")} />
            : <ol className={`ll7-day-list ll7-day-list--${day.band}`}>
              {day.blocks.filter((b) => !young || b.kind !== "ARRIVAL").map((b) => {
                const Icon = (b.kind === "PERIOD" && b.course ? ICONS[b.course] : null) ?? KIND_ICON[b.kind];
                return <li key={b.id}>
                  <button type="button" className="ll7-day-slot" aria-current={b.id === selected.id ? "step" : undefined} data-slot={b.slot} data-now={b.id === current?.id ? "" : undefined}
                    data-binding={b.binding.kind} onClick={() => go(b, "jump")}>
                    <Icon aria-hidden="true" className="ll7-day-icon" />
                    <span className="ll7-day-slot-text"><span className="ll7-day-slot-name">{blockTitle(b)}</span>
                      <span className="ll7-day-slot-time">{b.start}{young ? "" : `–${b.end}`}{b.id === current?.id ? " · now" : ""}</span></span>
                    {visited.includes(b.id) && b.id !== selected.id && <span className="ll7-sr"> (looked at)</span>}
                  </button>
                </li>;
              })}
            </ol>}
        </nav>

        <section className="ll7-day-detail" aria-labelledby="day-detail-title" data-day-detail={selected.slot}>
          <p className="ll7-day-eyebrow">{selected.label ?? (selected.slot.startsWith("P") ? `Period ${selected.slot.slice(1)}` : blockTitle(selected))}{selected.start ? ` · ${selected.start}–${selected.end}` : ""}</p>
          <h2 id="day-detail-title" ref={detailHeading} tabIndex={-1} className="ll7-day-detail-title">{blockTitle(selected)}{selected.unit && !young ? `: ${selected.unit.title}` : ""}</h2>
          {young && <ReadAloud text={readAloudText(selected)} />}
          <BlockBody block={selected} link={lessons[selected.id]} young={young} checks={checks[selected.id] ?? []} onToggle={(i) => toggle(selected.id, i)} onOpen={() => recordOpened(selected.id)} />
          <div className="ll7-day-move">
            {index > 0 && <button type="button" className="ll3-btn" onClick={() => go(day.blocks[index - 1], "jump")}>← {blockTitle(day.blocks[index - 1])}</button>}
            {index < day.blocks.length - 1
              ? <button type="button" className="ll3-btn" data-primary="" onClick={() => go(day.blocks[index + 1], "next")} data-day-next>{young ? "Next" : `Next: ${blockTitle(day.blocks[index + 1])} at ${day.blocks[index + 1].start}`} →</button>
              : <button type="button" className="ll3-btn" data-primary="" onClick={() => { setEnded(true); setAnnounce("End of the day. Time to look back."); }} data-day-end>End my day</button>}
          </div>
        </section>
      </div>

      {ended && <EndOfDay day={day} lessons={lessons} young={young} opened={opened} checks={checks} reflection={reflection} onReflection={setReflection} />}
      <p className="ll7-sr" aria-live="polite">{announce}</p>
    </div>
  );
}

function NowCard({ label, block, fallback, young }: { label: string; block: DayBlock | null; fallback: string; young: boolean }) {
  const Icon = block ? (block.kind === "PERIOD" && block.course ? ICONS[block.course] : null) ?? KIND_ICON[block.kind] : Clock;
  return <div className="ll7-day-nowcard" data-label={label}>
    <Icon aria-hidden="true" className="ll7-day-icon" />
    <p><span className="ll7-day-eyebrow">{label}</span><br /><strong>{block ? blockTitle(block) : fallback}</strong>{block && <span className="ll7-day-slot-time">{young ? ` at ${block.start}` : ` · ${block.start}–${block.end}`}</span>}</p>
  </div>;
}

function readAloudText(block: DayBlock) {
  const what = block.binding.kind === "LESSON" ? "Your lesson is ready on the screen." : block.binding.kind === "GAP" ? "Your teacher will lead this time." : block.binding.kind === "TEACHER_LED" ? "Your teacher will lead this time." : "";
  return `${blockTitle(block)}. It starts at ${block.start}. ${what}`;
}

/** Audio-assisted instructions for K-2, using the device's own speech (works offline where the device supports it). */
function ReadAloud({ text }: { text: string }) {
  const [supported, setSupported] = useState(false);
  useEffect(() => { setSupported(typeof window !== "undefined" && "speechSynthesis" in window); }, []);
  if (!supported) return <p className="ll7-day-note">Ask your teacher to read this with you.</p>;
  return <button type="button" className="ll3-btn ll7-day-listen" onClick={() => { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(text)); }}>
    <Volume2 aria-hidden="true" size={22} /> Listen
  </button>;
}

function BlockBody({ block, link, young, checks, onToggle, onOpen }: { block: DayBlock; link: LessonLink | undefined; young: boolean; checks: readonly number[]; onToggle: (i: number) => void; onOpen?: () => void }) {
  const b = block.binding;
  const unit = block.unit && <p className="ll7-day-unit">{young ? block.unit.title : <>Unit {block.unit.number}: {block.unit.title}{block.unit.performanceTask ? <> · <span className="ll7-day-muted">Unit task: {block.unit.performanceTask}</span></> : null}</>}</p>;
  if (b.kind === "NON_INSTRUCTIONAL") return <p className="ll7-day-note">{block.kind === "ARRIVAL" ? "Arrive, greet your teacher and get ready." : block.kind === "DISMISSAL" ? "Pack up and go home safely." : "Rest, eat and move."}</p>;
  const stage = block.stage && !young && <p className="ll7-day-muted ll7-day-stage" data-day-stage={block.stage.stage}>
    Stage: {STAGE_LABEL[block.stage.stage] ?? block.stage.stage.toLowerCase().replaceAll("_", " ")}{block.stage.g3 && block.stage.g3 !== "-" ? ` · quality check ${block.stage.g3.replace("G3_", "").toLowerCase()}` : ""}{block.stage.humanSubjectExpert === "NOT_PERFORMED" ? " · not yet reviewed by a subject expert" : ""}</p>;
  if (b.kind === "TEACHER_LED") return <>{unit}<p className="ll7-day-note" data-day-teacher-led>{b.label}.{b.activity ? ` ${b.activity}` : ""}</p></>;
  if (b.kind === "GAP") return <>{unit}<p className="ll7-day-gap" data-day-gap data-day-order={b.order?.orderId}>{b.label}.</p>{b.teacherLed && !young && <p className="ll7-day-muted">{b.teacherLed}</p>}{stage}</>;
  const groups = (["CONCEPT", "GUIDED", "INDEPENDENT", "EXTENSION", "REFLECTION"] as const).map((p) => [p, block.segments.map((s, i) => ({ s, i })).filter(({ s }) => s.practice === p)] as const).filter(([, rows]) => rows.length);
  return <>
    {unit}
    <div className="ll7-day-lesson" data-day-lesson={b.selection} data-package-hash={b.packageHash}>
      <p><strong>{b.title ?? "Today's lesson"}</strong></p>
      <p className="ll7-day-muted">{b.studentLabel}{b.provisional ? " · draft package may still change" : ""}</p>
      {!young && <p className="ll7-day-muted ll7-day-hash">Version {b.version} · package {b.packageHash.slice(0, 12)}</p>}
      {stage}
      {b.replacementOrder && !young && <p className="ll7-day-muted" data-day-replacement={b.replacementOrder.orderId}>An improved version of this lesson is on order. It will take this period when it passes review.</p>}
      {link?.href ? <a className="ll3-btn ll7-day-open" data-primary="" href={link.href} onClick={onOpen} data-day-open>{young ? "Start" : "Open lesson"}</a>
        : <p className="ll7-day-gap" data-day-unavailable>{link?.unavailable ?? "This lesson cannot open here yet."}</p>}
    </div>
    {groups.length > 0 && <div className="ll7-day-plan">
      <h3>{young ? "What we will do" : "Inside this period"}</h3>
      <p className="ll7-day-muted">Tick what you did. This list is only for you and clears when you close the page.</p>
      {groups.map(([practice, rows]) => <fieldset key={practice} className="ll7-day-group" data-practice={practice}>
        <legend>{(young ? YOUNG_PRACTICE : PRACTICE_LABEL)[practice]}{practice === "EXTENSION" ? " (extension)" : ""}</legend>
        {rows.map(({ s, i }) => <label key={i} className="ll7-day-step">
          <input type="checkbox" checked={checks.includes(i)} onChange={() => onToggle(i)} />
          <span>{s.what}{s.minutes && !young ? <span className="ll7-day-muted"> · about {s.minutes} min (planned)</span> : null}</span>
        </label>)}
      </fieldset>)}
    </div>}
    {!young && <p className="ll7-day-muted ll7-day-support"><LifeBuoy aria-hidden="true" size={16} /> Stuck? Use the lesson&apos;s own hints and feedback, then ask your teacher. Support time is at the end of the day.</p>}
  </>;
}

function ScheduleTable({ day, selectedId, currentId, visited, onPick }: { day: SchoolDay; selectedId: string; currentId: string | null; visited: readonly string[]; onPick: (b: DayBlock) => void }) {
  return <table className="ll7-day-table">
    <caption className="ll7-sr">Today&apos;s timetable</caption>
    <thead><tr><th scope="col">Time</th><th scope="col">Block</th><th scope="col">Unit</th><th scope="col">Lesson</th></tr></thead>
    <tbody>{day.blocks.map((b) => <tr key={b.id} data-slot={b.slot} data-now={b.id === currentId ? "" : undefined} aria-current={b.id === selectedId ? "step" : undefined}>
      <td>{b.start}–{b.end}</td>
      <th scope="row"><button type="button" className="ll7-day-tablepick" onClick={() => onPick(b)}>{blockTitle(b)}{b.id === currentId ? " · now" : ""}</button>{visited.includes(b.id) && b.id !== selectedId && <span className="ll7-sr"> (looked at)</span>}</th>
      <td>{b.unit ? `U${b.unit.number} ${b.unit.title}` : "—"}</td>
      <td data-binding={b.binding.kind}>{b.binding.kind === "LESSON" ? "Draft lesson" : b.binding.kind === "GAP" ? "No lesson yet" : b.binding.kind === "TEACHER_LED" ? "Teacher-led" : "—"}</td>
    </tr>)}</tbody>
  </table>;
}

function EndOfDay({ day, lessons, young, opened, checks, reflection, onReflection }: { day: SchoolDay; lessons: Readonly<Record<string, LessonLink>>; young: boolean; opened: readonly string[]; checks: Readonly<Record<string, readonly number[]>>; reflection: string; onReflection: (v: string) => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const lessonBlocks = day.blocks.filter((b) => b.binding.kind === "LESSON");
  // Periods with an openable lesson, and how many of them were opened in this browser session (not completion).
  const openable = day.blocks.filter((b) => lessons[b.id]?.href);
  const openedCount = openable.filter((b) => opened.includes(b.id)).length;
  const ticked = Object.values(checks).reduce((n, v) => n + v.length, 0);
  const prompt = young ? "What did you make or find out today?" : day.band === "G3_5" ? "What is one thing you learned, and one question you still have?"
    : day.band === "G6_8" ? "Which idea from today connects two subjects? What evidence did you use?" : "What did you understand well today, what needs more work, and what will you do about it?";
  return <section className="ll7-day-end" aria-labelledby="day-end-title" data-day-end-summary>
    <h2 id="day-end-title" ref={heading} tabIndex={-1}>{young ? "Look back at my day" : "End of the day"}</h2>
    <ul className="ll7-day-muted">
      <li>You opened {openedCount} of {openable.length} periods in this browser session.</li>
      <li>{lessonBlocks.length} periods had a lesson; you ticked {ticked} activit{ticked === 1 ? "y" : "ies"} on your own list.</li>
      <li>Your own list is not a record of lessons finished. Your lessons give their own feedback.</li>
    </ul>
    <label className="ll7-day-reflect"><span>{prompt}</span>
      <textarea value={reflection} onChange={(e) => onReflection(e.target.value)} rows={young ? 3 : 5} />
    </label>
    <p className="ll7-day-muted">Your reflection stays on this screen only. It is not saved or sent.</p>
  </section>;
}
