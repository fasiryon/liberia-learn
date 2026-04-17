"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { teacherWelcomeStorageKey } from "@/app/teacher/TeacherWelcomeGate";
import { DashboardTopBar } from "@/components/DashboardTopBar";

type DashboardData = {
  scheduledToday: number;
  completionRateToday: number;
  assignmentsPendingGrading: number;
  labsPendingReview: number;
  classPerformance: Array<{
    classId: string;
    className: string;
    subject: string;
    studentCount: number;
    lessonCount: number;
    lessonCompletionRate: number;
    averageQuizScore: number | null;
    lessonQuizPerformance: Array<{
      lessonKey: string;
      lessonTitle: string;
      averageQuizScore: number;
      attemptCount: number;
    }>;
    strugglingLesson: {
      lessonKey: string;
      lessonTitle: string;
      averageQuizScore: number;
      attemptCount: number;
    } | null;
    topStudents: Array<{
      studentId: string;
      userId: string;
      name: string;
      averageQuizScore: number;
      attemptCount: number;
      profileHref: string;
    }>;
    bottomStudents: Array<{
      studentId: string;
      userId: string;
      name: string;
      averageQuizScore: number;
      attemptCount: number;
      profileHref: string;
    }>;
    atRiskStudents: Array<{
      studentId: string;
      userId: string;
      name: string;
      classId: string;
      className: string;
      lastActivityAt: string | null;
      daysSinceActivity: number;
      profileHref: string;
    }>;
  }>;
  adaptiveStats: {
    studentsWithGaps: number;
    totalGapsDetected: number;
    avgMasteryScore: number;
    topWeakStrands: string[];
  };
  todayLessons: Array<{
    id: string;
    title: string;
    className: string;
    teacherName: string;
    durationMinutes: number;
    status: string;
    startedCount: number;
    completedCount: number;
    averageExitTicketScore: number | null;
  }>;
  recentLessons: Array<{ contentId: string; title: string; status: string; createdAt: string }>;
  classesWithoutLesson: string[];
  schoolCode: string | null;
  schoolName: string | null;
};

export default function TeacherDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [insightState, setInsightState] = useState<
    Record<
      string,
      {
        loading: boolean;
        error: string | null;
        result: null | {
          recommendations: string[];
          strugglingLesson: string;
          reteachApproach: string;
          hadFallback: boolean;
        };
      }
    >
  >({});
  const adaptiveEnabled = process.env.NEXT_PUBLIC_ENABLE_ADAPTIVE_ENGINE !== "false";
  const [codeCopied, setCodeCopied] = useState(false);

  function copySchoolCode() {
    const code = data?.schoolCode;
    if (!code) return;
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(teacherWelcomeStorageKey, "true");
    }
    fetch("/api/teacher/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .finally(() => setLoading(false));
  }, []);

  async function handleClassInsights(classId: string) {
    setInsightState((current) => ({
      ...current,
      [classId]: { loading: true, error: null, result: current[classId]?.result ?? null },
    }));

    try {
      const response = await fetch("/api/teacher/class-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load class insights.");
      }

      setInsightState((current) => ({
        ...current,
        [classId]: { loading: false, error: null, result: payload },
      }));
    } catch (error: any) {
      setInsightState((current) => ({
        ...current,
        [classId]: {
          loading: false,
          error: error?.message ?? "Failed to load class insights.",
          result: current[classId]?.result ?? null,
        },
      }));
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-4 py-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Consistent top bar */}
        <DashboardTopBar
          roleLabel="Teacher"
          roleBadgeBg="bg-blue-500"
          roleAccent="text-blue-300"
          userName={data?.schoolName ?? undefined}
          subtitle={data?.schoolCode ? `Code: ${data.schoolCode}` : undefined}
        />

        {/* Greeting */}
        <div>
          <h1 className="text-2xl font-bold">Good morning.</h1>
          <p className="mt-1 text-sm text-slate-400">
            {new Date().toLocaleDateString("en-LR", { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-slate-800/50 animate-pulse" />)}</div>
        ) : (
          <>
            {/* Alert banner */}
            {data?.classesWithoutLesson && data.classesWithoutLesson.length > 0 && (
              <div className="rounded-xl bg-amber-500/20 border border-amber-500/30 px-4 py-3 text-sm text-amber-300">
                {data.classesWithoutLesson.length} class(es) have no lesson scheduled for today: {data.classesWithoutLesson.join(", ")}
              </div>
            )}

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
                <p className="text-2xl font-bold text-blue-400">{data?.scheduledToday || 0}</p>
                <p className="text-xs text-slate-400">Lessons today</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
                <p className="text-2xl font-bold text-emerald-400">{data?.completionRateToday || 0}%</p>
                <p className="text-xs text-slate-400">Completion rate</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
                <p className="text-2xl font-bold text-amber-400">{data?.assignmentsPendingGrading || 0}</p>
                <p className="text-xs text-slate-400">Pending grading</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-center">
                <p className="text-2xl font-bold text-cyan-400">{data?.labsPendingReview || 0}</p>
                <p className="text-xs text-slate-400">Labs to review</p>
              </div>
            </div>

            {/* Primary Actions — above fold */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Link href="/teacher/students" className="flex flex-col gap-1 rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 hover:bg-blue-500/20">
                <p className="text-sm font-bold text-blue-300">View my classes</p>
              </Link>
              <Link href="/teacher/assignments" className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-slate-900/70 p-4 hover:border-blue-500/30">
                <p className="text-sm font-bold text-slate-100">Grade assignments</p>
              </Link>
              <Link href="/teacher/schedule" className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-slate-900/70 p-4 hover:border-blue-500/30">
                <p className="text-sm font-bold text-slate-100">Lesson planner</p>
              </Link>
              <Link href="/teacher/weekly-report" className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-slate-900/70 p-4 hover:border-blue-500/30">
                <p className="text-sm font-bold text-slate-100">Weekly report</p>
              </Link>
            </div>

            {/* School registration code */}
            {data?.schoolCode && (
              <section className="rounded-3xl border border-emerald-500/30 bg-emerald-950/20 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-emerald-400">School registration code</p>
                    <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-slate-50">{data.schoolCode}</p>
                    <p className="mt-1 text-xs text-slate-400">Share this code so students and guardians can self-register.</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={copySchoolCode}
                      className="rounded-xl border border-emerald-500/40 bg-emerald-900/40 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/60"
                    >
                      {codeCopied ? "Copied!" : "Copy code"}
                    </button>
                    <a
                      href={`/register/student?code=${encodeURIComponent(data.schoolCode)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-xl border border-slate-600/40 bg-slate-900/60 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800"
                    >
                      Shareable link
                    </a>
                  </div>
                </div>
              </section>
            )}


            {adaptiveEnabled && (
              <section className="rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-slate-900/80 p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-slate-100">Students Needing Extra Support</h2>
                    <p className="mt-1 text-sm text-slate-300">Use this section first when deciding who needs intervention today.</p>
                  </div>
                  <span className="text-xs text-emerald-300">Closed-loop mastery</span>
                </div>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="rounded-xl bg-slate-950/50 p-4">
                    <p className="text-2xl font-bold text-emerald-400">
                      {data?.adaptiveStats?.studentsWithGaps ?? 0}
                    </p>
                    <p className="text-sm text-slate-300">Students with gaps</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/50 p-4">
                    <p className="text-2xl font-bold text-amber-300">
                      {data?.adaptiveStats?.totalGapsDetected ?? 0}
                    </p>
                    <p className="text-sm text-slate-300">Total gaps detected</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/50 p-4">
                    <p className="text-2xl font-bold text-cyan-300">
                      {data?.adaptiveStats?.avgMasteryScore ?? 0}
                    </p>
                    <p className="text-sm text-slate-300">Average mastery score</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Top weak strands
                    </p>
                    <ul className="mt-2 space-y-1 text-sm text-slate-200">
                      {(data?.adaptiveStats?.topWeakStrands?.length ?? 0) === 0 ? (
                        <li className="text-slate-500">No adaptive attempts yet.</li>
                      ) : (
                        data?.adaptiveStats?.topWeakStrands?.map((strand) => (
                          <li key={strand}>{strand}</li>
                        ))
                      )}
                    </ul>
                  </div>
                </div>
              </section>
            )}

            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-slate-100">Class Performance Intelligence</h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Lesson completion, lesson quiz performance, and students who have had no lesson or quiz activity for 7 or more days.
                  </p>
                </div>
                <Link href="/teacher/weekly-report" className="text-xs text-emerald-300 hover:text-emerald-200">
                  Open weekly report
                </Link>
              </div>

              {(!data?.classPerformance || data.classPerformance.length === 0) ? (
                <p className="mt-4 text-sm text-slate-500">No class performance data yet.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  {data.classPerformance.map((cls) => {
                    const insights = insightState[cls.classId];
                    return (
                      <article key={cls.classId} className="rounded-3xl border border-slate-800 bg-slate-950/60 p-4 sm:p-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-base font-semibold text-slate-100">{cls.className}</h3>
                            <p className="mt-1 text-xs text-slate-400">
                              {cls.subject.replace(/_/g, " ")} · {cls.studentCount} students · {cls.lessonCount} lessons
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleClassInsights(cls.classId)}
                            className="min-h-11 rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-100 hover:border-cyan-300/50 hover:bg-cyan-400/15"
                          >
                            {insights?.loading ? "Loading insights..." : "AI Class Insights"}
                          </button>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-3">
                          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                            <p className="text-xs text-slate-400">Lesson completion</p>
                            <p className="mt-2 text-2xl font-semibold text-emerald-300">{cls.lessonCompletionRate}%</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                            <p className="text-xs text-slate-400">Average quiz score</p>
                            <p className="mt-2 text-2xl font-semibold text-cyan-300">
                              {cls.averageQuizScore == null ? "No data" : `${cls.averageQuizScore}%`}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                            <p className="text-xs text-slate-400">At-risk students</p>
                            <p className="mt-2 text-2xl font-semibold text-amber-300">{cls.atRiskStudents.length}</p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Lesson quiz averages</p>
                            {cls.lessonQuizPerformance.length === 0 ? (
                              <p className="mt-3 text-sm text-slate-500">No lesson quizzes completed yet.</p>
                            ) : (
                              <div className="mt-3 space-y-3">
                                {cls.lessonQuizPerformance.slice(0, 4).map((lesson) => (
                                  <div key={lesson.lessonKey} className="rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <p className="text-sm font-medium text-slate-100">{lesson.lessonTitle}</p>
                                      <span className="text-sm font-semibold text-cyan-300">{lesson.averageQuizScore}%</span>
                                    </div>
                                    <p className="mt-1 text-xs text-slate-500">{lesson.attemptCount} quiz attempt(s)</p>
                                  </div>
                                ))}
                              </div>
                            )}
                            {cls.strugglingLesson ? (
                              <p className="mt-3 text-xs text-amber-300">
                                Lowest-performing lesson: {cls.strugglingLesson.lessonTitle}
                              </p>
                            ) : null}
                          </section>

                          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">At-risk students</p>
                            {cls.atRiskStudents.length === 0 ? (
                              <p className="mt-3 text-sm text-slate-500">No students are currently past the 7-day inactivity mark.</p>
                            ) : (
                              <div className="mt-3 space-y-2">
                                {cls.atRiskStudents.slice(0, 5).map((student) => (
                                  <Link
                                    key={student.studentId}
                                    href={student.profileHref}
                                    className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/60 px-4 py-3 hover:border-amber-400/40"
                                  >
                                    <div>
                                      <p className="text-sm font-medium text-slate-100">{student.name}</p>
                                      <p className="mt-1 text-xs text-slate-500">
                                        {student.lastActivityAt
                                          ? `Last activity ${new Date(student.lastActivityAt).toLocaleDateString("en-LR")}`
                                          : "No lesson or quiz activity yet"}
                                      </p>
                                    </div>
                                    <span className="text-xs font-semibold text-amber-300">
                                      {student.daysSinceActivity >= 999 ? "No activity" : `${student.daysSinceActivity} days`}
                                    </span>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </section>
                        </div>

                        <div className="mt-4 grid gap-4 lg:grid-cols-2">
                          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Top 3 students</p>
                            {cls.topStudents.length === 0 ? (
                              <p className="mt-3 text-sm text-slate-500">No quiz ranking data yet.</p>
                            ) : (
                              <div className="mt-3 space-y-2">
                                {cls.topStudents.map((student) => (
                                  <Link key={student.studentId} href={student.profileHref} className="flex items-center justify-between rounded-2xl bg-slate-950/60 px-4 py-3 hover:border hover:border-emerald-400/30">
                                    <span className="text-sm text-slate-100">{student.name}</span>
                                    <span className="text-sm font-semibold text-emerald-300">{student.averageQuizScore}%</span>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </section>

                          <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Bottom 3 students</p>
                            {cls.bottomStudents.length === 0 ? (
                              <p className="mt-3 text-sm text-slate-500">No quiz ranking data yet.</p>
                            ) : (
                              <div className="mt-3 space-y-2">
                                {cls.bottomStudents.map((student) => (
                                  <Link key={student.studentId} href={student.profileHref} className="flex items-center justify-between rounded-2xl bg-slate-950/60 px-4 py-3 hover:border hover:border-amber-400/30">
                                    <span className="text-sm text-slate-100">{student.name}</span>
                                    <span className="text-sm font-semibold text-amber-300">{student.averageQuizScore}%</span>
                                  </Link>
                                ))}
                              </div>
                            )}
                          </section>
                        </div>

                        {insights?.error ? (
                          <div className="mt-4 rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                            {insights.error}
                          </div>
                        ) : null}

                        {insights?.result ? (
                          <section className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-200">AI class insights</p>
                            <div className="mt-3 space-y-2 text-sm text-slate-100">
                              {insights.result.recommendations.map((recommendation, index) => (
                                <p key={`${cls.classId}-insight-${index}`}>{index + 1}. {recommendation}</p>
                              ))}
                            </div>
                            <p className="mt-3 text-sm text-slate-100">
                              <span className="font-semibold text-cyan-100">Most difficult lesson:</span> {insights.result.strugglingLesson}
                            </p>
                            <p className="mt-2 text-sm text-slate-100">
                              <span className="font-semibold text-cyan-100">Reteach approach:</span> {insights.result.reteachApproach}
                            </p>
                            {insights.result.hadFallback ? (
                              <p className="mt-2 text-xs text-amber-300">Fallback guidance was used for this response.</p>
                            ) : null}
                          </section>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>


            <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-300">Today&apos;s Scheduled Lessons</h2>
                <Link href="/teacher/schedule" className="text-xs text-emerald-300 hover:text-emerald-200">
                  Open Schedule
                </Link>
              </div>
              {(!data?.todayLessons || data.todayLessons.length === 0) ? (
                <p className="text-xs text-slate-500">No lessons scheduled for today.</p>
              ) : (
                <div className="space-y-3">
                  {data.todayLessons.map((lesson) => (
                    <div key={lesson.id} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-100">{lesson.title}</p>
                          <p className="mt-1 text-xs text-slate-400">
                            {lesson.className} · {lesson.teacherName} · {lesson.durationMinutes}-minute{" "}
                            {lesson.durationMinutes >= 90 ? "block" : "period"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            lesson.status === "delivered"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {lesson.status}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                        <div className="rounded-xl bg-slate-900/70 p-3">
                          <p className="text-lg font-semibold text-slate-100">{lesson.startedCount}</p>
                          <p className="text-[11px] text-slate-500">Started</p>
                        </div>
                        <div className="rounded-xl bg-slate-900/70 p-3">
                          <p className="text-lg font-semibold text-slate-100">{lesson.completedCount}</p>
                          <p className="text-[11px] text-slate-500">Completed</p>
                        </div>
                        <div className="rounded-xl bg-slate-900/70 p-3">
                          <p className="text-lg font-semibold text-slate-100">
                            {lesson.averageExitTicketScore ?? "—"}
                          </p>
                          <p className="text-[11px] text-slate-500">Avg exit ticket</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Recent lessons */}
            <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <h2 className="text-sm font-semibold text-slate-300 mb-3">Recent Published Lessons</h2>
              {(!data?.recentLessons || data.recentLessons.length === 0) ? (
                <p className="text-xs text-slate-500">No published lessons yet. Generate your first lesson!</p>
              ) : (
                <div className="space-y-2">
                  {data.recentLessons.slice(0, 5).map((l) => (
                    <div key={l.contentId} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-2">
                      <div>
                        <p className="text-sm text-slate-200">{l.title}</p>
                        <p className="text-xs text-slate-500">{new Date(l.createdAt).toLocaleDateString()}</p>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${l.status === "APPROVED" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-300"}`}>
                        {l.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
