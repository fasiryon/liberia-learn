// app/student/homework/page.tsx
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export default async function StudentHomeworkList() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "STUDENT") {
    redirect("/login");
  }

  const userId = (session.user as any).id;

  const student = await prisma.student.findUnique({
    where: { userId },
  });

  if (!student) {
    return <div className="p-6 text-red-500">Student not found.</div>;
  }

  // For now we just show ALL homework in the system.
  // Later, you can filter by the student's classes.
  const allHomework = await prisma.homework.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50">
      <div className="mx-auto max-w-3xl space-y-6">
        <h1 className="text-2xl font-bold">Your Homework</h1>

        <div className="space-y-3">
          {allHomework.length === 0 ? (
            <p className="text-sm text-slate-400">
              No homework assigned yet.
            </p>
          ) : (
            allHomework.map((hw: any) => (
              <Link
                key={hw.id}
                href={`/student/homework/${hw.id}`}
                className="block rounded-xl border border-slate-800 bg-slate-900/70 p-4 hover:border-emerald-500/30"
              >
                <p className="text-lg font-medium">{hw.title}</p>
                <p className="text-sm text-slate-400">
                  {new Date(hw.createdAt).toLocaleDateString()}
                </p>
              </Link>
            ))
          )}
        </div>
      </div>
    </main>
  );
}
