/** Browser-only fixture harness. Production components; explicit fake identity and mocked API data. */
import { createRoot } from "react-dom/client";
import { StudentShellV2 } from "../../components/student/StudentShellV2";
import { TodayV2 } from "../../components/student/TodayV2";
import { LearnV2 } from "../../components/student/learn/LearnV2";
import { LessonCatalog } from "../../components/student/learn/LessonCatalog";
import UnitOverviewClient from "../../app/student/units/[unitId]/UnitOverviewClient";
import { MyClassesView } from "../../components/student/classes/MyClasses";
import { ClassDetailView } from "../../components/student/classes/ClassDetail";
import { ScheduleView } from "../../components/student/classes/Schedule";
import { classDetailFixture, myClassesFixture, scheduleFixture } from "./classFixtures";
import { LabsHubView } from "../../components/learner-experience/LabsHub";
import { InteractiveLabScreen } from "../../components/learner-experience/InteractiveLabScreen";
import { labsTabFixture, showcaseFixture } from "./labFixtures";
import LessonViewerClient from "../../app/student/lesson/[contentId]/LessonViewerClient";
import LessonDeliveryClient from "../../app/student/lessons/[id]/LessonDeliveryClient";
import StudentProgressDashboard from "../../components/student/StudentProgressDashboard";
import { PlaceValueDemo } from "../../components/experience/demo/PlaceValueDemo";
import { TeachingLessonPlayer } from "../../components/experience/teaching/TeachingLessonPlayer";
import { PreviewGallery } from "../../components/experience/teaching/PreviewGallery";
import { DEMO_TEACHING_LESSONS, GRADE7_PLACE_VALUE } from "../../lib/learner-experience/teaching/demoLessons";
import { teachingLessonAvailability } from "../../lib/learner-experience/teaching/contract";
// The harness has no release registry (node:crypto); an empty lookup gives the same DEMO status the server does.
const previewAvailability = (lesson: typeof GRADE7_PLACE_VALUE) => teachingLessonAvailability(lesson, () => null);
import { parseStudentLabReturn } from "../../lib/learner-experience/labLaunch";
import { getInteractiveLabDefinition } from "../../lib/interactive-labs/v2/registry";
import "../../app/globals.css";
const path = window.location.pathname;
const params = new URLSearchParams(window.location.search);
const grade = Number(params.get("grade") ?? sessionStorage.getItem("fixture-grade") ?? 4);
sessionStorage.setItem("fixture-grade", String(grade));
const name = params.get("name") ?? "Pewu Fixture";
const unit = path.match(/^\/student\/units\/([^/]+)$/)?.[1];
const classPage = path.match(/^\/student\/classes\/([^/]+)$/)?.[1];
const timetable = params.get("timetable") !== "none";
// Labs fixtures only when a ?showcase= server grant fixture is named; otherwise /student/labs stays a nav destination stub.
if (params.has("showcase")) sessionStorage.setItem("fixture-showcase", params.get("showcase")!);
const showcaseMode = sessionStorage.getItem("fixture-showcase");
const showcase = showcaseMode !== null ? showcaseFixture(showcaseMode) : null;
const labPage = path.match(/^\/student\/labs\/([^/]+)$/)?.[1];
const contentLesson = path.match(/^\/student\/lesson\/([^/]+)$/)?.[1];
const assignedLesson = path.match(/^\/student\/lessons\/([^/]+)$/)?.[1];
// Lesson → lab: the server page decides RELEASED (simulated here) and rebuilds the return from validated ids.
const lessonLab = labPage && params.has("rt") ? (() => {
  const labId = decodeURIComponent(labPage);
  const origin = parseStudentLabReturn(labId, Object.fromEntries(params.entries()));
  const definition = getInteractiveLabDefinition(labId);
  return origin && definition ? { labId, lessonReturn: { ...origin, labVersion: definition.version, totalChecks: definition.checks.length } } : { labId, lessonReturn: null };
})() : null;
const fixtureRoot = createRoot(document.getElementById("root")!);
let fixtureMount = 0;
const previewSlug = path.match(/^\/design-preview\/lessons\/([^/]+)$/)?.[1];
const previewLesson = previewSlug ? DEMO_TEACHING_LESSONS[previewSlug] : undefined;
const renderFixture = () => fixtureRoot.render(path === "/design-preview/grade-7-place-value" ? <PlaceValueDemo availability={previewAvailability(GRADE7_PLACE_VALUE)} initialSceneId={params.get("scene")} />
  : path === "/design-preview/lessons" ? <PreviewGallery releases={[{ id: "fixture-release", grade: 4, subject: "MATH" }]} chips={Object.fromEntries(Object.entries(DEMO_TEACHING_LESSONS).map(([slug, lesson]) => [slug, previewAvailability(lesson).chip]))} />
  : previewLesson ? <TeachingLessonPlayer lesson={previewLesson} availability={previewAvailability(previewLesson)} initialSceneId={params.get("scene")} backHref="/design-preview/lessons" backLabel="Back to Previews" moreHref="/design-preview/lessons" /> : <StudentShellV2 key={fixtureMount} identity={{ name, grade, userId: "fixture-student", schoolId: "fixture-school" }}>
  {contentLesson ? <LessonViewerClient enabledToolIds={[]} />
    : assignedLesson ? <LessonDeliveryClient lessonId={decodeURIComponent(assignedLesson)} enabledToolIds={[]} />
    : lessonLab ? <InteractiveLabScreen labId={lessonLab.labId} access="RELEASED" lessonReturn={lessonLab.lessonReturn} />
    : showcase && path === "/student/labs" ? <LabsHubView tab={labsTabFixture(grade)} requested={params.get("tab")} showcase={showcase.labs} aiLabsEnabled />
    : showcase && labPage ? <InteractiveLabScreen labId={decodeURIComponent(labPage)} access={showcase.ids.includes(decodeURIComponent(labPage)) ? "SHOWCASE" : "DENIED"} />
    : path === "/student/progress" && params.has("progress") ? <StudentProgressDashboard />
    : path === "/student/today" ? <TodayV2 /> : path === "/student/learn" ? <LearnV2 /> : path === "/student/lessons" ? <LessonCatalog />
    : path === "/student/classes" ? <MyClassesView model={myClassesFixture} today={myClassesFixture.today} />
    : classPage ? <ClassDetailView model={classDetailFixture(timetable)} />
    : path === "/student/schedule" ? <ScheduleView model={scheduleFixture(timetable)} view={params.get("view") === "week" ? "week" : "today"} /> : unit ? <UnitOverviewClient unitId={decodeURIComponent(unit)} /> : <main style={{ padding: 24 }}><a href="/student/today">Back to Today</a><h1>{path.includes("assignments") ? "Assignment fixture" : path.includes("labs") ? "Labs destination fixture" : path.includes("progress") ? "Progress destination fixture" : path.includes("signout") ? "Sign-out page fixture" : "Help destination fixture"}</h1><p>Destination routing fixture. This harness does not certify server authorization or the destination screen.</p></main>}
</StudentShellV2>);

renderFixture();
window.addEventListener("lesson-fixture-remount", () => { fixtureMount++; renderFixture(); });
