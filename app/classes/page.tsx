// app/classes/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type AppSession = {
  user?: {
    id?: string;
    role?: "STUDENT" | "TEACHER" | "ADMIN" | string;
    email?: string | null;
    name?: string | null;
  };
};

export default async function ClassesPage() {
  const rawSession = await getServerSession(authOptions);
  const session = rawSession as AppSession | null;

  if (!session?.user?.id) redirect("/login");

  const role = session.user.role;
  const userId = session.user.id as string;

  if (role === "TEACHER") redirect("/teacher");
  if (role === "ADMIN") redirect("/admin");

  const student = await prisma.student.findFirst({
    where: { userId },
    include: {
      user: true,
      enrollments: {
        include: {
          Class: {
            include: {
              School: true,
              Teacher: true,
              homework: true,
            },
          },
        },
      },
    },
  });

  if (!student) {
    redirect("/");
  }

  const classes = student.enrollments.map((e) => e.Class);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_#22c55e22,_transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-emerald-300">
              LiberiaLearn
            </p>
            <h1 className="text-2xl font-semibold">Your classes</h1>
            <p className="text-xs text-slate-400">
              These are the classes you are currently enrolled in.
            </p>
          </div>

          <Link
            href="/"
            className="rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-300 hover:bg-slate-900"
          >
            ← Back to dashboard
          </Link>
        </header>

        {/* Classes list */}
        {classes.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-10 text-center text-sm text-slate-400">
            No classes found. Contact your school if this seems wrong.
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {classes.map((cls) => (
              <div
                key={cls.id}
                className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 flex flex-col justify-between"
              >
                <div>
                  <h2 className="text-lg font-semibold text-slate-50">
                    {cls.name}
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    {cls.subject} · {cls.School?.name || "School"}
                  </p>
                  {cls.Teacher && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      Teacher: {cls.Teacher.name}
                    </p>
                  )}
                </div>

                <div className="mt-4 flex gap-2 text-xs">
                  <Link
                    href="/assignments"
                    className="rounded-lg bg-emerald-500 px-3 py-2 font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    View homework
                  </Link>
                  <Link
                    href="/progress"
                    className="rounded-lg border border-slate-700 px-3 py-2 font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    View progress
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
