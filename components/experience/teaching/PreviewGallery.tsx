import Link from "next/link";
import { BookOpen, FlaskConical, Landmark, Sigma } from "lucide-react";
import { PageFrame, PageHeader, Panel, Chip } from "@/components/experience/Frame";
import { DEMO_TEACHING_LESSONS } from "@/lib/learner-experience/teaching/demoLessons";
import { sceneBlocks, type TeachingLesson } from "@/lib/learner-experience/teaching/contract";
import "@/components/experience/lesson.css";

const ICON: Record<TeachingLesson["subject"], typeof Sigma> = { MATHEMATICS: Sigma, SCIENCE: FlaskConical, ENGLISH: BookOpen, SOCIAL_STUDIES: Landmark };
const BLOCK_LABEL: Record<string, string> = {
  GROUPED_NUMBER: "Grouped number", PLACE_VALUE_CHART: "Place-value chart", TEN_TIMES: "×10 shift", NUMBER_BUILDER: "Number builder",
  DIGIT_CARDS: "Digit cards", STEP_REVEAL: "Worked steps", CHOICE_CHECK: "Feedback questions", PROCESS_CYCLE: "Process cycle",
  SORT: "Sort", SEQUENCE: "Sequence + timeline", CALLOUT: "Tip / mistake callout",
};

/**
 * Dev-only index of the DEMO teaching lessons, with an explicit inventory of what is released, candidate,
 * demo or legacy. The released row and chips come from the published-release registry (computed by the
 * server page); nothing here is inferred from titles.
 */
export function PreviewGallery({ releases, chips }: { releases: readonly { id: string; grade: number; subject: string }[]; chips: Readonly<Record<string, string>> }) {
  return <div className="ll3-scope min-h-dvh">
    <PageFrame labelledBy="preview-title">
      <PageHeader eyebrow="Student Experience V3 · design preview" title="Teaching scene previews" titleId="preview-title"
        lede="Synthetic lessons that show the visual learning blocks across subjects. They are labelled DEMO, are not curriculum, and record nothing." />
      <div className="ll3-cards">
        {Object.entries(DEMO_TEACHING_LESSONS).map(([slug, lesson]) => {
          const Icon = ICON[lesson.subject];
          const blocks = [...new Set(lesson.scenes.flatMap((scene) => sceneBlocks(scene).map((block) => block.type)))];
          const href = slug === "grade-7-place-value" ? "/design-preview/grade-7-place-value" : `/design-preview/lessons/${slug}`;
          return <article key={slug} className="ll3-card ll4-gallery-card">
            <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ll-text-muted)]"><Icon size={18} aria-hidden="true" /> Grade {lesson.grade} · {lesson.subject.replace("_", " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())}</p>
            <h2 className="ll3-card-title"><Link href={href} className="ll4-card-link">{lesson.title}</Link></h2>
            <p className="ll3-small ll3-muted">{lesson.scenes.length} scenes · {blocks.map((type) => BLOCK_LABEL[type]).join(", ")}</p>
            <div><Chip tone="demo">{chips[slug] ?? "Status unknown"}</Chip></div>
          </article>;
        })}
      </div>
      <Panel title="Content status inventory" titleId="inventory-title" className="mt-8">
        <div className="ll3-table-wrap" role="region" aria-label="Content status inventory" tabIndex={0}>
          <table className="ll3-table">
            <thead><tr><th scope="col">Status</th><th scope="col">What</th><th scope="col">Shown to students?</th></tr></thead>
            <tbody>
              <tr><td>Released (native)</td><td>{releases.map((release) => `Grade ${release.grade} ${release.subject} (${release.id})`).join("; ") || "None"}</td><td>Yes, through the lesson delivery seam</td></tr>
              <tr><td>Candidate</td><td>Grade 4 fractions activities (ActivityDefinition fixtures); any teaching lesson that names an unregistered release</td><td>No</td></tr>
              <tr><td>Demo</td><td>{Object.values(DEMO_TEACHING_LESSONS).map((lesson) => `Grade ${lesson.grade} ${lesson.title}`).join("; ")}</td><td>No — dev-only preview routes</td></tr>
              <tr><td>Legacy</td><td>Hosted lessons without a native release, including Grade 7 Number Sense and Place Value</td><td>Yes, as legacy Read / Slides (unchanged authority)</td></tr>
            </tbody>
          </table>
        </div>
      </Panel>
    </PageFrame>
  </div>;
}
