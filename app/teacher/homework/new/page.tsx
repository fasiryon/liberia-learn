// app/teacher/homework/new/page.tsx
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import NewHomeworkForm from "./NewHomeworkForm";

export default async function NewHomeworkPage() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "TEACHER") {
    redirect("/login");
  }

  const teacherId = (session.user as any).id as string;

  // Classes this teacher owns
  const classes = await prisma.class.findMany({
    where: { teacherId },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

  if (classes.length === 0) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-slate-50">
        <div className="max-w-2xl mx-auto space-y-4">
          <h1 className="text-2xl font-bold">Create Homework</h1>
          <p className="text-sm text-slate-400">
            You don&apos;t have any classes yet. Once classes exist, you&apos;ll
            be able to create homework for them here.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-50">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold">Create Homework</h1>
        <NewHomeworkForm classes={classes} />
      </div>
    </main>
  );
}
