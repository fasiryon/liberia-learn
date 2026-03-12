import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CredentialCardPage({ searchParams }: PageProps) {
  const admin = await requireRole("ADMIN");
  const params = await searchParams;
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;
  const pin = Array.isArray(params.pin) ? params.pin[0] : params.pin;

  if (!admin.schoolId || !userId || !pin) {
    redirect("/admin");
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, schoolId: admin.schoolId, role: { in: ["STUDENT", "TEACHER"] } },
    select: {
      name: true,
      email: true,
      loginId: true,
      role: true,
      school: { select: { name: true } },
    },
  });

  if (!user) {
    redirect("/admin");
  }

  const schoolName = user.school?.name ?? "LiberiaLearn";
  const loginId = user.loginId ?? user.email;
  const roleLabel = user.role === "TEACHER" ? "Teacher" : "Student";

  return (
    <main className="min-h-screen bg-white p-4 text-slate-950 print:p-0">
      <script dangerouslySetInnerHTML={{ __html: "window.print();" }} />
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body { margin: 0; }
        }
      `}</style>
      <div className="mx-auto grid max-w-[210mm] grid-cols-1 gap-4 md:grid-cols-2 print:grid-cols-2">
        <CredentialCard schoolName={schoolName} name={user.name ?? user.email} loginId={loginId} pin={pin} roleLabel={roleLabel} />
        <CredentialCard schoolName={schoolName} name={user.name ?? user.email} loginId={loginId} pin={pin} roleLabel={roleLabel} />
      </div>
    </main>
  );
}

function CredentialCard(input: { schoolName: string; name: string; loginId: string; pin: string; roleLabel: string }) {
  return (
    <section className="flex min-h-[132mm] flex-col justify-between rounded-3xl border-2 border-slate-900 p-8">
      <div>
        <p className="text-2xl font-bold">LiberiaLearn</p>
        <p className="mt-1 text-lg font-semibold">{input.schoolName}</p>
      </div>
      <div className="space-y-3 text-lg">
        <p><span className="font-semibold">Name:</span> {input.name}</p>
        <p><span className="font-semibold">ID:</span> {input.loginId}</p>
        <p className="text-3xl font-black tracking-[0.2em]"><span className="mr-3 text-lg font-semibold tracking-normal">PIN:</span>{input.pin}</p>
      </div>
      <div className="space-y-1 text-lg">
        <p className="font-semibold">Go to:</p>
        <p className="font-bold">liberialearn.edu.lr</p>
        <p>Select {input.roleLabel}</p>
        <p>Enter your ID and PIN</p>
      </div>
    </section>
  );
}

