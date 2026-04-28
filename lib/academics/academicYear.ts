import { prisma } from "@/lib/db";
import {
  createAcademicYearForSchool,
  activateAcademicYearForSchool,
  listAcademicYearsForSchool,
  createAcademicYearSchema,
} from "@/lib/records/systemOfRecord";
import type { z } from "zod";

export { createAcademicYearSchema };

export async function getActiveAcademicYear(schoolId: string) {
  return prisma.academicYear.findFirst({
    where: { schoolId, isActive: true },
    include: { terms: { orderBy: { startDate: "asc" } } },
  });
}

export async function createAcademicYear(
  schoolId: string,
  input: z.infer<typeof createAcademicYearSchema>
) {
  return createAcademicYearForSchool(schoolId, input);
}

export async function setActiveAcademicYear(schoolId: string, academicYearId: string) {
  return activateAcademicYearForSchool(schoolId, academicYearId);
}

export { listAcademicYearsForSchool };
