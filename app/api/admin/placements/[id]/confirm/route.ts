// route-policy: auth=session; scope=tenant; authority=placement-confirm; rationale=only the school placement authority records the official placement decision that sets the learner's grade
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
