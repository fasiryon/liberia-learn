import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import MoeExportsClient from "./MoeExportsClient";

export default async function MoeExportsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string; isPlatformAdmin?: boolean } | null;

  if (!user?.role) {
    redirect("/moe/login");
  }

  if (user.role !== "MOE_OFFICIAL" && !user.isPlatformAdmin) {
    redirect("/moe/dashboard");
  }

  const [districts, schools] = await Promise.all([
    prisma.school.findMany({
      select: {
        district: true,
        District: { select: { name: true } },
      },
    }),
    prisma.school.findMany({
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const districtOptions = Array.from(
    new Set(
      districts
        .map((school) => school.District?.name ?? school.district)
        .filter((value): value is string => Boolean(value))
    )
  ).sort((left, right) => left.localeCompare(right));

  return (
    <MoeExportsClient
      districts={districtOptions}
      schools={schools}
    />
  );
}
