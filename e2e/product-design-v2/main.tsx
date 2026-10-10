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
import "../../app/globals.css";
const path = window.location.pathname;
const params = new URLSearchParams(window.location.search);
const grade = Number(params.get("grade") ?? sessionStorage.getItem("fixture-grade") ?? 4);
sessionStorage.setItem("fixture-grade", String(grade));
const name = params.get("name") ?? "Pewu Fixture";
const unit = path.match(/^\/student\/units\/([^/]+)$/)?.[1];
const classPage = path.match(/^\/student\/classes\/([^/]+)$/)?.[1];
const timetable = params.get("timetable") !== "none";
createRoot(document.getElementById("root")!).render(<StudentShellV2 identity={{ name, grade, userId: "fixture-student", schoolId: "fixture-school" }}>
  {path === "/student/today" ? <TodayV2 /> : path === "/student/learn" ? <LearnV2 /> : path === "/student/lessons" ? <LessonCatalog />
    : path === "/student/classes" ? <MyClassesView model={myClassesFixture} today={myClassesFixture.today} />
    : classPage ? <ClassDetailView model={classDetailFixture(timetable)} />
    : path === "/student/schedule" ? <ScheduleView model={scheduleFixture(timetable)} view={params.get("view") === "week" ? "week" : "today"} /> : unit ? <UnitOverviewClient unitId={decodeURIComponent(unit)} /> : <main style={{ padding: 24 }}><a href="/student/today">Back to Today</a><h1>{path.includes("assignments") ? "Assignment fixture" : path.includes("labs") ? "Labs destination fixture" : path.includes("progress") ? "Progress destination fixture" : path.includes("signout") ? "Sign-out page fixture" : "Help destination fixture"}</h1><p>Destination routing fixture. This harness does not certify server authorization or the destination screen.</p></main>}
</StudentShellV2>);
