// route-policy: auth=session; scope=tenant; authority=placement-confirm; rationale=only an ADMIN of the learner's school (PLACEMENT_CONFIRM, role ADMIN; no platform-admin bypass of the school scope) records the official placement decision that sets the learner's grade (AT-GRADE-01-2D)
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { confirmOfficialPlacement } from "@/lib/placementAuthority/decisionService";
import { placementErrorResponse } from "@/lib/placementAuthority/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const body = await req.json().catch(() => ({}));
    return NextResponse.json(await confirmOfficialPlacement(user, params.id, body ?? {}));
  } catch (error) {
    return placementErrorResponse(error);
  }
}
