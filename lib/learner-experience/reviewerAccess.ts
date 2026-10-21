import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { assertReviewReadScope } from "@/lib/curriculum/review/access";
import { isLearnerExperiencePrototypeEnabled } from "./prototypeRoute";

/** National, unassigned draft packages use the existing national review read scope. */
export async function requireCandidateReviewer() {
  if (!isLearnerExperiencePrototypeEnabled(process.env)) notFound();
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || typeof session.user.role !== "string") notFound();
  try { assertReviewReadScope({ ...session.user, role: session.user.role }, null); } catch { notFound(); }
  return session.user;
}
