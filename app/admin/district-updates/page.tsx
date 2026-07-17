import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import DistrictUpdatesClient from "./DistrictUpdatesClient";

export const dynamic = "force-dynamic";

export default async function AdminDistrictUpdatesPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN" && !user.isPlatformAdmin) {
    redirect("/admin");
  }

  const [districtRows, schools, classes] = await Promise.all([
    prisma.school.findMany({ where: { district: { not: null } }, select: { district: true }, distinct: ["district"] }),
    prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.class.findMany({ select: { id: true, name: true, schoolId: true }, orderBy: { name: "asc" } }),
  ]);
  const districts = districtRows.map((d) => d.district as string).sort((a, b) => a.localeCompare(b));

  return (
    <DistrictUpdatesClient
      isPlatformAdmin={Boolean(user.isPlatformAdmin)}
      districts={districts}
      schools={schools}
      classes={classes}
    />
  );
}
