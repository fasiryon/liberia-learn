import { prisma } from "@/lib/db";

const DEFAULTS = {
  primaryHex: "#10b981",
  secondaryHex: "#8b5cf6",
  accentHex: "#10b981",
  logoUrl: null as string | null,
  motto: null as string | null,
};

export async function getSchoolBranding(schoolId: string | null) {
  if (!schoolId) return DEFAULTS;
  const school = await prisma.school.findUnique({
    where: { id: schoolId },
    select: {
      primaryHex: true,
      secondaryHex: true,
      accentHex: true,
      logoUrl: true,
      motto: true,
    },
  });
  if (!school) return DEFAULTS;
  return {
    primaryHex: school.primaryHex || DEFAULTS.primaryHex,
    secondaryHex: school.secondaryHex || DEFAULTS.secondaryHex,
    accentHex: school.accentHex || DEFAULTS.accentHex,
    logoUrl: school.logoUrl || null,
    motto: school.motto || null,
  };
}
