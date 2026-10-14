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
const renderFixture = () => fixtureRoot.render(path === "/design-preview/grade-7-place-value" ? <PlaceValueDemo /> : <StudentShellV2 key={fixtureMount} identity={{ name, grade, userId: "fixture-student", schoolId: "fixture-school" }}>
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
