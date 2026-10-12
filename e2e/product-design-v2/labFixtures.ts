/**
 * Labs hub fixtures. The browser never decides showcase access: each fixture stands for the list of lab ids the
 * server authority (loadAuthorizedShowcaseLabs in lib/student/showcaseLabs.ts) returned. That module reads
 * Prisma, so the browser harness takes its answer as input instead of importing it.
 */
import { findLabExperience, listLabExperiences, type LabExperience } from "../../lib/learner-experience/labExperience";
import { buildLabsTab } from "../../lib/learner-experience/labsTab";

const AUTHORIZED_DEMO_RESPONSE = ["g4-solid-figures", "fixture-lever", "fixture-simple-circuit", "mount-coffee-hydropower"];

/** "all" = authorized demo student, "none" = ordinary learner (server returns no labs), else a comma list. */
export function showcaseFixture(mode: string | null) {
  const ids = mode === "all" ? AUTHORIZED_DEMO_RESPONSE : !mode || mode === "none" ? [] : mode.split(",");
  return { labs: ids.map((id) => findLabExperience(id)).filter((lab): lab is LabExperience => !!lab), ids };
}

/** The ordinary production tab builder, exactly as the server page uses it. */
export function labsTabFixture(grade: number) {
  return buildLabsTab({ labs: listLabExperiences(), sessions: [], pathLinks: [], grade });
}
