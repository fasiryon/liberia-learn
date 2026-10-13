/**
 * Teacher overview of one activity experience: type, objective, duration, collaboration, flow,
 * instructions, materials, evidence intent, look-fors and misconceptions. Teacher model only.
 */
import type { TeacherMember, TeacherPreviewModel } from "@/lib/content-bundle/preview/viewModel";
import type { ActivityExperienceV1, ExperienceTask } from "@/lib/content-bundle/v1/activityExperience";
import { Chip, Code, Empty, Facts, ItemLinks, ResourceList, Section } from "../parts";
import { FractionPicture } from "./FractionVisuals";

type ActivityDetail = Extract<TeacherMember["detail"], { category: "ACTIVITY" }>;

const TASK_LABEL: Readonly<Record<ExperienceTask["kind"], string>> = {
  SHADE_STRIP: "Shade a strip (on screen)",
  MARK_SET: "Mark part of a set (on screen)",
  NAME_FRACTION: "Name the fraction shown (on screen)",
  EQUAL_PARTS: "Equal parts? (on screen)",
  ON_PAPER: "On paper or with objects",
};

const PROFILE_TONE: Readonly<Record<ActivityExperienceV1["profile"], string>> = { GUIDED_PRACTICE: "guided", INDEPENDENT_PRACTICE: "independent", CLASSWORK: "classwork", HOMEWORK: "homework" };

export function TeacherActivityGuide({ member, detail, experience, model, onSelect }: { member: TeacherMember; detail: ActivityDetail; experience: ActivityExperienceV1; model: TeacherPreviewModel; onSelect: (itemId: string) => void }) {
  const t = experience.teacher;
  const l = experience.learner;
  const flowMinutes = t.phases.reduce((n, p) => n + p.minutes, 0);
  const objectiveText = (id: string) => model.objectives.find((o) => o.objectiveId === id)?.description;
  return (
    <div className={`cbx-teacher cbx-tone-${PROFILE_TONE[experience.profile]}`} data-testid="teacher-activity-guide" data-profile={experience.profile}>
      <div className="cbx-hero">
        <p className="cbx-badge">{detail.profileLabel}</p>
        <p className="cbx-goal">{t.summary}</p>
      </div>

      <Section id="cbp-activity" title="At a glance">
        <Facts
          rows={[
            ["Activity type", <span key="t"><Chip tone="gold">{detail.profileLabel}</Chip> <span className="cbp-sub">{detail.activityType}{detail.scaffolding ? `, ${detail.scaffolding.toLowerCase()} scaffolding` : ""}</span></span>],
            ["Objective", <ul key="o" className="cbp-list" data-testid="activity-objectives">{member.objectiveIds.map((id) => <li key={id}><Code>{id}</Code>{objectiveText(id) && objectiveText(id) !== "description unavailable" ? <div>{objectiveText(id)}</div> : null}</li>)}<li className="cbp-sub">Learner goal: “{l.goal}”</li></ul>],
            ["Duration", `${detail.expectedDurationMinutes} minutes${flowMinutes !== detail.expectedDurationMinutes ? ` (lesson flow below totals ${flowMinutes})` : ""}`],
            ["Collaboration", <span key="c">{detail.collaborationMode}{t.grouping ? <div className="cbp-sub">{t.grouping}</div> : null}</span>],
            ["Evidence intent", <span key="e">{detail.evidence}<div className="cbp-sub">{t.evidenceNote}</div></span>],
            ["Extends", <ItemLinks key="x" links={detail.extendsLessons} onSelect={onSelect} />],
          ]}
        />
      </Section>

      <Section id="cbp-activity-flow" title="Lesson flow">
        <ol className="cbx-flow" data-testid="activity-flow">
          {t.phases.map((p) => (
            <li key={p.label} className="cbx-flow-step">
              <span className="cbx-flow-min">{p.minutes} min</span>
              <span><span className="cbp-strong">{p.label}.</span> {p.text}</span>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="cbp-learner-instructions" title="Student instructions">
        <ol className="cbp-steps">{detail.learnerInstructions.map((s) => <li key={s.stepId}>{s.text}{s.resources.length > 0 ? <span className="cbp-sub"> Uses: {s.resources.join(", ")}</span> : null}</li>)}</ol>
        {l.roles.length > 0 ? <p className="cbp-sub">Partner jobs: {l.roles.map((r) => `${r.role} (${r.text})`).join(" ")}</p> : null}
      </Section>

      <Section id="cbp-teacher-instructions" title="Teacher instructions (teacher only)">
        {detail.teacherInstructions.length > 0 ? <ol className="cbp-steps" data-testid="teacher-instructions">{detail.teacherInstructions.map((s) => <li key={s.stepId}>{s.text}{s.resources.length > 0 ? <span className="cbp-sub"> Uses: {s.resources.join(", ")}</span> : null}</li>)}</ol> : <Empty>No teacher instructions for this activity.</Empty>}
      </Section>

      <Section id="cbp-activity-materials" title="Materials and resources">
        {t.materials.length > 0 ? (
          <ul className="cbp-list" data-testid="activity-materials">
            {t.materials.map((m) => <li key={m.text}>{m.text} {m.required ? <Chip tone="gold">Required</Chip> : <Chip>Optional</Chip>}</li>)}
          </ul>
        ) : <Empty>No materials needed.</Empty>}
        <h4 className="cbp-h4">Bundle resources</h4>
        <ResourceList resources={detail.resources} showAudience />
      </Section>

      <Section id="cbp-activity-lookfors" title="What to look and listen for">
        <ul className="cbx-bullets">{t.lookFors.map((x) => <li key={x}>{x}</li>)}</ul>
        {t.misconceptions.length > 0 ? (
          <>
            <h4 className="cbp-h4">Common mistakes and what to do</h4>
            <ul className="cbp-list" data-testid="misconceptions">
              {t.misconceptions.map((m) => <li key={m.sign} className="cbx-misconception"><span className="cbp-strong">If you see:</span> {m.sign}<div><span className="cbp-strong">Try:</span> {m.response}</div></li>)}
            </ul>
          </>
        ) : null}
        <Facts rows={[["Support", t.differentiation.support.join(" ") || "None"], ["Extend", t.differentiation.extend.join(" ") || "None"]]} />
      </Section>

      {detail.rubric ? (
        <Section id="cbp-rubric" title="Rubric">
          <Facts rows={[["Rubric", <Code key="r">{`${detail.rubric.rubricId}@${detail.rubric.rubricVersion}`}</Code>], ["Criteria students see", detail.rubric.criteria.join("; ")], ["Scoring guide", detail.rubric.scoringGuide ?? "None"]]} />
        </Section>
      ) : null}

      <Section id="cbp-activity-items" title={`What students do (${l.workedExamples.length > 0 ? `${l.workedExamples.length} worked example, ` : ""}${l.items.length} questions)`} note="Switch to Student view to try the activity as a learner.">
        <ol className="cbx-teacher-items">
          {l.items.map((it, i) => {
            const visual = it.task.kind === "ON_PAPER" || it.task.kind === "NAME_FRACTION" || it.task.kind === "EQUAL_PARTS" ? it.task.visual : null;
            return (
              <li key={it.itemKey} className="cbx-teacher-item">
                <p className="cbp-sub">{i + 1}. {TASK_LABEL[it.task.kind]} · {it.hints.length} {it.hints.length === 1 ? "hint" : "hints"}</p>
                <p>{it.prompt}</p>
                {visual ? <FractionPicture visual={visual} size="sm" /> : null}
              </li>
            );
          })}
        </ol>
      </Section>

      <Section id="cbp-activity-alignment" title="Alignment and readiness">
        <div className="cbp-callout cbp-callout-warn" role="note" data-testid="alignment-status">
          <p><Chip tone="warn">Unreviewed candidate</Chip> Alignment refs point to real repository records. They are not approval, review or release.</p>
        </div>
        <Facts
          rows={[
            ["Candidate MOE objective", t.alignment.candidateObjectiveRefs.map((r) => <Code key={r}>{r}</Code>)],
            ["Candidate lesson", t.alignment.candidateLessonRefs.map((r) => <Code key={r}>{r}</Code>)],
            ["Offline", l.offline.note],
          ]}
        />
      </Section>
    </div>
  );
}
