import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { requireP2bEnabled, reviewApiError } from "@/lib/curriculum/review/api";
import { reviewEligibility } from "@/lib/curriculum/review/eligibility";

const Slot = z.enum(["FIRST", "SECOND", "RESOLVER", "EMERGENCY_REVOCATION"]);

export async function GET(req: Request, { params }: { params: { taskId: string } }) {
  try {
    requireP2bEnabled();
    const user = await requireUser();
    const slot = Slot.parse(new URL(req.url).searchParams.get("slot") ?? "FIRST");
    return Response.json(await reviewEligibility({ user, taskId: params.taskId, slot }));
  } catch (error) { return reviewApiError(error); }
}
