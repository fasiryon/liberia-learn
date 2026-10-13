import type { TeacherMember, TeacherPreviewModel, TeacherToolRow } from "@/lib/content-bundle/preview/viewModel";
import { Chip, Code, Empty, Facts, formatBytes, ItemLinks, kindLabel, ResourceList, Section, SequenceFacts, type ChipTone } from "./parts";

const MODE_TONE: Readonly<Record<string, ChipTone>> = { REQUIRED: "gold", OPTIONAL: "neutral", PROHIBITED: "danger" };
const modeLabel = (mode: string) => (mode === "PROHIBITED" ? "Not allowed" : mode === "REQUIRED" ? "Required" : "Optional");

export function releaseChip(release: TeacherPreviewModel["release"]) {
  if (release.state === "RELEASED") return <Chip tone="green">Published ontology</Chip>;
  if (release.state === "UNRELEASED") return <Chip tone="warn">Not released</Chip>;
  return <Chip tone="warn">Release not evaluated</Chip>;
}

function ToolBindings({ tools }: { tools: readonly TeacherToolRow[] }) {
  if (tools.length === 0) return <Empty>This bundle binds no tools.</Empty>;
  return (
    <ul className="cbp-cards" data-testid="tool-bindings">
      {tools.map((tool, index) => (
        <li key={`${tool.toolId}-${index}`} className="cbp-card">
          <p className="cbp-card-title">
            <Code>{tool.toolId}</Code> <Chip tone={MODE_TONE[tool.mode]}>{modeLabel(tool.mode)}</Chip>
          </p>
          <Facts
            rows={[
              ["Applies to", tool.scope],
              ["Runtime tool", tool.runtimeTools.length > 0 ? tool.runtimeTools.join(", ") : "Mapping unresolved"],
              ...(tool.context ? ([["Student guidance", tool.context]] as const) : []),
              ...(tool.configuration.length > 0 ? ([["Student settings", tool.configuration.map((c) => `${c.key}: ${c.value}`).join(", ")]] as const) : []),
            ]}
          />
        </li>
      ))}
    </ul>
  );
}

function Overview({ model, onSelect }: { model: TeacherPreviewModel; onSelect: (itemId: string) => void }) {
  const count = (category: string) => model.members.filter((m) => m.category === category).length;
  const o = model.offline;
  return (
    <>
      <h2 id="cbp-item-heading" tabIndex={-1} className="cbp-h2">Bundle overview</h2>
      <p className="cbp-lead">
        {count("LESSON")} lessons · {count("ACTIVITY")} activities · {count("ASSESSMENT")} assessments · {count("LAB")} labs · {model.resources.length} resources
      </p>

      <Section id="cbp-objectives" title="Objectives">
        <ul className="cbp-list">
          {model.objectives.map((objective) => (
            <li key={objective.objectiveId}>
              <Code>{objective.objectiveId}</Code>
              <div>{objective.description}</div>
              <div className="cbp-sub">Taught by: <ItemLinks links={objective.boundItems} onSelect={onSelect} empty="No item binds this objective" /></div>
            </li>
          ))}
        </ul>
        {model.standards.length > 0 ? <p className="cbp-sub">Standards: {model.standards.map((s) => <Code key={s}>{s}</Code>)}</p> : null}
      </Section>

      <Section id="cbp-books" title="Textbook, workbook and teacher guide">
        <ul className="cbp-list" data-testid="renderings">
          {model.renderings.map((r) => (
            <li key={r.kind}>
              <span className="cbp-strong">{r.label}</span>{" "}
              {r.available ? <Chip tone="green">Available, v{r.artifactVersion} ({r.audience})</Chip> : <Chip>Not available</Chip>}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="cbp-resources" title="Resources">
        <ResourceList resources={model.resources} showAudience />
      </Section>

      <Section id="cbp-tools" title="Toolkit bindings" note={model.toolkitMapping.reviewed === false ? "The tool mapping this preview used has not been pedagogically reviewed." : undefined}>
        <ToolBindings tools={model.tools} />
      </Section>

      <Section id="cbp-support" title="Learner support">
        <Facts
          rows={[
            ["Remediation", model.learnerSupport.remediation.length > 0 ? model.learnerSupport.remediation.map((s) => <div key={s.supportId}>Revisit <ItemLinks links={s.items} onSelect={onSelect} />{s.resources.length > 0 ? ` with ${s.resources.join(", ")}` : null}</div>) : "None"],
            ["Enrichment", model.learnerSupport.enrichment.length > 0 ? model.learnerSupport.enrichment.map((s) => <div key={s.supportId}>Extend <ItemLinks links={s.items} onSelect={onSelect} /></div>) : "None"],
            ["Accommodations supported", model.learnerSupport.accommodations.length > 0 ? model.learnerSupport.accommodations.join(", ") : "None"],
            ["Language variants", model.learnerSupport.languageVariants.length > 0 ? model.learnerSupport.languageVariants.join(", ") : "None"],
          ]}
        />
      </Section>

      <Section id="cbp-offline" title="Offline package">
        <p className="cbp-callout cbp-callout-warn">{o.ready ? "Ready" : "Not yet ready: the real offline package is not closed."}</p>
        <Facts
          rows={[
            ["Can be packaged", o.packageable ? <Chip tone="green">Yes</Chip> : <Chip tone="warn">No</Chip>],
            ["Student assets", `${o.learnerAssets.count} (${formatBytes(o.learnerAssets.bytes)})`],
            ["Teacher-only assets", `${o.staffOnlyAssets.count} (${formatBytes(o.staffOnlyAssets.bytes)}), never in the student package`],
            ["Works offline", o.capabilities.length > 0 ? o.capabilities.join(", ") : "Nothing"],
            ["Needs a connection for", o.reconnectRequiredFor.length > 0 ? o.reconnectRequiredFor.join(", ") : "Nothing"],
            ["Longest time offline", o.maxOfflineDays === null ? "No limit set" : `${o.maxOfflineDays} days`],
          ]}
        />
        <details className="cbp-details" data-testid="offline-pins">
          <summary>Student package pins</summary>
          <Facts
            rows={[
              ["Bundle", <Code key="b">{o.pins.bundle}</Code>],
              ["Content hash", <Code key="h">{o.pins.contentHash}</Code>],
              ["Release identity", <Code key="r">{o.pins.releaseIdentity}</Code>],
              ["Projection", <Code key="p">{o.pins.projectionVersion}</Code>],
            ]}
          />
          <p className="cbp-sub">Members pinned ({o.pins.members.length})</p>
          <ul className="cbp-list cbp-mono">{o.pins.members.map((m) => <li key={m}>{m}</li>)}</ul>
          <p className="cbp-sub">Assets pinned ({o.pins.assets.length})</p>
          <ul className="cbp-list cbp-mono">{o.pins.assets.map((a) => <li key={a}>{a}</li>)}</ul>
        </details>
      </Section>
    </>
  );
}

function MemberDetail({ member, onSelect }: { member: TeacherMember; onSelect: (itemId: string) => void }) {
  const d = member.detail;
  return (
    <>
      <p className="cbp-eyebrow">{kindLabel(member.itemKind)}</p>
      <h2 id="cbp-item-heading" tabIndex={-1} className="cbp-h2">{member.title}</h2>

      {d.category === "LESSON" ? (
        <Section id="cbp-lesson" title="Lesson">
          <Facts rows={[["Estimated time", `${d.estimatedMinutes} minutes`]]} />
          <ResourceList resources={d.resources} showAudience />
        </Section>
      ) : null}

      {d.category === "ACTIVITY" ? (
        <>
          <Section id="cbp-activity" title="Activity">
            <Facts
              rows={[
                ["Type", <Chip key="t" tone="gold">{d.activityType}</Chip>],
                ["Expected duration", `${d.expectedDurationMinutes} minutes`],
                ["Collaboration", d.collaborationMode],
                ["Scaffolding", d.scaffolding ?? "Not specified"],
                ["Evidence", d.evidence],
                ["Extends", <ItemLinks key="e" links={d.extendsLessons} onSelect={onSelect} />],
              ]}
            />
          </Section>
          <Section id="cbp-learner-instructions" title="Student instructions">
            {d.learnerInstructions.length > 0 ? <ol className="cbp-steps">{d.learnerInstructions.map((s) => <li key={s.stepId}>{s.text}{s.resources.length > 0 ? <span className="cbp-sub"> Uses: {s.resources.join(", ")}</span> : null}</li>)}</ol> : <Empty>No student instructions.</Empty>}
          </Section>
          <Section id="cbp-teacher-instructions" title="Teacher instructions (teacher only)">
            {d.teacherInstructions.length > 0 ? <ol className="cbp-steps" data-testid="teacher-instructions">{d.teacherInstructions.map((s) => <li key={s.stepId}>{s.text}{s.resources.length > 0 ? <span className="cbp-sub"> Uses: {s.resources.join(", ")}</span> : null}</li>)}</ol> : <Empty>No teacher instructions for this activity.</Empty>}
          </Section>
          {d.rubric ? (
            <Section id="cbp-rubric" title="Rubric">
              <Facts rows={[["Rubric", <Code key="r">{`${d.rubric.rubricId}@${d.rubric.rubricVersion}`}</Code>], ["Criteria students see", d.rubric.criteria.join("; ")], ["Scoring guide", d.rubric.scoringGuide ?? "None"]]} />
            </Section>
          ) : null}
          <Section id="cbp-activity-resources" title="Resources">
            <ResourceList resources={d.resources} showAudience />
          </Section>
        </>
      ) : null}

      {d.category === "ASSESSMENT" ? (
        <Section id="cbp-assessment" title="Assessment">
          <Facts
            rows={[
              ["Purpose", <Chip key="p" tone="gold">{d.role}</Chip>],
              ["Definition", <Code key="d">{`${d.definitionId}@${d.definitionVersion}`}</Code>],
              ["Questions", `${d.itemCount}`],
              ["Question order", d.itemOrder],
              ["Student instructions", d.learnerInstructions.length > 0 ? d.learnerInstructions.join(" ") : "None"],
              ["Answer key", d.answerKey ?? "None in this bundle"],
              ["Scoring guide", d.scoringGuide ?? "None in this bundle"],
            ]}
          />
          <p className="cbp-note">Question content and answer keys are held by the assessment authority. This preview shows references only.</p>
        </Section>
      ) : null}

      {d.category === "LAB" ? (
        <Section id="cbp-lab" title="Lab">
          <div className={`cbp-callout ${d.runnable ? "cbp-callout-ok" : "cbp-callout-warn"}`} role="status" data-testid="lab-readiness">
            <p className="cbp-strong">{d.runnable ? "Runnable: certified for students" : "Not runnable"}</p>
            <p>{d.readiness.reason}</p>
          </div>
          <Facts
            rows={[
              ["Governed link", <Code key="l">{`${d.linkId} revision ${d.linkRevision}`}</Code>],
              ["Lab", <Code key="lab">{`${d.labId}@${d.labVersion}`}</Code>],
              ["Certification", humanizeReadiness(d.readiness.state)],
              ["Role", d.role],
              ["Placed in", d.placement],
              ["Authority basis", d.authorityBasis],
            ]}
          />
        </Section>
      ) : null}

      <Section id="cbp-sequence" title="Sequence">
        <SequenceFacts sequence={member.sequence} onSelect={onSelect} />
      </Section>
    </>
  );
}

function humanizeReadiness(state: string) {
  switch (state) {
    case "CERTIFIED_RUNNABLE":
      return "Certified";
    case "NOT_CERTIFIED":
      return "Not certified";
    case "LINK_REVISION_MISSING":
      return "Link revision missing";
    default:
      return "Not evaluated";
  }
}

export function TeacherCenter({ model, selectedId, onSelect }: { model: TeacherPreviewModel; selectedId: string; onSelect: (itemId: string) => void }) {
  const member = model.members.find((m) => m.itemId === selectedId);
  return member ? <MemberDetail member={member} onSelect={onSelect} /> : <Overview model={model} onSelect={onSelect} />;
}

export function TeacherAside({ model, selectedId }: { model: TeacherPreviewModel; selectedId: string }) {
  const member = model.members.find((m) => m.itemId === selectedId);
  const g = model.governance;
  return (
    <>
      {member ? (
        <Section id="cbp-aside-item" title="Item identity">
          <Facts
            rows={[
              ["Kind", kindLabel(member.itemKind)],
              ["Item id", <Code key="i">{member.itemId}</Code>],
              ["Version", <Code key="v">{member.itemVersion}</Code>],
              ["Requirement", member.sequence ? (member.sequence.requirement === "REQUIRED" ? "Required" : "Optional") : "Not sequenced"],
            ]}
          />
        </Section>
      ) : null}
      {member ? (
        <Section id="cbp-aside-objectives" title="Objectives">
          {member.objectiveIds.length > 0 ? <ul className="cbp-list">{member.objectiveIds.map((id) => <li key={id}><Code>{id}</Code><div>{model.objectives.find(o => o.objectiveId === id)?.description ?? "description unavailable"}</div></li>)}</ul> : <Empty>No objectives bound.</Empty>}
        </Section>
      ) : null}
      {member ? (
        <Section id="cbp-aside-tools" title="Tools for this item" note="An item can narrow a whole-bundle tool. A prohibition always wins.">
          {member.tools.length > 0 ? (
            <ul className="cbp-list" data-testid="item-tools">
              {member.tools.map((t) => (
                <li key={t.toolId}>
                  <Code>{t.toolId}</Code> <Chip tone={MODE_TONE[t.effectiveMode]}>{modeLabel(t.effectiveMode)}</Chip>
                  <div className="cbp-sub">From: {t.sources.join("; ")}</div>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No tools bound.</Empty>
          )}
        </Section>
      ) : null}
      <Section id="cbp-aside-governance" title="Governance and release">
        <div className={`cbp-callout ${model.release.state === "RELEASED" ? "cbp-callout-ok" : "cbp-callout-warn"}`} role="note">
          <p>{releaseChip(model.release)}</p>
          <p>{model.release.reason}</p>
        </div>
        <Facts
          rows={[
            ["Preview source", model.source.authoritative ? model.source.label : <span key="s">{model.source.label} <Chip tone="warn">Not authoritative</Chip></span>],
            ["Curriculum release", <Code key="r">{model.authority.releaseIdentity}</Code>],
            ["Content hash", <Code key="h">{model.header.contentHash.slice(0, 16)}…</Code>],
            ["Provenance", g.provenanceRefs.length > 0 ? g.provenanceRefs.join(", ") : "None recorded"],
            ["Reviews", g.reviewRefs.length > 0 ? g.reviewRefs.join(", ") : "None recorded"],
            ["Lifecycle", g.lifecycleRefs.length > 0 ? g.lifecycleRefs.join(", ") : "None recorded"],
            ["Releases", g.releaseRefs.length > 0 ? g.releaseRefs.join(", ") : "None recorded"],
            ["Tool mapping", model.toolkitMapping.pinned ? `${model.toolkitMapping.pinned}${model.toolkitMapping.reviewed === false ? " (unreviewed)" : ""}` : "Not pinned"],
          ]}
        />
        {model.toolkitMapping.issues.length > 0 ? (
          <ul className="cbp-list cbp-warn-text">{model.toolkitMapping.issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
        ) : null}
      </Section>
    </>
  );
}
