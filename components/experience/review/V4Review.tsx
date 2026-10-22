import Link from "next/link";
import { Chip, PageFrame, PageHeader, Panel } from "@/components/experience/Frame";
import "@/components/experience/lesson.css";

/**
 * Reviewer chrome for /lab-review/v4-lessons. Renders the loader's catalogue (T2, `lib/curriculum/v4/preview.ts`)
 * and never reads packages, hashes or falls back itself: a selection the loader did not verify is not linkable.
 * Provenance and hashes live here, outside Lesson Player V2; the player only ever receives the learner experience.
 * The view types mirror the agreed R7 interface (artifacts/v4-coordination/T1-R7-INTERFACE-CONFIRMATION.md §2).
 */
export type V4ReviewOrigin = "FACTORY_GENERATED" | "HAND_AUTHORED_FIXTURE";
export type V4ReviewEntryView = Readonly<{
  selection: string; origin: V4ReviewOrigin; lessonKey: string; candidateVersion: string;
  title: string; grade: number; subject: string; state: string; reviewStatus: string; integrity: string;
  provenance: Readonly<{
    sourceLineage: Readonly<{ kind: string; label: string }>;
    generator?: Readonly<{ executor: string; role: string; modelCalls: number; referenceFixtureCopied: boolean }>;
    packageHash?: string; candidateSha256: string; learnerProjectionSha256: string; manifestSha256?: string;
  }>;
  blockers: readonly string[];
}>;
export type V4ReviewRejectionView = Readonly<{ selection: string; origin: V4ReviewOrigin; reason: string }>;

export const ORIGIN_LABEL: Record<V4ReviewOrigin, string> = { FACTORY_GENERATED: "Factory-generated DRAFT", HAND_AUTHORED_FIXTURE: "Hand-authored reference fixture" };
/** The lesson reviewers open first: the Grade 7 geometry lesson, as produced by the Content Factory. */
export const FEATURED_LESSON_KEY = "g7-math-area-perimeter";

const LINEAGE: Record<string, string> = { FIRST_TEN_BOUND: "First-ten source + V0.2.1 baseline", SOURCE_ROW_ONLY: "Legacy row (body not compared)", SYNTHETIC_DEMONSTRATION: "Synthetic demonstration" };

/** `4.0.0-draft.5` sorts above `4.0.0-draft.4`; a release sorts above its drafts. Unparseable versions sort last. */
export function compareVersions(a: string, b: string): number {
  const parse = (v: string) => { const m = /^(\d+)\.(\d+)\.(\d+)(?:-draft\.(\d+))?$/.exec(v); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? Infinity : +m[4]] : null; };
  const x = parse(a), y = parse(b);
  if (!x || !y) return x ? -1 : y ? 1 : a.localeCompare(b);
  for (let i = 0; i < 4; i++) if (x[i] !== y[i]) return y[i] - x[i];
  return 0;
}

/** Selection keys are `[a-z0-9.@-]`, all legal in a path segment, so the link keeps the key byte-for-byte. */
export function selectionHref(basePath: string, selection: string): string {
  return `${basePath}/${encodeURIComponent(selection).replace(/%40/g, "@")}`;
}

/** Only verified DRAFT entries are selectable; anything else from the loader is dropped, never shown as playable. */
export function selectable(entries: readonly V4ReviewEntryView[]): V4ReviewEntryView[] {
  return entries.filter((entry) => entry.integrity === "VERIFIED" && entry.state === "DRAFT");
}

/** Factory versions of each lesson, newest first, in catalogue order of first appearance. */
export function factoryVersions(entries: readonly V4ReviewEntryView[]): Map<string, V4ReviewEntryView[]> {
  const groups = new Map<string, V4ReviewEntryView[]>();
  for (const entry of selectable(entries)) if (entry.origin === "FACTORY_GENERATED") groups.set(entry.lessonKey, [...(groups.get(entry.lessonKey) ?? []), entry]);
  for (const list of groups.values()) list.sort((a, b) => compareVersions(a.candidateVersion, b.candidateVersion));
  return groups;
}

function OriginChip({ origin }: { origin: V4ReviewOrigin }) {
  return <span className="ll3-chip ll4-origin" data-origin={origin}>{ORIGIN_LABEL[origin]}</span>;
}

function VersionLinks({ versions, current, basePath }: { versions: readonly V4ReviewEntryView[]; current?: string; basePath: string }) {
  return <ul className="ll4-versions" aria-label="Factory versions">
    {versions.map((entry, i) => <li key={entry.selection}>
      {entry.selection === current
        ? <span className="ll4-version" aria-current="page">{entry.candidateVersion}{i === 0 ? " · latest verified" : ""}</span>
        : <Link className="ll4-version" href={selectionHref(basePath, entry.selection)} data-v4-selection={entry.selection}>{entry.candidateVersion}{i === 0 ? " · latest verified" : ""}</Link>}
    </li>)}
  </ul>;
}

function FactoryCard({ versions, basePath, featured }: { versions: readonly V4ReviewEntryView[]; basePath: string; featured?: boolean }) {
  const latest = versions[0];
  return <article className="ll3-card ll4-gallery-card" data-v4-origin="FACTORY_GENERATED" data-v4-lesson={latest.lessonKey} data-featured={featured || undefined}>
    <div className="ll4-card-head"><OriginChip origin="FACTORY_GENERATED" />{featured ? <Chip tone="accent">Primary demonstration</Chip> : null}</div>
    <p className="text-sm font-semibold text-[var(--ll-text-muted)]">Grade {latest.grade} · {latest.subject}</p>
    <h3 className="ll3-card-title"><Link className="ll4-card-link" href={selectionHref(basePath, latest.selection)} data-v4-selection={latest.selection}>{latest.title}</Link></h3>
    <p className="ll3-small ll3-muted">{LINEAGE[latest.provenance.sourceLineage.kind] ?? latest.provenance.sourceLineage.kind}: {latest.provenance.sourceLineage.label}</p>
    <p className="ll3-small"><strong>Choose a version</strong></p>
    <VersionLinks versions={versions} basePath={basePath} />
    <div><Chip tone="demo">DRAFT · {latest.reviewStatus} · {latest.blockers.length} release blockers</Chip></div>
  </article>;
}

function ReferenceCard({ entry, basePath }: { entry: V4ReviewEntryView; basePath: string }) {
  return <article className="ll3-card ll4-gallery-card" data-v4-origin="HAND_AUTHORED_FIXTURE" data-v4-lesson={entry.lessonKey}>
    <div className="ll4-card-head"><OriginChip origin="HAND_AUTHORED_FIXTURE" /></div>
    <p className="text-sm font-semibold text-[var(--ll-text-muted)]">Grade {entry.grade} · {entry.subject} · {entry.candidateVersion}</p>
    <h3 className="ll3-card-title"><Link className="ll4-card-link" href={selectionHref(basePath, entry.selection)} data-v4-selection={entry.selection}>{entry.title}</Link></h3>
    <p className="ll3-small ll3-muted">Renderer reference for visual comparison. Not Content Factory output.</p>
    <div><Chip tone="demo">DRAFT · {entry.blockers.length} blocking review gaps</Chip></div>
  </article>;
}

/** Index: factory-generated lessons first (geometry featured), hand-authored fixtures separately, rejections visible. */
export function V4ReviewGallery({ entries, rejected, basePath }: { entries: readonly V4ReviewEntryView[]; rejected: readonly V4ReviewRejectionView[]; basePath: string }) {
  const factory = [...factoryVersions(entries).values()].sort((a, b) => Number(b[0].lessonKey === FEATURED_LESSON_KEY) - Number(a[0].lessonKey === FEATURED_LESSON_KEY));
  const references = selectable(entries).filter((entry) => entry.origin === "HAND_AUTHORED_FIXTURE");
  return <div className="ll3-scope min-h-dvh">
    <PageFrame labelledBy="v4-title">
      <PageHeader eyebrow="Interactive Learning V4 · review" title="V4 lesson candidates" titleId="v4-title"
        lede="Unreviewed DRAFTs played by Lesson Player V2: not approved, not released, not delivered to students. Nothing you do here is saved, sent or marked." />
      <section aria-labelledby="v4-factory" className="ll4-review-section">
        <h2 id="v4-factory" className="ll3-section-title">Factory-generated DRAFT lessons</h2>
        <p className="ll3-small ll3-muted">Produced by the Content Factory and loaded only after the package manifest and hashes verify. Pick a version explicitly; there is no automatic fallback.</p>
        {factory.length
          ? <div className="ll3-cards">{factory.map((versions) => <FactoryCard key={versions[0].lessonKey} versions={versions} basePath={basePath} featured={versions[0].lessonKey === FEATURED_LESSON_KEY} />)}</div>
          : <p className="ll3-small" role="status">No verified factory package is available.</p>}
      </section>
      <section aria-labelledby="v4-reference" className="ll4-review-section">
        <h2 id="v4-reference" className="ll3-section-title">Hand-authored reference fixtures (4.0.0-draft.1)</h2>
        <p className="ll3-small ll3-muted">The original renderer references, kept for side-by-side visual comparison with the factory output.</p>
        <div className="ll3-cards">{references.map((entry) => <ReferenceCard key={entry.selection} entry={entry} basePath={basePath} />)}</div>
      </section>
      {rejected.length ? <Panel title="Packages that did not verify" titleId="v4-rejected" className="mt-8">
        <ul className="ll3-small" data-v4-rejected>{rejected.map((row) => <li key={row.selection}><code>{row.selection}</code>: {row.reason}. Not selectable.</li>)}</ul>
      </Panel> : null}
      <Panel title="Why these are not released" titleId="v4-gates" className="mt-8">
        <p className="ll3-small">Each candidate still needs: MOE objective binding by a curriculum reviewer, an ontology release with governed Assessment Player V2 items, subject-expert review of accuracy and pedagogy, and (for bound lessons) a legacy comparison or factory-owner reconciliation with the V0.2.1 baseline.</p>
      </Panel>
    </PageFrame>
  </div>;
}

const short = (hash?: string) => (hash ? `${hash.slice(0, 12)}…` : "—");

/** Reviewer bar above the player: what is playing, which version, its status, and how to switch. */
export function V4ReviewBar({ entry, versions, reference, basePath }: { entry: V4ReviewEntryView; versions: readonly V4ReviewEntryView[]; reference: V4ReviewEntryView | null; basePath: string }) {
  const { provenance } = entry;
  return <aside className="ll3-scope ll4-review-bar" aria-label="Reviewer: candidate provenance" data-v4-review-bar data-v4-origin={entry.origin} data-v4-version={entry.candidateVersion} data-v4-projection={provenance.learnerProjectionSha256}>
    <div className="ll4-review-bar-row">
      <Link className="ll4-card-link ll3-small" href={basePath}>All candidates</Link>
      <OriginChip origin={entry.origin} />
      <span className="ll3-small"><strong>Version</strong> {entry.candidateVersion}</span>
      <span className="ll3-small"><strong>Status</strong> {entry.state} · {entry.reviewStatus}</span>
      {entry.origin === "FACTORY_GENERATED" && versions.length > 1 ? <VersionLinks versions={versions} current={entry.selection} basePath={basePath} /> : null}
      {reference ? <Link className="ll4-card-link ll3-small" href={selectionHref(basePath, reference.selection)} data-v4-selection={reference.selection}>Compare: hand-authored fixture</Link> : null}
      {entry.origin === "HAND_AUTHORED_FIXTURE" && versions.length ? <Link className="ll4-card-link ll3-small" href={selectionHref(basePath, versions[0].selection)} data-v4-selection={versions[0].selection}>Compare: factory {versions[0].candidateVersion}</Link> : null}
    </div>
    <details className="ll4-review-details">
      <summary className="ll3-small">Provenance and integrity</summary>
      <dl className="ll4-review-dl ll3-small">
        <dt>Selection</dt><dd><code>{entry.selection}</code></dd>
        <dt>Integrity</dt><dd>{entry.integrity}</dd>
        <dt>Source</dt><dd>{LINEAGE[provenance.sourceLineage.kind] ?? provenance.sourceLineage.kind}: {provenance.sourceLineage.label}</dd>
        {provenance.generator ? <><dt>Generator</dt><dd>{provenance.generator.executor} ({provenance.generator.role}), {provenance.generator.modelCalls} model calls, reference fixture copied: {provenance.generator.referenceFixtureCopied ? "yes" : "no"}</dd></> : null}
        {provenance.packageHash ? <><dt>Package</dt><dd><code title={provenance.packageHash}>{short(provenance.packageHash)}</code></dd></> : null}
        <dt>Candidate</dt><dd><code title={provenance.candidateSha256}>{short(provenance.candidateSha256)}</code></dd>
        <dt>Learner projection</dt><dd><code title={provenance.learnerProjectionSha256}>{short(provenance.learnerProjectionSha256)}</code></dd>
        <dt>Release blockers</dt><dd>{entry.blockers.length ? entry.blockers.join(", ") : "None recorded"}</dd>
      </dl>
    </details>
  </aside>;
}

/** A selection the loader refused (integrity, parse or projection mismatch). No lesson, no substitute. */
export function V4SelectionRejected({ selection, reason, basePath }: { selection: string; reason: string; basePath: string }) {
  return <div className="ll3-scope min-h-dvh">
    <PageFrame labelledBy="v4-rejected-title">
      <PageHeader eyebrow="Interactive Learning V4 · review" title="Selection rejected" titleId="v4-rejected-title"
        lede="The loader did not verify this candidate, so nothing is played and no other version is substituted." />
      <Panel title="Details" titleId="v4-rejected-details">
        <p className="ll3-small" data-v4-rejection={reason}><code>{selection}</code>: {reason}</p>
        <p className="ll3-small"><Link className="ll4-card-link" href={basePath}>Back to all candidates</Link></p>
      </Panel>
    </PageFrame>
  </div>;
}
