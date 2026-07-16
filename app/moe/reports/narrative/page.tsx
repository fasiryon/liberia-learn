import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import NarrativeReportsClient from "./NarrativeReportsClient";

export default async function MoeNarrativeReportsPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string; isPlatformAdmin?: boolean } | null;

  if (!user?.role) {
    redirect("/moe/login");
  }

  if (user.role !== "MOE_OFFICIAL" && !user.isPlatformAdmin) {
    redirect("/moe/dashboard");
  }

  const [districts, schools] = await Promise.all([
    prisma.district.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.school.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <NarrativeReportsClient
      districts={districts}
      schools={schools}
      isPlatformAdmin={Boolean(user.isPlatformAdmin)}
    />
  );
}
