// route-policy: auth=session; scope=national; authority=elevated; rationale=display tokens are not issued until a governed kiosk credential is approved
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Retired: the MOE live display stays behind an authenticated MOE session
// until a governed kiosk/display credential is separately approved.
export async function GET() {
  return NextResponse.json(
    { error: "Live display tokens are not issued. Sign in with an MOE account.", code: "live_token_retired" },
    { status: 410 }
  );
}
