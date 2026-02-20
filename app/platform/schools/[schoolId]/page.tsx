import { notFound } from "next/navigation";
import Link from "next/link";
import { requirePlatformAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PlatformSchoolDetailPage({
  params,
}: {
  params: { schoolId: string };
}) {
  await requirePlatformAdmin();

  const school = await prisma.school.findUnique({
    where: { id: params.schoolId },
    select: {
      id: true,
      name: true,
      status: true,
      county: true,
      district: true,
      pilotStatus: true,
      pilotCohort: true,
      pilotStartDate: true,
      pilotNotes: true,
      onboardingStep: true,
      contactEmailVerified: true,
      contactPhoneVerified: true,
      createdAt: true,
    },
  });

  if (!school) return notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/platform/schools" className="text-sm text-emerald-300 hover:text-emerald-200">
          &larr; Back to Schools
        </Link>
        <h1 className="text-2xl font-bold mt-2">{school.name}</h1>
        <p className="text-sm text-slate-400">
          School profile and pilot status details.
        </p>
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-900/70 p-6">
        <dl className="grid gap-4 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Status</dt>
            <dd className="text-slate-100">{school.status}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">County</dt>
            <dd className="text-slate-100">{school.county ?? "--"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">District</dt>
            <dd className="text-slate-100">{school.district ?? "--"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Onboarding Step</dt>
            <dd className="text-slate-100">{school.onboardingStep ?? 0}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Pilot Status</dt>
            <dd className="text-slate-100">{school.pilotStatus ?? "--"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Pilot Cohort</dt>
            <dd className="text-slate-100">{school.pilotCohort ?? "--"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Pilot Start Date</dt>
            <dd className="text-slate-100">
              {school.pilotStartDate ? school.pilotStartDate.toISOString().slice(0, 10) : "--"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Contact Email Verified</dt>
            <dd className="text-slate-100">{school.contactEmailVerified ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Contact Phone Verified</dt>
            <dd className="text-slate-100">{school.contactPhoneVerified ? "Yes" : "No"}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Created</dt>
            <dd className="text-slate-100">
              {school.createdAt.toISOString().slice(0, 10)}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs text-slate-500">Pilot Notes</dt>
            <dd className="text-slate-100">{school.pilotNotes ?? "--"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
