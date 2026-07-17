import { prisma } from "@/lib/db";

export type DistrictUpdateFilter = { type?: "standings" | "milestone" };

export interface DistrictUpdateCaller {
  isPlatformAdmin: boolean;
  schoolId: string | null;
}

/**
 * Tenant scoping for DistrictUpdateDraft, same discipline as the 2026-07-16
 * EscalationQueue fix (lib/agents/admin/escalations.ts): a school ADMIN must
 * never see another school's data. Unlike EscalationQueue (which had zero
 * scoping and needed a same-night fix), this is scoped correctly from the
 * start.
 *
 * A school ADMIN sees: their own school's drafts (scope=school,
 * scopeId=their schoolId), their school's classes' drafts (scope=class,
 * scopeId in their school's class ids), and their own DISTRICT's standings
 * narrative (scope=district, scopeId=their school's district) - district
 * league standings are already public information on /league regardless of
 * role, so this is not a tenant-scoping gap the way safeguarding data would
 * be, just a scope filter to keep the list relevant.
 *
 * A true platform admin (isPlatformAdmin: true) sees everything.
 */
async function scopedWhere(caller: DistrictUpdateCaller) {
  if (caller.isPlatformAdmin) return {};
  if (!caller.schoolId) return { id: "__no_access__" };

  const school = await prisma.school.findUnique({
    where: { id: caller.schoolId },
    select: { district: true },
  });
  const classIds = (
    await prisma.class.findMany({ where: { schoolId: caller.schoolId }, select: { id: true } })
  ).map((c) => c.id);

  return {
    OR: [
      { scope: "school", scopeId: caller.schoolId },
      { scope: "class", scopeId: { in: classIds } },
      ...(school?.district ? [{ scope: "district", scopeId: school.district }] : []),
    ],
  };
}

export async function listDistrictUpdates(caller: DistrictUpdateCaller, filter: DistrictUpdateFilter = {}) {
  const where = await scopedWhere(caller);
  return prisma.districtUpdateDraft.findMany({
    where: { ...where, ...(filter.type ? { type: filter.type } : {}) },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      type: true,
      scope: true,
      scopeId: true,
      status: true,
      createdAt: true,
    },
  });
}

export async function getDistrictUpdateIfVisible(caller: DistrictUpdateCaller, id: string) {
  const where = await scopedWhere(caller);
  return prisma.districtUpdateDraft.findFirst({ where: { ...where, id } });
}
