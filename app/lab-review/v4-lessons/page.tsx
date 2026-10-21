import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Chip, PageFrame, PageHeader, Panel } from "@/components/experience/Frame";
import { isLearnerExperiencePrototypeEnabled } from "@/lib/learner-experience/prototypeRoute";
import { V4_REVIEW_BASE_PATH, v4PreviewIndex } from "@/lib/curriculum/v4/preview";
import { TEACHING_BLOCK_REGISTRY } from "@/lib/learner-experience/teaching/registry";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "V4 lesson candidates · LiberiaLearn", robots: { index: false, follow: false } };

const SOURCE_LABEL: Record<string, string> = { FIRST_TEN_BOUND: "First-ten source + V0.2.1 baseline", SOURCE_ROW_ONLY: "Legacy row (body not compared)", SYNTHETIC_DEMONSTRATION: "Synthetic demonstration" };

/** Dev-only index of the six Interactive Learning V4 DRAFT candidates. */
export default function V4LessonIndexPage() {
  if (!isLearnerExperiencePrototypeEnabled(process.env)) notFound();
  const rows = v4PreviewIndex();
  return <div className="ll3-scope min-h-dvh">
    <PageFrame labelledBy="v4-title">
      <PageHeader eyebrow="Interactive Learning V4 · review" title="V4 lesson candidates" titleId="v4-title"
        lede="Six lessons generated to the V4 instructional standard and played by Lesson Player V2. Every one is an unreviewed DRAFT: not approved, not released, not delivered to students, and nothing you do here is saved, sent or marked." />
      <div className="ll3-cards">
        {rows.map((row) => <article key={row.key} className="ll3-card ll4-gallery-card" data-v4-candidate={row.key}>
          <p className="text-sm font-semibold text-[var(--ll-text-muted)]">Grade {row.grade} · {row.subject}</p>
          <h2 className="ll3-card-title"><Link className="ll4-card-link" href={`${V4_REVIEW_BASE_PATH}/${row.key}`}>{row.title}</Link></h2>
          <p className="ll3-small ll3-muted">{row.scenes} scenes · {row.problems} problems · {Math.round(row.activityShare * 100)}% activity</p>
          <p className="ll3-small ll3-muted">{row.blockTypes.map((type) => TEACHING_BLOCK_REGISTRY[type].label).join(", ")}</p>
          <p className="ll3-small"><strong>{SOURCE_LABEL[row.source.kind]}:</strong> {row.source.label}</p>
          <div><Chip tone="demo">DRAFT · {row.blocking.length} blocking review gaps</Chip></div>
        </article>)}
      </div>
      <Panel title="Why these are not released" titleId="v4-gates" className="mt-8">
        <p className="ll3-small">Each candidate still needs: MOE objective binding by a curriculum reviewer, an ontology release with governed Assessment Player V2 items, subject-expert review of accuracy and pedagogy, and (for bound lessons) a legacy comparison or factory-owner reconciliation with the V0.2.1 baseline.</p>
      </Panel>
    </PageFrame>
  </div>;
}
