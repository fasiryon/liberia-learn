import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { isP2bReviewOperationsEnabled } from "@/lib/serverFlags";
import { assertReviewOperationsAdmin } from "@/lib/curriculum/review/access";
import { getCredentialCoverageReport, getQueueOperationsReport, getReviewerQualityReport } from "@/lib/curriculum/review/reporting";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function ReviewOperationsPage() {
  if (!isP2bReviewOperationsEnabled()) notFound();
  const user = await requireUser();
  assertReviewOperationsAdmin(user, user.schoolId);
  const schoolId = user.isPlatformAdmin || user.role === "MOE_SUPER_ADMIN" ? undefined : user.schoolId;
  const [queue, quality, coverage, reviewers, calibration] = await Promise.all([
    getQueueOperationsReport(schoolId), getReviewerQualityReport(), getCredentialCoverageReport(),
    prisma.reviewerProfile.findMany({ where: schoolId === undefined ? {} : { schoolId }, include: { user: true, credentials: { include: { scopes: true } }, restrictions: true } }),
    prisma.reviewCalibrationSession.findMany({ include: { results: true }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return <main className="mx-auto max-w-7xl space-y-6 p-6"><div><h1 className="text-2xl font-semibold">Review operations</h1><p className="text-sm text-slate-600">Operational metrics are diagnostic and are not a reviewer leaderboard.</p></div><section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Object.entries({ "Open tasks": queue.openVolume, "Age p90 hours": queue.ageP90Hours, "SLA breached": queue.slaBreached, "Active claims": queue.activeClaims }).map(([label, value]) => <div key={label} className="rounded border bg-white p-4"><div className="text-sm text-slate-500">{label}</div><div className="text-2xl font-semibold">{value ?? "n/a"}</div></div>)}</section><section className="rounded border bg-white p-4"><h2 className="mb-3 font-semibold">Reviewer roster and credentials</h2><div className="space-y-3">{reviewers.map((reviewer) => <div className="rounded border p-3" key={reviewer.id}><div className="font-medium">{reviewer.user.name ?? reviewer.user.email} <span className="text-sm text-slate-500">{reviewer.status}, {reviewer.authority}</span></div><div className="text-sm">Capacity {reviewer.maxActiveClaims}, available {String(reviewer.available)}</div><ul className="mt-2 list-disc pl-5 text-sm">{reviewer.credentials.map((credential) => <li key={credential.id}>{credential.credentialType}, {credential.status}, {credential.issuer}, {credential.scopes.length} scope(s)</li>)}</ul></div>)}</div></section><section className="rounded border bg-white p-4"><h2 className="font-semibold">Credential coverage</h2><p className="text-sm">Verified scope sample size: {coverage.sampleSize}</p><div className="mt-2 max-h-64 overflow-auto text-sm">{coverage.coverage.map((item, index) => <div className="border-t py-2" key={`${item.credentialType}-${index}`}>{item.credentialType}: {item.subject ?? "all subjects"}, grades {item.gradeMin ?? "all"}-{item.gradeMax ?? "all"}, {item.authority}</div>)}</div></section><section className="rounded border bg-white p-4"><h2 className="font-semibold">Quality and calibration</h2><p className="text-sm">Comparable assessment sample: {quality.sampleSize}. {quality.interpretation}</p><p className="text-sm">Agreement: {quality.metrics?.agreementRate == null ? "insufficient data" : `${Math.round(quality.metrics.agreementRate * 100)}%`}</p><h3 className="mt-4 font-medium">Calibration sessions</h3>{calibration.map((session) => <div className="border-t py-2 text-sm" key={session.id}>{session.name}: {session.status}, {session.results.length} result(s)</div>)}</section></main>;
}
