import { notFound } from "next/navigation";
import { findLabExperience, isCertifiedStudentLab } from "@/lib/learner-experience/labExperience";

/** Static legacy routes must obey the same certification boundary as Library. A feature flag is insufficient. */
export function requireCertifiedStudentLab(labId: string) {
  const lab = findLabExperience(labId);
  if (!lab || !isCertifiedStudentLab(lab)) notFound();
}
