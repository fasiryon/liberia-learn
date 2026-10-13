/**
 * Student View. Receives only StudentPreviewModel (built from the LearnerContentBundle
 * projection), so it cannot render teacher notes, answer keys, prohibited tools or governance.
 */
import type { StudentMember, StudentPreviewModel } from "@/lib/content-bundle/preview/viewModel";
import { Chip, Empty, Facts, formatBytes, kindLabel, ResourceList, Section, SequenceFacts } from "./parts";
import { LearnerActivityExperience } from "./activity/LearnerActivityExperience";

function StudentOverview({ model }: { model: StudentPreviewModel }) {
  return (
    <>
      <h2 id="cbp-item-heading" tabIndex={-1} className="cbp-h2">{model.header.title}</h2>
      <p className="cbp-lead">Grade {model.header.gradeLevel} · {model.header.subject}</p>
      <Section id="cbp-s-books" title="Books">
        <ul className="cbp-list">
          {model.renderings.map((r) => (
            <li key={r.kind}>
              <span className="cbp-strong">{r.label}</span> {r.available ? <Chip tone="green">Available</Chip> : <Chip>Not available</Chip>}
            </li>
          ))}
        </ul>
      </Section>
      <Section id="cbp-s-resources" title="Resources">
        <ResourceList resources={model.resources} showAudience={false} />
      </Section>
      <Section id="cbp-s-tools" title="Tools you can use">
        {model.tools.length > 0 ? (
          <ul className="cbp-list" data-testid="student-tools">
            {model.tools.map((t) => (
              <li key={t.toolId}>
                <span className="cbp-strong">{t.toolId}</span> <Chip tone={t.mode === "REQUIRED" ? "gold" : "neutral"}>{t.mode === "REQUIRED" ? "Required" : "Optional"}</Chip>
                {t.context ? <div className="cbp-sub">{t.context}</div> : null}
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No tools.</Empty>
        )}
      </Section>
      <Section id="cbp-s-support" title="Help with reading and seeing">
        <p>{model.accommodations.length > 0 ? model.accommodations.join(", ") : "None"}</p>
      </Section>
      <Section id="cbp-s-offline" title="Offline">
        <Facts
          rows={[
            ["Download for offline", "Not yet ready: package closure has not been verified"],
            ["Pinned assets", `${model.offline.assetCount} files (${formatBytes(model.offline.bytes)})`],
            ["Works offline", model.offline.capabilities.join(", ") || "Nothing"],
            ["Needs a connection for", model.offline.reconnectRequiredFor.join(", ") || "Nothing"],
          ]}
        />
      </Section>
    </>
  );
}

function StudentMemberView({ member, onSelect }: { member: StudentMember; onSelect: (itemId: string) => void }) {
  const d = member.detail;
  return (
    <>
      <p className="cbp-eyebrow">{d.category === "ASSESSMENT" ? d.kindLabel : d.category === "ACTIVITY" ? d.profileLabel ?? d.activityType : kindLabel(member.itemKind)}</p>
      <h2 id="cbp-item-heading" tabIndex={-1} className="cbp-h2">{member.title}</h2>
      {d.category === "LESSON" ? (
        <Section id="cbp-s-lesson" title="Lesson">
          <p>About {d.estimatedMinutes} minutes.</p>
          {d.resources.length > 0 ? <p className="cbp-sub">You will use: {d.resources.join(", ")}</p> : null}
        </Section>
      ) : null}
      {d.category === "ACTIVITY" && d.experience ? (
        <>
          <LearnerActivityExperience experience={d.experience} minutes={d.expectedDurationMinutes} collaboration={d.collaborationMode} steps={d.instructions.map((s) => s.text)} />
          {d.criteria.length > 0 ? (
            <Section id="cbp-s-criteria" title="How your work will be checked">
              <ul className="cbp-list">{d.criteria.map((c) => <li key={c}>{c}</li>)}</ul>
            </Section>
          ) : null}
        </>
      ) : null}
      {d.category === "ACTIVITY" && !d.experience ? (
        <Section id="cbp-s-activity" title="What to do">
          <p className="cbp-sub">About {d.expectedDurationMinutes} minutes · {d.collaborationMode}</p>
          {d.instructions.length > 0 ? <ol className="cbp-steps">{d.instructions.map((s) => <li key={s.stepId}>{s.text}</li>)}</ol> : <Empty>No instructions.</Empty>}
          {d.criteria.length > 0 ? (
            <>
              <h4 className="cbp-h4">How your work will be checked</h4>
              <ul className="cbp-list">{d.criteria.map((c) => <li key={c}>{c}</li>)}</ul>
            </>
          ) : null}
          {d.resources.length > 0 ? <p className="cbp-sub">You will use: {d.resources.join(", ")}</p> : null}
        </Section>
      ) : null}
      {d.category === "ASSESSMENT" ? (
        <Section id="cbp-s-assessment" title="Before you start">
          {d.instructions.length > 0 ? <ul className="cbp-list">{d.instructions.map((i) => <li key={i}>{i}</li>)}</ul> : <Empty>No instructions.</Empty>}
          <p className="cbp-note">Questions are delivered when the student starts. They are not part of this preview.</p>
        </Section>
      ) : null}
      {d.category === "LAB" ? (
        <Section id="cbp-s-lab" title="Lab">
          <div className={`cbp-callout ${d.available ? "cbp-callout-ok" : "cbp-callout-warn"}`} role="status" data-testid="student-lab-state">
            <p>{d.available ? "Students can open this lab." : "Students will see this lab as not available yet."}</p>
          </div>
        </Section>
      ) : null}
      {member.tools.length > 0 ? (
        <Section id="cbp-s-item-tools" title="Tools for this">
          <ul className="cbp-list">{member.tools.map((t) => <li key={t.toolId}>{t.toolId} <Chip>{t.mode === "REQUIRED" ? "Required" : "Optional"}</Chip></li>)}</ul>
        </Section>
      ) : null}
      <Section id="cbp-s-sequence" title="Order">
        <SequenceFacts sequence={member.sequence} onSelect={onSelect} />
      </Section>
    </>
  );
}

export function StudentCenter({ model, selectedId, onSelect }: { model: StudentPreviewModel; selectedId: string; onSelect: (itemId: string) => void }) {
  const member = model.members.find((m) => m.itemId === selectedId);
  return member ? <StudentMemberView member={member} onSelect={onSelect} /> : <StudentOverview model={model} />;
}
