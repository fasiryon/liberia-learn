import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateLiveToken } from "@/lib/moe/liveToken";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string; isPlatformAdmin?: boolean } | null;

  const authorized =
    user?.role === "MOE_OFFICIAL" ||
    user?.role === "MOE_SUPER_ADMIN" ||
    user?.isPlatformAdmin === true;

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { token, expiresAt } = generateLiveToken();
  const url = `/moe/live?token=${token}`;
  return NextResponse.json({ token, expiresAt, url });
}
