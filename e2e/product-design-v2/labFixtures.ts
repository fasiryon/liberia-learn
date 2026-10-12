/** Labs hub fixtures: the server showcase grant is an explicit fixture input, never inferred in the browser. */
import { listLabExperiences } from "../../lib/learner-experience/labExperience";
import { buildLabsTab } from "../../lib/learner-experience/labsTab";
import { NO_SHOWCASE_ACCESS, SHOWCASE_LAB_IDS, showcaseLabExperiences, showcaseLabIds, type ShowcaseLabAccess } from "../../lib/student/showcaseLabAccess";

/** "all" = authorized demo response, "none" = ordinary learner, "denied" = authorized:false with ids, else a comma list. */
export function showcaseFixture(mode: string | null) {
  const access: ShowcaseLabAccess = mode === "all" ? { authorized: true, labIds: [...SHOWCASE_LAB_IDS] }
    : mode === "denied" ? { authorized: false, labIds: [...SHOWCASE_LAB_IDS] }
    : !mode || mode === "none" ? NO_SHOWCASE_ACCESS
    : { authorized: true, labIds: mode.split(",") };
  return { labs: showcaseLabExperiences(access), ids: showcaseLabIds(access) };
}

/** Today's real authority: no certified interactive labs and no practical sessions, so every section is empty. */
export function labsTabFixture(grade: number) {
  return buildLabsTab({ labs: listLabExperiences(), sessions: [], pathLinks: [], grade });
}
